import React, { useEffect, useState } from 'react';
import type { Category } from '../types';
import { CATEGORIES, getLocalTodayISO, toPaise } from '../utils/expenseUtils.js';
import { AccessibleDialog } from './AccessibleDialog';

export interface AddTransactionPayload {
  type: 'expense' | 'income';
  amountPaise: number;
  category: Category;
  source: string;
  date: string;
  note: string;
  repeatMonthly: boolean;
  dayOfMonth: number;
  endMonth?: string;
}

interface AddScreenProps {
  open: boolean;
  onClose: () => void;
  onSave: (payload: AddTransactionPayload) => void;
}

export const AddScreen: React.FC<AddScreenProps> = ({ open, onClose, onSave }) => {
  const [txType, setTxType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [source, setSource] = useState('');
  const [date, setDate] = useState(getLocalTodayISO());
  const [note, setNote] = useState('');
  const [repeatMonthly, setRepeatMonthly] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [endMonth, setEndMonth] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const today = getLocalTodayISO();
      const todayDay = Math.min(31, Math.max(1, Number(today.slice(8, 10)) || 1));
      setTxType('expense');
      setAmountInput('');
      setCategory('Food');
      setSource('');
      setDate(today);
      setNote('');
      setRepeatMonthly(false);
      setDayOfMonth(String(todayDay));
      setEndMonth('');
      setErrors({});
    }
  }, [open]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      const d = Math.min(31, Math.max(1, Number(newDate.slice(8, 10)) || 1));
      setDayOfMonth(String(d));
    }
  };

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

    if (txType === 'income' && !source.trim()) {
      nextErrors.source = 'Please enter an income source.';
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      nextErrors.date = 'Please select a valid date.';
    }

    const parsedDay = Number(dayOfMonth);
    if (repeatMonthly) {
      if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        nextErrors.dayOfMonth = 'Choose a day between 1 and 31.';
      }
      if (endMonth && date && endMonth < date.slice(0, 7)) {
        nextErrors.endMonth = 'End month must be the same as or after the start month.';
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const amountPaise = toPaise(trimmedAmount)!;
    onSave({
      type: txType,
      amountPaise,
      category,
      source: source.trim().slice(0, 60),
      date,
      note: note.trim().slice(0, 120),
      repeatMonthly,
      dayOfMonth: parsedDay,
      endMonth: repeatMonthly && endMonth ? endMonth : undefined,
    });
  };

  return (
    <AccessibleDialog
      open={open}
      onClose={onClose}
      title="Add transaction"
      description="Record an expense or income entry on this device."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Segmented Control: Expense | Income */}
        <div
          role="group"
          aria-label="Transaction type"
          className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3ECE2]"
        >
          <button
            type="button"
            onClick={() => {
              setTxType('expense');
              setErrors((prev) => ({ ...prev, source: '' }));
            }}
            aria-pressed={txType === 'expense'}
            className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
              txType === 'expense'
                ? 'bg-[#FFFFFF] text-[#C83219] shadow-sm'
                : 'text-[#5C534A] hover:text-[#1F1A17]'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setTxType('income')}
            aria-pressed={txType === 'income'}
            className={`min-h-[44px] rounded-lg text-sm font-semibold transition-colors ${
              txType === 'income'
                ? 'bg-[#FFFFFF] text-[#255B34] shadow-sm'
                : 'text-[#5C534A] hover:text-[#1F1A17]'
            }`}
          >
            Income
          </button>
        </div>

        {/* Amount */}
        <div>
          <label htmlFor="add-amount" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
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
              id="add-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
              }}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? 'add-amount-error' : undefined}
              className="w-full min-h-[44px] pl-8 pr-4 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-base tabular-nums focus:border-[#C83219]"
            />
          </div>
          {errors.amount && (
            <p id="add-amount-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
              {errors.amount}
            </p>
          )}
        </div>

        {/* Category or Source */}
        {txType === 'expense' ? (
          <div>
            <label htmlFor="add-category" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
              Category
            </label>
            <select
              id="add-category"
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
            <label htmlFor="add-source" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
              Source
            </label>
            <input
              id="add-source"
              type="text"
              maxLength={60}
              placeholder="e.g. Salary, Freelance, Stipend"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                if (errors.source) setErrors((prev) => ({ ...prev, source: '' }));
              }}
              aria-invalid={Boolean(errors.source)}
              aria-describedby={errors.source ? 'add-source-error' : undefined}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
            />
            {errors.source && (
              <p id="add-source-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
                {errors.source}
              </p>
            )}
          </div>
        )}

        {/* Date */}
        <div>
          <label htmlFor="add-date" className="block text-sm font-medium text-[#1F1A17] mb-1.5">
            Date
          </label>
          <input
            id="add-date"
            type="date"
            value={date}
            onChange={(e) => {
              handleDateChange(e.target.value);
              if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
            }}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? 'add-date-error' : undefined}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
          />
          {errors.date && (
            <p id="add-date-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
              {errors.date}
            </p>
          )}
        </div>

        {/* Optional Note */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="add-note" className="text-sm font-medium text-[#1F1A17]">
              Note <span className="text-[#5C534A] font-normal">(optional)</span>
            </label>
            <span className="text-xs text-[#5C534A] tabular-nums">{note.length}/120</span>
          </div>
          <input
            id="add-note"
            type="text"
            maxLength={120}
            placeholder="Lunch, metro pass, electricity bill..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
          />
        </div>

        {/* Repeat every month toggle */}
        <div className="pt-2 border-t border-[#E6DDD0]">
          <label
            htmlFor="add-repeat-toggle"
            className="min-h-[44px] flex items-center justify-between gap-3 cursor-pointer select-none"
          >
            <div>
              <span className="block text-sm font-medium text-[#1F1A17]">
                Repeat every month
              </span>
              <span className="block text-xs text-[#5C534A]">
                Automatically adds this entry each month
              </span>
            </div>
            <input
              id="add-repeat-toggle"
              type="checkbox"
              checked={repeatMonthly}
              onChange={(e) => setRepeatMonthly(e.target.checked)}
              className="w-5 h-5 accent-[#C83219] rounded cursor-pointer"
            />
          </label>

          {repeatMonthly && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DDD0]">
              <div>
                <label
                  htmlFor="add-repeat-day"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Day of month (1–31)
                </label>
                <input
                  id="add-repeat-day"
                  type="number"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => {
                    setDayOfMonth(e.target.value);
                    if (errors.dayOfMonth) setErrors((prev) => ({ ...prev, dayOfMonth: '' }));
                  }}
                  aria-invalid={Boolean(errors.dayOfMonth)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm tabular-nums"
                />
                {errors.dayOfMonth ? (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#C83219]">
                    {errors.dayOfMonth}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-[#5C534A]">
                    Shorter months use their last day.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="add-repeat-end"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  End month <span className="text-[#5C534A] font-normal">(optional)</span>
                </label>
                <input
                  id="add-repeat-end"
                  type="month"
                  value={endMonth}
                  onChange={(e) => {
                    setEndMonth(e.target.value);
                    if (errors.endMonth) setErrors((prev) => ({ ...prev, endMonth: '' }));
                  }}
                  aria-invalid={Boolean(errors.endMonth)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm"
                />
                {errors.endMonth && (
                  <p role="alert" className="mt-1 text-xs font-medium text-[#C83219]">
                    {errors.endMonth}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm font-medium hover:bg-[#FAF6F0] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`min-h-[44px] px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
              txType === 'expense'
                ? 'bg-[#C83219] hover:bg-[#A82813]'
                : 'bg-[#255B34] hover:bg-[#1C4728]'
            }`}
          >
            Save {txType === 'expense' ? 'expense' : 'income'}
          </button>
        </div>
      </form>
    </AccessibleDialog>
  );
};
