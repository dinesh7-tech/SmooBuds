import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase, createAuthClient } from "./supabase";


// 1. Zod Validation Schemas
const statusUpdateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["Pending", "Accepted", "Preparing", "Ready", "Served", "Cancelled"]),
});

const menuItemInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  price: z.number().nonnegative(),
  category: z.enum(["Coffee", "Mocktails", "Shakes", "Starters", "Main Course", "Desserts"]),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().default(true),
});

const tableInputSchema = z.object({
  tableNumber: z.number().int().positive(),
  isActive: z.boolean().default(true),
});

const uploadInputSchema = z.object({
  base64File: z.string().min(1, "File is empty"),
  fileName: z.string(),
  contentType: z.string(),
});

const settingsInputSchema = z.object({
  cafeName: z.string().min(2).max(100),
  aboutSection: z.string().max(1000).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  openingHours: z.string().max(100).optional().nullable(),
  closingHours: z.string().max(100).optional().nullable(),
  instagramLink: z.string().url().or(z.literal("")).optional().nullable(),
  facebookLink: z.string().url().or(z.literal("")).optional().nullable(),
  orderingEnabled: z.boolean().default(true),
  acceptNewOrders: z.boolean().default(true),
  autoRefreshInterval: z.number().int().min(5).max(300).default(30),
  qrTableCount: z.number().int().min(1).max(100).default(10),
  logoUrl: z.string().url().or(z.literal("")).optional().nullable(),
  themeColor: z.string().max(20).default("#4A5D23"),
});

import { hasPermission, type Permission } from "./permissions";

// Helper to safely extract session_id from JWT payload
function extractSessionId(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.session_id || null;
  } catch (e) {
    console.warn("Failed to extract session_id");
    return null;
  }
}

// Helper: Verify User and Permissions (RBAC)
async function verifyPermission(
  authHeader: string | null,
  requiredPermission: Permission
): Promise<{ userId: string; role: string; email: string }> {
  if (!authHeader) {
    throw new Error("Missing authorization header.");
  }
  
  // Extract token from bearer header
  const token = authHeader.replace("Bearer ", "").trim();
  
  const authClient = createAuthClient(token);
  
  // Verify JWT session with Supabase
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Unauthorized. Invalid session token.");
  }

  const sessionId = extractSessionId(token);

  if (sessionId) {
    try {
      console.log("SUPABASE_QUERY_STARTED", "verify_active_session");
      const { data: isSessionValid, error: sessionError } = await authClient.rpc("verify_active_session", {
        p_user_id: user.id,
        p_session_id: sessionId
      });
      console.log("SUPABASE_QUERY_FINISHED", "verify_active_session");

      // ONLY throw if explicitly FALSE (ignore null or RPC errors for resilience)
      if (!sessionError && isSessionValid === false) {
        throw new Error("Session has been forcibly logged out.");
      }
    } catch (e) {
      console.warn("Session verification unavailable, proceeding with valid token");
    }
  }

  // Get user role and status using the authenticated client
  console.log("SUPABASE_QUERY_STARTED", "fetch user role and status");
  const { data: roleData, error: roleError } = await authClient
    .from("user_roles")
    .select("role, status, locked_until")
    .eq("user_id", user.id)
    .maybeSingle();
  console.log("SUPABASE_QUERY_FINISHED", "fetch user role and status");

  if (roleError || !roleData) {
    throw new Error(`Forbidden. User does not have an assigned admin role.`);
  }

  // Security Checks
  if (roleData.status === "Pending") throw new Error("Account is pending. Please contact the Owner.");
  if (roleData.status === "Inactive") throw new Error("Account is inactive.");
  if (roleData.status === "Suspended") throw new Error("Account is suspended.");
  if (roleData.locked_until && new Date(roleData.locked_until) > new Date()) {
    throw new Error("Account is temporarily locked due to too many failed attempts.");
  }

  const role = roleData.role;
  if (!hasPermission(role, requiredPermission)) {
    throw new Error(`Forbidden. Required permission '${requiredPermission}' not met for role '${role}'.`);
  }

  return { userId: user.id, role, email: user.email || "" };
}

// Helper: Log audit trail
async function createAuditLog(userId: string, action: string, metadata: any = {}, authClient?: any) {
  try {
    const client = authClient || supabase;
    await client.from("audit_logs").insert({
      user_id: userId,
      action,
      metadata,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// 2. SERVER FUNCTION: Update Order Status
export const updateOrderStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      payload: statusUpdateSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "updateOrderStatusFn");
      const { payload, token } = data;
      
      // RBAC: Verify permission to update order status
      const { userId } = await verifyPermission(`Bearer ${token}`, "Orders.Update");

      // Fetch existing status to prevent illegal transitions (e.g. Served -> Pending)
      console.log("SUPABASE_QUERY_STARTED", "fetch order");
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("status, table_number")
        .eq("id", payload.orderId)
        .single();
      console.log("SUPABASE_QUERY_FINISHED", "fetch order");

      if (fetchError || !order) {
        throw new Error("Order not found.");
      }

      const currentStatus = order.status;
      const statusPriority: Record<string, number> = {
        Pending: 1,
        Accepted: 2,
        Preparing: 3,
        Ready: 4,
        Served: 5,
        Cancelled: 6,
      };

      // Transition checks
      if (payload.status !== "Cancelled" && statusPriority[payload.status] < statusPriority[currentStatus]) {
        throw new Error(`Invalid transition: Cannot go backward from ${currentStatus} to ${payload.status}`);
      }

      if (currentStatus === "Served") {
        throw new Error("Cannot modify an order that has already been served.");
      }

      const authClient = createAuthClient(token);

      console.log("SUPABASE_QUERY_STARTED", "update order");
      const { error: updateError } = await authClient
        .from("orders")
        .update({ status: payload.status })
        .eq("id", payload.orderId);
      console.log("SUPABASE_QUERY_FINISHED", "update order");

      if (updateError) {
        console.log("ACTION_ERROR", updateError);
        console.log("TABLE: orders", "OPERATION: UPDATE");
        throw new Error(`Failed to update status: ${updateError.message}`);
      }

      console.log("SUPABASE_QUERY_STARTED", "insert audit log");
      await createAuditLog(userId, "Order Status Change", {
        orderId: payload.orderId,
        tableNumber: order.table_number,
        from: currentStatus,
        to: payload.status,
      }, authClient);
      console.log("SUPABASE_QUERY_FINISHED", "insert audit log");

      console.log("ACTION_SUCCESS", "updateOrderStatusFn");
      return { success: true };
    } catch (error) {
      console.error("ACTION_ERROR", error);
      throw error;
    } finally {
      console.log("ACTION_FINISHED");
    }
  });

// 3. SERVER FUNCTIONS: Menu Management CRUD
export const saveMenuItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    try {
      return z.object({
        payload: menuItemInputSchema,
        token: z.string(),
      }).parse(data);
    } catch (e: any) {
      console.error("Zod Validation Error in saveMenuItemFn:", e.errors || e.message);
      throw e;
    }
  })
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "saveMenuItemFn");
      const { payload, token } = data;
      console.log("SERVER_ACTION_CALLED payload:", payload.name);
      
      // RBAC: Verify permission to manage menu
      const { userId } = await verifyPermission(`Bearer ${token}`, payload.id ? "Menu.Update" : "Menu.Create");

      const authClient = createAuthClient(token);
      console.log("AUTH_CLIENT_CREATED");
      const isUpdate = !!payload.id;
      let response;

      if (isUpdate) {
        console.log("MENU_UPDATE_STARTED for item:", payload.name);
        
        console.log("SUPABASE_QUERY_STARTED", "fetch existing item");
        const { data: existingItem, error: fetchError } = await authClient
          .from("menu_items")
          .select("price")
          .eq("id", payload.id)
          .single();
        console.log("SUPABASE_QUERY_FINISHED", "fetch existing item");

        if (fetchError) {
          console.error("MENU_DB_ERROR (fetch):", fetchError);
          throw new Error(`[Supabase Error] Failed to fetch existing item: ${fetchError.message}`);
        }

        console.log("SUPABASE_QUERY_STARTED", "update menu_item");
        const { data: updatedItem, error } = await authClient
          .from("menu_items")
          .update({
            name: payload.name,
            description: payload.description,
            price: payload.price,
            category: payload.category,
            image_url: payload.imageUrl,
            is_available: payload.isAvailable,
          })
          .eq("id", payload.id)
          .select()
          .single();
        console.log("SUPABASE_QUERY_FINISHED", "update menu_item");

        if (error) {
          console.log("ACTION_ERROR", error);
          console.log("TABLE: menu_items", "OPERATION: UPDATE");
          console.error("MENU_DB_ERROR (update):", error);
          throw new Error(`[Supabase Error] Failed to update item: ${error.message} | Code: ${error.code}`);
        }
        response = updatedItem;
        console.log("MENU_DB_SUCCESS", "Item updated successfully.");

        const auditData: any = { itemId: payload.id, name: payload.name };
        console.log("SUPABASE_QUERY_STARTED", "insert audit log");
        if (existingItem && existingItem.price !== payload.price) {
          auditData.priceChange = { from: existingItem.price, to: payload.price };
          await createAuditLog(userId, "Price Change", auditData, authClient);
        } else {
          await createAuditLog(userId, "Menu Update", auditData, authClient);
        }
        console.log("SUPABASE_QUERY_FINISHED", "insert audit log");
      } else {
        console.log("MENU_INSERT_STARTED for item:", payload.name);
        
        console.log("SUPABASE_QUERY_STARTED", "insert menu_item");
        const { data: newItem, error } = await authClient
          .from("menu_items")
          .insert({
            name: payload.name,
            description: payload.description,
            price: payload.price,
            category: payload.category,
            image_url: payload.imageUrl,
            is_available: payload.isAvailable,
          })
          .select()
          .single();
        console.log("SUPABASE_QUERY_FINISHED", "insert menu_item");

        if (error) {
          console.log("ACTION_ERROR", error);
          console.log("TABLE: menu_items", "OPERATION: INSERT");
          console.error("MENU_DB_ERROR (insert):", error);
          throw new Error(`[Supabase Error] Failed to insert item: ${error.message} | Code: ${error.code}`);
        }
        response = newItem;
        console.log("MENU_DB_SUCCESS", "Item created successfully.");

        console.log("SUPABASE_QUERY_STARTED", "insert audit log");
        await createAuditLog(userId, "Menu Create", { itemId: newItem.id, name: payload.name }, authClient);
        console.log("SUPABASE_QUERY_FINISHED", "insert audit log");
      }

      console.log("ACTION_SUCCESS", "saveMenuItemFn");
      return { success: true, item: response };
    } catch (error) {
      console.error("ACTION_ERROR", error);
      throw error;
    } finally {
      console.log("ACTION_FINISHED");
    }
  });

export const deleteMenuItemFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "deleteMenuItemFn");
      const { id, token } = data;
      const { userId } = await verifyPermission(`Bearer ${token}`, "Menu.Delete");

      const authClient = createAuthClient(token);
      console.log(`[MENU_DELETE_STARTED] Deleting item with ID: ${id}`);

      console.log("SUPABASE_QUERY_STARTED", "fetch menu_item");
      const { data: item } = await authClient
        .from("menu_items")
        .select("name")
        .eq("id", id)
        .single();
      console.log("SUPABASE_QUERY_FINISHED", "fetch menu_item");

      console.log("SUPABASE_QUERY_STARTED", "delete menu_item");
      const { error } = await authClient
        .from("menu_items")
        .delete()
        .eq("id", id);
      console.log("SUPABASE_QUERY_FINISHED", "delete menu_item");

      if (error) {
        console.error("MENU DELETE ERROR:", error);
        throw new Error(`[Supabase Error] Failed to delete item: ${error.message} | Code: ${error.code}`);
      }
      
      console.log("[MENU_DELETE_SUCCESS] Item deleted successfully.");

      console.log("SUPABASE_QUERY_STARTED", "insert audit log");
      await createAuditLog(userId, "Menu Delete", { itemId: id, name: item?.name || "Unknown" }, authClient);
      console.log("SUPABASE_QUERY_FINISHED", "insert audit log");
      
      console.log("ACTION_SUCCESS", "deleteMenuItemFn");
      return { success: true };
    } catch (error) {
      console.error("ACTION_ERROR", error);
      throw error;
    } finally {
      console.log("ACTION_FINISHED");
    }
  });

// 4. SERVER FUNCTIONS: Table & QR Management
export const saveTableFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      payload: tableInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { payload, token } = data;
    
    // RBAC: Only Owner can manage tables
    const { userId } = await verifyPermission(`Bearer ${token}`, "Tables.Update");

    // Generate secure token (8 random alphanumeric characters) — Web Crypto API
    const secureToken = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36)).join("").slice(0, 8);

    const authClient = createAuthClient(token);

    const { data: existingTable } = await authClient
      .from("restaurant_tables")
      .select("id")
      .eq("table_number", payload.tableNumber)
      .maybeSingle();

    if (existingTable) {
      const { error } = await authClient
        .from("restaurant_tables")
        .update({
          is_active: payload.isActive,
        })
        .eq("table_number", payload.tableNumber);
      if (error) throw new Error(error.message);
      
      await createAuditLog(userId, "Table Update", { tableNumber: payload.tableNumber, isActive: payload.isActive }, authClient);
    } else {
      const { error } = await authClient
        .from("restaurant_tables")
        .insert({
          table_number: payload.tableNumber,
          token: secureToken,
          is_active: payload.isActive,
        });
      if (error) throw new Error(error.message);

      await createAuditLog(userId, "Table Creation", { tableNumber: payload.tableNumber, token: secureToken }, authClient);
    }

    return { success: true };
  });

export const regenerateTableTokenFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      tableNumber: z.number().int().positive(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { tableNumber, token } = data;
    const { userId } = await verifyPermission(`Bearer ${token}`, "Tables.Update");

    // Generate secure token — Web Crypto API
    const newSecureToken = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(36)).join("").slice(0, 8);

    const authClient = createAuthClient(token);
    const { error } = await authClient
      .from("restaurant_tables")
      .update({ token: newSecureToken })
      .eq("table_number", tableNumber);

    if (error) throw new Error(error.message);

    await createAuditLog(userId, "QR Regeneration", { tableNumber, token: newSecureToken }, authClient);
    return { success: true, newToken: newSecureToken };
  });

export const regenerateAllTableTokensFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      tableCount: z.number().int().positive(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { tableCount, token } = data;
    const { userId } = await verifyPermission(`Bearer ${token}`, "Tables.Update");

    const authClient = createAuthClient(token);

    // Delete existing tables
    await authClient.from("restaurant_tables").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Insert new tables
    const newTables = Array.from({ length: tableCount }).map((_, i) => ({
      table_number: i + 1,
      token: Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(36)).join("").slice(0, 8),
      is_active: true,
    }));

    const { error } = await authClient.from("restaurant_tables").insert(newTables);
    if (error) throw new Error(error.message);

    await createAuditLog(userId, "Bulk QR Regeneration", { tableCount }, authClient);
    return { success: true };
  });

export const getTablesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { token } = data;
    await verifyPermission(`Bearer ${token}`, "Tables.View");
    const authClient = createAuthClient(token);
    const { data: tables } = await authClient.from("restaurant_tables").select("table_number, token").order("table_number");
    return tables || [];
  });

export const checkBucketExistsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    console.log("BUCKET_CHECK_STARTED");
    const authClient = createAuthClient(data.token);
    try {
      const { data: buckets, error } = await authClient.storage.listBuckets();
      console.log("BUCKET_CHECK_RESPONSE:", buckets, error);
      if (error) {
        console.error("BUCKET_CHECK_ERROR:", error);
        return true; // Default to true on error to avoid false positives
      }
      const found = buckets?.some(b => b.name === 'cafe-assets') || false;
      if (found) {
        console.log("BUCKET_FOUND");
        return true;
      }
      console.log("BUCKET_NOT_FOUND");
      return false;
    } catch (err) {
      console.error("BUCKET_CHECK_ERROR:", err);
      return true; // Default to true on exception to avoid false positives
    }
  });

export const uploadLogoFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      payload: uploadInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const { payload, token } = data;
      const { userId } = await verifyPermission(`Bearer ${token}`, "Settings.Update");

      // Validate MIME type
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimeTypes.includes(payload.contentType)) {
        throw new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
      }

      // Extract Base64 Data
      const base64Data = payload.base64File.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      // Validate Size (< 2MB)
      if (buffer.length > 2 * 1024 * 1024) {
        throw new Error("File size must be less than 2MB.");
      }

      // Validate Magic Bytes (Basic verification)
      const hex = buffer.subarray(0, 4).toString('hex').toLowerCase();
      let isValidImage = false;
      if (hex.startsWith('ffd8ffe0') || hex.startsWith('ffd8ffe1') || hex.startsWith('ffd8ffe2')) isValidImage = true; // JPEG
      if (hex.startsWith('89504e47')) isValidImage = true; // PNG
      if (hex.startsWith('52494646')) isValidImage = true; // WEBP (RIFF header)
      
      if (!isValidImage) {
        throw new Error("File content is not a valid image.");
      }

      const authClient = createAuthClient(token);
      
      // Sanitize and randomize filename to prevent traversal/collision
      const extension = payload.fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const safeFileName = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const filePath = `settings/${safeFileName}`;

      const { data: uploadData, error: uploadError } = await authClient.storage
        .from('cafe-assets')
        .upload(filePath, buffer, {
          contentType: payload.contentType,
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = authClient.storage
        .from('cafe-assets')
        .getPublicUrl(uploadData.path);

      await createAuditLog(userId, "Logo Uploaded", { filePath: uploadData.path }, authClient);

      return { success: true, url: publicUrlData.publicUrl };
    } catch (error: any) {
      console.error("UPLOAD_ERROR", error);
      throw new Error(error.message || "Failed to upload logo.");
    }
  });

// 5. SERVER FUNCTION: Cafe Settings
export const updateCafeSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      payload: settingsInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { payload, token } = data;
    const { userId } = await verifyPermission(`Bearer ${token}`, "Settings.Update");

    const authClient = createAuthClient(token);
    const { error } = await authClient
      .from("cafe_settings")
      .update({
        cafe_name: payload.cafeName,
        about_section: payload.aboutSection,
        address: payload.address,
        phone_number: payload.phoneNumber,
        whatsapp_number: payload.whatsappNumber,
        email: payload.email,
        opening_hours: payload.openingHours,
        closing_hours: payload.closingHours,
        instagram_link: payload.instagramLink || null,
        facebook_link: payload.facebookLink || null,
        ordering_enabled: payload.orderingEnabled,
        accept_new_orders: payload.acceptNewOrders,
        auto_refresh_interval: payload.autoRefreshInterval,
        qr_table_count: payload.qrTableCount,
        logo_url: payload.logoUrl || null,
        theme_color: payload.themeColor,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1); // Single row

    if (error) throw new Error(error.message);

    await createAuditLog(userId, "Settings Change", payload, authClient);
    return { success: true };
  });

// 6. PROMOTIONS & CAMPAIGNS SCHEMAS & FUNCTIONS
const promotionInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(100),
  subtitle: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  imageUrl: z.string().url().or(z.literal("")).optional().nullable(),
  bannerUrl: z.string().url().or(z.literal("")).optional().nullable(),
  ctaText: z.string().max(50).default("Order Now"),
  ctaUrl: z.string().max(200).default("/menu"),
  displayType: z.array(z.string()).min(1, "At least one display type is required"),
  animationType: z.string().default("fade"),
  animationDuration: z.string().default("0.5s"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  timezone: z.string().default("UTC"),
  targeting: z.record(z.any()).default({}),
  displayRules: z.record(z.any()).default({}),
  offerType: z.string().default("custom"),
  status: z.enum(["Draft", "Scheduled", "Active", "Paused", "Expired", "Archived"]).default("Draft"),
});

export const savePromotionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      payload: promotionInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "savePromotionFn");
      const { payload, token } = data;
      const { userId } = await verifyPermission(`Bearer ${token}`, payload.id ? "Promotions.Update" : "Promotions.Create");
      const authClient = createAuthClient(token);
      const isUpdate = !!payload.id;
      let response;

      const dbPayload = {
        title: payload.title,
        subtitle: payload.subtitle || null,
        description: payload.description || null,
        image_url: payload.imageUrl || null,
        banner_url: payload.bannerUrl || null,
        cta_text: payload.ctaText,
        cta_url: payload.ctaUrl,
        display_type: payload.displayType,
        animation_type: payload.animationType,
        animation_duration: payload.animationDuration,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        start_time: payload.startTime || null,
        end_time: payload.endTime || null,
        timezone: payload.timezone,
        targeting: payload.targeting,
        display_rules: payload.displayRules,
        offer_type: payload.offerType,
        status: payload.status,
        updated_at: new Date().toISOString(),
      };

      if (isUpdate) {
        const { data: updated, error } = await authClient
          .from("promotions")
          .update(dbPayload)
          .eq("id", payload.id)
          .select()
          .single();

        if (error) throw new Error(error.message);
        response = updated;
        await createAuditLog(userId, "Promotion Update", { id: payload.id, title: payload.title }, authClient);
      } else {
        const { data: created, error } = await authClient
          .from("promotions")
          .insert({
            ...dbPayload,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        response = created;
        await createAuditLog(userId, "Promotion Create", { id: created.id, title: payload.title }, authClient);
      }

      return { success: true, promotion: response };
    } catch (error: any) {
      console.error("savePromotionFn error:", error);
      throw new Error(error.message || "Failed to save promotion.");
    }
  });

export const deletePromotionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "deletePromotionFn");
      const { id, token } = data;
      const { userId } = await verifyPermission(`Bearer ${token}`, "Promotions.Delete");
      const authClient = createAuthClient(token);

      const { data: item } = await authClient
        .from("promotions")
        .select("title")
        .eq("id", id)
        .single();

      const { error } = await authClient
        .from("promotions")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      await createAuditLog(userId, "Promotion Delete", { id, title: item?.title || "Unknown" }, authClient);
      return { success: true };
    } catch (error: any) {
      console.error("deletePromotionFn error:", error);
      throw new Error(error.message || "Failed to delete promotion.");
    }
  });

export const duplicatePromotionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "duplicatePromotionFn");
      const { id, token } = data;
      const { userId } = await verifyPermission(`Bearer ${token}`, "Promotions.Create");
      const authClient = createAuthClient(token);

      const { data: original, error: fetchError } = await authClient
        .from("promotions")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !original) throw new Error("Promotion not found.");

      const clonePayload = {
        title: `Copy of ${original.title}`,
        subtitle: original.subtitle,
        description: original.description,
        image_url: original.image_url,
        banner_url: original.banner_url,
        cta_text: original.cta_text,
        cta_url: original.cta_url,
        display_type: original.display_type,
        animation_type: original.animation_type,
        animation_duration: original.animation_duration,
        start_date: original.start_date,
        end_date: original.end_date,
        start_time: original.start_time,
        end_time: original.end_time,
        timezone: original.timezone,
        targeting: original.targeting,
        display_rules: original.display_rules,
        offer_type: original.offer_type,
        status: "Draft",
        updated_at: new Date().toISOString(),
      };

      const { data: duplicated, error: insertError } = await authClient
        .from("promotions")
        .insert(clonePayload)
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);

      await createAuditLog(userId, "Promotion Duplicate", { originalId: id, newId: duplicated.id, title: clonePayload.title }, authClient);
      return { success: true, promotion: duplicated };
    } catch (error: any) {
      console.error("duplicatePromotionFn error:", error);
      throw new Error(error.message || "Failed to duplicate promotion.");
    }
  });

export const togglePromotionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      status: z.enum(["Draft", "Scheduled", "Active", "Paused", "Expired", "Archived"]),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "togglePromotionStatusFn");
      const { id, status, token } = data;
      const { userId } = await verifyPermission(token, "Promotions.Update");
      const authClient = createAuthClient(token);

      const { error } = await authClient
        .from("promotions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw new Error(error.message);

      await createAuditLog(userId, "Promotion Status Change", { id, status }, authClient);
      return { success: true };
    } catch (error: any) {
      console.error("togglePromotionStatusFn error:", error);
      throw new Error(error.message || "Failed to update promotion status.");
    }
  });

export const uploadPromotionAssetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      payload: uploadInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      console.log("SERVER_ACTION_STARTED", "uploadPromotionAssetFn");
      const { payload, token } = data;
      const { userId } = await verifyPermission(token, "Promotions.Create");

      // Validate MIME type
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimeTypes.includes(payload.contentType)) {
        throw new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
      }

      // Extract Base64 Data
      const base64Data = payload.base64File.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      // Validate Size (< 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error("File size must be less than 5MB.");
      }

      // Validate Magic Bytes
      const hex = buffer.subarray(0, 4).toString('hex').toLowerCase();
      let isValidImage = false;
      if (hex.startsWith('ffd8ffe0') || hex.startsWith('ffd8ffe1') || hex.startsWith('ffd8ffe2')) isValidImage = true;
      if (hex.startsWith('89504e47')) isValidImage = true;
      if (hex.startsWith('52494646')) isValidImage = true;
      
      if (!isValidImage) {
        throw new Error("File content is not a valid image.");
      }

      const authClient = createAuthClient(token);
      
      const extension = payload.fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const safeFileName = `promo_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const filePath = `assets/${safeFileName}`;

      const { data: uploadData, error: uploadError } = await authClient.storage
        .from('promotion-assets')
        .upload(filePath, buffer, {
          contentType: payload.contentType,
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = authClient.storage
        .from('promotion-assets')
        .getPublicUrl(uploadData.path);

      await createAuditLog(userId, "Promotion Image Uploaded", { filePath: uploadData.path }, authClient);

      return { success: true, url: publicUrlData.publicUrl };
    } catch (error: any) {
      console.error("uploadPromotionAssetFn error:", error);
      throw new Error(error.message || "Failed to upload promotion asset.");
    }
  });
