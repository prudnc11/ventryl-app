import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key && !url.includes('your-project-id'));

// Create a real client when configured, otherwise a no-op stub so the app
// can still render the "setup required" state without crashing on import.
export const supabase = isConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'ventryl-auth',
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
