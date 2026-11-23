import React, { useEffect, useMemo, useState } from 'react';
import { Copy, AlertTriangle, Check } from 'lucide-react';
import type { Category, Expense, MonthlyBudget } from '../types';
import {
  CATEGORIES,
  budgetForMonth,
  categoryBreakdown,
  formatINR,
  formatMonthLabel,
  getLocalCurrentMonth,
  paiseToInputString,
  shiftMonth,
  toPaise,
} from '../utils/expenseUtils.js';
import { CategoryIcon } from './CategoryIcon';
import { MonthSwitcher } from './MonthSwitcher';

interface BudgetScreenProps {
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  budgets: MonthlyBudget[];
  expenses: Expense[];
  onSaveBudget: (budget: MonthlyBudget) => void;
  onCopyBudgetToNextMonth: (sourceMonth: string, targetMonth: string, budget: MonthlyBudget) => void;
}

export const BudgetScreen: React.FC<BudgetScreenProps> = ({
  selectedMonth,
  onChangeMonth,
  budgets,
  expenses,
  onSaveBudget,
  onCopyBudgetToNextMonth,
}) => {
  const currentMonth = getLocalCurrentMonth();
  const effectiveBudget = useMemo(
    () => budgetForMonth(budgets, selectedMonth),
    [budgets, selectedMonth]
  );

  const [limitInput, setLimitInput] = useState('');
  const [catInputs, setCatInputs] = useState<Record<string, string>>({});
  const [limitError, setLimitError] = useState('');
  const [catErrors, setCatErrors] = useState<Record<string, string>>({});
  const [showPerCategory, setShowPerCategory] = useState(false);

  useEffect(() => {
    if (effectiveBudget) {
      setLimitInput(paiseToInputString(effectiveBudget.limitPaise));
      const nextCats: Record<string, string> = {};
      let hasCatLimits = false;
      for (const cat of CATEGORIES) {
        const val = effectiveBudget.perCategory?.[cat];
        if (val && val > 0) {
          nextCats[cat] = paiseToInputString(val);
          hasCatLimits = true;
        } else {
          nextCats[cat] = '';
        }
      }
      setCatInputs(nextCats);
      if (hasCatLimits) setShowPerCategory(true);
    } else {
      setLimitInput('');
      const emptyCats: Record<string, string> = {};
      for (const cat of CATEGORIES) emptyCats[cat] = '';
      setCatInputs(emptyCats);
    }
    setLimitError('');
    setCatErrors({});
  }, [selectedMonth, effectiveBudget]);

  const breakdown = useMemo(
    () => categoryBreakdown(selectedMonth, expenses),
    [selectedMonth, expenses]
  );

  const spentByCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of breakdown) {
      map[row.category] = row.amountPaise;
    }
    return map;
  }, [breakdown]);

  const validateAndBuildBudget = (): MonthlyBudget | null => {
    const trimmed = limitInput.trim();
    let hasError = false;

    if (!trimmed) {
      setLimitError('Please enter a monthly spending limit.');
      hasError = true;
    } else if (trimmed.startsWith('-')) {
      setLimitError('Monthly limit must be greater than zero.');
      hasError = true;
    } else {
      const paise = toPaise(trimmed);
      if (paise === null || paise <= 0) {
        setLimitError('Enter a positive amount with up to 2 decimal places.');
        hasError = true;
      } else {
        setLimitError('');
      }
    }

    const nextCatErrors: Record<string, string> = {};
    const perCategory: Partial<Record<Category, number>> = {};

    for (const cat of CATEGORIES) {
      const val = (catInputs[cat] || '').trim();
      if (!val) continue;
      if (val.startsWith('-')) {
        nextCatErrors[cat] = 'Must be greater than zero.';
        hasError = true;
        continue;
      }
      const p = toPaise(val);
      if (p === null || p <= 0) {
        nextCatErrors[cat] = 'Enter a positive amount (max 2 decimals).';
        hasError = true;
      } else {
        perCategory[cat] = p;
      }
    }
    setCatErrors(nextCatErrors);

    if (hasError) return null;

    return {
      month: selectedMonth,
      limitPaise: toPaise(trimmed)!,
      perCategory: Object.keys(perCategory).length > 0 ? perCategory : undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const built = validateAndBuildBudget();
    if (!built) return;
    onSaveBudget(built);
  };

  const handleCopyNext = () => {
    const built = validateAndBuildBudget();
    if (!built) return;
    const nextMonth = shiftMonth(selectedMonth, 1);
    onCopyBudgetToNextMonth(selectedMonth, nextMonth, {
      ...built,
      month: nextMonth,
    });
  };

  const nextMonthLabel = formatMonthLabel(shiftMonth(selectedMonth, 1));

  return (
    <div className="space-y-6">
      {/* Header & Month Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight">
            Monthly Budget
          </h1>
          <p className="text-sm text-[#5C534A] mt-0.5">
            {formatMonthLabel(selectedMonth)}
            {effectiveBudget?.inheritedFrom
              ? ` · Inherited from ${formatMonthLabel(effectiveBudget.inheritedFrom)}`
              : ''}
          </p>
        </div>

        <MonthSwitcher
          selectedMonth={selectedMonth}
          onChangeMonth={onChangeMonth}
        />
      </div>

      {/* Inherited notice */}
      {effectiveBudget?.inheritedFrom && (
        <div
          role="status"
          className="bg-[#FAF6F0] border border-[#E6DDD0] rounded-2xl px-4 py-3.5 text-sm text-[#1F1A17]"
        >
          <span className="font-semibold">Inherited budget:</span>{' '}
          {formatMonthLabel(selectedMonth)} has no saved budget yet, so it currently uses{' '}
          <span className="font-semibold">{formatMonthLabel(effectiveBudget.inheritedFrom)}</span>
          ’s limit of <span className="font-semibold tabular-nums">{formatINR(effectiveBudget.limitPaise)}</span>.
          Save below to customize this month.
        </div>
      )}

      {/* Main Budget Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-5">
          <div>
            <label
              htmlFor="budget-monthly-limit"
              className="block text-sm font-semibold text-[#1F1A17] mb-1.5"
            >
              Monthly spending limit (₹)
            </label>
            <p className="text-xs text-[#5C534A] mb-3">
              Months without an entry automatically inherit the most recent earlier budget.
            </p>
            <div className="relative max-w-sm">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5C534A] font-medium"
                aria-hidden="true"
              >
                ₹
              </span>
              <input
                id="budget-monthly-limit"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 25000"
                value={limitInput}
                onChange={(e) => {
                  setLimitInput(e.target.value);
                  if (limitError) setLimitError('');
                }}
                aria-invalid={Boolean(limitError)}
                aria-describedby={limitError ? 'budget-limit-error' : undefined}
                className="w-full min-h-[44px] pl-8 pr-4 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-base tabular-nums"
              />
            </div>
            {limitError && (
              <p id="budget-limit-error" role="alert" className="mt-1.5 text-xs font-medium text-[#C83219]">
                {limitError}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-[#E6DDD0] flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowPerCategory((v) => !v)}
              aria-expanded={showPerCategory}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm font-medium text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
            >
              {showPerCategory ? 'Hide per-category limits' : 'Set optional per-category limits'}
            </button>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyNext}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm font-medium text-[#1F1A17] hover:bg-[#FAF6F0] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Copy className="w-4 h-4 text-[#5C534A]" aria-hidden="true" />
                <span>Copy budget to {nextMonthLabel}</span>
              </button>

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Save budget</span>
              </button>
            </div>
          </div>
        </section>

        {/* Optional Per-Category Limits & Progress Bars */}
        {showPerCategory && (
          <section
            aria-label="Per-category budget limits"
            className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <div>
              <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                Category limits (optional)
              </h2>
              <p className="text-xs text-[#5C534A] mt-0.5">
                Leave blank for categories you don’t want to cap individually.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {CATEGORIES.map((cat) => {
                const inputVal = catInputs[cat] || '';
                const parsedLimit = toPaise(inputVal);
                const spent = spentByCat[cat] || 0;
                const hasValidLimit = parsedLimit !== null && parsedLimit > 0;
                const remaining = hasValidLimit ? parsedLimit - spent : 0;
                const isOver = hasValidLimit && remaining < 0;
                const pct = hasValidLimit
                  ? Math.min(100, Math.round((spent / parsedLimit) * 100))
                  : 0;

                return (
                  <div
                    key={cat}
                    className="p-4 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0]/60 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon category={cat} />
                        <div className="min-w-0">
                          <label
                            htmlFor={`cat-limit-${cat}`}
                            className="block text-sm font-semibold text-[#1F1A17]"
                          >
                            {cat}
                          </label>
                          <span className="text-xs text-[#5C534A] tabular-nums">
                            Spent: {formatINR(spent)}
                          </span>
                        </div>
                      </div>

                      <div className="relative w-32 shrink-0">
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#5C534A]"
                          aria-hidden="true"
                        >
                          ₹
                        </span>
                        <input
                          id={`cat-limit-${cat}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="No limit"
                          value={inputVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCatInputs((prev) => ({ ...prev, [cat]: val }));
                            if (catErrors[cat]) {
                              setCatErrors((prev) => ({ ...prev, [cat]: '' }));
                            }
                          }}
                          aria-invalid={Boolean(catErrors[cat])}
                          className="w-full min-h-[44px] pl-6 pr-2.5 py-1.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17] tabular-nums"
                        />
                      </div>
                    </div>

                    {catErrors[cat] && (
                      <p role="alert" className="text-xs font-medium text-[#C83219]">
                        {catErrors[cat]}
                      </p>
                    )}

                    {hasValidLimit && (
                      <div>
                        <div
                          className="h-2 w-full rounded-full bg-[#E6DDD0] overflow-hidden"
                          role="progressbar"
                          aria-valuenow={pct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${cat} budget used`}
                        >
                          <div
                            className={`h-full rounded-full bar-animate ${
                              isOver ? 'bg-[#C83219]' : 'bg-[#255B34]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
                          {isOver ? (
                            <span className="text-[#C83219] font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                              Over by {formatINR(Math.abs(remaining))}
                            </span>
                          ) : (
                            <span className="text-[#255B34] font-medium">
                              {formatINR(remaining)} left
                            </span>
                          )}
                          <span className="text-[#5C534A]">
                            Limit {formatINR(parsedLimit)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </form>
    </div>
  );
};
