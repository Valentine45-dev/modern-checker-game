import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, HelpCircle, X, type LucideIcon } from 'lucide-react';
import { ToastContext, useToast, type Toast, type ToastType } from './toastContext';

type ToastPlacement = 'docked' | 'bottom';

/** At most this many non-confirm toasts are visible at once. */
const MAX_VISIBLE = 3;
/** An identical message inside this window is swallowed instead of stacked. */
const DEDUPE_WINDOW_MS = 1500;
/** Toasts dock into the sidebar at this width and above, so they never cover the board. */
const DOCK_QUERY = '(min-width: 1024px)';

/** Tracks a media query so we can choose a placement without guessing. */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Renders where toasts should appear on wide screens. Drop this into the game
 * sidebar: toasts then flow inside that column instead of floating over the
 * board. When it isn't mounted (menu, settings) toasts fall back to a bottom
 * snackbar.
 */
export const ToastOutlet: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { registerOutlet } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerOutlet(ref.current);
    return () => registerOutlet(null);
  }, [registerOutlet]);

  /*
   * Two things this markup is doing, both deliberate.
   *
   * `h-0` on the anchor: toasts used to be ordinary children of the sidebar's
   * vertical stack, so the moment one appeared it took real height and shoved
   * Game Details and everything under it down the page — then let it spring back
   * on dismiss. A zero-height anchor with absolutely positioned children means
   * the sidebar's layout is identical whether or not a toast is showing.
   *
   * `sticky`: the confirmation for Quit Game is raised from a button near the
   * bottom of the sidebar, but rendered at the top of it. On a short window you
   * had to scroll back up to answer your own click. Pinning the anchor to the
   * viewport keeps the prompt where you are looking.
   *
   * Below `z-50` so the game-over dialog still covers it.
   */
  return (
    <div className={`sticky top-3 z-40 h-0 ${className}`}>
      <div ref={ref} className="absolute inset-x-0 top-0 space-y-3" />
    </div>
  );
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [outlet, setOutlet] = useState<HTMLElement | null>(null);
  const canDock = useMediaQuery(DOCK_QUERY);

  const recentRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const registerOutlet = useCallback((el: HTMLElement | null) => setOutlet(el), []);

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    // Collapse repeats of the same event instead of stacking them up.
    const key = `${toast.type}:${toast.message}`;
    const now = Date.now();
    const last = recentRef.current.get(key);
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return;
    recentRef.current.set(key, now);

    const id = newId();
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => {
      const next = [...prev, newToast];
      // Never trim confirm dialogs — the user is waiting on them.
      const confirms = next.filter((t) => t.type === 'confirm');
      const rest = next.filter((t) => t.type !== 'confirm').slice(-MAX_VISIBLE);
      return [...rest, ...confirms];
    });

    const duration = toast.duration || 5000;
    const timer = setTimeout(() => removeToast(id), duration);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  const addConfirmDialog = useCallback((toast: Omit<Toast, 'id' | 'type'>) => {
    const newToast: Toast = {
      ...toast,
      id: newId(),
      type: 'confirm',
      confirmText: toast.confirmText || 'OK',
      cancelText: toast.cancelText || 'Cancel'
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  // Clear any pending dismiss timers if the provider goes away.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const placement: ToastPlacement = canDock && outlet ? 'docked' : 'bottom';

  const stack = toasts.map((toast) => (
    <ToastItem
      key={toast.id}
      toast={toast}
      placement={placement}
      onClose={() => removeToast(toast.id)}
    />
  ));

  return (
    <ToastContext.Provider value={{ toasts, addToast, addConfirmDialog, removeToast, registerOutlet }}>
      {children}

      {placement === 'docked' && outlet
        ? createPortal(stack, outlet)
        : (
          <div
            className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2
                       w-[min(92vw,26rem)] pointer-events-none"
          >
            {stack}
          </div>
        )}
    </ToastContext.Provider>
  );
};

const TOAST_STYLES: Record<ToastType, { surface: string; accent: string }> = {
  success: { surface: 'from-green-500/20 to-emerald-500/20 border-green-500/30', accent: 'text-green-400' },
  error:   { surface: 'from-red-500/20 to-rose-500/20 border-red-500/30',        accent: 'text-red-400' },
  warning: { surface: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30', accent: 'text-yellow-400' },
  info:    { surface: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',      accent: 'text-blue-400' },
  confirm: { surface: 'from-orange-500/20 to-red-500/20 border-orange-500/30',   accent: 'text-orange-400' },
};

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  confirm: HelpCircle,
};

// Individual Toast Item Component
const ToastItem: React.FC<{ toast: Toast; placement: ToastPlacement; onClose: () => void }> = ({
  toast,
  placement,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300);
  };

  const { surface, accent } = TOAST_STYLES[toast.type];
  const Icon = TOAST_ICONS[toast.type];

  // Docked toasts slide down into the sidebar; the bottom snackbar slides up.
  const hidden = placement === 'docked' ? '-translate-y-2 opacity-0' : 'translate-y-3 opacity-0';
  const shown = 'translate-y-0 opacity-100';

  return (
    <div
      role={toast.type === 'confirm' ? 'alertdialog' : 'status'}
      aria-live={toast.type === 'error' || toast.type === 'warning' ? 'assertive' : 'polite'}
      className={`
        pointer-events-auto w-full
        backdrop-blur-xl bg-gradient-to-br ${surface}
        border rounded-xl shadow-2xl
        transform transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? shown : hidden}
        ${isLeaving ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="relative p-3 sm:p-4">
        <div className="relative flex gap-3">
          {/* Icon */}
          <div className={`flex-shrink-0 ${accent}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">{toast.message}</p>
            {toast.description && (
              <p className="mt-1 text-xs text-white/70">{toast.description}</p>
            )}
          </div>

          {/* Close button (only for non-confirm toasts) */}
          {toast.type !== 'confirm' && (
            <button
              onClick={handleClose}
              aria-label="Dismiss notification"
              className="flex-shrink-0 text-white/60 hover:text-white transition-colors duration-200"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Progress bar (only for non-confirm toasts) */}
        {toast.type !== 'confirm' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-white/40 to-white/20 animate-shrink"
              style={{ animationDuration: `${toast.duration || 5000}ms` }}
            />
          </div>
        )}

        {/* Confirmation buttons */}
        {toast.type === 'confirm' && (
          <div className="mt-4 flex gap-2 justify-end pointer-events-auto">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.onCancel?.();
                handleClose();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 cursor-pointer z-10 relative"
            >
              {toast.cancelText || 'Cancel'}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toast.onConfirm?.();
                handleClose();
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-orange-500/80 hover:bg-orange-500 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer z-10 relative"
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
