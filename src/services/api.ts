const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

async function request(path: string, init?: RequestInit) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json().catch(() => ({}));
}

export const api = {
  health: () => request('/health'),
  dbPing: () => request('/debug/db_ping'),
  oauth: {
    googleStart: () => `${API_BASE}/auth/oauth/google/start`,
    githubStart: () => `${API_BASE}/auth/oauth/github/start`,
  },
  workflows: {
    create: (token: string, body: any) => request('/workflows', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    }),
    list: (token: string) => request('/workflows', { headers: { Authorization: `Bearer ${token}` } }),
    get: (token: string, id: string) => request(`/workflows/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }),
    update: (token: string, id: string, patch: any) => request(`/workflows/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(patch)
    }),
    remove: (token: string, id: string) => request(`/workflows/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  },
  calls: {
    start: (token: string, body: any) => request('/call/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    }),
    reply: (body: any) => request('/call/reply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),
    logs: (callId: string, limit?: number) => request(`/calls/${encodeURIComponent(callId)}/logs${limit?`?limit=${limit}`:''}`),
  },
  nlu: {
    parse: (body: { text: string }) => request('/nlu/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  },
  conversation: {
    next: (body: any) => request('/conversation/next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    agent: (body: any) => request('/conversation/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  },
  telephony: {
    originate: (params: { channel: string; exten: string; context?: string; callerid?: string }) => {
      const q = new URLSearchParams(Object.entries(params).reduce((acc, [k,v])=>{ if(v!=null) acc[k]=String(v); return acc;},{}) as any).toString();
      return request(`/call/originate?${q}`);
    },
  },
  intents: () => request('/intents'),
  entities: () => request('/entities'),
}

export default api;