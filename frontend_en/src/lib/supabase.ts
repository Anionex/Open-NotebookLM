/**
 * Supabase client singleton for frontend.
 * Configuration is fetched from backend API.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

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
      const response = await fetch('/api/v1/auth/config');
      const data = await response.json();

      if (data.supabaseConfigured && data.supabaseUrl && data.supabaseAnonKey) {
        supabaseClient = createClient(data.supabaseUrl, data.supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        });
        console.info('[Supabase] Configured and initialized');
        return true;
      } else {
        console.info('[Supabase] Not configured, using trial mode');
        return false;
      }
    } catch (error) {
      console.error('[Supabase] Initialization failed:', error);
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
