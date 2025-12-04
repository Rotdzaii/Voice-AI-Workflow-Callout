import './login.css';
import { startGoogleLogin, startGithubLogin } from '../services/auth';

export default function LoginPage({ onBack, onOpenCredentials }: { onBack: () => void; onOpenCredentials: () => void }) {
  return (
    <div className="login-root">
      <div className="login-container">
        <div className="login-left" aria-hidden>
          {/* Placeholder for marketing/illustration */}
        </div>
        <div className="login-right">
          <div className="login-card">
            <button className="login-back" onClick={onBack}>← Back</button>
            <div className="login-logo" aria-hidden />

            {/* Click-through faux inputs to lead to credentials page */}
            <button className="login-input" onClick={onOpenCredentials}>
              <span>Email</span>
            </button>
            <button className="login-input" onClick={onOpenCredentials}>
              <span>Password</span>
            </button>

            <div className="login-row">
              <button className="login-oauth" onClick={() => startGoogleLogin()} title="Continue with Google">
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.1 31.9 29 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1.1 7.3 2.9l5.7-5.7C33.6 6.1 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.3 19 13 24 13c2.8 0 5.4 1.1 7.3 2.9l5.7-5.7C33.6 6.1 29 4 24 4 16 4 9.1 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5 0 9.6-1.9 13-5.1l-6-4.9C29.1 35.1 26.7 36 24 36c-5 0-9.2-3.1-10.8-7.5l-6.7 5.2C9.2 39.6 16 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-3 5.2-5.7 6.8l6 4.9C38.1 36.6 40 30.7 40 24c0-1.2-.1-2.3-.4-3.5z"/>
                </svg>
                <span>Google</span>
              </button>
              <button className="login-oauth" onClick={() => startGithubLogin()} title="Continue with GitHub">
                <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden>
                  <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <button className="login-primary" onClick={onOpenCredentials}>
              <span className="dot" />
              <span>Login</span>
            </button>

            <div className="login-links">
              <a href="#" onClick={(e) => e.preventDefault()}>Forgot Password ?</a>
              <a href="#" onClick={(e) => e.preventDefault()}>If you do not have an account, please register!</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
