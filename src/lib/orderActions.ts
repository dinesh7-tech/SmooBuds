import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import crypto from "node:crypto";
import { supabase } from "./supabase";
import { 
  verifyTableToken, 
} from "./verifyTable";

// Privacy Hashing
export function getIpHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
             request.headers.get("x-real-ip") ||
             "127.0.0.1";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// Database Threat Intelligence Logging
export async function logSecurityThreat(
  category: string,
  severity: "Low" | "Medium" | "High" | "Critical",
  details: any,
  request: Request | undefined
) {
  try {
    const rawIp = request ? (request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                            request.headers.get("x-real-ip") ||
                            "127.0.0.1") : "127.0.0.1";
    
    const hashedIp = crypto.createHash("sha256").update(rawIp).digest("hex");
    const hashedFingerprint = "unknown";

    const { error } = await supabase.from("security_threat_logs").insert({
      event_category: category,
      severity,
      details,
      hashed_client_ip: hashedIp,
      hashed_browser_fingerprint: hashedFingerprint,
      action_taken: severity === "Critical" ? "Revoke Request" : "Flag Action",
    });
    if (error) {
      console.error("Threat Log Insert Error:", error.message);
    }
  } catch (err) {
    console.error("Threat logging exception:", err);
  }
}

// Database Rate Limiter
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("Rate Limiter Database Error:", error.message);
      return true; // Fail open
    }
    return !!data;
  } catch (err) {
    console.error("Rate Limiter exception:", err);
    return true; // Fail open
  }
}

export async function isIpRateLimited(request: Request, action: string, limit: number, windowSeconds: number): Promise<boolean> {
  const ipHash = getIpHash(request);
  const key = `rate:${action}:${ipHash}`;
  const allowed = await checkRateLimit(key, limit, windowSeconds);
  if (!allowed) {
    await logSecurityThreat(
      "Rate Limit Abuse",
      "Medium",
      { action, limit, windowSeconds },
      request
    );
  }
  return !allowed;
}

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
  tableNumber: z.number().int().positive(),
  token: z.string().min(8),
  items: z.array(orderItemInputSchema).min(1, { message: "Cart cannot be empty" }),
  idempotencyKey: z.string().uuid({ message: "Invalid idempotency key format" }),
  appliedPromotionId: z.string().uuid({ message: "Invalid promotion ID format" }).optional().nullable(),
  nonce: z.string().min(1, { message: "Security token (nonce) is required" }),
});

export const requestSubmissionSchema = z.object({
  tableNumber: z.number().int().positive(),
  token: z.string().min(8),
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
    
    if (await isIpRateLimited(request, "generate_nonce", 20, 60)) {
      throw new Error("Rate limit exceeded. Please wait.");
    }

    const { data: nonce, error } = await supabase.rpc("get_nonce");

    if (error || !nonce) {
      throw new Error("Failed to generate security token: " + (error?.message || "Unknown error"));
    }

    return { nonce };
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

    const { tableNumber, token, items, idempotencyKey, appliedPromotionId, nonce } = data;

    // 3. Call Database RPC Transaction (Fully verifies table, token, availability, prices, active status, and nonces)
    const { data: result, error } = await supabase.rpc("submit_customer_order", {
      p_table_number: tableNumber,
      p_table_token: token,
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
    await supabase.channel(`table_${tableNumber}`).send({
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

    const { tableNumber, token, requestType, additionalInfo, nonce } = data;

    // 3. Call Database RPC Transaction
    const { data: result, error } = await supabase.rpc("submit_table_request", {
      p_table_number: tableNumber,
      p_table_token: token,
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
