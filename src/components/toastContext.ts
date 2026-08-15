import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'confirm';

export interface Toast {
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

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  addConfirmDialog: (toast: Omit<Toast, 'id' | 'type'>) => void;
  removeToast: (id: string) => void;
  registerOutlet: (el: HTMLElement | null) => void;
}

// Kept in its own module (rather than alongside the components) so that
// ToastNotification.tsx only exports components and React Fast Refresh keeps
// working for it.
export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
