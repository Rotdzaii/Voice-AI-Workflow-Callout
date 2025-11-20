import './login.css';
import { useState } from 'react';
import { loginWithCredentials } from '../services/auth';

export default function CredentialsPage({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const ok = await loginWithCredentials(email, password);
      if (ok) onSuccess();
      else setError('Invalid email or password');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-root">
      <div className="login-centered">
        <form className="cred-card" onSubmit={handleSubmit}>
          <button className="login-back" type="button" onClick={onBack}>← Back</button>
          <div className="login-logo small" aria-hidden />
          <input
            className="login-real-input"
            type="email"
            placeholder="Email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="login-real-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="login-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
