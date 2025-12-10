import { useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { ArrowLeft, Mail, Lock, Loader2 } from "lucide-react";
import { startGoogleLogin, startGithubLogin, loginWithCredentials } from "../services/auth";
import { useTheme } from "../state/ThemeContext";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";

const palettes = {
  dark: {
    bg: "radial-gradient(circle at 18% 22%, rgba(59,130,246,0.22), transparent 32%), radial-gradient(circle at 78% 6%, rgba(147,51,234,0.2), transparent 30%), linear-gradient(135deg, #050910 0%, #080f1c 45%, #0a1322 100%)",
    card: "rgba(12,18,31,0.92)",
    border: "rgba(148,163,184,0.3)",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    accent: "#3b82f6",
    accentAlt: "#6366f1",
    fieldBg: "rgba(15,23,42,0.7)",
    fieldBorder: "rgba(148,163,184,0.45)",
    glowBlue: "rgba(59,130,246,0.35)",
    glowPurple: "rgba(147,51,234,0.3)",
    glowCyan: "rgba(6,182,212,0.28)",
    shadow: "0 28px 80px rgba(2,6,23,0.65)",
  },
  light: {
    bg: "radial-gradient(circle at 18% 22%, rgba(59,130,246,0.18), transparent 34%), radial-gradient(circle at 80% 12%, rgba(147,51,234,0.16), transparent 30%), linear-gradient(135deg, #f6f8ff 0%, #eef2ff 50%, #e2e8ff 100%)",
    card: "rgba(255,255,255,0.9)",
    border: "rgba(148,163,184,0.45)",
    text: "#0f172a",
    textMuted: "#475467",
    accent: "#2563eb",
    accentAlt: "#7c3aed",
    fieldBg: "rgba(255,255,255,0.95)",
    fieldBorder: "rgba(148,163,184,0.5)",
    glowBlue: "rgba(59,130,246,0.22)",
    glowPurple: "rgba(147,51,234,0.18)",
    glowCyan: "rgba(14,165,233,0.16)",
    shadow: "0 28px 70px rgba(15,23,42,0.15)",
  },
} as const;

type Palette = (typeof palettes)[keyof typeof palettes];

type LoginPageProps = {
  onBack: () => void;
};

export default function LoginPage({ onBack }: LoginPageProps) {
  const { theme } = useTheme();
  const palette = useMemo<Palette>(() => (theme === "light" ? palettes.light : palettes.dark), [theme]);
  const styles = useMemo(() => buildStyles(palette), [palette]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  const handleSignIn = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const response = await loginWithCredentials(email, password);
      if (response.success) {
        window.location.href = "/";
        return;
      }
      setError(response.message || "Invalid credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await startGoogleLogin();
    } catch {
      setError("Google login failed");
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    try {
      await startGithubLogin();
    } catch {
      setError("GitHub login failed");
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.glowLayer}>
        {renderGlow(palette.glowBlue, "18%", "18%", 360)}
        {renderGlow(palette.glowPurple, "78%", "85%", 420)}
        {renderGlow(palette.glowCyan, "92%", "42%", 280)}
      </div>

      <div style={styles.contentWrap}>
        <div style={styles.headerRow}>
          <button type="button" onClick={onBack} style={styles.backButton}>
            <ArrowLeft size={16} />
            Back
          </button>
        </div>

        <div style={styles.layout}>
          <section style={styles.heroSection}>
            <div style={styles.heroBadge}>2025 RELEASE</div>
            <h2 style={styles.heroTitle}>Voice AI – Workflow Callout</h2>
            <p style={styles.heroBody}>
              Orchestrate real-time voice agents, route intents, and ship production-grade callouts with
              confident control.
            </p>
            <div style={styles.heroMeta}>
              {["Realtime audio", "Agentic routing", "Secure SSO"].map((item) => (
                <span key={item} style={styles.heroMetaItem}>{item}</span>
              ))}
            </div>
          </section>

          <section style={styles.formColumn}>
            <div style={styles.card}>
              <div style={{ marginBottom: 24 }}>
                <div style={styles.logoMark}>V</div>
                <div>
                  <h1 style={styles.heading}>Welcome</h1>
                  <p style={styles.subheading}>
                    Sign in to your workspace and start building powerful voice workflows
                  </p>
                </div>
              </div>

              {error && (
                <div style={styles.errorBox}>
                  <p style={{ margin: 0 }}>{error}</p>
                </div>
              )}

              <form style={styles.form} onSubmit={handleSignIn}>
                <Field label="Email address" palette={palette}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input
                    ref={emailInputRef}
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    style={styles.input}
                  />
                </Field>

                <Field
                  label={(
                    <div style={styles.labelRow}>
                      <span>Password</span>
                      <a href="#" style={styles.link}>Forgot?</a>
                    </div>
                  )}
                  palette={palette}
                >
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    style={styles.input}
                  />
                </Field>

                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  style={styles.primaryButton(isLoading || !email || !password)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} style={styles.loader} />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              <div style={styles.divider}>Or continue with</div>

              <div style={styles.socialRow}>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  style={styles.secondaryButton(isLoading)}
                >
                  <FcGoogle size={20} style={{ marginRight: 8 }} />
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleGithubLogin}
                  disabled={isLoading}
                  style={styles.secondaryButton(isLoading)}
                >
                  <FaGithub size={20} style={{ marginRight: 8 }} />
                  GitHub
                </button>
              </div>

              <p style={styles.ctaText}>
                Don&apos;t have an account?{' '}
                <a href="#" style={styles.linkStrong}>Get started free</a>
              </p>
            </div>
          </section>
        </div>

        <p style={styles.footer}>Your data is encrypted and secured with industry-standard protocols.</p>
      </div>
    </div>
  );
}

function Field({ label, palette, children }: { label: ReactNode; palette: Palette; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 6,
          color: palette.text,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {label}
      </div>
      <div style={{ position: 'relative' }}>{children}</div>
    </label>
  );
}

function renderGlow(color: string, left: string, top: string, size: number) {
  return (
    <div
      key={`${left}-${top}`}
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: 'blur(95px)',
        opacity: 0.9,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function buildStyles(palette: Palette) {
  return {
    page: {
      minHeight: '100vh',
      width: '100%',
      flex: '1 1 auto',
      padding: '32px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: palette.bg,
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      color: palette.text,
    } as CSSProperties,
    glowLayer: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none' as const,
    } as CSSProperties,
    contentWrap: {
      position: 'relative',
      zIndex: 1,
      width: '100%',
      maxWidth: 1180,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 32,
    } as CSSProperties,
    headerRow: {
      display: 'flex',
      justifyContent: 'flex-start',
    } as CSSProperties,
    layout: {
      display: 'flex',
      gap: 48,
      width: '100%',
      flexWrap: 'wrap',
      alignItems: 'stretch',
    } as CSSProperties,
    heroSection: {
      flex: '1 1 460px',
      minWidth: 320,
      borderRadius: 36,
      border: `1px solid ${palette.border}`,
      padding: '48px 40px',
      background: palette.card,
      backdropFilter: 'blur(18px)',
      boxShadow: '0 24px 60px rgba(8,15,23,0.25)',
    } as CSSProperties,
    heroBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 14px',
      borderRadius: 999,
      border: `1px solid ${palette.border}`,
      background: palette.card,
      color: palette.textMuted,
      fontSize: 12,
      fontWeight: 600,
      marginBottom: 20,
      textTransform: 'uppercase',
      letterSpacing: 2,
    } as CSSProperties,
    heroTitle: {
      fontSize: 40,
      lineHeight: 1.1,
      margin: '0 0 18px',
      color: palette.text,
    } as CSSProperties,
    heroBody: {
      fontSize: 17,
      margin: '0 0 32px',
      color: palette.textMuted,
      maxWidth: 480,
    } as CSSProperties,
    heroMeta: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
    } as CSSProperties,
    heroMetaItem: {
      padding: '10px 16px',
      borderRadius: 999,
      border: `1px solid ${palette.border}`,
      background: palette.card,
      color: palette.text,
      fontWeight: 600,
      fontSize: 13,
    } as CSSProperties,
    formColumn: {
      flex: '0 1 420px',
      width: '100%',
    } as CSSProperties,
    backButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      border: `1px solid ${palette.border}`,
      padding: '8px 16px',
      background: 'rgba(15,15,20,0.08)',
      color: palette.textMuted,
      cursor: 'pointer',
      marginBottom: 24,
      fontWeight: 500,
    },
    card: {
      borderRadius: 32,
      padding: '40px 36px',
      border: `1px solid ${palette.border}`,
      background: palette.card,
      boxShadow: palette.shadow,
      backdropFilter: 'blur(18px)',
      width: '100%',
    } as CSSProperties,
    logoMark: {
      width: 64,
      height: 64,
      borderRadius: 18,
      background: `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentAlt} 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 700,
      fontSize: 22,
      marginBottom: 12,
      boxShadow: '0 18px 40px rgba(37,99,235,0.38)',
    },
    heading: {
      margin: '0 0 6px',
      fontSize: 32,
      lineHeight: 1.1,
    },
    subheading: {
      margin: 0,
      color: palette.textMuted,
      fontSize: 15,
    },
    errorBox: {
      borderRadius: 16,
      border: '1px solid rgba(248,113,113,0.4)',
      background: 'rgba(248,113,113,0.18)',
      color: '#fecaca',
      padding: '10px 14px',
      fontSize: 13,
      marginBottom: 8,
    },
    form: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
    } as CSSProperties,
    input: {
      width: '100%',
      borderRadius: 16,
      border: `1px solid ${palette.fieldBorder}`,
      background: palette.fieldBg,
      color: palette.text,
      padding: '12px 16px 12px 44px',
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
    } as CSSProperties,
    inputIcon: {
      position: 'absolute' as const,
      left: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      color: palette.textMuted,
    },
    labelRow: {
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      fontSize: 13,
    },
    link: {
      fontSize: 12,
      color: palette.accent,
      textDecoration: 'none',
    },
    linkStrong: {
      color: palette.accent,
      fontWeight: 600,
      textDecoration: 'none',
    },
    primaryButton: (disabled: boolean) => ({
      marginTop: 4,
      width: '100%',
      border: 'none',
      borderRadius: 18,
      padding: '12px 18px',
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      background: `linear-gradient(105deg, ${palette.accent} 0%, ${palette.accentAlt} 100%)`,
      boxShadow: '0 20px 45px rgba(37,99,235,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }),
    loader: {
      animation: 'spin 1.2s linear infinite',
    },
    divider: {
      textTransform: 'uppercase',
      fontSize: 11,
      letterSpacing: 1,
      color: palette.textMuted,
      textAlign: 'center' as const,
      margin: '20px 0 14px',
    } as CSSProperties,
    socialRow: {
      display: 'flex',
      gap: 12,
    },
    secondaryButton: (disabled: boolean) => ({
      flex: 1,
      borderRadius: 16,
      border: `1px solid ${palette.fieldBorder}`,
      background: 'transparent',
      color: palette.text,
      padding: '10px 14px',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }),
    ctaText: {
      textAlign: 'center' as const,
      fontSize: 14,
      color: palette.textMuted,
      marginTop: 12,
    },
    footer: {
      marginTop: 12,
      textAlign: 'center' as const,
      fontSize: 12,
      color: palette.textMuted,
    },
  };
}
