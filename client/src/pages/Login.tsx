import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
  Lock,
  BarChart3,
  Globe,
  TrendingUp,
} from "lucide-react";

/* ─── Gradient mesh blob (Stripe-inspired) ─────────────────────────────────── */
function GradientMesh() {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}
    >
      {/* Primary mesh blobs */}
      <div style={{
        position: "absolute",
        top: "-12rem",
        left: "8%",
        width: "52rem",
        height: "28rem",
        borderRadius: "999px",
        background: "radial-gradient(ellipse, rgba(255,174,92,0.36) 0%, rgba(83,58,253,0.42) 42%, rgba(234,34,97,0.28) 70%, transparent 100%)",
        filter: "blur(72px)",
        opacity: 0.7,
        transform: "rotate(-8deg)",
      }} />
      <div style={{
        position: "absolute",
        top: "-6rem",
        right: "-10%",
        width: "38rem",
        height: "22rem",
        borderRadius: "999px",
        background: "radial-gradient(ellipse, rgba(83,58,253,0.32) 0%, rgba(249,107,238,0.24) 60%, transparent 100%)",
        filter: "blur(60px)",
        opacity: 0.6,
        transform: "rotate(12deg)",
      }} />
      <div style={{
        position: "absolute",
        bottom: "-4rem",
        left: "30%",
        width: "34rem",
        height: "18rem",
        borderRadius: "999px",
        background: "radial-gradient(ellipse, rgba(83,58,253,0.18) 0%, rgba(255,86,0,0.12) 60%, transparent 100%)",
        filter: "blur(56px)",
        opacity: 0.5,
      }} />
    </div>
  );
}

/* ─── Social proof card ─────────────────────────────────────────────────────── */
function TrustCard({
  icon: Icon,
  label,
  value,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-kincaid-slide-up"
      style={{
        animationDelay: `${delay}ms`,
        padding: "16px 18px",
        borderRadius: "var(--kiq-radius-lg)",
        border: "1px solid rgba(var(--kiq-shadow-blue), 0.09)",
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 1px 3px rgba(var(--kiq-shadow-blue), 0.06), inset 0 1px 0 rgba(255,255,255,0.88)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{
        width: 36,
        height: 36,
        borderRadius: "var(--kiq-radius-sm)",
        background: "linear-gradient(135deg, rgba(83,58,253,0.12), rgba(83,58,253,0.06))",
        border: "1px solid rgba(83,58,253,0.14)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}>
        <Icon size={16} style={{ color: "var(--kiq-primary)" }} />
      </div>
      <div>
        <div style={{
          fontSize: 18,
          fontWeight: 300,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          color: "var(--kiq-ink)",
          fontFeatureSettings: '"tnum"',
        }}>{value}</div>
        <div style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: "var(--kiq-muted)",
          marginTop: 2,
          letterSpacing: 0,
        }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Testimonial ────────────────────────────────────────────────────────────── */
function Testimonial() {
  return (
    <div
      className="animate-kincaid-slide-up animation-delay-300"
      style={{
        padding: "20px 22px",
        borderRadius: "var(--kiq-radius-lg)",
        border: "1px solid rgba(var(--kiq-shadow-blue), 0.09)",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px)",
        boxShadow: "0 1px 3px rgba(var(--kiq-shadow-blue), 0.05), inset 0 1px 0 rgba(255,255,255,0.82)",
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ color: "#f5a623", fontSize: 13 }}>★</div>
        ))}
      </div>
      <p style={{
        fontSize: 13.5,
        fontWeight: 400,
        lineHeight: 1.6,
        color: "var(--kiq-ink-soft)",
        margin: 0,
        letterSpacing: "-0.01em",
      }}>
        "Kincaid Health transformed how our CFO team approaches benefit analytics. The evidence-grade fiduciary controls are unlike anything we've used."
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--kiq-navy), var(--kiq-primary))",
          display: "grid",
          placeItems: "center",
          color: "white",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}>MR</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--kiq-ink)", letterSpacing: "-0.01em" }}>
            Michael R.
          </div>
          <div style={{ fontSize: 11, color: "var(--kiq-muted)" }}>
            CFO, Fortune 500 Healthcare Group
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Login Page ─────────────────────────────────────────────────────────────── */
export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get("mode") === "register" ? "register" : "login";

  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ username, password });
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await register({ username, email, password });
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
      className="kiq-public-shell"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px 16px",
      }}
    >
      <GradientMesh />

      {/* ── Main grid ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 1080,
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gap: 48,
          alignItems: "center",
        }}
        className="lg:grid-cols-[1fr_420px] max-lg:grid-cols-1"
      >
        {/* ── Left: Hero section ── */}
        <section className="hidden lg:block">
          {/* Badge — Intercom eyebrow */}
          <div className="kiq-public-badge animate-kincaid-slide-up" style={{ marginBottom: 28 }}>
            <Sparkles size={12} />
            Kincaid Health Intelligence Platform
          </div>

          {/* Hero title — Apple + Stripe display treatment */}
          <h1
            className="kiq-public-title animate-kincaid-slide-up animation-delay-100"
            style={{ maxWidth: 560, marginBottom: 20 }}
          >
            Evidence-grade healthcare intelligence.
            <span
              className="kiq-public-gradient-text"
              style={{ display: "block" }}
            >
              Built for scrutiny.
            </span>
          </h1>

          {/* Lead copy — Intercom body-lg */}
          <p
            className="kiq-public-lead animate-kincaid-slide-up animation-delay-200"
            style={{ maxWidth: 500, marginBottom: 36 }}
          >
            A premium command system for fiduciary controls, contract evidence,
            executive reporting, and health-plan financial governance.
          </p>

          {/* Trust cards — Stripe feature cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              maxWidth: 500,
            }}
          >
            <TrustCard
              icon={ShieldCheck}
              label="SOC 2 Type II Ready"
              value="Enterprise-grade"
              delay={200}
            />
            <TrustCard
              icon={Lock}
              label="Data encryption"
              value="AES-256"
              delay={260}
            />
            <TrustCard
              icon={BarChart3}
              label="Data points processed"
              value="2.4B+"
              delay={320}
            />
            <TrustCard
              icon={Globe}
              label="Organizations served"
              value="5,000+"
              delay={380}
            />
          </div>

          {/* Testimonial — Intercom testimonial-card */}
          <Testimonial />
        </section>

        {/* ── Right: Auth card ── */}
        <div
          className="kiq-public-card animate-kincaid-slide-up"
          style={{ padding: 28, width: "100%" }}
        >
          {/* Card header */}
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            {/* Brand mark */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: "linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 40%), linear-gradient(135deg, var(--kiq-navy) 0%, var(--kiq-primary) 60%, var(--kiq-ruby) 100%)",
                boxShadow: "0 16px 36px rgba(83,58,253,0.28), inset 0 1px 0 rgba(255,255,255,0.34)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
              aria-hidden="true"
            >
              KH
            </div>

            <h2 style={{
              fontSize: 24,
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.04em",
              color: "var(--kiq-ink)",
              margin: "0 0 8px",
            }}>
              {mode === "login" ? "Welcome back" : "Create your workspace"}
            </h2>
            <p style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "var(--kiq-muted)",
              margin: 0,
              fontWeight: 400,
            }}>
              {mode === "login"
                ? "Access your enterprise health intelligence console."
                : "Start with a secure fiduciary intelligence workspace."}
            </p>
          </div>

          {/* Mode toggle — Intercom pricing-tab style */}
          <div
            style={{
              display: "flex",
              padding: 4,
              borderRadius: "var(--kiq-radius-pill)",
              border: "1px solid rgba(var(--kiq-shadow-blue), 0.09)",
              background: "rgba(245,241,236,0.72)",
              marginBottom: 22,
              gap: 2,
            }}
          >
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                data-testid={`tab-${m}`}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: "var(--kiq-radius-pill)",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  cursor: "pointer",
                  transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
                  ...(mode === m ? {
                    background: "#fff",
                    color: "var(--kiq-ink)",
                    boxShadow: "0 1px 3px rgba(var(--kiq-shadow-blue), 0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                  } : {
                    background: "transparent",
                    color: "var(--kiq-muted)",
                  }),
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Error state */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: "var(--kiq-radius-sm)",
                border: "1px solid rgba(234,34,97,0.2)",
                background: "rgba(234,34,97,0.05)",
                marginBottom: 16,
                fontSize: 13,
                color: "#b91c1c",
                fontWeight: 400,
              }}
            >
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Username field */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--kiq-subtle)",
                  marginBottom: 6,
                }}
              >
                {mode === "login" ? "Username or Email" : "Username"}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder={mode === "login" ? "Enter username or email" : "Choose a username"}
                className="kiq-input"
                data-testid="input-username"
              />
            </div>

            {/* Email field (register only) */}
            {mode === "register" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--kiq-subtle)",
                    marginBottom: 6,
                  }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="Enter email address"
                  className="kiq-input"
                  data-testid="input-email"
                />
              </div>
            )}

            {/* Password field */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--kiq-subtle)",
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Enter password"
                  className="kiq-input"
                  style={{ paddingRight: 44 }}
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 30,
                    height: 30,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "var(--kiq-radius-sm)",
                    border: "none",
                    background: "transparent",
                    color: "var(--kiq-subtle)",
                    cursor: "pointer",
                    transition: "color 150ms ease",
                  }}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {mode === "register" && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--kiq-subtle)",
                    marginBottom: 6,
                  }}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  className="kiq-input"
                  data-testid="input-confirm-password"
                />
              </div>
            )}

            {/* Submit — Stripe pill primary button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 44,
                width: "100%",
                marginTop: 4,
                borderRadius: "var(--kiq-radius-pill)",
                border: "1px solid color-mix(in srgb, var(--kiq-primary) 72%, white)",
                background: loading
                  ? "var(--kiq-primary-deep)"
                  : "linear-gradient(135deg, var(--kiq-primary), var(--kiq-primary-deep))",
                color: "#fff",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: 0,
                boxShadow: "0 12px 28px rgba(83,58,253,0.24), inset 0 1px 0 rgba(255,255,255,0.22)",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.78 : 1,
                transition: "all 160ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              data-testid="button-submit-auth"
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  {mode === "login" ? "Authenticating…" : "Creating Account…"}
                </>
              ) : (
                <>
                  {mode === "login" ? "Access Platform" : "Create Account"}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "18px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "rgba(var(--kiq-shadow-blue), 0.08)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--kiq-subtle)", letterSpacing: 0 }}>
              or continue with
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(var(--kiq-shadow-blue), 0.08)" }} />
          </div>

          {/* OAuth buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {/* Google */}
            <a
              href="/api/auth/google"
              style={{
                display: "flex",
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--kiq-radius-sm)",
                border: "1px solid rgba(var(--kiq-shadow-blue), 0.1)",
                background: "rgba(255,255,255,0.82)",
                boxShadow: "0 1px 3px rgba(var(--kiq-shadow-blue), 0.06), inset 0 1px 0 rgba(255,255,255,0.88)",
                transition: "all 160ms ease",
                cursor: "pointer",
                textDecoration: "none",
              }}
              title="Sign in with Google"
              data-testid="button-oauth-google"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 20px rgba(var(--kiq-shadow-blue), 0.1), inset 0 1px 0 rgba(255,255,255,0.92)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 1px 3px rgba(var(--kiq-shadow-blue), 0.06), inset 0 1px 0 rgba(255,255,255,0.88)";
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </a>

            {/* GitHub */}
            <a
              href="/api/auth/github"
              style={{
                display: "flex",
                width: 48,
                height: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "var(--kiq-radius-sm)",
                border: "1px solid rgba(var(--kiq-shadow-blue), 0.1)",
                background: "rgba(255,255,255,0.82)",
                boxShadow: "0 1px 3px rgba(var(--kiq-shadow-blue), 0.06), inset 0 1px 0 rgba(255,255,255,0.88)",
                transition: "all 160ms ease",
                cursor: "pointer",
                textDecoration: "none",
                color: "var(--kiq-ink)",
              }}
              title="Sign in with GitHub"
              data-testid="button-oauth-github"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 8px 20px rgba(var(--kiq-shadow-blue), 0.1), inset 0 1px 0 rgba(255,255,255,0.92)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "";
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 1px 3px rgba(var(--kiq-shadow-blue), 0.06), inset 0 1px 0 rgba(255,255,255,0.88)";
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
            </a>
          </div>

          {/* Fine print */}
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--kiq-subtle)",
              marginTop: 18,
              letterSpacing: 0,
              lineHeight: 1.5,
            }}
          >
            Fiduciary-grade · AES-256 Encrypted · SOC 2 Type II
          </p>
        </div>
      </div>
    </div>
  );
}
