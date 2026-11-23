import React from 'react';
import { AccessibleDialog } from './AccessibleDialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
}) => {
  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClass="max-w-md"
      sheetOnMobile={false}
    >
      <p className="text-sm text-[#5C534A] leading-relaxed">{message}</p>
      <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm font-medium hover:bg-[#FAF6F0] transition-colors whitespace-nowrap"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`min-h-[44px] px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors whitespace-nowrap ${
            destructive
              ? 'bg-[#C83219] hover:bg-[#A82813]'
              : 'bg-[#255B34] hover:bg-[#1C4728]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </AccessibleDialog>
  );
};
