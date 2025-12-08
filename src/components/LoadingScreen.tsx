import { useEffect, useState } from 'react';

export type LoadingScreenProps = {
  label?: string;
  subLabel?: string;
};

export default function LoadingScreen({ label = 'Đang xác thực workspace...', subLabel = 'Please wait while we authenticate your session' }: LoadingScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-white dark:bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" aria-hidden />
      <div className="relative z-10 w-full max-w-sm">
        <div className="relative backdrop-blur-xl bg-white/80 dark:bg-slate-900/60 rounded-2xl p-8 shadow-2xl border border-white/30 dark:border-slate-700/40">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-end justify-center gap-1 h-16">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full bg-gradient-to-t from-indigo-500 to-cyan-400 dark:from-indigo-400 dark:to-cyan-300 ${mounted ? 'animate-[loading-wave_1.2s_ease-in-out_infinite]' : ''}`}
                  style={{
                    animationDelay: `${i * 0.1}s`,
                    height: `${22 + Math.sin(i) * 14}px`,
                  }}
                />
              ))}
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50 tracking-wide">{label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{subLabel}</p>
            </div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-[loading-bounce_1.4s_infinite]"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes loading-wave {
            0%, 100% { transform: scaleY(0.45); opacity: 0.6; }
            50% { transform: scaleY(1); opacity: 1; }
          }
          @keyframes loading-bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
            40% { transform: translateY(-8px); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
