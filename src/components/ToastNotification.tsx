import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

// Toast types
type ToastType = 'success' | 'error' | 'info' | 'warning' | 'confirm';
type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  addConfirmDialog: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// Toast Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Custom hook for using toasts
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode; position?: ToastPosition }> = ({ 
  children, 
  position = 'top-right' 
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration (except for confirm dialogs)
    if (toast.type !== 'confirm') {
      const duration = toast.duration || 5000;
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const addConfirmDialog = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { 
      ...toast, 
      id, 
      type: 'confirm',
      confirmText: toast.confirmText || 'OK',
      cancelText: toast.cancelText || 'Cancel'
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, addConfirmDialog, removeToast }}>
      {children}
      <div className={`fixed ${positionClasses[position]} z-50 flex flex-col gap-3 pointer-events-none`}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Individual Toast Item Component
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'confirm':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400';
      case 'error':
        return 'from-red-500/20 to-rose-500/20 border-red-500/30 text-red-400';
      case 'warning':
        return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400';
      case 'info':
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400';
      case 'confirm':
        return 'from-orange-500/20 to-red-500/20 border-orange-500/30 text-orange-400';
      default:
        return 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400';
    }
  };

  return (
    <div
      className={`
        pointer-events-auto
        min-w-[320px] max-w-md
        backdrop-blur-xl bg-gradient-to-br ${getColors()}
        border rounded-xl shadow-2xl
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="relative p-4">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-xl animate-pulse" />
        
        <div className="relative flex gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${getColors().split(' ')[3]}`}>
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">
              {toast.message}
            </p>
            {toast.description && (
              <p className="mt-1 text-xs text-white/70">
                {toast.description}
              </p>
            )}
          </div>

          {/* Close button (only for non-confirm toasts) */}
          {toast.type !== 'confirm' && (
            <button
              onClick={handleClose}
              className="flex-shrink-0 text-white/60 hover:text-white transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar (only for non-confirm toasts) */}
        {toast.type !== 'confirm' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-white/40 to-white/20 animate-shrink"
              style={{
                animationDuration: `${toast.duration || 5000}ms`,
              }}
            />
          </div>
        )}

        {/* Confirmation buttons */}
        {toast.type === 'confirm' && (
          <div className="mt-4 flex gap-2 justify-end">
            <button
              onClick={() => {
                toast.onCancel?.();
                handleClose();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200"
            >
              {toast.cancelText || 'Cancel'}
            </button>
            <button
              onClick={() => {
                toast.onConfirm?.();
                handleClose();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500/80 hover:bg-orange-500 rounded-lg transition-all duration-200 hover:scale-105"
            >
              {toast.confirmText || 'OK'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToastProvider;

