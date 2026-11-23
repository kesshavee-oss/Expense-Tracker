import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface ToastBannerProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-36 sm:bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 pointer-events-none flex justify-center md:justify-end"
    >
      {toast && (
        <div
          role="status"
          className={`pointer-events-auto w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border shadow-lg ${
            toast.tone === 'error'
              ? 'bg-[#FDECE8] border-[#E7B5AC] text-[#8E1F0C]'
              : toast.tone === 'success'
              ? 'bg-[#E8F3EB] border-[#B6D7BF] text-[#1C4728]'
              : 'bg-[#FFFFFF] border-[#E6DDD0] text-[#1F1A17]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.tone === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm font-medium leading-snug">{toast.text}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl hover:bg-black/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
