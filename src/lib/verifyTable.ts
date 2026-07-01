import crypto from "node:crypto";
import { z } from "zod";
import { supabase } from "./supabase";

// 1. Zod Validation Schemas
export const tableVerificationSchema = z.object({
  tableNumber: z.coerce.number().int().positive({ message: "Table number must be a positive integer" }),
  token: z.string().min(8).max(128).regex(/^[a-fA-F0-9]+$/, { message: "Invalid characters in token" }),
});

export const cookiePayloadSchema = z.object({
  sessionId: z.string().uuid(),
  sessionToken: z.string(),
  expiresAt: z.number().positive(),
});

export interface QrPayload {
  tableId: string;
  tableNumber: number;
  tokenVersion: number;
  issuedAt: number;
  restaurantId: string;
  qrVersion: number;
}

// 2. Secret Key Rotation Engine
const ACTIVE_SECRET = process.env.SESSION_SECRET || "default_smoobuds_cookie_secret_key_change_me_in_prod";
const PREVIOUS_SECRET = process.env.PREVIOUS_SESSION_SECRET || null;

export function signPayload(payload: string): string {
  return crypto.createHmac("sha256", ACTIVE_SECRET).update(payload).digest("hex");
}

export function verifySignature(payload: string, signature: string): boolean {
  // Check active secret
  let expectedSignature = crypto.createHmac("sha256", ACTIVE_SECRET).update(payload).digest("hex");
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    isValid = false;
  }

  // Fallback to previous secret
  if (!isValid && PREVIOUS_SECRET) {
    try {
      expectedSignature = crypto.createHmac("sha256", PREVIOUS_SECRET).update(payload).digest("hex");
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      );
    } catch {
      isValid = false;
    }
  }

  return isValid;
}

export const COOKIE_NAME = "smoobuds_table_session";

// 3. Signed QR Payload Utilities
export function signQrPayload(payload: QrPayload): string {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", ACTIVE_SECRET).update(dataStr).digest("base64url");
  return `${dataStr}.${signature}`;
}

export function verifyQrPayload(signedData: string): QrPayload | null {
  const parts = signedData.split(".");
  if (parts.length !== 2) return null;
  const [dataStr, signature] = parts;

  // Check active secret signature
  let expectedSignature = crypto.createHmac("sha256", ACTIVE_SECRET).update(dataStr).digest("base64url");
  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    isValid = false;
  }

  // Fallback to previous secret
  if (!isValid && PREVIOUS_SECRET) {
    try {
      expectedSignature = crypto.createHmac("sha256", PREVIOUS_SECRET).update(dataStr).digest("base64url");
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      isValid = false;
    }
  }

  if (!isValid) return null;

  try {
    const jsonStr = Buffer.from(dataStr, "base64url").toString("utf8");
    return JSON.parse(jsonStr) as QrPayload;
  } catch {
    return null;
  }
}

// 4. Privacy Hashing & Subnet Extraction
export function generateFingerprint(request: Request): string {
  const ua = request.headers.get("user-agent") || "";
  const lang = request.headers.get("accept-language") || "";
  const secChUa = request.headers.get("sec-ch-ua") || "";
  const secChUaPlatform = request.headers.get("sec-ch-ua-platform") || "";
  
  const raw = `${ua}|${lang}|${secChUa}|${secChUaPlatform}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function getIpHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
             request.headers.get("x-real-ip") ||
             "127.0.0.1";
  return crypto.createHash("sha256").update(ip).digest("hex");
}

export function getSubnet(ip: string): string {
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":"); // Take first 48 bits of IPv6
  } else {
    const parts = ip.split(".");
    return parts.slice(0, 3).join("."); // Take first 24 bits of IPv4
  }
}

// 5. Database Threat Intelligence Logging
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
    const userAgent = request ? (request.headers.get("user-agent") || "Unknown") : "Unknown";
    
    const hashedIp = crypto.createHash("sha256").update(rawIp).digest("hex");
    const hashedFingerprint = request ? generateFingerprint(request) : "unknown";

    const { error } = await supabase.from("security_threat_logs").insert({
      event_category: category,
      severity,
      details,
      hashed_client_ip: hashedIp,
      hashed_browser_fingerprint: hashedFingerprint,
      action_taken: severity === "Critical" ? "Revoke Session & Force Rescan" : "Deduct Trust Score / Flag Action",
    });
    if (error) {
      console.error("Threat Log Insert Error:", error.message);
    }
  } catch (err) {
    console.error("Threat logging exception:", err);
  }
}

// 6. Database Rate Limiter
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

// 7. DB Session Verification & Trust Score Engine
export interface SessionDetails {
  sessionId: string;
  sessionToken: string;
  tableNumber: number;
  tableId: string;
  tableSessionId?: string;
  displayName?: string;
  isNameSet: boolean;
  seatNumber?: number | null;
}

export async function verifyTableSession(
  cookieValue: string | undefined,
  request: Request | undefined
): Promise<SessionDetails | null> {
  if (!cookieValue || !request) return null;

  const parts = cookieValue.split(":");
  if (parts.length !== 4) return null;

  const [sessionId, sessionToken, expiresStr, signature] = parts;
  const payloadStr = `${sessionId}:${sessionToken}:${expiresStr}`;

  // Validate cookie signature
  if (!verifySignature(payloadStr, signature)) {
    console.warn("Table session cookie signature validation failed.");
    await logSecurityThreat(
      "Session Hijacking",
      "High",
      { message: "Cookie signature tampering detected" },
      request
    );
    return null;
  }

  // Parse payload structures
  const validationResult = cookiePayloadSchema.safeParse({
    sessionId,
    sessionToken,
    expiresAt: parseInt(expiresStr, 10),
  });

  if (!validationResult.success) {
    return null;
  }

  const { expiresAt } = validationResult.data;

  // Check expiration in cookie
  if (Date.now() > expiresAt) {
    console.warn("Table session cookie expired.");
    return null;
  }

  const currentFingerprint = generateFingerprint(request);

  // Validate session directly in the database
  const { data: dbSession, error } = await supabase
    .from("dining_sessions")
    .select(`
      id,
      session_token,
      is_active,
      expires_at,
      browser_fingerprint_hash,
      user_agent_hash,
      ip_subnet,
      trust_score,
      table_session_id,
      display_name,
      is_name_set,
      seat_number,
      restaurant_tables (
        id,
        table_number,
        is_active,
        qr_status
      )
    `)
    .eq("id", sessionId)
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !dbSession) {
    return null;
  }

  // Check active flag & DB expiration
  if (!dbSession.is_active || new Date(dbSession.expires_at).getTime() < Date.now()) {
    return null;
  }

  // Device Trust Engine Calculations
  let scoreDeduction = 0;

  // Fingerprint mismatch (deduct 100 - immediate revocation)
  if (dbSession.browser_fingerprint_hash !== currentFingerprint) {
    scoreDeduction += 100;
    await logSecurityThreat(
      "Device Mismatch",
      "Critical",
      { message: "Fingerprint changed during active session" },
      request
    );
  }

  // User-Agent mismatch (deduct 60)
  const currentUserAgentHash = crypto.createHash("sha256").update(request.headers.get("user-agent") || "").digest("hex");
  if (dbSession.user_agent_hash !== currentUserAgentHash) {
    scoreDeduction += 60;
    await logSecurityThreat(
      "Device Mismatch",
      "High",
      { message: "User-agent changed during active session" },
      request
    );
  }

  // IP Subnet consistency (deduct 15)
  const currentRawIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                       request.headers.get("x-real-ip") ||
                       "127.0.0.1";
  const currentSubnetHash = crypto.createHash("sha256").update(getSubnet(currentRawIp)).digest("hex");
  if (dbSession.ip_subnet && dbSession.ip_subnet !== currentSubnetHash) {
    scoreDeduction += 15;
    await logSecurityThreat(
      "Device Mismatch",
      "Low",
      { message: "Subnet migration detected" },
      request
    );
  }

  if (scoreDeduction > 0) {
    const nextTrustScore = Math.max(0, dbSession.trust_score - scoreDeduction);
    await supabase
      .from("dining_sessions")
      .update({ trust_score: nextTrustScore })
      .eq("id", sessionId);

    if (nextTrustScore < 50) {
      await logSecurityThreat(
        "Session Hijacking",
        "Critical",
        { message: "Session terminated due to low trust score", finalScore: nextTrustScore },
        request
      );
      // Evict dining session
      await supabase
        .from("dining_sessions")
        .update({ is_active: false })
        .eq("id", sessionId);
      return null;
    }
  }

  const table = dbSession.restaurant_tables as any;
  if (!table || !table.is_active || table.qr_status !== "Active") {
    return null;
  }

  // Validate the shared table session
  if (!dbSession.table_session_id) {
    return null;
  }
  const { data: tableSession, error: tableSessionError } = await supabase
    .from("table_sessions")
    .select("is_active, expires_at")
    .eq("id", dbSession.table_session_id)
    .single();

  if (
    tableSessionError || 
    !tableSession || 
    !tableSession.is_active || 
    new Date(tableSession.expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  return {
    sessionId: dbSession.id,
    sessionToken: dbSession.session_token,
    tableNumber: table.table_number,
    tableId: table.id,
    tableSessionId: dbSession.table_session_id,
    displayName: dbSession.display_name,
    isNameSet: dbSession.is_name_set,
    seatNumber: dbSession.seat_number,
  };
}

// 8. Dynamic QR Lookup (Plain Token & Grace Period Check)
export async function verifyTableToken(tableNumber: number, token: string): Promise<{ tableId: string } | null> {
  const { data: table, error } = await supabase
    .from("restaurant_tables")
    .select("id, is_active, qr_status, qr_token, previous_qr_token, rotated_at")
    .eq("table_number", tableNumber)
    .maybeSingle();

  if (error || !table || !table.is_active || table.qr_status !== "Active") {
    return null;
  }

  // 1. Check primary token
  if (table.qr_token === token) {
    return { tableId: table.id };
  }

  // 2. Check previous rotated token inside the Grace Period window
  if (table.previous_qr_token === token && table.rotated_at) {
    const graceMinutes = 15; // fallback default
    const graceExpiry = new Date(table.rotated_at).getTime() + graceMinutes * 60 * 1000;
    if (Date.now() < graceExpiry) {
      return { tableId: table.id };
    }
  }

  return null;
}
