/**
 * Zustand store for authentication state.
 */

import { create } from "zustand";
import { signIn, signUp, signOut as apiSignOut, getCurrentUser, isAuthConfigured, verifyOtp as apiVerifyOtp, resendOtp as apiResendOtp } from "../lib/supabase";

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  session: null;
  loading: boolean;
  error: string | null;
  pendingEmail: string | null;
  needsOtpVerification: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: null) => void;
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

  setUser: (user) => {
    set({ user, loading: false });
  },

  setSession: (session) => {
    set({
      session,
      user: getCurrentUser(),
      loading: false,
      error: null,
    });
  },

  signInWithEmail: async (email, password) => {
    if (!isAuthConfigured()) {
      set({ error: "认证未配置", loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const result = await signIn(email.trim(), password);

      if (!result.success) {
        set({ error: result.message || "登录失败", loading: false });
        return;
      }

      set({
        session: null,
        user: result.user || null,
        loading: false,
        error: null,
        pendingEmail: null,
        needsOtpVerification: false,
      });
    } catch (error: any) {
      set({ error: error.message || "登录失败", loading: false });
    }
  },

  signUpWithEmail: async (email, password) => {
    if (!isAuthConfigured()) {
      set({ error: "认证未配置", loading: false });
      return { needsVerification: false };
    }

    set({ loading: true, error: null });
    try {
      const result = await signUp(email.trim(), password);

      if (!result.success) {
        set({ error: result.message || "注册失败", loading: false });
        return { needsVerification: false };
      }

      if (result.message?.includes("email")) {
        set({
          loading: false,
          pendingEmail: email.trim(),
          needsOtpVerification: true,
          error: null,
        });
        return { needsVerification: true };
      }

      set({
        session: null,
        user: result.user || null,
        loading: false,
        error: null,
        pendingEmail: null,
        needsOtpVerification: false,
      });
      return { needsVerification: false };
    } catch (error: any) {
      set({ error: error.message || "注册失败", loading: false });
      return { needsVerification: false };
    }
  },

  verifyOtp: async (email, token) => {
    set({ loading: true, error: null });
    try {
      const response = await apiVerifyOtp(email, token);
      if (response.success && response.user) {
        set({
          user: response.user,
          needsOtpVerification: false,
          pendingEmail: null,
          loading: false
        });
      } else {
        throw new Error(response.message || "验证失败");
      }
    } catch (error: any) {
      set({ error: error.message || "验证失败", loading: false });
      throw error;
    }
  },

  resendOtp: async (email) => {
    set({ loading: true, error: null });
    try {
      await apiResendOtp(email);
      set({ loading: false, error: null });
    } catch (error: any) {
      set({ error: error.message || "重发失败", loading: false });
      throw error;
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await apiSignOut();
    } catch (error) {
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
  return null;
}
