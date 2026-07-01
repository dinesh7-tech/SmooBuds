import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import crypto from "node:crypto";
import { supabase } from "./supabase";
import { 
  verifyTableToken, 
  isIpRateLimited,
  logSecurityThreat
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

// SERVER FUNCTION: Verify Menu Access
export const verifyMenuAccessFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      table: z.number().optional(),
      token: z.string().optional(),
      data: z.string().optional(), // Left for signature compatibility, but ignored in strict rollback
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) {
      return { tableNumber: null, isVerified: false };
    }

    // 1. Rate Limiting QR scan attempts
    if (await isIpRateLimited(request, "verify_qr", 10, 60)) {
      return { tableNumber: null, isVerified: false };
    }

    // 2. Fetch Cafe Settings to check Emergency Lockdown Levels
    const { data: settings } = await supabase
      .from("cafe_settings")
      .select("qr_emergency_disabled, lockdown_level, disable_legacy_qr")
      .eq("id", 1)
      .maybeSingle();

    // Level 3 Lockdown: Complete Customer Lockdown
    if (settings?.lockdown_level === 3 || settings?.qr_emergency_disabled) {
      return { tableNumber: null, isVerified: false };
    }

    let scannedTable: number | undefined;
    let scannedToken: string | undefined;

    // Strict validation of plain table/token parameters as requested
    if (data.table !== undefined && data.token !== undefined) {
      if (settings?.disable_legacy_qr) {
        await logSecurityThreat("URL Manipulation", "Medium", { message: "Attempted legacy QR scan when legacy support is disabled" }, request);
        return { tableNumber: null, isVerified: false };
      }

      const tableVerifyResult = await verifyTableToken(data.table, data.token);
      if (tableVerifyResult) {
        scannedTable = data.table;
        scannedToken = data.token;
      } else {
        await logSecurityThreat("Token Guessing", "Low", { table: data.table, token: data.token }, request);
        return { tableNumber: null, isVerified: false };
      }
    }

    if (scannedTable !== undefined && scannedToken !== undefined) {
      return {
        tableNumber: scannedTable,
        isVerified: true,
      };
    }

    return {
      tableNumber: null,
      isVerified: false,
    };
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
