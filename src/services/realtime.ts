import { createClient, type RealtimeChannel, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';

type WorkflowRow = {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

let client: SupabaseClient | null = null;

function ensureClient(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (import.meta.env.DEV) {
      console.warn('[realtime] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    }
    return null;
  }
  client = createClient(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
  return client;
}

export type WorkflowRealtimePayload = RealtimePostgresChangesPayload<WorkflowRow>;
export type WorkflowEventHandler = (payload: WorkflowRealtimePayload) => void;

export function subscribeToWorkflowEvents(handler?: WorkflowEventHandler | null): () => void {
  const supabase = ensureClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
    .channel('workflows-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workflows' }, (payload) => {
      handler?.(payload as WorkflowRealtimePayload);
    });

  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      console.error('[realtime] Failed to subscribe to workflow channel');
    }
  });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // ignore cleanup errors
    }
  };
}
