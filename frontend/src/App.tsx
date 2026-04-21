import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

import type { Notebook } from './components/thinkflow-types';
import { initSupabase, refreshSession } from './lib/supabase';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import NotebookView from './pages/NotebookView';
import { LanguageSwitcher, useI18nDom } from './i18n';
import { useAuthStore } from './stores/authStore';

const pageVariants = {
  initial: (direction: number) => ({
    x: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -20 : 20,
    opacity: 0,
    transition: { duration: 0.2 },
  }),
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
      <div className="rounded-[28px] border border-white/60 bg-white/64 px-6 py-5 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl">
        <Loader2 size={28} className="animate-spin text-slate-500" />
      </div>
    </div>
  );
}

export default function App() {
  useI18nDom();
  const [currentView, setCurrentView] = useState<'dashboard' | 'notebook'>('dashboard');
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [direction, setDirection] = useState(0);
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);
  // initializing：仅首次 session 检查期间为 true，不受后续 auth 操作影响
  const [initializing, setInitializing] = useState(true);
  const { user, setUser } = useAuthStore();

  useEffect(() => {
    initSupabase().then(setSupabaseConfigured);
  }, []);

  useEffect(() => {
    if (supabaseConfigured === null) return;
    if (!supabaseConfigured) {
      setUser(null);
      setInitializing(false);
      return;
    }
    refreshSession().then((u) => {
      setUser(u);
      setInitializing(false);
    });
  }, [setUser, supabaseConfigured]);

  useEffect(() => {
    if (!user) {
      setCurrentView('dashboard');
      setSelectedNotebook(null);
    }
  }, [user]);

  if (initializing) {
    return (
      <>
        <LanguageSwitcher />
        <LoadingScreen />
      </>
    );
  }

  if (supabaseConfigured && !user) {
    return (
      <>
        <LanguageSwitcher />
        <AuthPage />
      </>
    );
  }

  const handleOpenNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    setDirection(1);
    setCurrentView('notebook');
  };

  const handleBackToDashboard = () => {
    setDirection(-1);
    setCurrentView('dashboard');
    setSelectedNotebook(null);
    setDashboardRefresh((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
      {currentView === 'dashboard' || !selectedNotebook ? <LanguageSwitcher /> : null}
      <AnimatePresence mode="wait" custom={direction}>
        {currentView === 'dashboard' || !selectedNotebook ? (
          <motion.div
            key="dashboard"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Dashboard
              onOpenNotebook={handleOpenNotebook}
              refreshTrigger={dashboardRefresh}
              supabaseConfigured={supabaseConfigured}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`notebook-${selectedNotebook.id}`}
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <NotebookView notebook={selectedNotebook} onBack={handleBackToDashboard} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
