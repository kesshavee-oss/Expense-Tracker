import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AccessibleDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
  sheetOnMobile?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const openDialogStack: string[] = [];

export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  maxWidthClass = 'max-w-lg',
  sheetOnMobile = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dialogId = useRef(`dialog-${Math.random().toString(36).slice(2, 9)}`).current;
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  useEffect(() => {
    if (!open) return;

    triggerRef.current = document.activeElement as HTMLElement | null;
    openDialogStack.push(dialogId);
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        panel.focus();
      }
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openDialogStack[openDialogStack.length - 1] !== dialogId) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === first || !panel.contains(document.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !panel.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const idx = openDialogStack.lastIndexOf(dialogId);
      if (idx !== -1) {
        openDialogStack.splice(idx, 1);
      }
      if (openDialogStack.length === 0) {
        document.body.style.overflow = '';
      }
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [open, dialogId]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex ${
        sheetOnMobile ? 'items-end sm:items-center' : 'items-center'
      } justify-center bg-black/45 p-0 sm:p-4 backdrop-blur-[2px]`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`w-full ${maxWidthClass} bg-[#FFFFFF] text-[#1F1A17] border border-[#E6DDD0] shadow-xl ${
          sheetOnMobile
            ? 'rounded-t-2xl sm:rounded-2xl max-h-[92vh]'
            : 'rounded-2xl max-h-[90vh] mx-4'
        } flex flex-col overflow-hidden`}
      >
        {sheetOnMobile && (
          <div className="sm:hidden flex justify-center pt-2.5 pb-1" aria-hidden="true">
            <div className="w-10 h-1 rounded-full bg-[#D7CCC0]" />
          </div>
        )}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#E6DDD0]">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold text-[#1F1A17] leading-snug">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm text-[#5C534A]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close dialog"
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-[#5C534A] hover:bg-[#FAF6F0] hover:text-[#1F1A17] transition-colors shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
};
