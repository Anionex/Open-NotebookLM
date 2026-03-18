/**
 * Auth client - all requests go through backend proxy.
 * No direct Supabase connection from frontend.
 */

import { API_BASE_URL } from "../config/api";

interface User {
  id: string;
  email: string;
}

interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}

let currentUser: User | null = null;
let authConfigured = false;

/**
 * Initialize auth - check if backend has auth configured
 */
export async function initSupabase(): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/api/v1/auth/config`;
    console.info('[Auth] 正在获取配置:', url);

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      console.error('[Auth] 配置请求失败:', response.status);
      return false;
    }

    const data = await response.json();
    authConfigured = data.supabaseConfigured;
    console.info('[Auth] 配置响应:', { configured: authConfigured, mode: data.authMode });

    // 如果配置了认证，尝试获取当前会话
    if (authConfigured) {
      await refreshSession();
    }

    return authConfigured;
  } catch (error) {
    console.error('[Auth] 初始化失败:', error);
    return false;
  }
}

/**
 * Login with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success && data.user) {
      currentUser = data.user;
    }
    return data;
  } catch (error) {
    console.error('[Auth] Login failed:', error);
    throw error;
  }
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success && data.user) {
      currentUser = data.user;
    }
    return data;
  } catch (error) {
    console.error('[Auth] Signup failed:', error);
    throw error;
  }
}

/**
 * Refresh session
 */
export async function refreshSession(): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/session`, {
      method: 'GET',
      credentials: 'include',
    });

    if (response.status === 401) {
      currentUser = null;
      return null;
    }

    if (!response.ok) {
      console.error('[Auth] Session refresh failed:', response.status);
      currentUser = null;
      return null;
    }

    const data = await response.json();
    currentUser = data.user || null;
    return currentUser;
  } catch (error) {
    console.error('[Auth] Session refresh failed:', error);
    currentUser = null;
    return null;
  }
}

/**
 * Verify OTP token
 */
export async function verifyOtp(email: string, token: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, token }),
    });

    const data = await response.json();
    if (data.success && data.user) {
      currentUser = data.user;
    }
    return data;
  } catch (error) {
    console.error('[Auth] Verify OTP failed:', error);
    throw error;
  }
}

/**
 * Resend OTP token
 */
export async function resendOtp(email: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    return await response.json();
  } catch (error) {
    console.error('[Auth] Resend OTP failed:', error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    currentUser = null;
  } catch (error) {
    console.error('[Auth] Logout failed:', error);
    throw error;
  }
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  return currentUser;
}

/**
 * Check if auth is configured
 */
export function isAuthConfigured(): boolean {
  return authConfigured;
}
