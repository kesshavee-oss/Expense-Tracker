import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Plus,
  ArrowRight,
  Search,
  X,
} from 'lucide-react';
import type { Category, Expense, Income, MonthlyBudget, ScreenId } from '../types';
import {
  budgetForMonth,
  categoryBreakdown,
  daysInMonth,
  formatINR,
  formatMonthLabel,
  formatWeekdayDate,
  getLocalCurrentMonth,
  getLocalTodayISO,
  summarizeMonth,
} from '../utils/expenseUtils.js';
import {
  isValidMonthString,
  loadSelectedMonth,
  saveSelectedMonth,
} from '../utils/storage';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { CategoryIcon, getCategoryBarClass } from './CategoryIcon';
import { MonthSwitcher } from './MonthSwitcher';

interface HomeScreenProps {
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  expenses: Expense[];
  income: Income[];
  budgets: MonthlyBudget[];
  onOpenAdd: () => void;
  onNavigate: (screen: ScreenId) => void;
  onSelectExpense: (expense: Expense) => void;
}

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SEARCH_DEBOUNCE_MS = 250;

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  let matchIndex = lowerText.indexOf(lowerQuery);
  if (matchIndex === -1) return text;

  const parts: React.ReactNode[] = [];
  let cursor = 0;

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex));
    }
    const end = matchIndex + trimmed.length;
    parts.push(
      <mark
        key={`${matchIndex}-${end}`}
        className="bg-[#FCE2C4] text-[#1F1A17] rounded px-0.5 font-semibold"
      >
        {text.slice(matchIndex, end)}
      </mark>
    );
    cursor = end;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  selectedMonth,
  onChangeMonth,
  expenses,
  income,
  budgets,
  onOpenAdd,
  onNavigate,
  onSelectExpense,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentMonth = getLocalCurrentMonth();
  const todayISO = getLocalTodayISO();
  const activeMonth = isValidMonthString(selectedMonth)
    ? selectedMonth
    : loadSelectedMonth();

  useEffect(() => {
    setSelectedCategory(null);
    if (isValidMonthString(activeMonth)) {
      saveSelectedMonth(activeMonth);
    }
  }, [activeMonth]);

  const handleMonthChange = useCallback(
    (nextMonth: string) => {
      const resolvedMonth = isValidMonthString(nextMonth)
        ? nextMonth
        : getLocalCurrentMonth();
      setSelectedCategory(null);
      saveSelectedMonth(resolvedMonth);
      onChangeMonth(resolvedMonth);
    },
    [onChangeMonth]
  );

  const [scheduleSearch, cancelScheduledSearch] = useDebouncedCallback(
    (nextValue: string) => {
      setSearchQuery(nextValue);
    },
    SEARCH_DEBOUNCE_MS
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (!nextValue) {
        cancelScheduledSearch();
        setSearchQuery((prev) => (prev === '' ? prev : ''));
        return;
      }
      scheduleSearch(nextValue);
    },
    [cancelScheduledSearch, scheduleSearch]
  );

  const clearSearch = useCallback(() => {
    cancelScheduledSearch();
    if (searchInputRef.current) {
      searchInputRef.current.value = '';
    }
    setSearchQuery('');
  }, [cancelScheduledSearch]);

  const summary = useMemo(
    () => summarizeMonth(activeMonth, expenses, income),
    [activeMonth, expenses, income]
  );

  const effectiveBudget = useMemo(
    () => budgetForMonth(budgets, activeMonth),
    [budgets, activeMonth]
  );

  const breakdown = useMemo(
    () => categoryBreakdown(activeMonth, expenses),
    [activeMonth, expenses]
  );

  const activeCategories = useMemo(
    () => breakdown.filter((row) => row.amountPaise > 0),
    [breakdown]
  );

  const monthExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses
      .filter((e) => e.date.startsWith(activeMonth))
      .filter((e) => (selectedCategory ? e.category === selectedCategory : true))
      .filter((e) => {
        if (!q) return true;
        const noteMatch = (e.note || '').toLowerCase().includes(q);
        const categoryMatch = e.category.toLowerCase().includes(q);
        return noteMatch || categoryMatch;
      })
      .sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }, [expenses, activeMonth, selectedCategory, searchQuery]);

  // Last 7 days ending today (if current month) or end of activeMonth
  const last7Days = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number);
    let anchorDate: Date;
    if (activeMonth === currentMonth) {
      const [ty, tm, td] = todayISO.split('-').map(Number);
      anchorDate = new Date(ty, tm - 1, td);
    } else {
      anchorDate = new Date(y, m - 1, daysInMonth(activeMonth));
    }

    const days: Array<{ iso: string; weekday: string; dayNum: number; amountPaise: number }> = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dt = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - offset);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
        dt.getDate()
      ).padStart(2, '0')}`;
      const dayTotal = expenses
        .filter((e) => e.date === iso)
        .reduce((acc, e) => acc + e.amount, 0);
      days.push({
        iso,
        weekday: SHORT_WEEKDAYS[dt.getDay()],
        dayNum: dt.getDate(),
        amountPaise: dayTotal,
      });
    }
    const maxPaise = Math.max(...days.map((d) => d.amountPaise), 0);
    return { days, maxPaise };
  }, [activeMonth, currentMonth, todayISO, expenses]);

  const budgetRemainingPaise = effectiveBudget
    ? effectiveBudget.limitPaise - summary.spentPaise
    : null;
  const isOverBudget = budgetRemainingPaise !== null && budgetRemainingPaise < 0;
  const budgetUsedPct =
    effectiveBudget && effectiveBudget.limitPaise > 0
      ? Math.min(100, Math.round((summary.spentPaise / effectiveBudget.limitPaise) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Month Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight">
            {formatMonthLabel(activeMonth)}
          </h1>
          <p className="text-sm text-[#5C534A] mt-0.5">
            Monthly overview · {summary.expenseCount}{' '}
            {summary.expenseCount === 1 ? 'expense' : 'expenses'}
          </p>
        </div>

        <MonthSwitcher
          selectedMonth={activeMonth}
          onChangeMonth={handleMonthChange}
        />
      </div>

      {/* Summary Card */}
      <section
        aria-label="Monthly summary"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 shadow-[0_1px_3px_rgba(31,26,23,0.05)]"
      >
        {/* Search box */}
        <div className="relative mb-5">
          <label htmlFor="home-tx-search" className="sr-only">
            Search transactions by note or category
          </label>
          <Search
            className="w-4 h-4 text-[#5C534A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            id="home-tx-search"
            type="search"
            defaultValue={searchQuery}
            placeholder="Search note or category..."
            onChange={handleSearchChange}
            className="w-full min-h-[44px] pl-10 pr-10 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm text-[#1F1A17] placeholder:text-[#786D62]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="min-h-[44px] min-w-[44px] absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#5C534A] hover:text-[#1F1A17]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pb-5 border-b border-[#E6DDD0]">
          <div>
            <p className="text-xs font-medium text-[#5C534A]">Total spent</p>
            <p className="mt-1 font-display text-xl lg:text-2xl font-bold text-[#C83219] tabular-nums">
              {formatINR(summary.spentPaise)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#5C534A]">Total income</p>
            <p className="mt-1 font-display text-xl lg:text-2xl font-bold text-[#255B34] tabular-nums">
              {formatINR(summary.incomePaise)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#5C534A]">Net (income − spent)</p>
            <p
              className={`mt-1 font-display text-xl lg:text-2xl font-bold tabular-nums ${
                summary.netPaise >= 0 ? 'text-[#255B34]' : 'text-[#C83219]'
              }`}
            >
              {summary.netPaise > 0 ? '+' : ''}
              {formatINR(summary.netPaise)}
            </p>
          </div>
        </div>

        {/* Budget Progress */}
        <div className="pt-5">
          {effectiveBudget ? (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-[#1F1A17]">
                    Left in budget
                  </span>
                  {effectiveBudget.inheritedFrom && (
                    <span className="ml-2 text-xs text-[#5C534A]">
                      · Inherited from {formatMonthLabel(effectiveBudget.inheritedFrom)}
                    </span>
                  )}
                </div>

                {isOverBudget ? (
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-[#C83219] tabular-nums">
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Over by {formatINR(Math.abs(budgetRemainingPaise!))}</span>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-[#255B34] tabular-nums">
                    {formatINR(budgetRemainingPaise!)} left of {formatINR(effectiveBudget.limitPaise)}
                  </div>
                )}
              </div>

              <div
                className="mt-3 h-3 w-full rounded-full bg-[#F3ECE2] overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.min(100, Math.round((summary.spentPaise / effectiveBudget.limitPaise) * 100))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Monthly budget used"
              >
                <div
                  className={`h-full rounded-full bar-animate ${
                    isOverBudget ? 'bg-[#C83219]' : 'bg-[#255B34]'
                  }`}
                  style={{ width: `${budgetUsedPct}%` }}
                />
              </div>

              <div className="mt-2 flex items-center justify-between text-xs text-[#5C534A] tabular-nums">
                <span>
                  {Math.round((summary.spentPaise / effectiveBudget.limitPaise) * 100)}% of monthly limit used
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('budget')}
                  className="font-medium text-[#C83219] hover:underline min-h-[44px] px-1 -my-2 inline-flex items-center"
                >
                  Adjust budget
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#1F1A17]">No monthly budget set yet</p>
                <p className="text-xs text-[#5C534A] mt-0.5">
                  Set a spending limit to track how much is left each month.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('budget')}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm font-medium text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors whitespace-nowrap"
              >
                Set budget
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Content Grid: Category Breakdown & Last 7 Days */}
      {summary.expenseCount === 0 ? (
        <section className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-8 text-center">
          <p className="text-base font-medium text-[#1F1A17]">
            No expenses this month yet. Add your first one with the + button.
          </p>
          <p className="text-sm text-[#5C534A] mt-1">
            Your spending breakdown and 7-day trend will appear here as soon as you record an expense.
          </p>
          <button
            type="button"
            onClick={onOpenAdd}
            className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add first expense</span>
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Category Breakdown */}
          <section
            aria-label="Category breakdown"
            className="lg:col-span-7 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                  Spending by category
                </h2>
                <p className="text-xs text-[#5C534A] mt-0.5">
                  Tap a category row to filter the list below
                </p>
              </div>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="min-h-[44px] px-3 py-1.5 rounded-xl bg-[#FDECE8] text-[#A82813] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#FADAD3] transition-colors whitespace-nowrap"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Clear: {selectedCategory}</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#F0E8DC]">
              {activeCategories.map((row) => {
                const isSelected = selectedCategory === row.category;
                const barClass = getCategoryBarClass(row.category);
                const catLimit = effectiveBudget?.perCategory?.[row.category];
                const isCatOver =
                  typeof catLimit === 'number' && catLimit > 0 && row.amountPaise > catLimit;
                const catOverBy = isCatOver ? row.amountPaise - catLimit : 0;

                return (
                  <button
                    key={row.category}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === row.category ? null : row.category
                      )
                    }
                    className={`w-full min-h-[56px] py-3 px-2.5 -mx-2.5 rounded-xl text-left transition-colors flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#FDECE8]/60 ring-1 ring-[#C83219]/40'
                        : 'hover:bg-[#FAF6F0]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon category={row.category} />
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-[#1F1A17] block truncate">
                            {row.category}
                          </span>
                          <span className="text-xs text-[#5C534A] tabular-nums">
                            {row.sharePct}% of spending · {row.count}{' '}
                            {row.count === 1 ? 'item' : 'items'}
                          </span>
                          {isCatOver && (
                            <span className="mt-0.5 text-xs font-semibold text-[#C83219] inline-flex items-center gap-1 tabular-nums">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Over by {formatINR(catOverBy)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-[#1F1A17] tabular-nums shrink-0">
                        {formatINR(row.amountPaise)}
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-[#F3ECE2] overflow-hidden">
                      <div
                        className={`h-full rounded-full bar-animate ${
                          isCatOver ? 'bg-[#C83219]' : barClass
                        }`}
                        style={{ width: `${Math.max(2, row.sharePct)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Last 7 Days CSS Bars */}
          <section
            aria-label="Last 7 days spending"
            className="lg:col-span-5 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6"
          >
            <div className="mb-5">
              <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                Last 7 days
              </h2>
              <p className="text-xs text-[#5C534A] mt-0.5">
                Daily spending totals ({formatWeekdayDate(last7Days.days[0].iso)} –{' '}
                {formatWeekdayDate(last7Days.days[6].iso)})
              </p>
            </div>

            <div className="grid grid-cols-7 gap-2 items-end h-44 pt-6 border-b border-[#E6DDD0] pb-2">
              {last7Days.days.map((day) => {
                const heightPct =
                  last7Days.maxPaise > 0
                    ? Math.round((day.amountPaise / last7Days.maxPaise) * 100)
                    : 0;
                const visualHeight =
                  day.amountPaise > 0 ? Math.max(8, heightPct) : 0;

                return (
                  <div
                    key={day.iso}
                    className="flex flex-col items-center justify-end h-full min-w-0"
                    title={`${formatWeekdayDate(day.iso)}: ${formatINR(day.amountPaise)}`}
                  >
                    <span className="text-[10px] font-medium text-[#5C534A] tabular-nums mb-1 truncate max-w-full">
                      {day.amountPaise > 0 ? `₹${Math.round(day.amountPaise / 100)}` : ''}
                    </span>
                    <div className="w-full max-w-[28px] flex-1 flex items-end justify-center">
                      {day.amountPaise > 0 ? (
                        <div
                          className="w-full rounded-t-lg bg-[#C83219] bar-animate"
                          style={{ height: `${visualHeight}%` }}
                          role="img"
                          aria-label={`${day.weekday} ${day.dayNum}: ${formatINR(day.amountPaise)}`}
                        />
                      ) : (
                        <div
                          className="w-full h-1 rounded-full bg-[#EFECE6]"
                          aria-label={`${day.weekday} ${day.dayNum}: ₹0`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-7 gap-2 pt-2 text-center">
              {last7Days.days.map((day) => (
                <div key={day.iso} className="min-w-0">
                  <span className="block text-[11px] font-medium text-[#1F1A17]">
                    {day.weekday}
                  </span>
                  <span className="block text-[11px] text-[#5C534A] tabular-nums">
                    {day.dayNum}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Filtered Monthly Expenses List */}
      {summary.expenseCount > 0 && (
        <section
          aria-label="Month expenses list"
          className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                {selectedCategory ? `${selectedCategory} expenses` : 'Expenses this month'}
              </h2>
              <p className="text-xs text-[#5C534A] mt-0.5">
                {monthExpenses.length} {monthExpenses.length === 1 ? 'entry' : 'entries'}
                {selectedCategory ? ` in ${selectedCategory}` : ''}
                {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium text-[#C83219] hover:bg-[#FDECE8]/60 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>All transactions</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {monthExpenses.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm font-medium text-[#1F1A17]">
                No matching expenses found.
              </p>
              <p className="text-xs text-[#5C534A] mt-1">
                Try clearing your search or category filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearSearch();
                  setSelectedCategory(null);
                }}
                className="mt-3 min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm font-medium text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#F0E8DC]">
              {monthExpenses.slice(0, 12).map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onSelectExpense(exp)}
                  className="w-full min-h-[58px] py-3 px-2 -mx-2 rounded-xl hover:bg-[#FAF6F0] transition-colors flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon category={exp.category} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#1F1A17] truncate">
                          {renderHighlightedText(exp.category, searchQuery)}
                        </span>
                        <span className="text-xs text-[#5C534A] whitespace-nowrap">
                          · {formatWeekdayDate(exp.date)}
                        </span>
                      </div>
                      {exp.note && (
                        <p className="text-xs text-[#5C534A] truncate mt-0.5">
                          {renderHighlightedText(exp.note, searchQuery)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-[#C83219] tabular-nums shrink-0">
                    -{formatINR(exp.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {monthExpenses.length > 12 && (
            <div className="pt-3 mt-2 border-t border-[#F0E8DC] text-center">
              <button
                type="button"
                onClick={() => onNavigate('transactions')}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#C83219] hover:underline"
              >
                Show all {monthExpenses.length} expenses in Transactions
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
