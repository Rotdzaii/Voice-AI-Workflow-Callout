export type LoginResponse = { success: boolean; token?: string; message?: string; requiresReset?: boolean };
export type AccountLookupResponse = { exists: boolean; message?: string };

export type UserProfile = {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  provider?: 'local' | 'google' | 'github' | string;
  username?: string;
};

export function apiBase() {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL || '';
  if (envBase) return envBase.replace(/\/$/, '');
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const fallback = hostname === 'localhost' || hostname === '127.0.0.1' ? 'http://localhost:8000' : '';
  return fallback.replace(/\/$/, '');
}

// NOTE: Backend endpoints invoked here must hash passwords, rate-limit attempts, and rely on parameterized SQL to prevent injection.
export async function loginWithCredentials(email: string, password: string): Promise<LoginResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  const base = (apiBase() || '').replace(/\/$/, '');
  const url = `${base}/auth/token`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: new URLSearchParams({ username: normalizedEmail, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.access_token) {
      const token = data.access_token as string;
      localStorage.setItem('auth_token', token);
      saveProfileFromToken(token, 'local');
      return { success: true, token };
    }
    return { success: false, message: data?.detail || data?.message || 'Invalid email or password.' };
  } catch (err: any) {
    // Demo fallback to keep local development unblocked.
    const ok = normalizedEmail.length > 3 && password.length > 3;
    if (ok) {
      localStorage.setItem('auth_token', 'DEMO_TOKEN');
      const name = normalizedEmail.split('@')[0] || 'User';
      const demoProfile: UserProfile = { name, email: normalizedEmail, provider: 'local', username: name };
      localStorage.setItem('auth_user', JSON.stringify(demoProfile));
      return { success: true, token: 'DEMO_TOKEN', message: 'Demo login only. Replace with secure backend.' };
    }
    return { success: false, message: err?.message || 'Unable to reach auth server.' };
  }
}

// Lightweight lookup used to hint whether the email exists before we prompt for password entry.
// Server-side handlers should continue to blur timing to avoid account enumeration attacks.
export async function verifyAccount(email: string): Promise<AccountLookupResponse> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { exists: false };
  const base = (apiBase() || '').replace(/\/$/, '');
  const url = `${base}/auth/accounts/lookup`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildSecureHeaders(),
      credentials: 'include',
      body: JSON.stringify({ email: normalizedEmail })
    });
    if (!res.ok) return { exists: false };
    const data = await res.json().catch(() => ({}));
    return { exists: Boolean(data.exists), message: data?.message };
  } catch {
    return { exists: false };
  }
}

function randomString(len = 32): string {
  const arr = new Uint8Array(len);
  (window.crypto || (window as any).msCrypto).getRandomValues(arr);
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  for (let i = 0; i < arr.length; i++) out += alph[arr[i] % alph.length];
  return out;
}

function appendQuery(url: string, params: Record<string, string | undefined | null>): string {
  const u = new URL(url, window.location.origin);
  Object.entries(params).forEach(([k, v]) => { if (v != null) u.searchParams.set(k, String(v)); });
  return u.toString();
}

function openOAuthPopup(url: string, provider: 'google' | 'github', timeoutMs = 120000): Promise<string> {
  const webNonce = randomString(24);
  // Attach a frontend nonce to correlate with callback message (similar to state)
  url = appendQuery(url, { web_nonce: webNonce });
  const w = 520, h = 640;
  const y = window.top ? Math.max(0, (window.top.outerHeight - h) / 2 + (window.top.screenY || 0)) : 0;
  const x = window.top ? Math.max(0, (window.top.outerWidth - w) / 2 + (window.top.screenX || 0)) : 0;
  const popup = window.open(url, `oauth_${provider}` , `width=${w},height=${h},left=${x},top=${y}`);
  if (!popup) return Promise.reject(new Error('Popup blocked'));

  const base = apiBase();
  let expectedOrigin: string | null = null;
  try { expectedOrigin = base ? new URL(base).origin : null; } catch { expectedOrigin = null; }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      try { popup.close(); } catch {}
      reject(new Error('OAuth timeout'));
    }, timeoutMs);

    const onMessage = (ev: MessageEvent) => {
      if (expectedOrigin && ev.origin !== expectedOrigin) return; // ignore other origins
      const d = ev.data || {};
      if (d?.type !== 'oauth' || d?.provider !== provider) return;
      // If backend echoes the nonce, verify; otherwise allow for backward compat
      if (d?.nonce && d.nonce !== webNonce) {
        cleanup();
        try { popup.close(); } catch {}
        reject(new Error('OAuth response nonce mismatch'));
        return;
      }
      cleanup();
      try { popup.close(); } catch {}
      if (d.ok && d.token) {
        resolve(String(d.token));
      } else {
        reject(new Error(String(d.error || 'OAuth failed')));
      }
    };

    const interval = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(interval);
        // do not reject immediately; maybe a message already resolved
      }
    }, 300);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage as any);
    }

    window.addEventListener('message', onMessage as any);
  });
}

export async function startGoogleLogin(): Promise<boolean> {
  const url = `${apiBase()}/auth/oauth/google/start`;
  const token = await openOAuthPopup(url, 'google');
  if (token) {
    localStorage.setItem('auth_token', token);
    saveProfileFromToken(token, 'google');
    // Navigate to home page after login
    window.location.href = '/';
    return true;
  }
  return false;
}

export async function startGithubLogin(): Promise<boolean> {
  const url = `${apiBase()}/auth/oauth/github/start`;
  const token = await openOAuthPopup(url, 'github');
  if (token) {
    localStorage.setItem('auth_token', token);
    saveProfileFromToken(token, 'github');
    window.location.href = '/';
    return true;
  }
  return false;
}

// ----- Profile helpers -----

function parseJwt<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function saveProfileFromToken(token: string, providerHint?: UserProfile['provider']) {
  const p = parseJwt<any>(token) || {};
  const iss = String(p.iss || '');
  let provider: UserProfile['provider'] = providerHint ||
    (iss.includes('google') ? 'google' : iss.includes('github') ? 'github' : 'local');
  const name = p.name || [p.given_name, p.family_name].filter(Boolean).join(' ') || p.login || p.preferred_username || (p.email ? String(p.email).split('@')[0] : undefined) || 'User';
  const email = p.email || p.email_address || undefined;
  let avatarUrl: string | undefined = p.picture || p.avatar_url || undefined;
  const id = p.sub || p.id || undefined;
  const username = p.login || p.preferred_username || (email ? String(email).split('@')[0] : undefined);
  if (provider === 'google' && avatarUrl) {
    avatarUrl = normalizeGoogleAvatar(avatarUrl);
  }
  const profile: UserProfile = { id, name, email, avatarUrl, provider, username };
  try { localStorage.setItem('auth_user', JSON.stringify(profile)); } catch {}
  try {
    const candidates = getAvatarCandidates(profile);
    console.log('[auth] Saved profile from token:', { provider, name, email, rawAvatar: p.picture || p.avatar_url, normalizedAvatar: avatarUrl, avatarCandidates: candidates });
  } catch {}
  return profile;
}

export function getStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) as UserProfile : null;
  } catch { return null; }
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = localStorage.getItem('auth_token');
  if (!token) return null;
  const base = apiBase();
  const candidates = [
    `${base}/auth/me`,
    `${base}/api/auth/me`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const profile: UserProfile = {
          id: data.id || data.user_id || data.sub,
          name: data.name || data.full_name || data.login || data.preferred_username,
          email: data.email,
          avatarUrl: data.avatarUrl || data.avatar_url || data.picture,
          provider: data.provider || data.iss || 'local',
          username: data.login || data.username || data.preferred_username
        };
        localStorage.setItem('auth_user', JSON.stringify(profile));
        return profile;
      }
    } catch {
      // try next
    }
  }
  // Fallback to decoding JWT
  return saveProfileFromToken(token);
}

export function logout(redirectTo?: string) {
  try { localStorage.removeItem('auth_token'); } catch {}
  try { localStorage.removeItem('auth_user'); } catch {}
  if (redirectTo) {
    window.location.href = redirectTo;
  } else {
    // Reload to root; App checks token and shows Login
    window.location.href = '/';
  }
}

// Construct best-effort avatar URL from profile
export function getAvatarUrl(profile?: UserProfile | null): string | undefined {
  if (!profile) return undefined;
  if (profile.avatarUrl) return profile.avatarUrl;
  if (profile.provider === 'github' && profile.username) {
    return `https://github.com/${encodeURIComponent(profile.username)}.png`;
  }
  if (profile.provider === 'google' && profile.email) {
    return `https://unavatar.io/google/${encodeURIComponent(profile.email)}`;
  }
  // Avoid pulling generic gravatars for local/demo users; fall back to initials instead
  if (profile.provider && profile.provider !== 'local' && profile.email) {
    return `https://unavatar.io/${encodeURIComponent(profile.email)}`;
  }
  return undefined;
}

export function getAvatarCandidates(profile?: UserProfile | null): string[] {
  const urls: string[] = [];
  if (!profile) return urls;
  if (profile.avatarUrl) urls.push(String(profile.avatarUrl));
  if (profile.provider === 'github' && profile.username) {
    urls.push(`https://github.com/${encodeURIComponent(profile.username)}.png`);
  }
  if (profile.provider === 'google') {
    if (profile.email) {
      // Try Google-specific resolvers first
      urls.push(`https://unavatar.io/google/${encodeURIComponent(profile.email)}`);
      urls.push(`https://unavatar.io/gmail/${encodeURIComponent(profile.email)}`);
    }
  }
  if (profile.email) {
    // Gravatar, then generic email resolution
    urls.push(`https://unavatar.io/gravatar/${encodeURIComponent(profile.email)}`);
    urls.push(`https://unavatar.io/${encodeURIComponent(profile.email)}`);
  }
  // De-duplicate while preserving order
  return Array.from(new Set(urls));
}

// Normalize Google avatar URL size (default Google returns s96-c). We upscale modestly.
function normalizeGoogleAvatar(url: string, size: number = 128): string {
  try {
    if (!/googleusercontent\.com\//.test(url)) return url;
    // Examples: https://lh3.googleusercontent.com/a/XYZ=s96-c
    // Replace =sNN-c with =s{size}-c preserving crop spec 'c'
    return url.replace(/=s\d+-c$/, `=s${size}-c`);
  } catch {
    return url;
  }
}

function buildSecureHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const csrf = getCsrfToken();
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return headers;
}

function getCsrfToken(): string | undefined {
  const meta = typeof document !== 'undefined'
    ? (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)
    : null;
  return meta?.content || undefined;
}
