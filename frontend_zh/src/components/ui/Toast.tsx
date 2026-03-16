import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast = ({ message, type = 'success', onClose, duration = 3000 }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-green-400" />,
    error: <XCircle size={20} className="text-red-400" />,
    warning: <AlertCircle size={20} className="text-yellow-400" />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200'
  };

  const textColors = {
    success: 'text-green-900',
    error: 'text-red-900',
    warning: 'text-amber-900'
  };

  const closeColors = {
    success: 'text-green-500 hover:text-green-700',
    error: 'text-red-500 hover:text-red-700',
    warning: 'text-amber-500 hover:text-amber-700'
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-top-2 duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border bg-white/95 backdrop-blur-sm shadow-lg ${bgColors[type]}`}>
        {icons[type]}
        <span className={`text-sm font-medium ${textColors[type]}`}>{message}</span>
        <button onClick={onClose} className={`ml-2 transition-colors ${closeColors[type]}`}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
