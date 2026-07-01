import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createAuthClient, supabase } from "./supabase";
import { hasPermission, type Permission } from "./permissions";
import { isIpRateLimited, checkRateLimit } from "./verifyTable";

const INTERNAL_RPC_SECRET = process.env.INTERNAL_RPC_SECRET || "smoobuds_internal_rpc_secret_2026";

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

// 1. Zod Validation Schemas
const userInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["Owner", "Manager", "Staff"]),
  status: z.enum(["Pending", "Active", "Inactive", "Locked", "Suspended"]).default("Pending"),
});

// Helper: Verify User and Permissions (RBAC)
async function verifyPermission(
  authHeader: string | null,
  requiredPermission: Permission
): Promise<{ userId: string; role: string; email: string }> {
  if (!authHeader) {
    throw new Error("Missing authorization header.");
  }
  
  const token = authHeader.replace("Bearer ", "").trim();
  
  const authClient = createAuthClient(token);
  
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Unauthorized. Invalid session token.");
  }

  const sessionId = extractSessionId(token);
  
  if (sessionId) {
    try {
      const { data: isSessionValid, error: sessionError } = await authClient.rpc("verify_active_session", {
        p_user_id: user.id,
        p_session_id: sessionId
      });

      // ONLY throw if explicitly FALSE (ignore null or RPC errors for resilience)
      if (!sessionError && isSessionValid === false) {
        throw new Error("Session has been forcibly logged out.");
      }
    } catch (e) {
      console.warn("Session verification unavailable, proceeding with valid token");
    }
  }

  const { data: roleData, error: roleError } = await authClient
    .from("user_roles")
    .select("role, status, locked_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError || !roleData) {
    throw new Error(`Forbidden. User does not have an assigned admin role.`);
  }

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
async function createAuditLog(
  actorId: string, 
  targetUserId: string | null,
  action: string, 
  metadata: any = {}, 
  authClient?: any
) {
  try {
    const client = authClient || supabase;
    await client.rpc("insert_audit_log", {
      p_actor_id: actorId,
      p_target_user_id: targetUserId,
      p_action: action,
      p_details: metadata,
      p_device: "Server Action",
      p_browser: "Node.js",
      p_ip_address: "127.0.0.1",
      p_secret: INTERNAL_RPC_SECRET
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

// 2. Fetch Users
export const getUsersFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { token } = data;
    await verifyPermission(`Bearer ${token}`, "Users.View");
    const authClient = createAuthClient(token);
    const { data: users, error } = await authClient
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) throw new Error(error.message);
    return users || [];
  });

// 3. Save User (Create / Edit)
export const saveUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      payload: userInputSchema,
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    try {
      const { payload, token } = data;
      const { userId: actorId } = await verifyPermission(`Bearer ${token}`, payload.id ? "Users.Update" : "Users.Create");
      const authClient = createAuthClient(token);
      
      const normalizedEmail = payload.email.trim().toLowerCase();

      // Enforce email uniqueness
      const { data: existingUser } = await authClient
        .from("user_roles")
        .select("id, email, user_id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existingUser && existingUser.id !== payload.id) {
        throw new Error("Email address is already in use by another account.");
      }

      if (payload.id) {
        // UPDATE
        console.log("---- DB OP: SELECT (saveUser) ----");
        console.log("Current User ID (actorId):", actorId);
        console.log("JWT Subject (from verifyPermission):", actorId);
        
        const { data: originalUser, error: selectError } = await authClient.from("user_roles").select("*").eq("id", payload.id).single();
        if (selectError) {
          console.log("SELECT Error:", JSON.stringify(selectError, null, 2));
        }
        if (!originalUser) throw new Error("User not found.");

        // Check Owner protections
        if (originalUser.role === "Owner" && payload.role !== "Owner") {
           // Can't demote if they are the only owner (trigger will also catch this, but better UX here)
           const { count } = await authClient.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "Owner").eq("status", "Active").is("deleted_at", null);
           if ((count || 0) <= 1) {
             throw new Error("Cannot demote the only active Owner.");
           }
        }
        if (originalUser.role === "Owner" && originalUser.user_id === actorId && payload.status !== "Active") {
           throw new Error("You cannot change your own status.");
        }

        console.log("---- DB OP: UPDATE ----");
        const updateResult = await authClient
          .from("user_roles")
          .update({
            name: payload.name,
            email: normalizedEmail,
            role: payload.role,
            status: payload.status,
            updated_at: new Date().toISOString()
          })
          .eq("id", payload.id)
          .select()
          .single();

        const { data: updatedUser, error } = updateResult;
        console.log("UPDATE Result Data:", JSON.stringify(updatedUser, null, 2));
        if (error) {
          console.log("UPDATE Error Object:", JSON.stringify(error, null, 2));
          console.log("SQLSTATE Code:", error.code);
          console.log("PostgREST Error Message:", error.message);
        }

        console.log("User ID:", actorId);
        console.log("Supabase Error:", JSON.stringify(error, null, 2));
        console.log("Returned Data:", updatedUser);

        if (error) {
          throw new Error(JSON.stringify(error));
        }

        await createAuditLog(actorId, updatedUser.user_id, "Update User", { 
          table_name: "user_roles", record_id: payload.id, old_data: originalUser, new_data: updatedUser 
        }, authClient);

        return { success: true, user: updatedUser };

      } else {
        // CREATE
        console.log("---- DB OP: INSERT ----");
        const insertResult = await authClient
          .from("user_roles")
          .insert({
            name: payload.name,
            email: normalizedEmail,
            role: payload.role,
            status: payload.status,
          })
          .select()
          .single();
          
        const { data: newUser, error } = insertResult;
        console.log("INSERT Result Data:", JSON.stringify(newUser, null, 2));
        if (error) {
          console.log("INSERT Error Object:", JSON.stringify(error, null, 2));
          console.log("SQLSTATE Code:", error.code);
          console.log("PostgREST Error Message:", error.message);
        }

        console.log("User ID:", actorId);
        console.log("Supabase Error:", JSON.stringify(error, null, 2));
        console.log("Returned Data:", newUser);

        if (error) {
          throw new Error(JSON.stringify(error));
        }

        await createAuditLog(actorId, null, "Create User", { 
          table_name: "user_roles", record_id: newUser.id, new_data: newUser 
        }, authClient);

        return { success: true, user: newUser };
      }
    } catch (error: any) {
      throw new Error(error.message || "Failed to save user.");
    }
  });

// 4. Update Status (Suspend, Lock, Activate)
export const updateUserStatusFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      status: z.enum(["Pending", "Active", "Inactive", "Locked", "Suspended"]),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { id, status, token } = data;
    const { userId: actorId } = await verifyPermission(`Bearer ${token}`, "Users.Update");
    const authClient = createAuthClient(token);

    const { data: originalUser } = await authClient.from("user_roles").select("*").eq("id", id).single();
    if (!originalUser) throw new Error("User not found.");

    if (originalUser.role === "Owner" && originalUser.user_id === actorId) {
       throw new Error("You cannot change your own status.");
    }

    const { data: updatedUser, error } = await authClient
      .from("user_roles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    console.log("User ID:", actorId);
    console.log("Supabase Error:", JSON.stringify(error, null, 2));
    console.log("Returned Data:", updatedUser);

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    await createAuditLog(actorId, originalUser.user_id, "Change Status", { 
      table_name: "user_roles", record_id: id, old_data: { status: originalUser.status }, new_data: { status } 
    }, authClient);

    return { success: true };
  });

// 5. Soft Delete / Restore
export const toggleUserDeleteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      isDeleted: z.boolean(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { id, isDeleted, token } = data;
    const { userId: actorId } = await verifyPermission(`Bearer ${token}`, "Users.Delete");
    const authClient = createAuthClient(token);

    const { data: originalUser } = await authClient.from("user_roles").select("*").eq("id", id).single();
    if (!originalUser) throw new Error("User not found.");

    if (originalUser.user_id === actorId) {
       throw new Error("You cannot delete yourself.");
    }

    const deletedAt = isDeleted ? new Date().toISOString() : null;

    const { error } = await authClient
      .from("user_roles")
      .update({ deleted_at: deletedAt, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw new Error(error.message);

    await createAuditLog(actorId, originalUser.user_id, isDeleted ? "Delete User" : "Restore User", { 
      table_name: "user_roles", record_id: id 
    }, authClient);

    return { success: true };
  });

// 6. Reset Failed Attempts & Unlock
export const unlockUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      id: z.string().uuid(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { id, token } = data;
    const { userId: actorId } = await verifyPermission(`Bearer ${token}`, "Users.Update");
    const authClient = createAuthClient(token);

    const { data: originalUser } = await authClient.from("user_roles").select("user_id").eq("id", id).single();

    const { error } = await authClient
      .from("user_roles")
      .update({ failed_attempts: 0, locked_until: null, status: "Active" })
      .eq("id", id);

    if (error) throw new Error(error.message);

    await createAuditLog(actorId, originalUser?.user_id, "Unlock Account", { table_name: "user_roles", record_id: id }, authClient);

    return { success: true };
  });

// 7. Force Logout specific Session
export const forceLogoutSessionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      historyId: z.string().uuid(),
      token: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const { historyId, token } = data;
    const { userId: actorId } = await verifyPermission(`Bearer ${token}`, "Users.Update");
    const authClient = createAuthClient(token);

    const { data: historyRow } = await authClient.from("login_history").select("user_id").eq("id", historyId).single();

    if (historyRow?.user_id === actorId) {
      throw new Error("You cannot force logout your own session.");
    }

    const { error } = await authClient
      .from("login_history")
      .update({ is_forced_logout: true, logout_time: new Date().toISOString() })
      .eq("id", historyId);

    if (error) throw new Error(error.message);

    await createAuditLog(actorId, historyRow?.user_id, "Force Logout", { table_name: "login_history", record_id: historyId }, authClient);

    return { success: true };
  });

// 8. Fetch Audit Logs
export const getAuditLogsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { token } = data;
    await verifyPermission(`Bearer ${token}`, "Audit.View");
    const authClient = createAuthClient(token);
    
    const { data: logs, error } = await authClient
      .from("audit_logs")
      .select(`
        *,
        user:user_roles!user_id(name, email),
        target_user:user_roles!target_user_id(name, email)
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw new Error(error.message);
    return logs || [];
  });

// 9. Fetch Login History
export const getLoginHistoryFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { token } = data;
    await verifyPermission(`Bearer ${token}`, "Audit.View");
    const authClient = createAuthClient(token);
    
    const { data: history, error } = await authClient
      .from("login_history")
      .select(`
        *,
        user:user_roles!user_id(name, role)
      `)
      .order("login_time", { ascending: false });
    
    if (error) throw new Error(error.message);
    return history || [];
  });

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => 
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      device: z.string(),
      browser: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) throw new Error("No request context.");

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                     request.headers.get("x-real-ip") ||
                     "127.0.0.1";

    const emailHash = crypto.createHash("sha256").update(data.email.trim().toLowerCase()).digest("hex");

    // Rate Limit 1: IP rate limit for logins (max 10 attempts per 15 minutes)
    if (await isIpRateLimited(request, "login_ip", 10, 900)) {
      throw new Error("Too many login attempts from this IP. Please try again in 15 minutes.");
    }
    // Rate Limit 2: Email rate limit (max 5 attempts per 15 minutes)
    const emailKey = `rate:login_email:${emailHash}`;
    const emailAllowed = await checkRateLimit(emailKey, 5, 900);
    if (!emailAllowed) {
      throw new Error("Too many login attempts for this account. Please try again in 15 minutes.");
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        // Record failed attempt
        await supabase.rpc("record_login_attempt", {
          p_email: data.email,
          p_success: false,
          p_device: data.device,
          p_browser: data.browser,
          p_ip: clientIp,
          p_secret: INTERNAL_RPC_SECRET
        });
        throw new Error(authError?.message || "Invalid email or password.");
      }

      // Fetch user role info
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("status, role, locked_until")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      if (roleError || !roleData) {
        await supabase.auth.signOut();
        throw new Error("Unauthorized. Your email is not pre-authorized.");
      }

      // Enforce status checks
      if (roleData.status === "Pending") {
        await supabase.auth.signOut();
        throw new Error("Account is pending. Please contact the Owner.");
      }
      if (roleData.status === "Inactive") {
        await supabase.auth.signOut();
        throw new Error("Account is inactive.");
      }
      if (roleData.status === "Suspended") {
        await supabase.auth.signOut();
        throw new Error("Account is suspended.");
      }
      if (roleData.locked_until && new Date(roleData.locked_until) > new Date()) {
        await supabase.auth.signOut();
        throw new Error("Account is temporarily locked. Please contact the Owner.");
      }

      // Successful login: record attempt with session_id
      const sessionId = extractSessionId(authData.session?.access_token);
      await supabase.rpc("record_login_attempt", {
        p_email: data.email,
        p_success: true,
        p_device: data.device,
        p_browser: data.browser,
        p_ip: clientIp,
        p_secret: INTERNAL_RPC_SECRET,
        p_session_id: sessionId
      });

      return {
        success: true,
        session: authData.session,
        role: roleData.role,
      };
    } catch (err: any) {
      throw new Error(err.message || "Authentication failed.");
    }
  });

export const signupFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      device: z.string(),
      browser: z.string(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) throw new Error("No request context.");

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                     request.headers.get("x-real-ip") ||
                     "127.0.0.1";

    // Rate Limit IP for signups (max 5 signups per hour)
    if (await isIpRateLimited(request, "signup_ip", 5, 3600)) {
      throw new Error("Too many registrations from this IP. Please try again later.");
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Registration failed.");
      }

      let session = authData.session;
      if (!session) {
        // Sign in immediately to get a JWT
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (signInError) throw new Error(signInError.message);
        session = signInData.session;
      }

      if (!session) {
        throw new Error("Failed to establish session after signup. Please sign in manually.");
      }

      // Link Account
      const authClient = createAuthClient(session.access_token);
      const { data: linkSuccess, error: linkError } = await authClient.rpc("link_user_account");
      if (linkError) {
        console.error("Account linking error:", linkError);
      }

      if (!linkSuccess) {
        await supabase.auth.signOut();
        throw new Error("Registration failed. Your email has not been pre-authorized by an Owner.");
      }

      // Record successful login
      const sessionId = extractSessionId(session.access_token);
      await supabase.rpc("record_login_attempt", {
        p_email: data.email,
        p_success: true,
        p_device: data.device,
        p_browser: data.browser,
        p_ip: clientIp,
        p_secret: INTERNAL_RPC_SECRET,
        p_session_id: sessionId
      });

      // Fetch role
      const { data: roleData } = await authClient
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      return {
        success: true,
        session,
        role: roleData?.role || "Staff",
      };
    } catch (err: any) {
      throw new Error(err.message || "Registration failed.");
    }
  });
