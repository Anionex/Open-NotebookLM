/**
 * API Settings Service - Manage user's LLM + Search API configuration
 */

import { DEFAULT_LLM_API_URL } from '../config/api';

export type SearchProvider = 'serper' | 'serpapi' | 'bocha';
export type SearchEngine = 'google' | 'baidu';

export interface ApiSettings {
  apiUrl: string;
  apiKey: string;
  searchProvider?: SearchProvider;
  searchApiKey?: string;
  searchEngine?: SearchEngine;
}

const STORAGE_KEY_PREFIX = 'kb_api_settings_';

function getStorageKey(userId: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}${userId}` : `${STORAGE_KEY_PREFIX}global`;
}

function loadStoredApiSettings(userId: string | null): Partial<ApiSettings> | null {
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.error('Failed to load API settings:', err);
    return null;
  }
}

function normalizeApiSettings(settings: Partial<ApiSettings>): ApiSettings {
  const searchApiKey = settings.searchApiKey || '';
  let searchProvider = settings.searchProvider;

  if (!searchProvider) {
    searchProvider = 'bocha';
  }
  if (searchProvider === 'serper' && !searchApiKey.trim()) {
    searchProvider = 'bocha';
  }

  return {
    apiUrl: settings.apiUrl || DEFAULT_LLM_API_URL,
    apiKey: settings.apiKey || '',
    searchProvider,
    searchApiKey,
    searchEngine: settings.searchEngine || 'google',
  };
}

/**
 * Get API settings for a user (or global if userId is null)
 */
export function getApiSettings(userId: string | null): ApiSettings | null {
  const stored = loadStoredApiSettings(userId);
  if (stored) {
    return normalizeApiSettings(stored);
  }
  return normalizeApiSettings({});
}

/**
 * Get API settings that were explicitly saved by the user.
 * This should be used for request payloads to avoid sending UI defaults
 * that can conflict with backend env-based credentials.
 */
export function getRequestApiSettings(userId: string | null): ApiSettings | null {
  const stored = loadStoredApiSettings(userId);
  if (!stored) return null;
  return normalizeApiSettings(stored);
}

/**
 * Save API settings for a user
 */
export function saveApiSettings(userId: string | null, settings: ApiSettings): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save API settings:', err);
  }
}
