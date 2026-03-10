/**
 * Zustand store for authentication state.
 */

import { create } from "zustand";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  pendingEmail: string | null;
  needsOtpVerification: boolean;

  setSession: (session: Session | null) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resendOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  clearPendingVerification: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  pendingEmail: null,
  needsOtpVerification: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      loading: false,
      error: null,
    });
  },

  signInWithEmail: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabase is not configured", loading: false });
      return;
    }

    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      let friendlyError = error.message;
      const normalized = error.message.toLowerCase();
      if (normalized.includes("invalid login credentials")) {
        friendlyError = "Invalid email or password.";
      } else if (normalized.includes("email not confirmed")) {
        friendlyError = "Email is not confirmed yet.";
      }
      set({ error: friendlyError, loading: false });
      return;
    }

    set({
      session: data.session,
      user: data.user,
      loading: false,
      error: null,
      pendingEmail: null,
      needsOtpVerification: false,
    });
  },

  signUpWithEmail: async (email, password) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabase is not configured", loading: false });
      return { needsVerification: false };
    }

    set({ loading: true, error: null });
    const normalizedEmail = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });

    if (error) {
      set({ error: error.message, loading: false });
      return { needsVerification: false };
    }

    if (data.user && !data.session) {
      set({
        loading: false,
        pendingEmail: normalizedEmail,
        needsOtpVerification: true,
        error: null,
      });
      return { needsVerification: true };
    }

    set({
      session: data.session,
      user: data.user,
      loading: false,
      error: null,
      pendingEmail: null,
      needsOtpVerification: false,
    });
    return { needsVerification: false };
  },

  verifyOtp: async (email, token) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabase is not configured", loading: false });
      return;
    }

    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: "signup",
    });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({
      session: data.session,
      user: data.user,
      loading: false,
      error: null,
      pendingEmail: null,
      needsOtpVerification: false,
    });
  },

  resendOtp: async (email) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabase is not configured", loading: false });
      return;
    }

    set({ loading: true, error: null });
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });

    if (error) {
      set({ error: error.message, loading: false });
      return;
    }

    set({ loading: false, error: null });
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ user: null, session: null, loading: false, error: null, pendingEmail: null, needsOtpVerification: false });
      return;
    }

    set({ loading: true });
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Sign out error:', error);
    }

    set({
      user: null,
      session: null,
      loading: false,
      error: null,
      pendingEmail: null,
      needsOtpVerification: false,
    });
  },

  clearError: () => set({ error: null }),
  clearPendingVerification: () => set({ pendingEmail: null, needsOtpVerification: false, error: null }),
}));

/**
 * Get the current access token for API calls.
 */
export function getAccessToken(): string | null {
  return useAuthStore.getState().session?.access_token ?? null;
}
