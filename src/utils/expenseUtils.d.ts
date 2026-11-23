import type {
  AppSettings,
  Category,
  EffectiveBudget,
  Expense,
  Income,
  MonthlyBudget,
  RecurringRule,
} from '../types';

export declare const CATEGORIES: readonly Category[];

export declare const STORAGE_KEYS: {
  expenses: 'wcic_expense_expenses';
  income: 'wcic_expense_income';
  recurring: 'wcic_expense_recurring';
  budgets: 'wcic_expense_budgets';
  settings: 'wcic_expense_settings';
};

export declare const BACKUP_VERSION: number;

export declare function toPaise(input: string | number | null | undefined): number | null;
export declare function formatINR(paise: number | null | undefined): string;
export declare function paiseToInputString(paise: number | null | undefined): string;
export declare function getLocalTodayISO(now?: Date): string;
export declare function getLocalCurrentMonth(now?: Date): string;
export declare function formatDisplayDate(dateStr: string): string;
export declare function formatWeekdayDate(dateStr: string, includeYear?: boolean): string;
export declare function formatMonthLabel(monthStr: string): string;
export declare function shiftMonth(monthStr: string, delta: number): string;
export declare function monthRange(startMonth: string, endMonth: string): string[];
export declare function daysInMonth(monthStr: string): number;

export declare function summarizeMonth(
  month: string,
  expenses: Expense[],
  income: Income[]
): {
  month: string;
  spentPaise: number;
  incomePaise: number;
  netPaise: number;
  expenseCount: number;
  incomeCount: number;
};

export declare function categoryBreakdown(
  month: string,
  expenses: Expense[]
): Array<{
  category: Category;
  amountPaise: number;
  sharePct: number;
  count: number;
}>;

export declare function budgetForMonth(
  budgets: MonthlyBudget[],
  month: string
): EffectiveBudget | null;

export declare function generateRecurringInstances(
  recurringList: RecurringRule[],
  existingExpenses: Expense[],
  existingIncome: Income[],
  upToMonth?: string,
  idFactory?: () => string
): {
  expenses: Expense[];
  income: Income[];
  createdCount: number;
};

export declare function validateBackup(payload: unknown):
  | {
      valid: true;
      data: {
        wcic_expense_expenses: Expense[];
        wcic_expense_income: Income[];
        wcic_expense_recurring: RecurringRule[];
        wcic_expense_budgets: MonthlyBudget[];
        wcic_expense_settings: AppSettings;
      };
    }
  | {
      valid: false;
      error: string;
    };

export declare function runExpenseUtilsSelfTests(): void;
