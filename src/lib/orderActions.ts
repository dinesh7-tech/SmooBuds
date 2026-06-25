import { createServerFn } from "@tanstack/react-start";
import { getRequest, getCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "./supabase";
import { 
  verifyTableSession, 
  verifyTableToken, 
  createTableSession, 
  isVerifyRateLimited,
  isOrderRateLimited,
  isRequestRateLimited,
  COOKIE_NAME 
} from "./verifyTable";

// Type declarations
interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  item_price: number;
  notes: string | null;
}

interface Order {
  id: string;
  status: "Pending" | "Accepted" | "Preparing" | "Ready" | "Served" | "Cancelled";
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

// Zod Validation Schemas
export const orderItemInputSchema = z.object({
  id: z.string().uuid({ message: "Invalid item ID format" }),
  quantity: z.number().int().positive({ message: "Quantity must be a positive integer" }),
  notes: z.string().max(200, { message: "Notes must be under 200 characters" }).optional(),
});

export const orderSubmissionSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, { message: "Cart cannot be empty" }),
  idempotencyKey: z.string().uuid({ message: "Invalid idempotency key format" }),
  appliedPromotionId: z.string().uuid({ message: "Invalid promotion ID format" }).optional().nullable(),
});

export const requestSubmissionSchema = z.object({
  requestType: z.enum(["Call Waiter", "Request Bill", "Feedback", "Other"]),
  additionalInfo: z.string().max(300).optional(),
});

// Helper: Parse cookies from header
function getTableSessionFromRequest(request: Request | undefined): { tableNumber: number } {
  if (!request) {
    throw new Error("Request context not found.");
  }
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift()?.trim();
    if (key) {
      cookies[key] = decodeURIComponent(parts.join("="));
    }
  });

  const session = verifyTableSession(cookies[COOKIE_NAME]);
  if (!session) {
    throw new Error("Invalid or expired table session. Please re-scan the QR code at your table.");
  }
  return session;
}

// Helper: Parse cookies
function parseCookies(header: string) {
  const list: Record<string, string> = {};
  header.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const key = parts.shift()?.trim();
    if (key) {
      list[key] = decodeURIComponent(parts.join("="));
    }
  });
  return list;
}

// SERVER FUNCTION: Verify Menu Access and set Cookie
export const verifyMenuAccessFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      table: z.number().optional(),
      token: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      return { tableNumber: null, isVerified: false };
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    // Use getCookie() from @tanstack/react-start/server — server-only, no manual parsing
    const cookieValue = getCookie(COOKIE_NAME);
    const existingSession = verifyTableSession(cookieValue);

    // Scenario 1: Table QR Code Verification
    if (data.table !== undefined && data.token !== undefined) {
      if (isVerifyRateLimited(clientIp)) {
        throw redirect({
          to: "/menu",
          search: { error: "rate-limited" },
        });
      }

      const isValid = await verifyTableToken(data.table, data.token);
      if (isValid) {
        const sessionCookie = createTableSession(data.table);
        throw redirect({
          to: "/menu",
          headers: {
            "Set-Cookie": `${sessionCookie.name}=${sessionCookie.value}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=10800`,
          },
        });
      } else {
        throw redirect({
          to: "/menu",
          search: { error: "invalid-token" },
          headers: {
            "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
          },
        });
      }
    }

    // Scenario 2: Active Verified session
    if (existingSession) {
      return {
        tableNumber: existingSession.tableNumber,
        isVerified: true,
      };
    }

    // Scenario 3: Public read-only
    return {
      tableNumber: null,
      isVerified: false,
    };
  });

// SERVER FUNCTION: Fetch session orders securely
export const fetchSessionOrdersFn = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      // getCookie() is server-only — reads from the incoming request's Cookie header
      const cookieValue = getCookie(COOKIE_NAME);
      const session = verifyTableSession(cookieValue);
      if (!session) return [] as Order[];

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total_amount,
          created_at,
          order_items (
            id,
            item_name,
            quantity,
            item_price,
            notes
          )
        `)
        .eq("table_number", session.tableNumber)
        .gte("created_at", threeHoursAgo)
        .order("created_at", { ascending: false });

      if (!ordersError && ordersData) {
        return ordersData as unknown as Order[];
      }
    } catch (err) {
      console.error("Error fetching session orders:", err);
    }
    return [] as Order[];
  });

// SERVER FUNCTION: Place Order
export const placeOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    console.log("PLACE_ORDER_FN_STARTED");
    const res = orderSubmissionSchema.parse(data);
    console.log("VALIDATION_PASSED");
    return res;
  })
  .handler(async ({ data }) => {
    const request = getRequest();
    
    // IP Rate Limiting
    const clientIp =
      request?.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request?.headers.get("x-real-ip") ||
      "127.0.0.1";

    if (isOrderRateLimited(clientIp)) {
      throw new Error("Rate limit exceeded. Please wait before placing another order.");
    }

    const { tableNumber } = getTableSessionFromRequest(request);
    console.log("SESSION_VALIDATED");

    const { items, idempotencyKey, appliedPromotionId } = data;

    // 1. Check if order with this idempotency key already exists (Duplicate Protection)
    const { data: existingOrder, error: checkError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (checkError) {
      throw new Error(`Database error during idempotency check: ${checkError.message}`);
    }

    if (existingOrder) {
      return {
        success: true,
        orderId: existingOrder.id,
        status: existingOrder.status,
        isDuplicate: true,
      };
    }

    // 2. Fetch and Validate Menu Items (Prices & Availability) from Database
    const itemIds = items.map((i) => i.id);
    const { data: dbItems, error: itemsError } = await supabase
      .from("menu_items")
      .select("id, name, price, is_available")
      .in("id", itemIds);

    if (itemsError || !dbItems) {
      throw new Error("Failed to fetch menu items from database for validation.");
    }

    const dbItemsMap = new Map(dbItems.map((item) => [item.id, item]));

    // Check availability
    for (const clientItem of items) {
      const dbItem = dbItemsMap.get(clientItem.id);
      if (!dbItem) {
        throw new Error(`One or more items in your cart do not exist in the menu.`);
      }
      if (!dbItem.is_available) {
        throw new Error(`"${dbItem.name}" is currently out of stock. Please remove it from your cart before ordering.`);
      }
    }

    // 3. Recalculate prices
    let totalAmount = 0;
    const orderItemsToInsert = items.map((clientItem) => {
      const dbItem = dbItemsMap.get(clientItem.id)!;
      const itemTotal = dbItem.price * clientItem.quantity;
      totalAmount += itemTotal;

      return {
        item_name: dbItem.name,
        quantity: clientItem.quantity,
        item_price: dbItem.price,
        notes: clientItem.notes || null,
      };
    });

    console.log("DB_INSERT_STARTED");
    // 4. Insert Order
    const { data: newOrder, error: orderInsertError } = await supabase
      .from("orders")
      .insert({
        table_number: tableNumber,
        total_amount: totalAmount,
        status: "Pending",
        idempotency_key: idempotencyKey,
        applied_promotion_id: appliedPromotionId || null,
      })
      .select("id")
      .single();

    if (orderInsertError) {
      if (orderInsertError.code === "23505") {
        const { data: reCheckOrder } = await supabase
          .from("orders")
          .select("id, status")
          .eq("idempotency_key", idempotencyKey)
          .single();
        if (reCheckOrder) {
          return {
            success: true,
            orderId: reCheckOrder.id,
            status: reCheckOrder.status,
            isDuplicate: true,
          };
        }
      }
      throw new Error(`Failed to create order: ${orderInsertError.message}`);
    }

    console.log("DB_INSERT_SUCCESS");

    // 5. Insert Order Items
    const itemsWithOrderId = orderItemsToInsert.map((item) => ({
      ...item,
      order_id: newOrder.id,
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(itemsWithOrderId);

    if (itemsInsertError) {
      await supabase.from("orders").delete().eq("id", newOrder.id);
      throw new Error(`Failed to save items for your order: ${itemsInsertError.message}`);
    }

    return {
      success: true,
      orderId: newOrder.id,
      status: "Pending",
      isDuplicate: false,
    };
  });

// SERVER FUNCTION: Call Waiter or Request Bill
export const submitTableRequestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSubmissionSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();

    // IP Rate Limiting
    const clientIp =
      request?.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request?.headers.get("x-real-ip") ||
      "127.0.0.1";

    if (isRequestRateLimited(clientIp)) {
      throw new Error("Rate limit exceeded. Please wait before sending another request.");
    }

    const { tableNumber } = getTableSessionFromRequest(request);

    const { requestType, additionalInfo } = data;

    const { data: newRequest, error } = await supabase
      .from("table_requests")
      .insert({
        table_number: tableNumber,
        request_type: requestType,
        additional_info: additionalInfo || null,
        status: "Pending",
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to send request: ${error.message}`);
    }

    return {
      success: true,
      requestId: newRequest.id,
    };
  });
