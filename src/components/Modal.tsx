import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  children,
  onClose,
  label,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
}) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select, [tabindex="0"]',
        ) || [],
      );
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`modal-scrim ${className}`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={dialog}
      >
        {children}
      </section>
    </div>
  );
}
