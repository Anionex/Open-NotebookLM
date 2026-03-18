import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './pages/Dashboard';
import NotebookView from './pages/NotebookView';
import { useAuthStore } from './stores/authStore';
import { initSupabase } from './lib/supabase';
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
    setSession(null);
  }, [setSession, supabaseConfigured]);

  useEffect(() => {
    if (!user) {
      setCurrentView('dashboard');
      setSelectedNotebook(null);
    }
  }, [user]);

  if (loading || supabaseConfigured === null) {
    return (
      <div className="portal-page relative flex items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
          <div className="absolute right-0 top-10 h-80 w-80 rounded-full bg-accent-blue/12 blur-3xl" />
        </div>
        <div className="portal-card relative flex items-center gap-3 px-6 py-4">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-sm font-medium text-ios-gray-700">Initializing OpenNotebookLM...</span>
        </div>
      </div>
    );
  }

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
    <div className="portal-page relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-3rem] top-16 h-96 w-96 rounded-full bg-accent-blue/12 blur-3xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-80 w-80 rounded-full bg-accent-gold/10 blur-3xl" />
      </div>
      <div className="relative min-h-screen">
        <AnimatePresence mode="wait" custom={direction}>
          {currentView === 'dashboard' ? (
            <motion.div
              key="dashboard"
              custom={direction}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-screen"
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
              className="min-h-screen"
            >
              <NotebookView
                notebook={selectedNotebook}
                onBack={handleBackToDashboard}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;
