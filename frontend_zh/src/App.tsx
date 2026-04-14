import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { apiFetch } from './config/api';
import ThinkFlowWorkspace from './components/thinkflow/ThinkFlowWorkspace';
import type { Notebook } from './components/thinkflow/types';
import AuthPage from './pages/AuthPage';
import { initSupabase, refreshSession } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

const DEFAULT_NOTEBOOK_NAME = '默认工作区';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
      <div className="rounded-[28px] border border-white/60 bg-white/64 px-6 py-5 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl">
        <Loader2 size={28} className="animate-spin text-slate-500" />
      </div>
    </div>
  );
}

function WorkspaceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void | Promise<void>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">无法进入工作区</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>
        <button
          type="button"
          onClick={() => void onRetry()}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-accent-600"
        >
          <RefreshCw size={16} />
          重试
        </button>
      </div>
    </div>
  );
}

async function ensureNotebook(userId: string, email: string): Promise<Notebook> {
  const response = await apiFetch(
    `/api/v1/kb/notebooks?user_id=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`,
  );
  const data = await response.json();
  const notebooks = Array.isArray(data?.notebooks) ? data.notebooks : [];
  const existing = notebooks[0];

  if (existing) {
    return {
      id: existing.id,
      title: existing.name || existing.title || DEFAULT_NOTEBOOK_NAME,
      name: existing.name || existing.title || DEFAULT_NOTEBOOK_NAME,
    };
  }

  const createResponse = await apiFetch('/api/v1/kb/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DEFAULT_NOTEBOOK_NAME,
      description: '',
      user_id: userId,
      email,
    }),
  });
  const created = await createResponse.json();

  if (!created?.success || !created?.notebook?.id) {
    throw new Error(created?.message || '初始化默认工作区失败');
  }

  return {
    id: created.notebook.id,
    title: created.notebook.name || DEFAULT_NOTEBOOK_NAME,
    name: created.notebook.name || DEFAULT_NOTEBOOK_NAME,
  };
}

export default function App() {
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);
  const [workspaceNotebook, setWorkspaceNotebook] = useState<Notebook | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const { user, loading, setUser } = useAuthStore();

  useEffect(() => {
    initSupabase().then(setSupabaseConfigured);
  }, []);

  useEffect(() => {
    if (supabaseConfigured === null) return;
    if (!supabaseConfigured) {
      setUser(null);
      return;
    }
    refreshSession().then(setUser);
  }, [setUser, supabaseConfigured]);

  useEffect(() => {
    if (supabaseConfigured === null) return;
    if (supabaseConfigured && !user) {
      setWorkspaceNotebook(null);
      setWorkspaceLoading(false);
      return;
    }

    const userId = user?.id || 'local';
    const email = user?.email || '';

    setWorkspaceLoading(true);
    setWorkspaceError('');

    void ensureNotebook(userId, email)
      .then((notebook) => setWorkspaceNotebook(notebook))
      .catch((error: any) => {
        setWorkspaceNotebook(null);
        setWorkspaceError(error?.message || '工作区初始化失败');
      })
      .finally(() => setWorkspaceLoading(false));
  }, [supabaseConfigured, user?.email, user?.id]);

  if (loading || supabaseConfigured === null || workspaceLoading) {
    return <LoadingScreen />;
  }

  if (supabaseConfigured && !user) {
    return <AuthPage />;
  }

  if (!workspaceNotebook) {
    return (
      <WorkspaceError
        message={workspaceError || '没有可用的工作区。'}
        onRetry={async () => {
          const userId = user?.id || 'local';
          const email = user?.email || '';
          setWorkspaceLoading(true);
          setWorkspaceError('');
          try {
            const notebook = await ensureNotebook(userId, email);
            setWorkspaceNotebook(notebook);
          } catch (error: any) {
            setWorkspaceError(error?.message || '工作区初始化失败');
          } finally {
            setWorkspaceLoading(false);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
      <ThinkFlowWorkspace notebook={workspaceNotebook} onBack={() => undefined} />
    </div>
  );
}
