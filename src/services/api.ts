import { apiBase } from './auth';

export type StartCallPayload = {
  workflow_id: string;
  customer_phone: string;
  from_phone?: string;
  metadata?: Record<string, unknown>;
};

const API_BASE = apiBase().replace(/\/$/, '');

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const base = (apiBase() || API_BASE).replace(/\/$/, '');
  const url = `${base}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.json().catch(() => ({} as T));
}

export const api = {
  health: () => request('/health'),
  dbPing: () => request('/debug/db_ping'),
  oauth: {
    googleStart: () => `${(apiBase() || API_BASE)}/auth/oauth/google/start`,
    githubStart: () => `${(apiBase() || API_BASE)}/auth/oauth/github/start`,
  },
  workflows: {
    create: (token: string, body: unknown) => request('/workflows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }),
    list: (token: string) => request('/workflows', { headers: { Authorization: `Bearer ${token}` } }),
    get: (token: string, id: string) => request(`/workflows/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }),
    update: (token: string, id: string, patch: unknown) => request(`/workflows/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    }),
    remove: (token: string, id: string) => request(`/workflows/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
  },
  calls: {
    start: (token: string, payload: StartCallPayload) => request('/call/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }),
    reply: (body: unknown) => request('/call/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    logs: (callId: string, limit?: number) => request(`/calls/${encodeURIComponent(callId)}/logs${limit ? `?limit=${limit}` : ''}`),
  },
  nlu: {
    parse: (body: { text: string }) => request('/nlu/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  },
  conversation: {
    next: (body: unknown) => request('/conversation/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    agent: (body: unknown) => request('/conversation/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  },
  telephony: {
    originate: (params: { channel: string; exten: string; context?: string; callerid?: string }) => {
      const acc: Record<string, string> = {};
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) acc[k] = String(v);
      });
      const q = new URLSearchParams(acc).toString();
      return request(`/call/originate?${q}`);
    },
  },
  intents: () => request('/intents'),
  entities: () => request('/entities'),
};

export default api;
