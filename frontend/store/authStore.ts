import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setSession: (session) => set({ session }),
  setError: (error) => set({ error }),

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      set({ 
        session, 
        user: session?.user ?? null, 
        isAuthenticated: !!session?.user,
        isLoading: false 
      });

      // Set up auth listener for real-time auth changes (sign-in, token refresh, sign-out)
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ 
          session, 
          user: session?.user ?? null, 
          isAuthenticated: !!session?.user,
          isLoading: false
        });
        
        // Sync cookie for Next.js middleware route protection
        if (session) {
          document.cookie = `sb-session=true; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
        } else {
          document.cookie = `sb-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        }
      });
      
    } catch (err: any) {
      set({ 
        error: err.message || 'Failed to initialize authentication', 
        isLoading: false 
      });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true, error: null });
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      set({ 
        user: null, 
        session: null, 
        isAuthenticated: false, 
        isLoading: false 
      });
    } catch (err: any) {
      set({ 
        error: err.message || 'Logout failed', 
        isLoading: false 
      });
    }
  }
}));
