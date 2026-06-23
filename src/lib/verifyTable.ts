import crypto from "node:crypto";
import { z } from "zod";
import { supabase } from "./supabase";

// 1. Zod Validation Schemas
export const tableVerificationSchema = z.object({
  tableNumber: z.coerce.number().int().positive({ message: "Table number must be a positive integer" }),
  token: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/, { message: "Invalid characters in token" }),
});

export const cookiePayloadSchema = z.object({
  tableNumber: z.number().int().positive(),
  expiresAt: z.number().positive(),
});

// 2. Secret Key Retrieval
const SESSION_SECRET = process.env.SESSION_SECRET || "default_smoobuds_cookie_secret_key_change_me_in_prod";

// 3. Cryptographic Signature Utilities
export function signPayload(payload: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = signPayload(payload);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

// 4. Cookie Management (Session expiry: 3 hours)
const SESSION_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
}

export const COOKIE_NAME = "smoobuds_table_session";

export function createTableSession(tableNumber: number): {
  name: string;
  value: string;
  options: CookieOptions;
} {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payloadStr = `${tableNumber}:${expiresAt}`;
  const signature = signPayload(payloadStr);
  const cookieValue = `${payloadStr}:${signature}`;

  return {
    name: COOKIE_NAME,
    value: cookieValue,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3 * 60 * 60, // 3 hours in seconds
    },
  };
}

export function verifyTableSession(cookieValue: string | undefined): { tableNumber: number } | null {
  if (!cookieValue) return null;

  const parts = cookieValue.split(":");
  if (parts.length !== 3) return null;

  const [tableStr, expiresStr, signature] = parts;
  const payloadStr = `${tableStr}:${expiresStr}`;

  if (!verifySignature(payloadStr, signature)) {
    console.warn("Invalid session signature detected.");
    return null;
  }

  // Parse and validate payload structure with Zod
  const validationResult = cookiePayloadSchema.safeParse({
    tableNumber: parseInt(tableStr, 10),
    expiresAt: parseInt(expiresStr, 10),
  });

  if (!validationResult.success) {
    return null;
  }

  const { tableNumber, expiresAt } = validationResult.data;

  if (Date.now() > expiresAt) {
    console.warn(`Table session for Table ${tableNumber} has expired.`);
    return null;
  }

  return { tableNumber };
}

// 5. In-Memory Rate Limiting
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const verifyLimitMap = new Map<string, RateLimitRecord>();
const sessionLimitMap = new Map<string, RateLimitRecord>();
const orderLimitMap = new Map<string, RateLimitRecord>();
const requestLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(
  map: Map<string, RateLimitRecord>,
  ip: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const record = map.get(ip);

  if (!record) {
    map.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (now > record.resetTime) {
    map.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

// Rate limits: Max 5 attempts per 1 minute (60,000 ms) per IP
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

export function isVerifyRateLimited(ip: string): boolean {
  return !checkRateLimit(verifyLimitMap, ip, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW);
}

export function isSessionRateLimited(ip: string): boolean {
  return !checkRateLimit(sessionLimitMap, ip, RATE_LIMIT_MAX_ATTEMPTS, RATE_LIMIT_WINDOW);
}

// Max 3 orders per 1 minute per IP
export function isOrderRateLimited(ip: string): boolean {
  return !checkRateLimit(orderLimitMap, ip, 3, 60 * 1000);
}

// Max 5 table requests per 1 minute per IP
export function isRequestRateLimited(ip: string): boolean {
  return !checkRateLimit(requestLimitMap, ip, 5, 60 * 1000);
}

// Periodic cleanup of rate limits every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const intervalId = setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of verifyLimitMap.entries()) {
    if (now > record.resetTime) verifyLimitMap.delete(ip);
  }
  for (const [ip, record] of sessionLimitMap.entries()) {
    if (now > record.resetTime) sessionLimitMap.delete(ip);
  }
  for (const [ip, record] of orderLimitMap.entries()) {
    if (now > record.resetTime) orderLimitMap.delete(ip);
  }
  for (const [ip, record] of requestLimitMap.entries()) {
    if (now > record.resetTime) requestLimitMap.delete(ip);
  }
}, CLEANUP_INTERVAL);

// Allow Node event loop to exit if this is the only active handle
if (typeof intervalId.unref === "function") {
  intervalId.unref();
}

// 6. DB Verification via Supabase RPC
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
