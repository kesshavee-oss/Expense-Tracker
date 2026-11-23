export type Category =
  | 'Food'
  | 'Groceries'
  | 'Transport'
  | 'Travel'
  | 'Rent'
  | 'Bills'
  | 'Utilities'
  | 'Subscriptions'
  | 'Education'
  | 'Study'
  | 'Shopping'
  | 'Healthcare'
  | 'Health'
  | 'Personal Care'
  | 'Fitness'
  | 'Investments'
  | 'Insurance'
  | 'Entertainment'
  | 'Family'
  | 'Gifts'
  | 'Charity'
  | 'Pets'
  | 'Other';

export interface Expense {
  id: string;
  amount: number; // integer paise
  category: Category;
  date: string; // YYYY-MM-DD
  note: string;
  recurringId?: string;
  importKey?: string;
}

export interface Income {
  id: string;
  amount: number; // integer paise
  source: string;
  date: string; // YYYY-MM-DD
  note: string;
  recurringId?: string;
  importKey?: string;
}

export interface RecurringRule {
  id: string;
  type: 'expense' | 'income';
  amount: number; // integer paise
  category?: Category;
  source?: string;
  dayOfMonth: number; // 1-28 (clamped up to 31 in generation)
  startMonth: string; // YYYY-MM
  endMonth?: string; // YYYY-MM
  note: string;
  paused?: boolean;
}

export interface MonthlyBudget {
  month: string; // YYYY-MM
  limitPaise: number;
  perCategory?: Partial<Record<Category, number>>;
}

export interface EffectiveBudget extends MonthlyBudget {
  inheritedFrom: string | null;
}

export interface AppSettings {
  currency: '₹';
  categoryOrder: Category[];
}

export type ScreenId = 'home' | 'transactions' | 'budget' | 'reports' | 'settings';

export type TransactionItem =
  | (Expense & { txType: 'expense' })
  | (Income & { txType: 'income' });
