import crypto from "node:crypto";
import { z } from "zod";
import { supabase } from "./supabase";

// 1. Zod Validation Schemas
export const tableVerificationSchema = z.object({
  tableNumber: z.coerce.number().int().positive({ message: "Table number must be a positive integer" }),
  token: z.string().min(8).max(128).regex(/^[a-fA-F0-9]+$/, { message: "Invalid characters in token" }),
});

// 2. Privacy Hashing
export function getIpHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
             request.headers.get("x-real-ip") ||
             "127.0.0.1";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

// 3. Database Threat Intelligence Logging
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

// 4. Database Rate Limiter
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

// 5. DB Verification via Supabase RPC (Original Flow)
export async function verifyTableToken(tableNumber: number, token: string): Promise<boolean> {
  const validation = tableVerificationSchema.safeParse({ tableNumber, token });
  if (!validation.success) {
    return false;
  }

  const { data } = await supabase.rpc("verify_table_token", {
    p_table_number: validation.data.tableNumber,
    p_token: validation.data.token,
  });

  return !!data;
}
