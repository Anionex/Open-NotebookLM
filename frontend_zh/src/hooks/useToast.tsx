import { useState, useCallback } from 'react';
import { Toast } from '../components/ui/Toast';

type ToastType = 'success' | 'error' | 'warning';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type, id: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const ToastContainer = toast ? (
    <Toast
      key={toast.id}
      message={toast.message}
      type={toast.type}
      onClose={hideToast}
    />
  ) : null;

  return { showToast, ToastContainer };
};
