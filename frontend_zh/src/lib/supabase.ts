/**
 * Supabase client singleton for frontend.
 * Configuration is fetched from backend API.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { API_BASE_URL } from "../config/api";

let supabaseClient: SupabaseClient | null = null;
let initPromise: Promise<boolean> | null = null;

/**
 * Initialize Supabase client from backend config.
 * Returns true if configured, false otherwise.
 */
export async function initSupabase(): Promise<boolean> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const url = `${API_BASE_URL}/api/v1/auth/config`;
      console.info('[Supabase] 正在获取配置:', url);

      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        console.error('[Supabase] 配置请求失败:', response.status, response.statusText);
        return false;
      }

      const data = await response.json();
      console.info('[Supabase] 配置响应:', { supabaseConfigured: data.supabaseConfigured });

      if (data.supabaseConfigured && data.supabaseUrl && data.supabaseAnonKey) {
        supabaseClient = createClient(data.supabaseUrl, data.supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        });
        console.info('[Supabase] 已配置并初始化');
        return true;
      } else {
        console.info('[Supabase] 未配置，使用试用模式');
        return false;
      }
    } catch (error) {
      console.error('[Supabase] 初始化失败:', error);
      return false;
    }
  })();

  return initPromise;
}

/**
 * Get Supabase client (must call initSupabase first).
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Legacy export for compatibility.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!supabaseClient) {
      throw new Error('[Supabase] Client not initialized. Call initSupabase() first.');
    }
    return (supabaseClient as any)[prop];
  }
});
