import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import type { Category, Expense, Income, TransactionItem } from '../types';
import {
  CATEGORIES,
  formatINR,
  formatWeekdayDate,
} from '../utils/expenseUtils.js';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { CategoryIcon } from './CategoryIcon';

const SEARCH_DEBOUNCE_MS = 250;

interface TransactionsScreenProps {
  expenses: Expense[];
  income: Income[];
  onSelectTransaction: (tx: TransactionItem) => void;
  onOpenAdd: () => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  expenses,
  income,
  onSelectTransaction,
  onOpenAdd,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const allItems = useMemo<TransactionItem[]>(() => {
    const expItems: TransactionItem[] = expenses.map((e) => ({
      ...e,
      txType: 'expense',
    }));
    const incItems: TransactionItem[] = income.map((i) => ({
      ...i,
      txType: 'income',
    }));
    return [...expItems, ...incItems].sort((a, b) => {
      if (b.date !== a.date) return b.date > a.date ? 1 : -1;
      return b.id > a.id ? 1 : -1;
    });
  }, [expenses, income]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allItems.filter((item) => {
      if (typeFilter === 'expense' && item.txType !== 'expense') return false;
      if (typeFilter === 'income' && item.txType !== 'income') return false;

      if (categoryFilter !== 'all') {
        if (item.txType !== 'expense' || item.category !== categoryFilter) {
          return false;
        }
      }

      if (q) {
        const noteMatch = (item.note || '').toLowerCase().includes(q);
        const labelMatch =
          item.txType === 'expense'
            ? item.category.toLowerCase().includes(q)
            : item.source.toLowerCase().includes(q);
        if (!noteMatch && !labelMatch) return false;
      }

      return true;
    });
  }, [allItems, typeFilter, categoryFilter, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: TransactionItem[] }> = [];
    for (const item of filteredItems) {
      const last = groups[groups.length - 1];
      if (last && last.date === item.date) {
        last.items.push(item);
      } else {
        groups.push({ date: item.date, items: [item] });
      }
    }
    return groups;
  }, [filteredItems]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight">
            Transactions
          </h1>
          <p className="text-sm text-[#5C534A] mt-0.5">
            {filteredItems.length} {filteredItems.length === 1 ? 'entry' : 'entries'} shown
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <section
        aria-label="Filter transactions"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Segmented filter */}
          <div
            role="group"
            aria-label="Filter by transaction type"
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F3ECE2] shrink-0"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'expense', label: 'Expenses' },
                { id: 'income', label: 'Income' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={typeFilter === opt.id}
                onClick={() => {
                  setTypeFilter(opt.id);
                  if (opt.id === 'income') {
                    setCategoryFilter('all');
                  }
                }}
                className={`min-h-[44px] px-3 sm:px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  typeFilter === opt.id
                    ? 'bg-[#FFFFFF] text-[#1F1A17] shadow-sm font-semibold'
                    : 'text-[#5C534A] hover:text-[#1F1A17]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative flex-1 min-w-0">
            <label htmlFor="tx-search" className="sr-only">
              Search transactions by note or category
            </label>
            <Search
              className="w-4 h-4 text-[#5C534A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              id="tx-search"
              type="search"
              defaultValue={searchQuery}
              placeholder="Search note, category, or source..."
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
        </div>

        {/* Category Filter Row */}
        {typeFilter !== 'income' && (
          <div
            role="group"
            aria-label="Filter by expense category"
            className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1"
          >
            <button
              type="button"
              aria-pressed={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === 'all'
                  ? 'bg-[#1F1A17] text-[#FFFFFF] border-[#1F1A17]'
                  : 'bg-[#FAF6F0] text-[#5C534A] border-[#E6DDD0] hover:text-[#1F1A17]'
              }`}
            >
              All categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={categoryFilter === cat}
                onClick={() => setCategoryFilter((prev) => (prev === cat ? 'all' : cat))}
                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-[#C83219] text-[#FFFFFF] border-[#C83219]'
                    : 'bg-[#FAF6F0] text-[#5C534A] border-[#E6DDD0] hover:text-[#1F1A17]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Grouped List */}
      {groupedByDate.length === 0 ? (
        <section className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-8 text-center">
          {allItems.length === 0 ? (
            <>
              <p className="text-base font-medium text-[#1F1A17]">
                No transactions recorded yet.
              </p>
              <p className="text-sm text-[#5C534A] mt-1">
                Tap the + button to log your first expense or income.
              </p>
              <button
                type="button"
                onClick={onOpenAdd}
                className="mt-5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Add transaction</span>
              </button>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-[#1F1A17]">
                No matching transactions found.
              </p>
              <p className="text-sm text-[#5C534A] mt-1">
                Try clearing your search or switching filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setCategoryFilter('all');
                  clearSearch();
                }}
                className="mt-4 min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm font-medium text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
              >
                Reset filters
              </button>
            </>
          )}
        </section>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map((group) => (
            <section
              key={group.date}
              aria-label={formatWeekdayDate(group.date, true)}
              className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl overflow-hidden"
            >
              <header className="px-4 sm:px-5 py-2.5 bg-[#FAF6F0] border-b border-[#E6DDD0] flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#5C534A]">
                  {formatWeekdayDate(group.date, true)}
                </h2>
                <span className="text-xs text-[#5C534A] tabular-nums">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </span>
              </header>

              <div className="divide-y divide-[#F0E8DC]">
                {group.items.map((item) => {
                  const isExpense = item.txType === 'expense';
                  const title = isExpense ? item.category : item.source;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTransaction(item)}
                      className="w-full min-h-[64px] px-4 sm:px-5 py-3 hover:bg-[#FAF6F0]/70 transition-colors flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon
                          category={isExpense ? item.category : undefined}
                          isIncome={!isExpense}
                          label={title}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-[#1F1A17] truncate">
                              {title}
                            </span>
                            {item.recurringId && (
                              <span className="text-xs text-[#5C534A]">· Recurring</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#5C534A] mt-0.5 min-w-0">
                            <span className="whitespace-nowrap shrink-0">
                              {formatWeekdayDate(item.date)}
                            </span>
                            {item.note && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{item.note}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-sm font-semibold tabular-nums shrink-0 ${
                          isExpense ? 'text-[#C83219]' : 'text-[#255B34]'
                        }`}
                      >
                        {isExpense ? '-' : '+'}
                        {formatINR(item.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
