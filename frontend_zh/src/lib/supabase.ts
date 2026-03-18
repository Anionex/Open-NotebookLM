/**
 * Supabase client singleton for frontend.
 *
 * PKU intranet deployment disables frontend auth unconditionally.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

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

  initPromise = Promise.resolve(false);
  console.info('[Supabase] 北大平台模式已启用，前端登录注册已关闭');

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
