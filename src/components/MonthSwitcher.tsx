import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  formatMonthLabel,
  getLocalCurrentMonth,
  shiftMonth,
} from '../utils/expenseUtils.js';

interface MonthSwitcherProps {
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const MonthSwitcher: React.FC<MonthSwitcherProps> = ({
  selectedMonth,
  onChangeMonth,
}) => {
  const currentMonth = getLocalCurrentMonth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => {
    const y = Number(selectedMonth.slice(0, 4));
    return Number.isFinite(y) && y > 1900 ? y : new Date().getFullYear();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const y = Number(selectedMonth.slice(0, 4));
    if (Number.isFinite(y) && y > 1900) {
      setPickerYear(y);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [pickerOpen]);

  const selectMonthAndClose = (month: string) => {
    onChangeMonth(month);
    setPickerOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
        aria-label="Previous month"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
      >
        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => setPickerOpen((prev) => !prev)}
        aria-expanded={pickerOpen}
        aria-haspopup="dialog"
        aria-label={`Select month, currently ${formatMonthLabel(selectedMonth)}`}
        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm font-medium text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
      >
        <Calendar className="w-4 h-4 text-[#C83219] shrink-0" aria-hidden="true" />
        <span>{formatMonthLabel(selectedMonth)}</span>
        <ChevronDown
          className={`w-4 h-4 text-[#5C534A] transition-transform shrink-0 ${
            pickerOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
        aria-label="Next month"
        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
      >
        <ChevronRight className="w-5 h-5" aria-hidden="true" />
      </button>

      {selectedMonth !== currentMonth && (
        <button
          type="button"
          onClick={() => selectMonthAndClose(currentMonth)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-xs font-semibold text-[#C83219] hover:bg-[#FDECE8] transition-colors whitespace-nowrap shrink-0"
        >
          This month
        </button>
      )}

      {pickerOpen && (
        <div
          role="dialog"
          aria-label="Choose month and year"
          className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 z-40 w-[284px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#E6DDD0] bg-[#FFFFFF] p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#F0E8DC]">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              aria-label="Previous year"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            <span className="font-display text-base font-bold text-[#1F1A17] tabular-nums">
              {pickerYear}
            </span>

            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              aria-label="Next year"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3">
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const monthValue = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
              const isSelected = monthValue === selectedMonth;
              const isCurrent = monthValue === currentMonth;

              return (
                <button
                  key={monthValue}
                  type="button"
                  onClick={() => selectMonthAndClose(monthValue)}
                  aria-pressed={isSelected}
                  className={`min-h-[44px] px-2 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[#C83219] text-white font-semibold'
                      : isCurrent
                      ? 'bg-[#FDECE8] text-[#A82813] border border-[#E7B5AC] font-semibold hover:bg-[#FADAD3]'
                      : 'bg-[#FAF6F0] text-[#1F1A17] hover:bg-[#F3ECE2]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>

          <div className="pt-3 mt-3 border-t border-[#F0E8DC] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => selectMonthAndClose(currentMonth)}
              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold text-[#C83219] hover:bg-[#FDECE8] transition-colors"
            >
              Jump to this month
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-medium text-[#5C534A] hover:bg-[#FAF6F0] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
