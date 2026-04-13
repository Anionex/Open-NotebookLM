import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import NotebookView from './pages/NotebookView';
import AuthPage from './pages/AuthPage';
import { useAuthStore } from './stores/authStore';
import { initSupabase, refreshSession } from './lib/supabase';
import { Loader2 } from 'lucide-react';

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

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'notebook'>('dashboard');
  const [selectedNotebook, setSelectedNotebook] = useState<any>(null);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [direction, setDirection] = useState(0);
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null);
  const { user, loading, setUser } = useAuthStore();

  // Initialize Supabase from backend config
  useEffect(() => {
    initSupabase().then(setSupabaseConfigured);
  }, []);

  // Initialize auth session
  useEffect(() => {
    if (supabaseConfigured === null) return;
    if (!supabaseConfigured) {
      setUser(null);
      return;
    }

    refreshSession().then(setUser);
  }, [setUser, supabaseConfigured]);

  useEffect(() => {
    if (!user) {
      setCurrentView('dashboard');
      setSelectedNotebook(null);
    }
  }, [user]);

  if (loading || supabaseConfigured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
        <div className="rounded-[28px] border border-white/60 bg-white/64 px-6 py-5 shadow-[0_24px_60px_rgba(22,38,66,0.10)] backdrop-blur-2xl">
          <Loader2 size={28} className="animate-spin text-slate-500" />
        </div>
      </div>
    );
  }

  // If Supabase is configured but user is not logged in, show auth page
  if (supabaseConfigured && !user) {
    return <AuthPage />;
  }

  // If Supabase is not configured, allow trial mode (no auth required)

  const handleOpenNotebook = (notebook: any) => {
    setSelectedNotebook(notebook);
    setDirection(1);
    setCurrentView('notebook');
  };

  const handleBackToDashboard = () => {
    setDirection(-1);
    setCurrentView('dashboard');
    setSelectedNotebook(null);
    setDashboardRefresh((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(166,215,255,0.58),transparent_26%),radial-gradient(circle_at_top_right,rgba(255,225,205,0.46),transparent_24%),linear-gradient(180deg,#eef4fb_0%,#f5f4f7_44%,#f7f3ed_100%)]">
      <AnimatePresence mode="wait" custom={direction}>
        {currentView === 'dashboard' ? (
          <motion.div
            key="dashboard"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Dashboard onOpenNotebook={handleOpenNotebook} refreshTrigger={dashboardRefresh} supabaseConfigured={supabaseConfigured} />
          </motion.div>
        ) : (
          <motion.div
            key="notebook"
            custom={direction}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <NotebookView
              notebook={selectedNotebook}
              onBack={handleBackToDashboard}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
