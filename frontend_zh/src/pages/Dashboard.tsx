import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Info,
  Key,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';

import { useAuthStore } from '../stores/authStore';
import { apiFetch, API_URL_OPTIONS, DEFAULT_LLM_API_URL } from '../config/api';
import {
  getApiSettings,
  saveApiSettings,
  type ApiSettings,
  type SearchEngine,
  type SearchProvider,
} from '../services/apiSettingsService';
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

const glassPanel =
  'rounded-[30px] border border-white/60 bg-white/65 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl';

const fieldClass =
  'w-full rounded-[18px] border border-slate-200/80 bg-white/85 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100';

const Dashboard = ({
  onOpenNotebook,
  refreshTrigger = 0,
  supabaseConfigured,
}: {
  onOpenNotebook: (n: Notebook) => void;
  refreshTrigger?: number;
  supabaseConfigured: boolean | null;
}) => {
  const { user, signOut } = useAuthStore();
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
    const settings = getApiSettings(effectiveUserId);
    if (settings) {
      setApiUrl(settings.apiUrl || DEFAULT_LLM_API_URL);
      setApiKey(settings.apiKey || '');
      setSearchProvider((settings.searchProvider as SearchProvider) || 'serper');
      setSearchApiKey(settings.searchApiKey || '');
      setSearchEngine((settings.searchEngine as SearchEngine) || 'google');
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
          const res = await apiFetch(
            `/api/v1/kb/notebooks?user_id=${encodeURIComponent(effectiveUserId)}&email=${encodeURIComponent(effectiveEmail)}`,
          );
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
        { force: options?.force, useStaleOnError: true },
      );
      setNotebooks(list);
    } catch (error) {
      console.error('Failed to fetch notebooks:', error);
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
        setNotebooks((prev) => {
          const next = [newNb, ...prev.filter((item) => item.id !== newNb.id)];
          setCachedValue(notebookListCacheKey, next, NOTEBOOK_LIST_CACHE_TTL_MS);
          return next;
        });
        setCreateModalOpen(false);
        setNewNotebookName('');
        onOpenNotebook(newNb);
      } else {
        setCreateError(data?.message || '创建失败');
      }
    } catch (error: any) {
      setCreateError(error?.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const featuredMetrics = useMemo(
    () => [
      { label: '笔记本', value: String(notebooks.length) },
      {
        label: '总来源',
        value: String(notebooks.reduce((acc, item) => acc + (Number(item.sources) || 0), 0)),
      },
      { label: '模式', value: supabaseConfigured ? '团队认证' : '试用模式' },
    ],
    [notebooks, supabaseConfigured],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(164,214,255,0.55),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.48),transparent_20%),linear-gradient(180deg,#eef4fb_0%,#f6f5f6_42%,#f7f3ed_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1580px] flex-col gap-5 px-4 py-4 md:px-6 md:py-5">
        <header className={`${glassPanel} sticky top-3 z-20 px-5 py-5 md:px-6`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <Sparkles size={14} />
                  OpenNotebookLM
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/85 px-3 py-1.5 text-sm font-medium text-sky-700">
                  <BookOpen size={15} />
                  ThinkFlow Homepage
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <img src="/logo_small.png" alt="Logo" className="h-10 w-auto object-contain" />
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-900 md:text-5xl">
                  你的笔记本工作台
                </h1>
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-[15px]">
                统一管理来源、对话整理、结构化文档和产出生成。首页延续 ThinkFlow 的玻璃层次和大留白风格，进到笔记本后就是同一套工作流体验。
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {featuredMetrics.map((item) => (
                  <div
                    key={item.label}
                    className="min-w-[118px] rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                  >
                    <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-slate-900">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:justify-end">
              <div className="hidden items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-2 text-sm text-slate-600 md:inline-flex">
                <User size={16} />
                {user?.email || user?.id || 'local'}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setConfigOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-[18px] border border-white/70 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(37,53,81,0.08)] transition hover:-translate-y-0.5"
              >
                <Settings size={16} />
                API 配置
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] px-4 py-3 text-sm font-medium text-white shadow-[0_16px_32px_rgba(45,98,164,0.24)] transition hover:-translate-y-0.5"
              >
                <Plus size={16} />
                新建笔记本
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-2 rounded-[18px] border border-white/70 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(37,53,81,0.08)] transition hover:-translate-y-0.5"
              >
                <LogOut size={16} />
                退出
              </motion.button>
            </div>
          </div>
        </header>

        {!supabaseConfigured && (
          <motion.section
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassPanel} flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-2xl bg-sky-100 p-2 text-sky-700">
                <Info size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">当前处于试用模式</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  现在可以直接体验 OpenNotebookLM。接入 Supabase 后，会自动启用团队登录、多用户隔离和邮箱验证。
                </p>
              </div>
            </div>
            <a
              href="https://supabase.com/docs/guides/auth"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 transition hover:text-sky-800"
            >
              了解如何配置
              <ArrowRight size={14} />
            </a>
          </motion.section>
        )}

        <AnimatePresence>
          {configOpen && (
            <motion.section
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className={`${glassPanel} overflow-hidden px-5 py-5 md:px-6`}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Global Config</div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">首页默认配置</h3>
                  <p className="mt-1 text-sm text-slate-600">进入任何笔记本前，先在这里统一设置模型入口和搜索服务。</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500">
                  <Key size={14} />
                  当前用户配置
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[26px] border border-white/70 bg-white/72 p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Sparkles size={16} className="text-sky-600" />
                    LLM 调用
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">API URL</label>
                      <select value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} className={fieldClass}>
                        {[apiUrl, ...API_URL_OPTIONS]
                          .filter((value, index, array) => array.indexOf(value) === index)
                          .map((url) => (
                            <option key={url} value={url}>
                              {url}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">API Key</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-white/70 bg-white/72 p-5">
                  <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Search size={16} className="text-violet-600" />
                    搜索来源 API
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">搜索服务</label>
                      <select
                        value={searchProvider}
                        onChange={(e) => setSearchProvider(e.target.value as SearchProvider)}
                        className={fieldClass}
                      >
                        <option value="serper">Serper (Google，环境变量)</option>
                        <option value="serpapi">SerpAPI (Google/百度)</option>
                        <option value="bocha">博查 Bocha</option>
                      </select>
                    </div>
                    {(searchProvider === 'serpapi' || searchProvider === 'bocha') && (
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Search API Key</label>
                        <input
                          type="password"
                          value={searchApiKey}
                          onChange={(e) => setSearchApiKey(e.target.value)}
                          placeholder={searchProvider === 'bocha' ? '博查 API Key' : 'SerpAPI Key'}
                          className={fieldClass}
                        />
                      </div>
                    )}
                    {searchProvider === 'serpapi' && (
                      <div>
                        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-slate-400">搜索引擎</label>
                        <select
                          value={searchEngine}
                          onChange={(e) => setSearchEngine(e.target.value as SearchEngine)}
                          className={fieldClass}
                        >
                          <option value="google">Google</option>
                          <option value="baidu">百度</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={handleSaveConfig}
                  disabled={configSaving}
                  className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_32px_rgba(45,98,164,0.24)] disabled:opacity-60"
                >
                  {configSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : configSaved ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Key size={16} />
                  )}
                  {configSaving ? '保存中...' : configSaved ? '已保存' : '保存配置'}
                </motion.button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className={`${glassPanel} flex-1 px-5 py-5 md:px-6`}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Notebook Library</div>
              <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-slate-900">全部笔记本</h2>
              <p className="mt-2 text-sm text-slate-600">从这里进入 ThinkFlow 工作台，继续处理文档、对话与产出。</p>
            </div>
            <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-sm text-slate-500">
              {loading ? '正在同步...' : `${notebooks.length} 个笔记本`}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              加载中...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <motion.button
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                className="group flex aspect-[1.06/1] flex-col justify-between rounded-[28px] border border-dashed border-slate-300/80 bg-white/62 p-5 text-left shadow-[0_18px_36px_rgba(24,39,63,0.07)] transition"
                onClick={() => setCreateModalOpen(true)}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,rgba(31,93,168,0.14),rgba(76,164,255,0.24))] text-sky-700">
                  <Plus size={26} />
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Create</div>
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">新建笔记本</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">开始一个新的文档工作流，把素材、对话和产出放到同一空间里。</p>
                </div>
              </motion.button>

              {notebooks.map((nb, index) => (
                <motion.button
                  key={nb.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  type="button"
                  className="group flex aspect-[1.06/1] flex-col justify-between rounded-[28px] border border-white/70 bg-white/78 p-5 text-left shadow-[0_18px_36px_rgba(24,39,63,0.07)]"
                  onClick={() => onOpenNotebook(nb)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(255,199,128,0.28),rgba(255,225,205,0.55))] text-amber-700">
                      <BookOpen size={20} />
                    </div>
                    <div className="rounded-full bg-slate-100/90 px-3 py-1 text-[11px] font-medium text-slate-500">
                      #{String(index + 1).padStart(2, '0')}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Notebook</div>
                    <h3 className="line-clamp-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">
                      {nb.title || nb.name || '未命名'}
                    </h3>
                    <p className="mt-2 line-clamp-2 min-h-[44px] text-sm leading-6 text-slate-500">
                      {nb.description || '进入后可继续做对话梳理、结构化文档沉淀和多类型产出。'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm text-slate-500">
                    <span>{nb.date || (nb.updated_at ? new Date(nb.updated_at).toLocaleDateString('zh-CN') : '刚刚创建')}</span>
                    <span>{typeof nb.sources === 'number' ? `${nb.sources} 个来源` : '暂无来源'}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        <AnimatePresence>
          {createModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/28 px-4 py-6 backdrop-blur-md sm:items-center"
              onClick={() => !creating && setCreateModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 280, damping: 30 }}
                className={`${glassPanel} w-full max-w-md p-6`}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-4 flex justify-center sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-slate-300" />
                </div>
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Create Notebook</div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-slate-900">新建笔记本</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">先给这个工作空间起一个清晰的名字，后续所有文档和产出都会围绕它组织。</p>
                </div>

                <input
                  type="text"
                  className={fieldClass}
                  placeholder="例如：Expert Attention 论文拆解"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                />
                {createError ? <p className="mt-3 text-sm text-rose-600">{createError}</p> : null}

                <div className="mt-5 flex justify-end gap-3">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className="rounded-[18px] border border-white/70 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700"
                    onClick={() => !creating && setCreateModalOpen(false)}
                    disabled={creating}
                  >
                    取消
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#17467a_0%,#3f84cc_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_32px_rgba(45,98,164,0.24)] disabled:opacity-60"
                    onClick={handleCreateNotebook}
                    disabled={creating || !newNotebookName.trim()}
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    创建
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Dashboard;
