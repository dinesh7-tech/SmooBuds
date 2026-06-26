import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ChefHat, Shield, Mail, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupRoute,
});

function SignupRoute() {
  const navigate = useNavigate({ from: "/signup" });
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // 1. Sign Up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw new Error(error.message);

      // signUp() may return session=null if Supabase hasn't issued the JWT yet.
      // We sign in immediately to guarantee an authenticated session before hitting user_roles.
      if (data.user) {
        let session = data.session;

        if (!session) {
          // Force a sign-in to get a real JWT
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw new Error(signInError.message);
          session = signInData.session;
        }

        if (!session) {
          throw new Error("Failed to obtain authenticated session after signup. Please sign in manually.");
        }

        // 2. Link Account (Associates auth.uid() with user_roles record, or creates Owner if DB is empty)
        const { data: linkSuccess, error: linkError } = await supabase.rpc("link_user_account");
        if (linkError) {
          console.error("Account linking error:", linkError);
        }

        if (!linkSuccess) {
          await supabase.auth.signOut();
          throw new Error("Registration failed. Your email has not been pre-authorized by an Owner.");
        }

        // 3. Fetch the assigned role to welcome the user appropriately
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        toast.success(
          roleData?.role === "Owner" 
            ? "Account created! Registered as Cafe Owner." 
            : `Account created! Registered as ${roleData?.role || 'Staff'}.`
        );
        
        // 4. Record successful login
        await supabase.rpc("record_login_attempt", {
          p_email: email, 
          p_success: true, 
          p_device: navigator.userAgent, 
          p_browser: navigator.vendor || "Unknown", 
          p_ip: "Client", 
          p_secret: "smoobuds_internal_rpc_secret_2026"
        });

        navigate({ to: "/admin", replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message || "Registration failed.");
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
            Register Admin Account
          </h2>
          <p className="text-xs text-sage/70 mt-1">
            Create your credentials to join the cafe crew.
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSignup} className="space-y-4">
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
                minLength={6}
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
            {loading ? "Registering..." : "Create Crew Account"}
          </button>
        </form>

        {/* Toggle Login Mode */}
        <div className="text-center mt-6 pt-6 border-t border-sage/10 text-xs text-sage/75">
          <p>
            Already part of the crew?{" "}
            <Link to="/login" className="text-sage-deep font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>

        {/* Demo Notice */}
        <div className="mt-6 bg-gold/10 border border-gold/25 rounded-2xl p-4 text-[10px] text-sage flex gap-2">
          <Shield size={16} className="text-gold flex-shrink-0" />
          <div>
            <span className="font-bold text-sage-deep">Note:</span> Your email must be pre-authorized by an Owner before you can register, unless you are the first user (Owner).
          </div>
        </div>
      </div>
    </div>
  );
}
