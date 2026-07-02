import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Github, Chrome, AlertCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login({ username, password });
      } else {
        await register({ username, password });
      }
      setLocation("/");
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "hsl(238 95% 3%)",
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(0,140,255,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(120,60,255,0.06) 0%, transparent 60%)",
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,140,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,140,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(0,100,255,0.05) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-60 h-60 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(120,60,255,0.04) 0%, transparent 70%)" }}
      />

      <div className="w-full max-w-sm relative z-10 animate-float-up">
        {/* Banner */}
        <div className="mb-7 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(0,43,92,0.50)", boxShadow: "0 6px 30px rgba(0,43,92,0.30)" }}>
          <div className="w-full" style={{ height: 90, background: "linear-gradient(135deg, #002B5C 0%, #9B1C2E 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 900, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const }}>KINCAID IQ — FIDUCIARY INTELLIGENCE</span>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7"
          style={{
            background: "rgba(5, 8, 40, 0.88)",
            backdropFilter: "blur(32px)",
            border: "1px solid rgba(0, 140, 255, 0.12)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Tab toggle */}
          <div
            className="flex rounded-xl p-1 mb-6"
            style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(0,140,255,0.07)" }}
          >
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
              style={{
                background: mode === "login" ? "rgba(0,140,255,0.15)" : "transparent",
                color: mode === "login" ? "hsl(207 100% 68%)" : "rgba(130,160,200,0.45)",
                border: mode === "login" ? "1px solid rgba(0,160,255,0.25)" : "1px solid transparent",
                boxShadow: mode === "login" ? "0 0 14px rgba(0,140,255,0.15)" : "none",
              }}
              data-testid="tab-login"
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200"
              style={{
                background: mode === "register" ? "rgba(255,184,0,0.1)" : "transparent",
                color: mode === "register" ? "hsl(44 100% 65%)" : "rgba(130,160,200,0.45)",
                border: mode === "register" ? "1px solid rgba(255,184,0,0.25)" : "1px solid transparent",
                boxShadow: mode === "register" ? "0 0 14px rgba(255,184,0,0.1)" : "none",
              }}
              data-testid="tab-register"
            >
              Register
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                background: "rgba(255,60,60,0.08)",
                border: "1px solid rgba(255,60,60,0.2)",
                color: "hsl(0 90% 68%)",
              }}
            >
              <AlertCircle size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="section-label block mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter username"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/40"
                style={{
                  background: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(0,140,255,0.12)",
                  color: "white",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(0,160,255,0.38)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,140,255,0.08)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(0,140,255,0.12)"; e.target.style.boxShadow = "none"; }}
                data-testid="input-username"
              />
            </div>

            {/* Password */}
            <div>
              <label className="section-label block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Enter password"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all duration-200 placeholder:text-muted-foreground/40"
                  style={{
                    background: "rgba(255,255,255,0.035)",
                    border: "1px solid rgba(0,140,255,0.12)",
                    color: "white",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(0,160,255,0.38)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,140,255,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(0,140,255,0.12)"; e.target.style.boxShadow = "none"; }}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-80 transition-opacity"
                  style={{ color: "rgba(130,160,200,0.4)" }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 mt-2"
              style={{
                background:
                  mode === "login"
                    ? "linear-gradient(135deg, rgba(0,140,255,0.25) 0%, rgba(0,100,200,0.15) 100%)"
                    : "linear-gradient(135deg, rgba(255,184,0,0.2) 0%, rgba(200,140,0,0.12) 100%)",
                color: mode === "login" ? "hsl(207 100% 70%)" : "hsl(44 100% 65%)",
                border:
                  mode === "login"
                    ? "1px solid rgba(0,160,255,0.28)"
                    : "1px solid rgba(255,184,0,0.28)",
                boxShadow:
                  mode === "login"
                    ? "0 0 20px rgba(0,140,255,0.12)"
                    : "0 0 20px rgba(255,184,0,0.1)",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              data-testid="button-submit-auth"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  {mode === "login" ? "Authenticating..." : "Creating Account..."}
                </span>
              ) : mode === "login" ? "Access Platform" : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 neon-divider" />
            <span className="text-[11px]" style={{ color: "rgba(130,160,200,0.28)" }}>
              or continue with
            </span>
            <div className="flex-1 neon-divider" />
          </div>

          {/* OAuth buttons */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/api/auth/google"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 hover:bg-white/5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(200,220,255,0.6)",
              }}
              data-testid="button-oauth-google"
            >
              <Chrome size={15} />
              Google
            </a>
            <a
              href="/api/auth/github"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90 hover:bg-white/5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(200,220,255,0.6)",
              }}
              data-testid="button-oauth-github"
            >
              <Github size={15} />
              GitHub
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] mt-5" style={{ color: "rgba(130,160,200,0.25)" }}>
          Fiduciary-grade · AES-256 Encrypted · SOC 2 Type II
        </p>
      </div>
    </div>
  );
}
