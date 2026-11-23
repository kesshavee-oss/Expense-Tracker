import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Category, TransactionItem } from '../types';
import { CATEGORIES, paiseToInputString, toPaise } from '../utils/expenseUtils.js';
import { AccessibleDialog } from './AccessibleDialog';
import { ConfirmDialog } from './ConfirmDialog';

export interface EditSavePayload {
  id: string;
  txType: 'expense' | 'income';
  amountPaise: number;
  category: Category;
  source: string;
  date: string;
  note: string;
  scope: 'single' | 'future';
}

interface EditTransactionDialogProps {
  transaction: TransactionItem | null;
  onClose: () => void;
  onSave: (payload: EditSavePayload) => void;
  onDelete: (tx: TransactionItem) => void;
}

export const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  transaction,
  onClose,
  onSave,
  onDelete,
}) => {
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [source, setSource] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [recurringPromptOpen, setRecurringPromptOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Omit<EditSavePayload, 'scope'> | null>(null);

  useEffect(() => {
    if (transaction) {
      setAmountInput(paiseToInputString(transaction.amount));
      if (transaction.txType === 'expense') {
        setCategory(transaction.category);
        setSource('');
      } else {
        setSource(transaction.source);
        setCategory('Food');
      }
      setDate(transaction.date);
      setNote(transaction.note || '');
      setErrors({});
      setConfirmDeleteOpen(false);
      setRecurringPromptOpen(false);
      setPendingPayload(null);
    }
  }, [transaction]);

  if (!transaction) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};

    const trimmedAmount = amountInput.trim();
    if (!trimmedAmount) {
      nextErrors.amount = 'Please enter an amount.';
    } else if (trimmedAmount.startsWith('-')) {
      nextErrors.amount = 'Amount must be greater than zero.';
    } else {
      const paise = toPaise(trimmedAmount);
      if (paise === null) {
        nextErrors.amount = 'Enter a valid amount with up to 2 decimal places.';
      } else if (paise <= 0) {
        nextErrors.amount = 'Amount must be greater than zero.';
      }
    }

    if (transaction.txType === 'income' && !source.trim()) {
      nextErrors.source = 'Please enter an income source.';
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      nextErrors.date = 'Please select a valid date.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const basePayload: Omit<EditSavePayload, 'scope'> = {
      id: transaction.id,
      txType: transaction.txType,
      amountPaise: toPaise(trimmedAmount)!,
      category,
      source: source.trim().slice(0, 60),
      date,
      note: note.trim().slice(0, 120),
    };

    if (transaction.recurringId) {
      setPendingPayload(basePayload);
      setRecurringPromptOpen(true);
    } else {
      onSave({ ...basePayload, scope: 'single' });
    }
  };

  return (
    <>
      <AccessibleDialog
        open={Boolean(transaction)}
        onClose={onClose}
        title={transaction.txType === 'expense' ? 'Edit expense' : 'Edit income'}
        description={
          transaction.recurringId
            ? 'This entry was created by a monthly recurring rule.'
            : undefined
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Amount */}
          <div>
            <label htmlFor="edit-amount" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
              Amount (₹)
            </label>
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C534A] font-medium"
                aria-hidden="true"
              >
                ₹
              </span>
              <input
                id="edit-amount"
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? 'edit-amount-error' : undefined}
                className="w-full min-h-[44px] pl-8 pr-4 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-base tabular-nums"
              />
            </div>
            {errors.amount && (
              <p id="edit-amount-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
                {errors.amount}
              </p>
            )}
          </div>

          {/* Category or Source */}
          {transaction.txType === 'expense' ? (
            <div>
              <label
                htmlFor="edit-category"
                className="block text-sm font-medium text-[#1F1A17] mb-1.5"
              >
                Category
              </label>
              <select
                id="edit-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label
                htmlFor="edit-source"
                className="block text-sm font-medium text-[#1F1A17] mb-1.5"
              >
                Source
              </label>
              <input
                id="edit-source"
                type="text"
                maxLength={60}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  if (errors.source) setErrors((prev) => ({ ...prev, source: '' }));
                }}
                aria-invalid={Boolean(errors.source)}
                aria-describedby={errors.source ? 'edit-source-error' : undefined}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
              />
              {errors.source && (
                <p id="edit-source-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
                  {errors.source}
                </p>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label htmlFor="edit-date" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
              Date
            </label>
            <input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
              }}
              aria-invalid={Boolean(errors.date)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
            />
            {errors.date && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
                {errors.date}
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-note" className="text-sm font-medium text-[#1F1A17]">
                Note
              </label>
              <span className="text-xs text-[#5C534A] tabular-nums">{note.length}/120</span>
            </div>
            <input
              id="edit-note"
              type="text"
              maxLength={120}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#E6DDD0] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E7B5AC] bg-[#FDECE8] text-[#A82813] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#FADAD3] transition-colors"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>Delete</span>
            </button>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm font-medium hover:bg-[#FAF6F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold transition-colors"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </AccessibleDialog>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => onDelete(transaction)}
        title="Delete transaction"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        confirmLabel="Delete"
      />

      {/* Recurring instance edit choice */}
      <AccessibleDialog
        open={recurringPromptOpen}
        onClose={() => setRecurringPromptOpen(false)}
        title="Edit recurring entry"
        maxWidthClass="max-w-md"
        sheetOnMobile={false}
      >
        <p className="text-sm text-[#5C534A] leading-relaxed">
          Change only this one, or this and all future ones?
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (pendingPayload) {
                onSave({ ...pendingPayload, scope: 'single' });
              }
              setRecurringPromptOpen(false);
            }}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm font-semibold hover:bg-[#FAF6F0] transition-colors text-left"
          >
            Only this one
          </button>
          <button
            type="button"
            onClick={() => {
              if (pendingPayload) {
                onSave({ ...pendingPayload, scope: 'future' });
              }
              setRecurringPromptOpen(false);
            }}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold transition-colors text-left"
          >
            This and all future ones
          </button>
          <button
            type="button"
            onClick={() => setRecurringPromptOpen(false)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl text-[#5C534A] text-sm font-medium hover:bg-[#FAF6F0] transition-colors"
          >
            Cancel
          </button>
        </div>
      </AccessibleDialog>
    </>
  );
};
