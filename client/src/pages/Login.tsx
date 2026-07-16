import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion, useMotionValue, useTransform } from "framer-motion";
import * as THREE from "three";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  varying vec2 vUv;

  mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) {
      v += a * noise(p);
      p = rot(0.52) * p * 2.04 + 0.13;
      a *= 0.52;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec2 mouse = (uMouse - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    float t = uTime * 0.055;
    float d = length(p - mouse * 0.34);

    vec2 flow = p;
    flow += 0.22 * vec2(
      sin((p.y * 3.3) + t * 2.0),
      cos((p.x * 2.7) - t * 1.7)
    );
    flow += mouse * 0.18;

    float n1 = fbm(flow * 2.0 + vec2(t, -t * 0.55));
    float n2 = fbm(flow * 4.2 - vec2(t * 0.7, t * 0.9));
    float n3 = fbm((flow + n1) * 7.0 + t);

    vec3 purple = vec3(0.176, 0.106, 0.306);   // #2d1b4e
    vec3 blue   = vec3(0.102, 0.212, 0.365);   // #1a365d
    vec3 ink    = vec3(0.018, 0.023, 0.055);
    vec3 cyan   = vec3(0.120, 0.945, 1.000);
    vec3 violet = vec3(0.420, 0.220, 0.780);

    vec3 color = mix(ink, purple, smoothstep(0.12, 0.86, n1));
    color = mix(color, blue, smoothstep(0.22, 0.88, n2));
    color += cyan * pow(max(0.0, n3), 4.0) * 0.34;
    color += violet * pow(max(0.0, n2 - 0.18), 3.0) * 0.22;

    float beam = smoothstep(0.015, 0.0, abs(sin((p.x + p.y) * 5.0 + n1 * 4.0 + t * 2.0))) * 0.09;
    float mouseGlow = exp(-d * 4.4) * 0.22;
    float vignette = smoothstep(1.18, 0.18, length(p));

    color += cyan * (beam + mouseGlow);
    color *= vignette;
    color += vec3(0.006, 0.010, 0.025);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function FluidShaderPlane({ mouse }: { mouse: React.MutableRefObject<THREE.Vector2> }) {
  const material = useRef<THREE.ShaderMaterial | null>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    [],
  );

  useEffect(() => {
    if (material.current) {
      material.current.uniforms.uResolution.value.set(size.width, size.height);
    }
  }, [size.width, size.height]);

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uMouse.value.lerp(mouse.current, 0.045);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2, 1, 1]} />
      <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function WebGLBackground({ mouse }: { mouse: React.MutableRefObject<THREE.Vector2> }) {
  return (
    <div className="kiq-webgl-background" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 1], fov: 75 }} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}>
        <FluidShaderPlane mouse={mouse} />
      </Canvas>
      <div className="kiq-webgl-grid" />
      <div className="kiq-webgl-orb orb-left" />
      <div className="kiq-webgl-orb orb-right" />
      <div className="kiq-webgl-vignette" />
    </div>
  );
}

function TiltGlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-80, 80], [7, -7]);
  const rotateY = useTransform(x, [-80, 80], [-7, 7]);

  return (
    <motion.div
      className={`premium-glass glowing-border ${className}`}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - rect.left - rect.width / 2);
        y.set(event.clientY - rect.top - rect.height / 2);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileHover={{ y: -4, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 170, damping: 18 }}
    >
      {children}
    </motion.div>
  );
}

const stats = [
  { icon: BarChart3, value: "10B+", label: "Data Points Processed" },
  { icon: ShieldCheck, value: "SOC 2", label: "Type II Certified" },
  { icon: Globe2, value: "Global", label: "Fiduciary Controls" },
  { icon: LockKeyhole, value: "Enterprise", label: "Grade Security" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, register } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get("mode") === "register" ? "register" : "login";

  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
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
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
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
    <main
      className="kiq-webgl-landing"
      onPointerMove={(event) => {
        mouse.current.set(event.clientX / window.innerWidth, 1 - event.clientY / window.innerHeight);
      }}
    >
      <WebGLBackground mouse={mouse} />

      <section className="kiq-webgl-hero">
        <div className="kiq-webgl-left">
          <motion.div
            className="kiq-webgl-eyebrow"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <Sparkles size={14} />
            Kincaid Health Intelligence OS
          </motion.div>

          <motion.h1
            className="kiq-webgl-title"
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.055 } },
            }}
          >
            {[
              { text: "Precision", tone: "ice" },
              { text: "Healthcare", tone: "white" },
              { text: "Intelligence.", tone: "cyan" },
              { text: "Scaled", tone: "violet" },
              { text: "for", tone: "soft" },
              { text: "Global", tone: "blue" },
              { text: "Impact.", tone: "white" },
            ].map((word, index) => (
              <motion.span
                key={`${word.text}-${index}`}
                className={`kiq-title-word tone-${word.tone}`}
                variants={{
                  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
                  show: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
              >
                {word.text}&nbsp;
              </motion.span>
            ))}
          </motion.h1>

          <motion.p
            className="kiq-webgl-subtitle"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            Advanced fiduciary controls and contract intelligence for global healthcare systems.
          </motion.p>

          <motion.div
            className="kiq-webgl-stat-grid"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.58, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {stats.map(({ icon: Icon, value, label }) => (
              <TiltGlassCard key={label} className="kiq-webgl-stat-card">
                <div className="kiq-webgl-icon-ring">
                  <Icon size={22} />
                </div>
                <div>
                  <div className="kiq-webgl-stat-value">{value}</div>
                  <div className="kiq-webgl-stat-label">{label}</div>
                </div>
              </TiltGlassCard>
            ))}
          </motion.div>

          <motion.div
            className="premium-glass glowing-border kiq-webgl-testimonial"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.78, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="kiq-webgl-stars" aria-label="5 star rating">
              {[0, 1, 2, 3, 4].map((star) => (
                <svg key={star} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2.2l2.9 6 6.6.95-4.77 4.65 1.13 6.57L12 17.27l-5.86 3.1 1.13-6.57L2.5 9.15l6.6-.95L12 2.2z" />
                </svg>
              ))}
            </div>
            <p>“Kincaid Health provides unparalleled insights, transforming our approach to benefit analytics and risk management.”</p>
            <div className="kiq-webgl-avatar-row">
              <a
                className="kiq-webgl-avatar"
                href="https://www.linkedin.com/in/shrack/"
                target="_blank"
                rel="noreferrer"
                aria-label="Jeremiah Franklin Shrack LinkedIn profile"
              >
                <img src="/jeremiah-franklin-shrack.png" alt="Jeremiah Franklin Shrack" />
              </a>
              <a className="kiq-webgl-profile-link" href="https://www.linkedin.com/in/shrack/" target="_blank" rel="noreferrer">
                Jeremiah Franklin Shrack
              </a>
            </div>
          </motion.div>
        </div>

        <motion.aside
          className="premium-glass glowing-border kiq-webgl-auth"
          initial={{ opacity: 0, x: 34, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ delay: 0.36, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="kiq-webgl-auth-shine" />
          <div className="kiq-webgl-logo">KH</div>
          <h2>{mode === "login" ? "Welcome back" : "Create your workspace"}</h2>
          <p className="kiq-webgl-auth-subtitle">
            {mode === "login" ? "Access your enterprise health intelligence console" : "Register your secure enterprise health intelligence console"}
          </p>

          <div className="kiq-webgl-tabs" role="tablist">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={mode === item ? "is-active" : ""}
                onClick={() => {
                  setMode(item);
                  setError(null);
                }}
                data-testid={`tab-${item}`}
              >
                {item === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {error && (
            <div className="kiq-webgl-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="kiq-webgl-form">
            <label className="kiq-webgl-field">
              <span>{mode === "login" ? "Username or Email" : "Username"}</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoComplete="username"
                data-testid="input-username"
              />
            </label>

            {mode === "register" && (
              <label className="kiq-webgl-field">
                <span>Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </label>
            )}

            <label className="kiq-webgl-field">
              <span>Password</span>
              <div className="kiq-webgl-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  data-testid="input-password"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} data-testid="button-toggle-password">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <label className="kiq-webgl-field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                  data-testid="input-confirm-password"
                />
              </label>
            )}

            <button className="kiq-webgl-cta" type="submit" disabled={loading} data-testid="button-submit-auth">
              <span>{loading ? (mode === "login" ? "Authenticating…" : "Creating Account…") : mode === "login" ? "Access Platform" : "Create Account"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="kiq-webgl-divider">
            <span />
            or continue with
            <span />
          </div>

          <div className="kiq-webgl-sso">
            <a className="premium-glass" href="/api/auth/google" data-testid="button-oauth-google">
              <svg viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Google
            </a>
            <a className="premium-glass" href="/api/auth/github" data-testid="button-oauth-github">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              GitHub
            </a>
          </div>
        </motion.aside>
      </section>
    </main>
  );
}
