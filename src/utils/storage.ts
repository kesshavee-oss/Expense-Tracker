import type {
  AppSettings,
  Expense,
  Income,
  MonthlyBudget,
  RecurringRule,
} from '../types';
import { CATEGORIES, STORAGE_KEYS, getLocalCurrentMonth } from './expenseUtils.js';
import { IMPORT_STORAGE_KEYS, type ImportProfile } from './csvImport.js';

export const SELECTED_MONTH_STORAGE_KEY = 'wcic_expense_selectedMonth';
const VALID_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthString(month: unknown): month is string {
  return typeof month === 'string' && VALID_MONTH_RE.test(month);
}

export function loadSelectedMonth(): string {
  try {
    const raw = localStorage.getItem(SELECTED_MONTH_STORAGE_KEY);
    if (isValidMonthString(raw)) {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return getLocalCurrentMonth();
}

export function saveSelectedMonth(month: string): boolean {
  if (!isValidMonthString(month)) return false;
  try {
    localStorage.setItem(SELECTED_MONTH_STORAGE_KEY, month);
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: '₹',
  categoryOrder: [...CATEGORIES],
};

export interface StoredAppState {
  expenses: Expense[];
  income: Income[];
  recurring: RecurringRule[];
  budgets: MonthlyBudget[];
  settings: AppSettings;
  hadCorruption: boolean;
}

function safeReadArray<T>(
  key: string,
  isValidItem: (item: unknown) => boolean
): { value: T[]; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return { value: [], corrupted: false };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(key, JSON.stringify([]));
      return { value: [], corrupted: true };
    }
    const validItems = parsed.filter(isValidItem) as T[];
    if (validItems.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(validItems));
      return { value: validItems, corrupted: true };
    }
    return { value: validItems, corrupted: false };
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify([]));
    } catch {
      // Ignore secondary storage errors (e.g. private browsing quota)
    }
    return { value: [], corrupted: true };
  }
}

function safeReadSettings(): { value: AppSettings; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw === null) {
      return { value: { ...DEFAULT_SETTINGS }, corrupted: false };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
      return { value: { ...DEFAULT_SETTINGS }, corrupted: true };
    }
    return {
      value: {
        currency: '₹',
        categoryOrder: [...CATEGORIES],
      },
      corrupted: false,
    };
  } catch {
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      // Ignore secondary storage errors
    }
    return { value: { ...DEFAULT_SETTINGS }, corrupted: true };
  }
}

function isValidExpense(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const e = item as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.amount === 'number' &&
    Number.isFinite(e.amount) &&
    e.amount > 0 &&
    typeof e.category === 'string' &&
    typeof e.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  );
}

function isValidIncome(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.id === 'string' &&
    typeof i.amount === 'number' &&
    Number.isFinite(i.amount) &&
    i.amount > 0 &&
    typeof i.source === 'string' &&
    typeof i.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(i.date)
  );
}

function isValidRecurring(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    (r.type === 'expense' || r.type === 'income') &&
    typeof r.amount === 'number' &&
    Number.isFinite(r.amount) &&
    r.amount > 0 &&
    typeof r.dayOfMonth === 'number' &&
    r.dayOfMonth >= 1 &&
    r.dayOfMonth <= 31 &&
    typeof r.startMonth === 'string' &&
    /^\d{4}-\d{2}$/.test(r.startMonth)
  );
}

function isValidBudget(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const b = item as Record<string, unknown>;
  return (
    typeof b.month === 'string' &&
    /^\d{4}-\d{2}$/.test(b.month) &&
    typeof b.limitPaise === 'number' &&
    Number.isFinite(b.limitPaise) &&
    b.limitPaise > 0
  );
}

function isValidImportProfile(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const p = item as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.dateColumn === 'string' &&
    typeof p.descriptionColumn === 'string' &&
    typeof p.dateFormat === 'string'
  );
}

export function loadAllFromStorage(): StoredAppState {
  const expensesRes = safeReadArray<Expense>(STORAGE_KEYS.expenses, isValidExpense);
  const incomeRes = safeReadArray<Income>(STORAGE_KEYS.income, isValidIncome);
  const recurringRes = safeReadArray<RecurringRule>(STORAGE_KEYS.recurring, isValidRecurring);
  const budgetsRes = safeReadArray<MonthlyBudget>(STORAGE_KEYS.budgets, isValidBudget);
  const settingsRes = safeReadSettings();

  return {
    expenses: expensesRes.value,
    income: incomeRes.value,
    recurring: recurringRes.value,
    budgets: budgetsRes.value,
    settings: settingsRes.value,
    hadCorruption:
      expensesRes.corrupted ||
      incomeRes.corrupted ||
      recurringRes.corrupted ||
      budgetsRes.corrupted ||
      settingsRes.corrupted,
  };
}

export function loadImportProfiles(): ImportProfile[] {
  return safeReadArray<ImportProfile>(
    IMPORT_STORAGE_KEYS.importProfiles,
    isValidImportProfile
  ).value;
}

export function loadImportKeys(): string[] {
  return safeReadArray<string>(
    IMPORT_STORAGE_KEYS.importKeys,
    (k) => typeof k === 'string' && k.length > 0
  ).value;
}

export function safeWriteStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Atomically writes expenses, income, and importKeys to localStorage.
 * If any write throws, rolls back all three keys to their previous values.
 */
export function saveImportBatch(
  nextExpenses: Expense[],
  nextIncome: Income[],
  nextImportKeys: string[]
): boolean {
  let prevExp: string | null = null;
  let prevInc: string | null = null;
  let prevKeys: string | null = null;

  try {
    prevExp = localStorage.getItem(STORAGE_KEYS.expenses);
    prevInc = localStorage.getItem(STORAGE_KEYS.income);
    prevKeys = localStorage.getItem(IMPORT_STORAGE_KEYS.importKeys);

    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(nextExpenses));
    localStorage.setItem(STORAGE_KEYS.income, JSON.stringify(nextIncome));
    localStorage.setItem(IMPORT_STORAGE_KEYS.importKeys, JSON.stringify(nextImportKeys));
    return true;
  } catch {
    try {
      if (prevExp === null) localStorage.removeItem(STORAGE_KEYS.expenses);
      else localStorage.setItem(STORAGE_KEYS.expenses, prevExp);

      if (prevInc === null) localStorage.removeItem(STORAGE_KEYS.income);
      else localStorage.setItem(STORAGE_KEYS.income, prevInc);

      if (prevKeys === null) localStorage.removeItem(IMPORT_STORAGE_KEYS.importKeys);
      else localStorage.setItem(IMPORT_STORAGE_KEYS.importKeys, prevKeys);
    } catch {
      // Best-effort rollback
    }
    return false;
  }
}

export function clearAllExpenseStorage(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEYS.expenses);
    localStorage.removeItem(STORAGE_KEYS.income);
    localStorage.removeItem(STORAGE_KEYS.recurring);
    localStorage.removeItem(STORAGE_KEYS.budgets);
    localStorage.removeItem(STORAGE_KEYS.settings);
    localStorage.removeItem(IMPORT_STORAGE_KEYS.importProfiles);
    localStorage.removeItem(IMPORT_STORAGE_KEYS.importKeys);
    localStorage.removeItem(SELECTED_MONTH_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
