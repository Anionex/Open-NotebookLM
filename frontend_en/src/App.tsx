import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import NotebookView from './pages/NotebookView';
import AuthPage from './pages/AuthPage';
import { useAuthStore } from './stores/authStore';
import { initSupabase, getSupabaseClient } from './lib/supabase';
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
  const { user, loading, setSession } = useAuthStore();

  // Initialize Supabase from backend config
  useEffect(() => {
    initSupabase().then(setSupabaseConfigured);
  }, []);

  // Initialize auth session
  useEffect(() => {
    if (supabaseConfigured === null) return;
    if (!supabaseConfigured) {
      setSession(null);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, supabaseConfigured]);

  useEffect(() => {
    if (!user) {
      setCurrentView('dashboard');
      setSelectedNotebook(null);
    }
  }, [user]);

  if (loading || supabaseConfigured === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f7]">
        <Loader2 size={28} className="animate-spin text-slate-500" />
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
    <div className="min-h-screen bg-[#f2f2f7]">
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
