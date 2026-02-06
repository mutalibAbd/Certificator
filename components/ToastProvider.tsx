"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType) => void;
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                   */
/* -------------------------------------------------------------------------- */

export const ToastContext = createContext<ToastContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4_000;

/* -------------------------------------------------------------------------- */
/*  Style helpers                                                             */
/* -------------------------------------------------------------------------- */

const typeStyles: Record<
  ToastType,
  { bg: string; border: string; accent: string }
> = {
  success: {
    bg: "bg-green-50",
    border: "border-green-500",
    accent: "var(--success, #22c55e)",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-500",
    accent: "var(--error, #ef4444)",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-500",
    accent: "var(--primary, #2563eb)",
  },
};

/* -------------------------------------------------------------------------- */
/*  Single toast card                                                         */
/* -------------------------------------------------------------------------- */

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const style = typeStyles[toast.type];

  /* Slide in on mount */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-start gap-3 rounded-lg px-4 py-3 shadow-md
        border ${style.border} ${style.bg}
        transition-transform duration-300 ease-in-out
        ${visible ? "translate-x-0" : "translate-x-full"}
      `}
      style={{
        borderLeftWidth: 4,
        borderLeftStyle: "solid",
        borderLeftColor: style.accent,
        fontFamily: "var(--font-sans)",
        maxWidth: 360,
        width: "100%",
        pointerEvents: "auto",
      }}
    >
      {/* Message */}
      <span className="flex-1 text-sm text-foreground leading-snug">
        {toast.message}
      </span>

      {/* Close button */}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  /* Clean up all timers on unmount */
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, message, type, createdAt: Date.now() };

      setToasts((prev) => {
        // Keep only the newest MAX_VISIBLE - 1 so the new one fits
        const trimmed =
          prev.length >= MAX_VISIBLE ? prev.slice(-MAX_VISIBLE + 1) : prev;
        return [...trimmed, toast];
      });

      // Auto-dismiss
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        className="z-toast fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
