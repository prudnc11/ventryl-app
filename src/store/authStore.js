import { create } from 'zustand';
import { supabase, isConfigured } from '../lib/supabase';

async function fetchProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data ?? null;
}

export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,       // Supabase auth user
  profile: null,    // profiles table row
  loading: true,
  initialized: false,

  /**
   * Call once on app mount. Loads the current session and subscribes
   * to auth state changes for the lifetime of the app.
   */
  init: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!isConfigured) {
      set({ loading: false });
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profile = await fetchProfile(session.user.id);
      set({ session, user: session.user, profile, loading: false });
    } else {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const profile = await fetchProfile(session.user.id);
        set({ session, user: session.user, profile });
      } else {
        set({ session: null, user: null, profile: null });
      }
    });
  },

  /** Update local profile cache after edits */
  setProfile: (profile) => set({ profile }),

  /** Sign out */
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));
