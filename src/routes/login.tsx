import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ChefHat, Shield, Mail, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loginFn } from "@/lib/userManagementActions";

// Helper to safely extract session_id from JWT payload in the browser
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

export const Route = createFileRoute("/login")({
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Check if already logged in, redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate({ to: "/admin", replace: true });
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // Authenticate via secure server function to enforce server rate limits and protect audit secrets
      const res = await loginFn({
        data: {
          email,
          password,
          device: navigator.userAgent,
          browser: navigator.vendor || "Unknown",
        }
      });

      if (res.success && res.session) {
        // Set the session locally in the browser
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token
        });

        if (sessionError) throw sessionError;

        toast.success(`Welcome back! Logged in as ${res.role}.`);
        navigate({ to: "/admin", replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink font-body flex items-center justify-center p-6 relative overflow-hidden">
      {/* Visual background glows */}
      <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-gold/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-sage/10 blur-3xl" />

      <div className="w-full max-w-md bg-white/40 border border-sage/15 backdrop-blur-md rounded-3xl p-8 shadow-luxe relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-sage flex items-center justify-center text-cream mb-4 shadow-soft">
            <ChefHat size={24} />
          </div>
          <span className="font-signature text-3xl text-gold-gradient block">Smoobuds</span>
          <h2 className="font-display font-extrabold text-xl text-sage-deep mt-2 tracking-tight">
            Staff Portal Login
          </h2>
          <p className="text-xs text-sage/70 mt-1">
            Authentication required to access operations.
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold block mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@smoobuds.com"
                className="w-full bg-white/60 border border-sage/10 rounded-2xl pl-10 pr-6 py-3 text-sm focus:outline-none focus:border-sage focus:bg-white transition-all placeholder-sage/35"
              />
            </div>
          </div>

          <div>
            <label className="text-[0.65rem] uppercase tracking-wider text-sage font-display font-semibold block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-sage/40" size={16} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/60 border border-sage/10 rounded-2xl pl-10 pr-6 py-3 text-sm focus:outline-none focus:border-sage focus:bg-white transition-all placeholder-sage/35"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sage hover:bg-sage-deep text-cream disabled:opacity-50 font-display font-semibold tracking-widest text-xs uppercase py-3.5 rounded-2xl border border-white/10 transition-colors shadow-soft mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>

        {/* Link to Signup */}
        <div className="text-center mt-6 pt-6 border-t border-sage/10 text-xs text-sage/75">
          <p>
            New staff member?{" "}
            <Link to="/signup" className="text-sage-deep font-bold hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
