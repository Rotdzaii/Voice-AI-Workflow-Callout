export type LoginResponse = { success: boolean; token?: string; message?: string };

function apiBase() {
  const base = (import.meta as any).env?.VITE_API_BASE_URL || '';
  return base.replace(/\/$/, '');
}

export async function loginWithCredentials(email: string, password: string): Promise<boolean> {
  // Placeholder for backend integration. Frontend team can connect to real API later.
  const url = `${apiBase()}/api/auth/login`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) return false;
    const data: LoginResponse = await res.json().catch(() => ({ success: false }));
    if (data?.success && data?.token) {
      localStorage.setItem('auth_token', data.token);
      return true;
    }
    return false;
  } catch {
    // Fallback demo behavior (remove when backend is ready)
    const ok = email.length > 3 && password.length > 3;
    if (ok) localStorage.setItem('auth_token', 'DEMO_TOKEN');
    return ok;
  }
}

export function startGoogleLogin() {
  // Redirect to backend OAuth endpoint which handles Google flow
  const url = `${apiBase()}/api/auth/google`;
  window.location.href = url;
}

export function startGithubLogin() {
  // Redirect to backend OAuth endpoint which handles GitHub flow
  const url = `${apiBase()}/api/auth/github`;
  window.location.href = url;
}
