import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = () => {
  if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env) {
    if ((import.meta as any).env.VITE_SUPABASE_URL) return (import.meta as any).env.VITE_SUPABASE_URL;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_SUPABASE_URL;
  }
  return undefined;
};

const getSupabaseAnonKey = () => {
  if (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env) {
    if ((import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY) return (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  }
  return undefined;
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Warning: Supabase environment variables are missing. App may fail during operations requiring database access.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

export const createAuthClient = (token: string) => {
  return createClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-anon-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      accessToken: async () => token,
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        fetch: (url, options) => {
          // Force Authorization header directly at the fetch level to prevent Vercel Node runtime interceptor bugs
          const newHeaders = new Headers(options?.headers);
          newHeaders.set("Authorization", `Bearer ${token}`);
          return fetch(url, { ...options, headers: newHeaders });
        },
      },
    }
  );
};
