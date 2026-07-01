import { createServerFn } from "@tanstack/react-start";
import { getRequest, getCookie } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import crypto from "node:crypto";
import { supabase } from "./supabase";
import { 
  verifyTableSession, 
  verifyTableToken, 
  verifyQrPayload,
  signPayload,
  isIpRateLimited,
  generateFingerprint,
  getIpHash,
  getSubnet,
  logSecurityThreat,
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
  nonce: z.string().min(1, { message: "Security token (nonce) is required" }),
});

export const requestSubmissionSchema = z.object({
  requestType: z.enum(["Call Waiter", "Request Bill", "Feedback", "Other"]),
  additionalInfo: z.string().max(300).optional(),
  nonce: z.string().min(1, { message: "Security token (nonce) is required" }),
});

// SERVER FUNCTION: Generate session nonce
export const getNonceFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const request = getRequest();
    if (!request) {
      throw new Error("No request context.");
    }
    const cookieValue = getCookie(COOKIE_NAME);
    const session = await verifyTableSession(cookieValue, request);
    if (!session) {
      throw new Error("Invalid or expired table session. Please re-scan QR.");
    }

    const { data: nonce, error } = await supabase.rpc("generate_session_nonce", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken
    });

    if (error || !nonce) {
      throw new Error("Failed to generate security token: " + (error?.message || "Unknown error"));
    }

    return { nonce };
  });

// SERVER FUNCTION: Verify Menu Access and set Cookie
export const verifyMenuAccessFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      table: z.number().optional(),
      token: z.string().optional(),
      data: z.string().optional(), // Signed QR payload parameter
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      return { tableNumber: null, isVerified: false };
    }

    // 1. Rate Limiting QR scan attempts
    if (await isIpRateLimited(request, "verify_qr", 10, 60)) {
      throw redirect({
        to: "/menu",
        search: { error: "rate-limited" },
      });
    }

    // 2. Fetch Cafe Settings to check Emergency Lockdown Levels
    const { data: settings } = await supabase
      .from("cafe_settings")
      .select("qr_emergency_disabled, session_timeout_minutes, lockdown_level, disable_legacy_qr, qr_rotation_grace_period_mins, require_customer_name")
      .eq("id", 1)
      .maybeSingle();

    // Level 3 Lockdown: Complete Customer Lockdown
    if (settings?.lockdown_level === 3 || settings?.qr_emergency_disabled) {
      throw redirect({
        to: "/menu",
        search: { error: "lockdown-maintenance" },
      });
    }

    const cookieValue = getCookie(COOKIE_NAME);
    const existingSession = await verifyTableSession(cookieValue, request);

    let scannedTable: number | undefined;
    let scannedTableId: string | undefined;
    let scannedToken: string | undefined;

    // A. Check signed payload format first
    if (data.data) {
      const payload = verifyQrPayload(data.data);
      if (!payload) {
        await logSecurityThreat("Invalid Signature", "High", { signedData: data.data }, request);
        throw redirect({
          to: "/menu",
          search: { error: "invalid-signature" },
        });
      }

      // Fetch table info
      const { data: dbTable } = await supabase
        .from("restaurant_tables")
        .select("id, table_number, is_active, qr_status, qr_token, previous_qr_token, rotated_at, qr_version")
        .eq("id", payload.tableId)
        .maybeSingle();

      if (!dbTable || !dbTable.is_active || dbTable.qr_status !== "Active") {
        await logSecurityThreat("Token Guessing", "High", { tableId: payload.tableId }, request);
        throw redirect({
          to: "/menu",
          search: { error: "invalid-token" },
        });
      }

      // Verify QR version & grace periods
      let isTokenValid = false;
      if (dbTable.qr_version === payload.qrVersion) {
        isTokenValid = true;
      } else if (dbTable.qr_version === payload.qrVersion + 1 && dbTable.rotated_at) {
        const graceExpiry = new Date(dbTable.rotated_at).getTime() + (settings?.qr_rotation_grace_period_mins || 15) * 60 * 1000;
        if (Date.now() < graceExpiry) {
          isTokenValid = true;
        }
      }

      if (!isTokenValid) {
        await logSecurityThreat("URL Manipulation", "Medium", { message: "QR Code version expired", qrVersion: payload.qrVersion, dbVersion: dbTable.qr_version }, request);
        throw redirect({
          to: "/menu",
          search: { error: "invalid-token" },
        });
      }

      scannedTable = dbTable.table_number;
      scannedTableId = dbTable.id;
      scannedToken = dbTable.qr_token;
    }
    // B. Check plain token parameter (legacy compatibility)
    else if (data.table !== undefined && data.token !== undefined) {
      if (settings?.disable_legacy_qr) {
        await logSecurityThreat("URL Manipulation", "Medium", { message: "Attempted legacy QR scan when legacy support is disabled" }, request);
        throw redirect({
          to: "/menu",
          search: { error: "legacy-disabled" },
        });
      }

      const tableVerifyResult = await verifyTableToken(data.table, data.token);
      if (tableVerifyResult) {
        scannedTable = data.table;
        scannedTableId = tableVerifyResult.tableId;
        scannedToken = data.token;
      } else {
        await logSecurityThreat("Token Guessing", "Low", { table: data.table, token: data.token }, request);
        throw redirect({
          to: "/menu",
          search: { error: "invalid-token" },
          headers: {
            "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
          },
        });
      }
    }

    // Scenario 1: Table QR Code Scanned successfully
    if (scannedTable !== undefined && scannedToken !== undefined && scannedTableId !== undefined) {
      // Session Lock check: If they already have an active session for a DIFFERENT table
      if (existingSession && existingSession.tableNumber !== scannedTable) {
        await logSecurityThreat("Session Hijacking", "Medium", { message: "Table switching attempted", currentTable: existingSession.tableNumber, targetTable: scannedTable }, request);
        throw redirect({
          to: "/menu",
          search: { error: "active-session-lock" },
        });
      }

      // If they already have an active session for the SAME table, just redirect to /menu (clean URL)
      if (existingSession && existingSession.tableNumber === scannedTable) {
        throw redirect({
          to: "/menu",
        });
      }

      // Create secure database dining session
      const sessionTimeoutMinutes = settings?.session_timeout_minutes || 180;
      const durationMs = sessionTimeoutMinutes * 60 * 1000;
      const expiresAt = Date.now() + durationMs;
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                       request.headers.get("x-real-ip") ||
                       "127.0.0.1";
      const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
      const subnetHash = crypto.createHash("sha256").update(getSubnet(clientIp)).digest("hex");

      // 1. Fetch or create active Table Session
      let tableSessionId: string;
      let displayName = "Guest 1";

      const { data: existingTableSession } = await supabase
        .from("table_sessions")
        .select("id, total_devices")
        .eq("table_id", scannedTableId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existingTableSession) {
        tableSessionId = existingTableSession.id;
        const newDeviceCount = existingTableSession.total_devices + 1;
        displayName = `Guest ${newDeviceCount}`;
        
        await supabase
          .from("table_sessions")
          .update({ total_devices: newDeviceCount })
          .eq("id", tableSessionId);
      } else {
        const tableSessionToken = crypto.randomBytes(32).toString("hex");
        const { data: newTableSession, error: tableSessionError } = await supabase
          .from("table_sessions")
          .insert({
            table_id: scannedTableId,
            session_token: tableSessionToken,
            expires_at: new Date(expiresAt).toISOString(),
            total_devices: 1,
            total_orders: 0
          })
          .select("id")
          .single();

        if (tableSessionError || !newTableSession) {
          throw new Error("Failed to initiate table session.");
        }
        tableSessionId = newTableSession.id;
      }

      // 2. Create Device Session
      const { data: newSession, error: sessionError } = await supabase
        .from("dining_sessions")
        .insert({
          table_id: scannedTableId,
          table_session_id: tableSessionId,
          display_name: displayName,
          is_name_set: false,
          session_token: sessionToken,
          browser_fingerprint_hash: generateFingerprint(request),
          user_agent_hash: crypto.createHash("sha256").update(request.headers.get("user-agent") || "").digest("hex"),
          expires_at: new Date(expiresAt).toISOString(),
          client_ip_hash: ipHash,
          ip_subnet: subnetHash,
          trust_score: 100,
        })
        .select("id")
        .single();

      if (sessionError || !newSession) {
        throw new Error("Failed to initiate secure dining session.");
      }

      const payloadStr = `${newSession.id}:${sessionToken}:${expiresAt}`;
      const signature = signPayload(payloadStr);
      const cookieVal = `${payloadStr}:${signature}`;

      throw redirect({
        to: "/menu",
        headers: {
          "Set-Cookie": `${COOKIE_NAME}=${cookieVal}; Path=/; HttpOnly; ${process.env.NODE_ENV === "production" ? "Secure;" : ""} SameSite=Lax; Max-Age=${sessionTimeoutMinutes * 60}`,
        },
      });
    }

    // Scenario 2: Active Verified session
    if (existingSession) {
      return {
        tableNumber: existingSession.tableNumber,
        isVerified: true,
        sessionToken: existingSession.sessionToken,
        tableSessionId: existingSession.tableSessionId,
        displayName: existingSession.displayName,
        isNameSet: existingSession.isNameSet,
        requireCustomerName: settings?.require_customer_name ?? true,
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
    const request = getRequest();
    if (!request) return [] as Order[];

    try {
      const cookieValue = getCookie(COOKIE_NAME);
      const session = await verifyTableSession(cookieValue, request);
      if (!session || !session.tableSessionId) return [] as Order[];

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          status,
          total_amount,
          created_at,
          customer_name,
          order_items (
            id,
            item_name,
            quantity,
            item_price,
            notes
          )
        `)
        .eq("table_session_id", session.tableSessionId)
        .order("created_at", { ascending: false });

      if (!ordersError && ordersData) {
        return ordersData as unknown as Order[];
      }
    } catch (err) {
      console.error("Error fetching session orders:", err);
    }
    return [] as Order[];
  });

// SERVER FUNCTION: Place Order via Secure PostgreSQL Transaction
export const placeOrderFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderSubmissionSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      throw new Error("No request context.");
    }

    // 1. IP Rate Limiting
    if (await isIpRateLimited(request, "place_order", 3, 60)) {
      throw new Error("Rate limit exceeded. Please wait before placing another order.");
    }

    // 2. Fetch Lockdown Status
    const { data: settings } = await supabase
      .from("cafe_settings")
      .select("lockdown_level")
      .eq("id", 1)
      .maybeSingle();

    // Level 1+ Lockdown: Customer Ordering Disabled
    if (settings && settings.lockdown_level >= 1) {
      throw new Error("Ordering is temporarily disabled due to system security lockdown.");
    }

    // 3. Validate Session
    const cookieValue = getCookie(COOKIE_NAME);
    const session = await verifyTableSession(cookieValue, request);
    if (!session) {
      throw new Error("Invalid or expired table session. Please re-scan QR.");
    }

    const { items, idempotencyKey, appliedPromotionId, nonce } = data;

    // 4. Call Database RPC Transaction (Fully verifies availability, prices, active status, and nonces)
    const { data: result, error } = await supabase.rpc("submit_customer_order", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
      p_idempotency_key: idempotencyKey,
      p_applied_promotion_id: appliedPromotionId || null,
      p_items: JSON.stringify(items),
      p_nonce: nonce
    });

    if (error || !result) {
      throw new Error(error?.message || "Order submission database transaction failed.");
    }

    const rpcRes = result as any;
    if (rpcRes.error) {
      throw new Error(rpcRes.error);
    }

    // Broadcast change to realtime channel securely
    await supabase.channel(`session_${session.tableSessionId}`).send({
      type: "broadcast",
      event: "order_updated",
      payload: { orderId: rpcRes.orderId, status: rpcRes.status }
    });

    return {
      success: true,
      orderId: rpcRes.orderId,
      status: rpcRes.status,
      isDuplicate: !!rpcRes.isDuplicate,
    };
  });

// SERVER FUNCTION: Call Waiter or Request Bill
export const submitTableRequestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => requestSubmissionSchema.parse(data))
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      throw new Error("No request context.");
    }

    // 1. IP Rate Limiting
    if (await isIpRateLimited(request, "table_request", 5, 60)) {
      throw new Error("Rate limit exceeded. Please wait before sending another request.");
    }

    // 2. Fetch Lockdown Status
    const { data: settings } = await supabase
      .from("cafe_settings")
      .select("lockdown_level")
      .eq("id", 1)
      .maybeSingle();

    // Level 2+ Lockdown: Waiter Requests Disabled
    if (settings && settings.lockdown_level >= 2) {
      throw new Error("Requests are temporarily disabled due to system security lockdown.");
    }

    // 3. Validate Session
    const cookieValue = getCookie(COOKIE_NAME);
    const session = await verifyTableSession(cookieValue, request);
    if (!session) {
      throw new Error("Invalid or expired table session. Please re-scan QR.");
    }

    const { requestType, additionalInfo, nonce } = data;

    // 4. Call Database RPC Transaction
    const { data: result, error } = await supabase.rpc("submit_table_request", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
      p_request_type: requestType,
      p_additional_info: additionalInfo || null,
      p_nonce: nonce
    });

    if (error || !result) {
      throw new Error(error?.message || "Table request failed.");
    }

    const rpcRes = result as any;
    if (rpcRes.error) {
      throw new Error(rpcRes.error);
    }

    return {
      success: true,
      requestId: rpcRes.requestId,
    };
  });

// SERVER FUNCTION: Set Customer Name
export const setCustomerNameFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      name: z.string().min(2).max(40).trim(),
      forceAppend: z.boolean().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      throw new Error("No request context.");
    }

    if (await isIpRateLimited(request, "set_customer_name", 10, 60)) {
      throw new Error("Rate limit exceeded. Please wait.");
    }

    const cookieValue = getCookie(COOKIE_NAME);
    const session = await verifyTableSession(cookieValue, request);
    if (!session) {
      throw new Error("Invalid or expired table session.");
    }

    // Sanitize input
    const sanitizedName = data.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const { data: result, error } = await supabase.rpc("set_customer_name", {
      p_session_id: session.sessionId,
      p_session_token: session.sessionToken,
      p_name: sanitizedName,
      p_force_append: data.forceAppend || false
    });

    if (error || !result) {
      throw new Error(error?.message || "Failed to set customer name.");
    }

    const rpcRes = result as any;
    if (rpcRes.error) {
      throw new Error(rpcRes.error);
    }

    return rpcRes; // { success, isDuplicate, suggestedName, displayName }
  });

// SERVER FUNCTION: Leave Table Session
export const leaveTableSessionFn = createServerFn({ method: "POST" })
  .handler(async () => {
    const request = getRequest();
    if (!request) return { success: false };

    const cookieValue = getCookie(COOKIE_NAME);
    const session = await verifyTableSession(cookieValue, request);
    
    if (session) {
      await supabase
        .from("dining_sessions")
        .update({ is_active: false })
        .eq("id", session.sessionId);
    }

    throw redirect({
      to: "/menu",
      headers: {
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      },
    });
  });
