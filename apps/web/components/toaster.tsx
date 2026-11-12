"use client";

// Short messages after an action ("Moved to Trash" with Undo). Bottom-left on desktop, above
// the tab bar on phones. A message stays 5 seconds, or 10 when it offers an action. The timer
// pauses while the message has keyboard focus or the pointer is on it (WCAG 2.2.1), and when a
// message closes with focus inside it, focus moves to a sensible place on the page.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toast, type ToastProps } from "@/components/ui";

type ToastInput = {
  message: string;
  tone?: ToastProps["tone"];
  actionLabel?: string;
  onAction?: () => void;
  /** Move keyboard focus to the action, e.g. Undo after the item the user was on is gone. */
  focusAction?: boolean;
  /** Where focus goes if the message closes while it has focus. Default: the page heading. */
  returnFocus?: () => HTMLElement | null | undefined;
};

type ToastEntry = ToastInput & { id: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** The page's heading, made focusable for a moment, when there is nowhere better. */
function pageHeading(): HTMLElement | null {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (heading && !heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  return heading;
}

export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((toast: ToastEntry) => {
    const element = document.querySelector(`[data-toast-id="${toast.id}"]`);
    const hadFocus = Boolean(element?.contains(document.activeElement));
    setToasts((all) => all.filter((t) => t.id !== toast.id));
    if (hadFocus) {
      setTimeout(() => {
        const target = toast.returnFocus?.();
        (target && target.isConnected ? target : pageHeading())?.focus();
      }, 0);
    }
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    // The newest three at most; a new one replaces the oldest.
    setToasts((all) => [...all.slice(-2), { ...toast, id }]);
    if (toast.focusAction) {
      setTimeout(
        () => document.querySelector<HTMLElement>(`[data-toast-id="${id}"] button`)?.focus(),
        0,
      );
    }
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Each Toast is its own status region, so the stack itself isn't announced. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[100px] z-40 flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:left-[calc(var(--sidebar-width)+24px)] md:items-start">
        {toasts.map((toast) => (
          <TimedToast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function TimedToast({
  toast,
  onDismiss,
}: {
  toast: ToastEntry;
  onDismiss: (toast: ToastEntry) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remaining = useRef(toast.actionLabel ? 10_000 : 5_000);
  const paused = focused || hovered;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, toast, onDismiss]);

  return (
    <div
      data-toast-id={toast.id}
      className="pointer-events-auto"
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Toast
        tone={toast.tone}
        actionLabel={toast.actionLabel}
        onAction={
          toast.onAction
            ? () => {
                onDismiss(toast);
                toast.onAction?.();
              }
            : undefined
        }
        onClose={() => onDismiss(toast)}
      >
        {toast.message}
      </Toast>
    </div>
  );
}
