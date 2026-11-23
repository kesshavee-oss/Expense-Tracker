import React, { useMemo, useState } from 'react';
import type { Expense, Income } from '../types';
import {
  CATEGORIES,
  formatINR,
  formatMonthLabel,
  getLocalCurrentMonth,
  monthRange,
  shiftMonth,
  summarizeMonth,
} from '../utils/expenseUtils.js';

interface ReportsScreenProps {
  expenses: Expense[];
  income: Income[];
}

type RangeKey = '3m' | '6m' | 'year';

export const ReportsScreen: React.FC<ReportsScreenProps> = ({ expenses, income }) => {
  const [range, setRange] = useState<RangeKey>('3m');
  const currentMonth = getLocalCurrentMonth();
  const currentYear = currentMonth.slice(0, 4);

  const months = useMemo(() => {
    if (range === '3m') {
      return monthRange(shiftMonth(currentMonth, -2), currentMonth);
    }
    if (range === '6m') {
      return monthRange(shiftMonth(currentMonth, -5), currentMonth);
    }
    return monthRange(`${currentYear}-01`, currentMonth);
  }, [range, currentMonth, currentYear]);

  const reportData = useMemo(() => {
    const monthlyRows = months.map((m) => {
      const s = summarizeMonth(m, expenses, income);
      return {
        month: m,
        label: formatMonthLabel(m),
        shortLabel: formatMonthLabel(m).split(' ')[0],
        spentPaise: s.spentPaise,
        incomePaise: s.incomePaise,
        netPaise: s.netPaise,
        hasData: s.expenseCount > 0 || s.incomeCount > 0,
      };
    });

    const monthSet = new Set(months);
    const catTotals = new Map<string, number>();
    let totalSpentPaise = 0;
    let totalIncomePaise = 0;

    for (const exp of expenses) {
      const m = exp.date.slice(0, 7);
      if (!monthSet.has(m)) continue;
      const cat = CATEGORIES.includes(exp.category) ? exp.category : 'Other';
      catTotals.set(cat, (catTotals.get(cat) || 0) + exp.amount);
      totalSpentPaise += exp.amount;
    }

    for (const inc of income) {
      const m = inc.date.slice(0, 7);
      if (!monthSet.has(m)) continue;
      totalIncomePaise += inc.amount;
    }

    let highestCategory: { name: string; amountPaise: number } | null = null;
    for (const [name, amountPaise] of catTotals.entries()) {
      if (amountPaise > 0 && (!highestCategory || amountPaise > highestCategory.amountPaise)) {
        highestCategory = { name, amountPaise };
      }
    }

    const avgMonthlySpentPaise =
      totalSpentPaise > 0 && months.length > 0
        ? Math.round(totalSpentPaise / months.length)
        : null;

    const maxBarValue = Math.max(
      ...monthlyRows.map((r) => Math.max(r.spentPaise, r.incomePaise)),
      0
    );

    const hasAnyData = totalSpentPaise > 0 || totalIncomePaise > 0;

    return {
      monthlyRows,
      highestCategory,
      avgMonthlySpentPaise,
      totalSpentPaise,
      totalIncomePaise,
      maxBarValue,
      hasAnyData,
    };
  }, [months, expenses, income]);

  return (
    <div className="space-y-6">
      {/* Header & Range Picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-[#5C534A] mt-0.5">
            {formatMonthLabel(months[0])} – {formatMonthLabel(months[months.length - 1])}
          </p>
        </div>

        <div
          role="group"
          aria-label="Report date range"
          className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F3ECE2]"
        >
          {(
            [
              { id: '3m', label: 'Last 3 months' },
              { id: '6m', label: 'Last 6 months' },
              { id: 'year', label: 'This year' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={range === opt.id}
              onClick={() => setRange(opt.id)}
              className={`min-h-[44px] px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                range === opt.id
                  ? 'bg-[#FFFFFF] text-[#1F1A17] shadow-sm font-semibold'
                  : 'text-[#5C534A] hover:text-[#1F1A17]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <section aria-label="Range highlights" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5">
          <p className="text-xs font-medium text-[#5C534A]">Highest-spending category</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#1F1A17]">
            {reportData.highestCategory ? reportData.highestCategory.name : '-'}
          </p>
          <p className="mt-0.5 text-sm text-[#5C534A] tabular-nums">
            {reportData.highestCategory
              ? formatINR(reportData.highestCategory.amountPaise)
              : '-'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5">
          <p className="text-xs font-medium text-[#5C534A]">Average monthly spending</p>
          <p className="mt-1.5 font-display text-xl font-bold text-[#C83219] tabular-nums">
            {reportData.avgMonthlySpentPaise !== null
              ? formatINR(reportData.avgMonthlySpentPaise)
              : '-'}
          </p>
          <p className="mt-0.5 text-sm text-[#5C534A] tabular-nums">
            {reportData.hasAnyData
              ? `Across ${months.length} ${months.length === 1 ? 'month' : 'months'}`
              : '-'}
          </p>
        </div>
      </section>

      {/* CSS Bar Chart */}
      <section
        aria-label="Monthly spending and income chart"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Monthly totals
          </h2>
          <div className="flex items-center gap-4 text-xs text-[#5C534A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#C83219]" aria-hidden="true" />
              Spent
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#255B34]" aria-hidden="true" />
              Income
            </span>
          </div>
        </div>

        {!reportData.hasAnyData ? (
          <div className="py-10 text-center text-sm text-[#5C534A]">
            No transactions recorded in this range yet.
          </div>
        ) : (
          <div className="overflow-x-auto pb-1">
            <div
              className="grid gap-3 items-end min-w-[300px]"
              style={{
                gridTemplateColumns: `repeat(${reportData.monthlyRows.length}, minmax(36px, 1fr))`,
              }}
            >
              {reportData.monthlyRows.map((row) => {
                const spentPct =
                  reportData.maxBarValue > 0
                    ? Math.round((row.spentPaise / reportData.maxBarValue) * 100)
                    : 0;
                const incomePct =
                  reportData.maxBarValue > 0
                    ? Math.round((row.incomePaise / reportData.maxBarValue) * 100)
                    : 0;

                return (
                  <div key={row.month} className="flex flex-col items-center">
                    <div className="w-full h-44 flex items-end justify-center gap-1.5 border-b border-[#E6DDD0] pb-2">
                      <div
                        className="w-3.5 sm:w-4 bg-[#C83219] rounded-t-md bar-animate"
                        style={{
                          height: row.spentPaise > 0 ? `${Math.max(6, spentPct)}%` : '2px',
                          opacity: row.spentPaise > 0 ? 1 : 0.2,
                        }}
                        title={`${row.label} Spent: ${formatINR(row.spentPaise)}`}
                        role="img"
                        aria-label={`${row.label} spent ${formatINR(row.spentPaise)}`}
                      />
                      <div
                        className="w-3.5 sm:w-4 bg-[#255B34] rounded-t-md bar-animate"
                        style={{
                          height: row.incomePaise > 0 ? `${Math.max(6, incomePct)}%` : '2px',
                          opacity: row.incomePaise > 0 ? 1 : 0.2,
                        }}
                        title={`${row.label} Income: ${formatINR(row.incomePaise)}`}
                        role="img"
                        aria-label={`${row.label} income ${formatINR(row.incomePaise)}`}
                      />
                    </div>
                    <span className="mt-2 text-xs font-medium text-[#5C534A] whitespace-nowrap">
                      {row.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Monthly Table */}
      <section
        aria-label="Monthly breakdown table"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#E6DDD0]">
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Month-by-month table
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF6F0] border-b border-[#E6DDD0] text-left text-xs font-semibold text-[#5C534A]">
                <th scope="col" className="py-3 px-4 sm:px-5">
                  Month
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Spent
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Income
                </th>
                <th scope="col" className="py-3 px-4 sm:px-5 text-right">
                  Net
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E8DC]">
              {reportData.monthlyRows.map((row) => (
                <tr key={row.month} className="hover:bg-[#FAF6F0]/60 transition-colors">
                  <td className="py-3.5 px-4 sm:px-5 font-medium text-[#1F1A17] whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-[#C83219] whitespace-nowrap">
                    {row.hasData ? formatINR(row.spentPaise) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right tabular-nums text-[#255B34] whitespace-nowrap">
                    {row.hasData ? formatINR(row.incomePaise) : '-'}
                  </td>
                  <td
                    className={`py-3.5 px-4 sm:px-5 text-right font-semibold tabular-nums whitespace-nowrap ${
                      !row.hasData
                        ? 'text-[#5C534A]'
                        : row.netPaise >= 0
                        ? 'text-[#255B34]'
                        : 'text-[#C83219]'
                    }`}
                  >
                    {row.hasData
                      ? `${row.netPaise > 0 ? '+' : ''}${formatINR(row.netPaise)}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
