import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Plus, User, Loader2, BookOpen, Key, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { apiFetch } from '../config/api';
import { API_URL_OPTIONS, DEFAULT_LLM_API_URL } from '../config/api';
import { getApiSettings, saveApiSettings, type ApiSettings, type SearchProvider, type SearchEngine } from '../services/apiSettingsService';
import { fetchWithCache, getCachedValue, setCachedValue } from '../services/clientCache';

export interface Notebook {
  id: string;
  title?: string;
  name?: string;
  author?: string;
  date?: string;
  sources?: number;
  image?: string;
  isFeatured?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const NOTEBOOK_LIST_CACHE_TTL_MS = 2 * 60 * 1000;

const Dashboard = ({ onOpenNotebook, refreshTrigger = 0, supabaseConfigured }: { onOpenNotebook: (n: Notebook) => void; refreshTrigger?: number; supabaseConfigured: boolean | null }) => {
  const { user } = useAuthStore();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(DEFAULT_LLM_API_URL);
  const [apiKey, setApiKey] = useState('');
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('serper');
  const [searchApiKey, setSearchApiKey] = useState('');
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('google');
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const effectiveUserId = user?.id || 'local';
  const effectiveEmail = user?.email || '';
  const notebookListCacheKey = `notebooks:${effectiveUserId}:${effectiveEmail || 'anonymous'}`;

  useEffect(() => {
    const s = getApiSettings(effectiveUserId);
    if (s) {
      setApiUrl(s.apiUrl || DEFAULT_LLM_API_URL);
      setApiKey(s.apiKey || '');
      setSearchProvider((s.searchProvider as SearchProvider) || 'serper');
      setSearchApiKey(s.searchApiKey || '');
      setSearchEngine((s.searchEngine as SearchEngine) || 'google');
    }
  }, [effectiveUserId]);

  const handleSaveConfig = () => {
    setConfigSaving(true);
    setConfigSaved(false);
    const settings: ApiSettings = {
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      searchProvider,
      searchApiKey: searchApiKey.trim(),
      searchEngine,
    };
    saveApiSettings(effectiveUserId, settings);
    setConfigSaved(true);
    setTimeout(() => {
      setConfigSaving(false);
      setConfigSaved(false);
    }, 1500);
  };

  const fetchNotebooks = async (options?: { force?: boolean }) => {
    const cached = getCachedValue<Notebook[]>(notebookListCacheKey);
    if (cached) {
      setNotebooks(cached);
      setLoading(false);
      if (!options?.force) return;
    } else {
      setLoading(true);
    }
    try {
      const list = await fetchWithCache<Notebook[]>(
        notebookListCacheKey,
        NOTEBOOK_LIST_CACHE_TTL_MS,
        async () => {
          const res = await apiFetch(`/api/v1/kb/notebooks?user_id=${encodeURIComponent(effectiveUserId)}&email=${encodeURIComponent(effectiveEmail)}`);
          const data = await res.json();
          if (!data?.success || !Array.isArray(data.notebooks)) return [];
          return data.notebooks.map((row: any) => ({
            id: row.id,
            title: row.name,
            name: row.name,
            description: row.description,
            created_at: row.created_at,
            updated_at: row.updated_at,
            date: row.updated_at ? new Date(row.updated_at).toLocaleDateString('zh-CN') : '',
            sources: typeof row.sources === 'number' ? row.sources : 0,
          }));
        },
        { force: options?.force, useStaleOnError: true }
      );
      setNotebooks(list);
    } catch (err) {
      console.error('Failed to fetch notebooks:', err);
      if (!cached) setNotebooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotebooks({ force: refreshTrigger > 0 });
  }, [effectiveUserId, refreshTrigger]);

  const handleCreateNotebook = async () => {
    const name = newNotebookName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await apiFetch('/api/v1/kb/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: '', user_id: effectiveUserId, email: effectiveEmail }),
      });
      const data = await res.json();
      if (data?.success && data?.notebook) {
        const nb = data.notebook;
        const newNb: Notebook = {
          id: nb.id,
          title: nb.name,
          name: nb.name,
          description: nb.description,
          created_at: nb.created_at,
          updated_at: nb.updated_at,
          date: nb.updated_at ? new Date(nb.updated_at).toLocaleDateString('zh-CN') : '',
          sources: 0,
        };
        setNotebooks(prev => {
          const next = [newNb, ...prev.filter(item => item.id !== newNb.id)];
          setCachedValue(notebookListCacheKey, next, NOTEBOOK_LIST_CACHE_TTL_MS);
          return next;
        });
        setCreateModalOpen(false);
        setNewNotebookName('');
        onOpenNotebook(newNb);
      } else {
        setCreateError(data?.message || 'Create failed');
      }
    } catch (err: any) {
      setCreateError(err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="portal-shell py-6 sm:py-8">
      <header className="glass sticky top-4 z-30 mb-8 rounded-ios-2xl px-5 py-4 shadow-ios-lg sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-ios bg-primary/10 ring-1 ring-primary/10">
              <img src="/logo_small.png" alt="Logo" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <p className="portal-kicker">Research Notebook</p>
              <h1 className="text-2xl font-semibold text-ios-gray-900">OpenNotebookLM</h1>
              <p className="text-sm text-ios-gray-500">A unified shell for notebook entry, source management, and research chat.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="portal-badge hidden md:inline-flex">
              {user?.email || user?.id || 'PKU Intranet'}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setConfigOpen((o) => !o)}
              className="portal-button-secondary px-4 py-2.5"
            >
              <Settings size={20} />
              <span className="text-sm font-medium">API Settings</span>
            </motion.button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-blue text-white shadow-ios-sm">
              <User size={18} />
            </div>
          </div>
        </div>
      </header>

      {configOpen && (
        <section className="portal-card mb-8 p-6">
          <h3 className="text-lg font-semibold text-ios-gray-900 mb-4 flex items-center gap-2">
            <Key size={20} />
            Home config (used when you open a notebook)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-ios-gray-600 flex items-center gap-1.5">LLM API</h4>
              <div>
                <label className="block text-xs font-medium text-ios-gray-500 mb-1">API URL</label>
                <select
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="portal-input py-2.5"
                >
                  {[apiUrl, ...API_URL_OPTIONS].filter((v, i, a) => a.indexOf(v) === i).map((url: string) => (
                    <option key={url} value={url}>{url}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ios-gray-500 mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="portal-input py-2.5"
                />
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-ios-gray-600 flex items-center gap-1.5">Search API</h4>
              <div>
                <label className="block text-xs font-medium text-ios-gray-500 mb-1">Search provider</label>
                <select
                  value={searchProvider}
                  onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
                  className="portal-input py-2.5"
                >
                  <option value="serper">Serper (Google, env)</option>
                  <option value="serpapi">SerpAPI (Google/Baidu)</option>
                  <option value="bocha">Bocha</option>
                </select>
              </div>
              {(searchProvider === 'serpapi' || searchProvider === 'bocha') && (
                <div>
                  <label className="block text-xs font-medium text-ios-gray-500 mb-1">Search API Key</label>
                  <input
                    type="password"
                    value={searchApiKey}
                    onChange={(e) => setSearchApiKey(e.target.value)}
                    placeholder={searchProvider === 'bocha' ? 'Bocha API Key' : 'SerpAPI Key'}
                    className="portal-input py-2.5"
                  />
                </div>
              )}
              {searchProvider === 'serpapi' && (
                <div>
                  <label className="block text-xs font-medium text-ios-gray-500 mb-1">Search engine</label>
                  <select
                    value={searchEngine}
                    onChange={(e) => setSearchEngine(e.target.value as SearchEngine)}
                    className="portal-input py-2.5"
                  >
                    <option value="google">Google</option>
                    <option value="baidu">Baidu</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleSaveConfig}
              disabled={configSaving}
              className="portal-button-primary px-5 py-2.5 disabled:opacity-50"
            >
              {configSaving ? <Loader2 size={16} className="animate-spin" /> : configSaved ? <CheckCircle2 size={16} /> : <Key size={16} />}
              {configSaving ? 'Saving...' : configSaved ? 'Saved' : 'Save config'}
            </motion.button>
          </div>
        </section>
      )}

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-ios-gray-900">Notebooks</h2>
        </div>
        {loading ? (
          <div className="portal-card flex items-center justify-center py-12 text-ios-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* New Notebook Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              className="portal-panel-muted cursor-pointer border-2 border-dashed border-ios-gray-200/90 aspect-[4/3] flex flex-col items-center justify-center gap-4 transition-colors hover:border-primary/40"
              onClick={() => setCreateModalOpen(true)}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-full flex items-center justify-center">
                <Plus size={24} className="text-primary" />
              </div>
              <span className="font-medium text-ios-gray-700">New notebook</span>
            </motion.div>

            {/* Notebook Cards */}
            {notebooks.map((nb) => (
              <motion.div
                key={nb.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              className="portal-card-soft cursor-pointer p-6 transition-shadow aspect-[4/3] flex flex-col justify-between hover:shadow-ios-lg"
                onClick={() => onOpenNotebook(nb)}
              >
                <div className="flex justify-between items-start">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 rounded-ios flex items-center justify-center text-amber-600">
                    <BookOpen size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-ios-gray-900 line-clamp-2 mb-2">
                    {nb.title || nb.name || 'Untitled'}
                  </h3>
                  <p className="text-ios-gray-400 text-xs">
                    {nb.date || (nb.updated_at ? new Date(nb.updated_at).toLocaleDateString('zh-CN') : '')}
                    {typeof nb.sources === 'number' ? ` · ${nb.sources} sources` : ''}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Create Modal — iOS Sheet */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => !creating && setCreateModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 glass-dark"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="portal-card relative w-full max-w-md rounded-t-ios-2xl p-6 sm:rounded-ios-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* iOS Drag Indicator */}
              <div className="flex justify-center mb-4 sm:hidden">
                <div className="w-9 h-1 rounded-full bg-ios-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-ios-gray-900 mb-4">New notebook</h3>
              <input
                type="text"
                className="portal-input mb-3"
                placeholder="Notebook name"
                value={newNotebookName}
                onChange={e => setNewNotebookName(e.target.value)}
              />
              {createError && <p className="text-red-500 text-sm mb-2">{createError}</p>}
              <div className="flex justify-end gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="portal-button-secondary px-5 py-2.5"
                  onClick={() => !creating && setCreateModalOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="portal-button-primary px-5 py-2.5 disabled:opacity-50"
                  onClick={handleCreateNotebook}
                  disabled={creating || !newNotebookName.trim()}
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
