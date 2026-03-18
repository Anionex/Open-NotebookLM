import React, { useEffect, useState } from 'react';
import { X, Key, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { API_URL_OPTIONS, DEFAULT_LLM_API_URL } from '../config/api';
import { getApiSettings, saveApiSettings, type SearchProvider, type SearchEngine } from '../services/apiSettingsService';
import { useAuthStore } from '../stores/authStore';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onClose }) => {
  const { user } = useAuthStore();
  const userIdForSettings = user?.id ?? 'default';
  const [apiUrl, setApiUrl] = useState(DEFAULT_LLM_API_URL);
  const [apiKey, setApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('serper');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('google');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const settings = getApiSettings(userIdForSettings);
      if (settings) {
        setApiUrl(settings.apiUrl || DEFAULT_LLM_API_URL);
        setApiKey(settings.apiKey || '');
        setSearchProvider((settings.searchProvider as SearchProvider) || 'serper');
        setSearchApiKey(settings.searchApiKey || '');
        setSearchEngine((settings.searchEngine as SearchEngine) || 'google');
      } else {
        setApiUrl(DEFAULT_LLM_API_URL);
        setApiKey('');
        setSearchProvider('serper');
        setSearchApiKey('');
        setSearchEngine('google');
      }
    }
  }, [open, userIdForSettings]);

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    saveApiSettings(userIdForSettings, {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      searchProvider,
      searchApiKey: searchApiKey.trim(),
      searchEngine,
    });
    setSaved(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(false);
    }, 1500);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 px-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-ios-2xl border border-white/75 bg-white/88 shadow-ios-xl backdrop-blur-ios"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-ios-gray-100/80 px-6 py-5">
          <div>
            <p className="portal-kicker">Notebook Runtime</p>
            <h2 className="mt-2 text-2xl">API Settings</h2>
            <p className="mt-2 text-sm text-ios-gray-500">
              Configure chat, search, and generation runtime values. These changes stay in local browser storage only.
            </p>
          </div>
          <button onClick={onClose} className="rounded-ios p-2 text-ios-gray-500 transition hover:bg-ios-gray-100 hover:text-ios-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-ios-gray-700">API URL</label>
            <select value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className="portal-input">
              {[apiUrl, ...API_URL_OPTIONS].filter((v, i, a) => a.indexOf(v) === i).map((url: string) => (
                <option key={url} value={url}>{url}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-ios-gray-400">OpenAI-compatible endpoint such as `api.openai.com/v1` or your self-hosted gateway.</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ios-gray-700">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="portal-input"
            />
            <p className="mt-2 text-xs text-ios-gray-400">Stored only in this browser and never written back to server config.</p>
            {!apiKey.trim() && (
              <p className="mt-2 text-xs text-warning-600">Fill and save the API key or generation and embedding-related features will be limited.</p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-ios-gray-700">Search provider</label>
              <select
                value={searchProvider}
                onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
                className="portal-input"
              >
                <option value="serper">Serper (Google)</option>
                <option value="serpapi">SerpAPI (Google / Baidu)</option>
                <option value="bocha">Bocha</option>
              </select>
            </div>

            {(searchProvider === 'serper' || searchProvider === 'serpapi' || searchProvider === 'bocha') && (
              <div>
                <label className="mb-2 block text-sm font-medium text-ios-gray-700">Search API Key</label>
                <input
                  type="password"
                  value={searchApiKey}
                  onChange={(e) => setSearchApiKey(e.target.value)}
                  placeholder={searchProvider === 'bocha' ? 'Bocha API Key' : searchProvider === 'serper' ? 'Serper API Key' : 'SerpAPI Key'}
                  className="portal-input"
                />
              </div>
            )}
          </div>

          {searchProvider === 'serpapi' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-ios-gray-700">Search engine</label>
              <select
                value={searchEngine}
                onChange={(e) => setSearchEngine(e.target.value as SearchEngine)}
                className="portal-input"
              >
                <option value="google">Google</option>
                <option value="baidu">Baidu</option>
              </select>
            </div>
          )}

          <div className="rounded-ios-xl border border-warning-500/20 bg-warning-50 px-4 py-3 text-xs text-warning-600">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>These settings are stored only in the current browser on this device. Use them in a trusted environment.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-ios-gray-100/80 px-6 py-4">
          <button onClick={onClose} className="portal-button-secondary px-4 py-2.5">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="portal-button-primary px-4 py-2.5 disabled:opacity-60">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle2 size={16} />
                Saved
              </>
            ) : (
              <>
                <Key size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
