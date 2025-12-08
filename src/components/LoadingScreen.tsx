import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export type LoadingScreenProps = {
  label?: string;
  subLabel?: string;
};

export default function LoadingScreen({
  label = 'Đang xác thực workspace...',
  subLabel = 'Please wait while we authenticate your session',
}: LoadingScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const styles = useMemo(() => buildStyles(), []);

  return (
    <div style={styles.page}>
      <div style={styles.background} aria-hidden />
      <div style={styles.cardWrap}>
        <div style={styles.card}>
          <div style={styles.equalizer}>
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                style={{
                  ...styles.equalizerBar,
                  height: 24 + Math.abs(Math.sin(i)) * 22,
                  animationDelay: `${i * 0.12}s`,
                  animationPlayState: mounted ? 'running' : 'paused',
                }}
              />
            ))}
          </div>
          <div style={styles.copyBlock}>
            <p style={styles.title}>{label}</p>
            <p style={styles.subtitle}>{subLabel}</p>
          </div>
          <div style={styles.dots}>
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <span key={i} style={{ ...styles.dot, animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes ls-wave {
            0%, 100% { transform: scaleY(0.35); opacity: 0.5; }
            50% { transform: scaleY(1); opacity: 1; }
          }
          @keyframes ls-bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-6px); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

function buildStyles() {
  const glass: CSSProperties = {
    backdropFilter: 'blur(30px)',
    background: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.4)',
    boxShadow: '0 25px 70px rgba(15,23,42,0.15)',
  };

  return {
    page: {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#fdfdfd',
      fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#0f172a',
      overflow: 'hidden',
    } as CSSProperties,
    background: {
      position: 'absolute',
      inset: 0,
      background:
        'radial-gradient(circle at 18% 18%, rgba(99,102,241,0.18), transparent 40%), radial-gradient(circle at 82% 8%, rgba(6,182,212,0.18), transparent 40%), linear-gradient(135deg, #f6f8ff 0%, #eef4ff 40%, #fdfdfd 100%)',
    } as CSSProperties,
    cardWrap: {
      position: 'relative',
      zIndex: 1,
      width: 'min(420px, 100%)',
    } as CSSProperties,
    card: {
      ...glass,
      borderRadius: 28,
      padding: '40px 36px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    } as CSSProperties,
    equalizer: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
      height: 72,
    } as CSSProperties,
    equalizerBar: {
      width: 8,
      borderRadius: 999,
      background: 'linear-gradient(180deg, #38bdf8, #6366f1)',
      animation: 'ls-wave 1.15s ease-in-out infinite',
      transformOrigin: 'center bottom',
      display: 'inline-block',
    } as CSSProperties,
    copyBlock: {
      textAlign: 'center' as const,
    },
    title: {
      margin: 0,
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: 0.2,
    },
    subtitle: {
      margin: '6px 0 0',
      fontSize: 13,
      color: '#475467',
      letterSpacing: 0.3,
    },
    dots: {
      display: 'flex',
      justifyContent: 'center',
      gap: 6,
      marginTop: 4,
    } as CSSProperties,
    dot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#6366f1',
      animation: 'ls-bounce 1.4s infinite ease-in-out',
    } as CSSProperties,
  } satisfies Record<string, CSSProperties>;
}
