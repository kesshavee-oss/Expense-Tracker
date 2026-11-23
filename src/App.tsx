import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Home,
  ListOrdered,
  PiggyBank,
  BarChart3,
  Settings,
  Plus,
} from 'lucide-react';
import type {
  AppSettings,
  Expense,
  Income,
  MonthlyBudget,
  RecurringRule,
  ScreenId,
  TransactionItem,
} from './types';
import {
  CATEGORIES,
  STORAGE_KEYS,
  formatINR,
  formatMonthLabel,
  generateRecurringInstances,
  getLocalCurrentMonth,
} from './utils/expenseUtils.js';
import {
  IMPORT_STORAGE_KEYS,
  type ImportProfile,
  type PlannedImportItem,
} from './utils/csvImport.js';
import {
  DEFAULT_SETTINGS,
  clearAllExpenseStorage,
  isValidMonthString,
  loadAllFromStorage,
  loadImportKeys,
  loadImportProfiles,
  loadSelectedMonth,
  safeWriteStorage,
  saveImportBatch,
  saveSelectedMonth,
} from './utils/storage';
import { HomeScreen } from './components/HomeScreen';
import { AddScreen, type AddTransactionPayload } from './components/AddScreen';
import { TransactionsScreen } from './components/TransactionsScreen';
import { BudgetScreen } from './components/BudgetScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import {
  EditTransactionDialog,
  type EditSavePayload,
} from './components/EditTransactionDialog';
import { ToastBanner, type ToastMessage } from './components/ToastBanner';

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const NAV_ITEMS: Array<{
  id: ScreenId;
  label: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'transactions', label: 'Transactions', Icon: ListOrdered },
  { id: 'budget', label: 'Budget', Icon: PiggyBank },
  { id: 'reports', label: 'Reports', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('home');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => loadSelectedMonth());

  const handleChangeMonth = useCallback((nextMonth: string) => {
    if (!isValidMonthString(nextMonth)) return;
    setSelectedMonth(nextMonth);
    saveSelectedMonth(nextMonth);
  }, []);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [recurring, setRecurring] = useState<RecurringRule[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [importProfiles, setImportProfiles] = useState<ImportProfile[]>([]);
  const [importKeys, setImportKeys] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback(
    (text: string, tone: 'success' | 'error' | 'info' = 'info') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      const id = makeId('toast');
      setToast({ id, text, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4200);
    },
    []
  );

  // Initial load from localStorage + generate missing recurring instances up to current month
  useEffect(() => {
    const loaded = loadAllFromStorage();
    const currentMonth = getLocalCurrentMonth();

    const gen = generateRecurringInstances(
      loaded.recurring,
      loaded.expenses,
      loaded.income,
      currentMonth,
      () => makeId('rec_tx')
    );

    setExpenses(gen.expenses);
    setIncome(gen.income);
    setRecurring(loaded.recurring);
    setBudgets(loaded.budgets);
    setSettings(loaded.settings);
    setImportProfiles(loadImportProfiles());
    setImportKeys(loadImportKeys());

    if (gen.createdCount > 0) {
      safeWriteStorage(STORAGE_KEYS.expenses, gen.expenses);
      safeWriteStorage(STORAGE_KEYS.income, gen.income);
    }

    if (loaded.hadCorruption) {
      showToast('Some saved data was reset.', 'error');
    }

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [showToast]);

  // Global keyboard shortcuts: 'n' (Add), 'Esc' (close active dialog), 'h'/'t'/'b'/'r'/'s' (tabs)
  useEffect(() => {
    const TAB_SHORTCUTS: Record<string, ScreenId> = {
      h: 'home',
      t: 'transactions',
      b: 'budget',
      r: 'reports',
      s: 'settings',
    };

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!event.defaultPrevented) {
          if (editingTx !== null) {
            event.preventDefault();
            setEditingTx(null);
          } else if (addOpen) {
            event.preventDefault();
            setAddOpen(false);
          }
        }
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Do not trigger tab or 'n' shortcuts while a modal dialog is open
      if (addOpen || editingTx !== null || document.querySelector('[role="dialog"]')) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'n') {
        event.preventDefault();
        setAddOpen(true);
        return;
      }

      const nextTab = TAB_SHORTCUTS[key];
      if (nextTab) {
        event.preventDefault();
        setScreen(nextTab);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [addOpen, editingTx]);

  const persistExpenses = (next: Expense[]) => {
    setExpenses(next);
    safeWriteStorage(STORAGE_KEYS.expenses, next);
  };

  const persistIncome = (next: Income[]) => {
    setIncome(next);
    safeWriteStorage(STORAGE_KEYS.income, next);
  };

  const persistRecurring = (next: RecurringRule[]) => {
    setRecurring(next);
    safeWriteStorage(STORAGE_KEYS.recurring, next);
  };

  const persistBudgets = (next: MonthlyBudget[]) => {
    setBudgets(next);
    safeWriteStorage(STORAGE_KEYS.budgets, next);
  };

  const handleAddSave = (payload: AddTransactionPayload) => {
    const startMonth = payload.date.slice(0, 7);
    const currentMonth = getLocalCurrentMonth();

    let recId: string | undefined;
    let nextRecurring = recurring;

    if (payload.repeatMonthly) {
      recId = makeId('rec');
      const newRule: RecurringRule = {
        id: recId,
        type: payload.type,
        amount: payload.amountPaise,
        ...(payload.type === 'expense'
          ? { category: payload.category }
          : { source: payload.source }),
        dayOfMonth: payload.dayOfMonth,
        startMonth,
        ...(payload.endMonth ? { endMonth: payload.endMonth } : {}),
        note: payload.note,
        paused: false,
      };
      nextRecurring = [...recurring, newRule];
      persistRecurring(nextRecurring);
    }

    let nextExpenses = expenses;
    let nextIncome = income;

    if (payload.type === 'expense') {
      const newExpense: Expense = {
        id: makeId('exp'),
        amount: payload.amountPaise,
        category: payload.category,
        date: payload.date,
        note: payload.note,
        ...(recId ? { recurringId: recId } : {}),
      };
      nextExpenses = [...expenses, newExpense];
    } else {
      const newIncome: Income = {
        id: makeId('inc'),
        amount: payload.amountPaise,
        source: payload.source,
        date: payload.date,
        note: payload.note,
        ...(recId ? { recurringId: recId } : {}),
      };
      nextIncome = [...income, newIncome];
    }

    if (payload.repeatMonthly && startMonth < currentMonth) {
      const gen = generateRecurringInstances(
        nextRecurring,
        nextExpenses,
        nextIncome,
        currentMonth,
        () => makeId('rec_tx')
      );
      nextExpenses = gen.expenses;
      nextIncome = gen.income;
    }

    persistExpenses(nextExpenses);
    persistIncome(nextIncome);

    const targetLabel = payload.type === 'expense' ? payload.category : payload.source;
    showToast(`Added ${formatINR(payload.amountPaise)} to ${targetLabel}.`, 'success');
    setAddOpen(false);
  };

  const handleEditSave = (payload: EditSavePayload) => {
    if (!editingTx) return;
    const originalDate = editingTx.date;
    const recId = editingTx.recurringId;

    if (payload.txType === 'expense') {
      const updatedExpenses = expenses.map((exp) => {
        if (exp.id === payload.id) {
          return {
            ...exp,
            amount: payload.amountPaise,
            category: payload.category,
            date: payload.date,
            note: payload.note,
          };
        }
        if (
          payload.scope === 'future' &&
          recId &&
          exp.recurringId === recId &&
          exp.date > originalDate
        ) {
          return {
            ...exp,
            amount: payload.amountPaise,
            category: payload.category,
            note: payload.note,
          };
        }
        return exp;
      });
      persistExpenses(updatedExpenses);
    } else {
      const updatedIncome = income.map((inc) => {
        if (inc.id === payload.id) {
          return {
            ...inc,
            amount: payload.amountPaise,
            source: payload.source,
            date: payload.date,
            note: payload.note,
          };
        }
        if (
          payload.scope === 'future' &&
          recId &&
          inc.recurringId === recId &&
          inc.date > originalDate
        ) {
          return {
            ...inc,
            amount: payload.amountPaise,
            source: payload.source,
            note: payload.note,
          };
        }
        return inc;
      });
      persistIncome(updatedIncome);
    }

    if (payload.scope === 'future' && recId) {
      const updatedRules = recurring.map((rule) => {
        if (rule.id !== recId) return rule;
        return {
          ...rule,
          amount: payload.amountPaise,
          ...(payload.txType === 'expense'
            ? { category: payload.category }
            : { source: payload.source }),
          note: payload.note,
        };
      });
      persistRecurring(updatedRules);
      showToast('Updated this and future recurring entries.', 'success');
    } else {
      showToast('Transaction updated.', 'success');
    }

    setEditingTx(null);
  };

  const handleDeleteTransaction = (tx: TransactionItem) => {
    if (tx.txType === 'expense') {
      persistExpenses(expenses.filter((e) => e.id !== tx.id));
    } else {
      persistIncome(income.filter((i) => i.id !== tx.id));
    }
    setEditingTx(null);
    showToast('Transaction deleted.', 'info');
  };

  const handleSaveBudget = (budget: MonthlyBudget) => {
    const existingIdx = budgets.findIndex((b) => b.month === budget.month);
    const next =
      existingIdx >= 0
        ? budgets.map((b, i) => (i === existingIdx ? budget : b))
        : [...budgets, budget];
    persistBudgets(next);
    showToast(`Saved budget for ${formatMonthLabel(budget.month)}.`, 'success');
  };

  const handleCopyBudgetToNextMonth = (
    _sourceMonth: string,
    targetMonth: string,
    budgetForTarget: MonthlyBudget
  ) => {
    const withoutTarget = budgets.filter((b) => b.month !== targetMonth);
    persistBudgets([...withoutTarget, budgetForTarget]);
    showToast(`Copied budget to ${formatMonthLabel(targetMonth)}.`, 'success');
  };

  const handleTogglePauseRecurring = (id: string) => {
    const target = recurring.find((r) => r.id === id);
    const next = recurring.map((r) =>
      r.id === id ? { ...r, paused: !r.paused } : r
    );
    persistRecurring(next);
    if (target) {
      showToast(
        target.paused ? 'Recurring rule resumed.' : 'Recurring rule paused.',
        'info'
      );
    }
  };

  const handleDeleteRecurring = (id: string) => {
    persistRecurring(recurring.filter((r) => r.id !== id));
    showToast('Recurring rule deleted.', 'info');
  };

  const handleImportBackup = (data: {
    expenses: Expense[];
    income: Income[];
    recurring: RecurringRule[];
    budgets: MonthlyBudget[];
    settings: AppSettings;
    importProfiles?: ImportProfile[];
    importKeys?: string[];
  }) => {
    const currentMonth = getLocalCurrentMonth();
    const gen = generateRecurringInstances(
      data.recurring,
      data.expenses,
      data.income,
      currentMonth,
      () => makeId('rec_tx')
    );

    const restoredSettings: AppSettings = {
      currency: '₹',
      categoryOrder: data.settings.categoryOrder || DEFAULT_SETTINGS.categoryOrder,
    };

    const derivedKeys = [
      ...gen.expenses.map((e) => e.importKey).filter((k): k is string => Boolean(k)),
      ...gen.income.map((i) => i.importKey).filter((k): k is string => Boolean(k)),
    ];
    const nextImportKeys = Array.from(
      new Set([...(data.importKeys || []), ...derivedKeys])
    );
    const nextImportProfiles = Array.isArray(data.importProfiles)
      ? data.importProfiles
      : importProfiles;

    setExpenses(gen.expenses);
    setIncome(gen.income);
    setRecurring(data.recurring);
    setBudgets(data.budgets);
    setSettings(restoredSettings);
    setImportKeys(nextImportKeys);
    if (Array.isArray(data.importProfiles)) {
      setImportProfiles(nextImportProfiles);
    }

    safeWriteStorage(STORAGE_KEYS.expenses, gen.expenses);
    safeWriteStorage(STORAGE_KEYS.income, gen.income);
    safeWriteStorage(STORAGE_KEYS.recurring, data.recurring);
    safeWriteStorage(STORAGE_KEYS.budgets, data.budgets);
    safeWriteStorage(STORAGE_KEYS.settings, restoredSettings);
    safeWriteStorage(IMPORT_STORAGE_KEYS.importKeys, nextImportKeys);
    if (Array.isArray(data.importProfiles)) {
      safeWriteStorage(IMPORT_STORAGE_KEYS.importProfiles, nextImportProfiles);
    }

    showToast('Backup restored.', 'success');
  };

  const handleSaveImportProfile = (profile: ImportProfile) => {
    const normalizedName = profile.name.trim().toLowerCase();
    const filtered = importProfiles.filter(
      (p) => p.name.trim().toLowerCase() !== normalizedName
    );
    const next = [...filtered, profile];
    setImportProfiles(next);
    safeWriteStorage(IMPORT_STORAGE_KEYS.importProfiles, next);
    showToast(`Saved import profile "${profile.name}".`, 'success');
  };

  const handleDeleteImportProfile = (id: string) => {
    const next = importProfiles.filter((p) => p.id !== id);
    setImportProfiles(next);
    safeWriteStorage(IMPORT_STORAGE_KEYS.importProfiles, next);
    showToast('Import profile removed.', 'info');
  };

  const handleCommitCsvImport = (items: PlannedImportItem[]): boolean => {
    if (items.length === 0) return false;

    const newExpenses: Expense[] = [];
    const newIncome: Income[] = [];
    const newKeys: string[] = [];

    for (const item of items) {
      newKeys.push(item.importKey);
      if (item.txType === 'expense') {
        const category =
          item.category && CATEGORIES.includes(item.category) ? item.category : 'Other';
        newExpenses.push({
          id: makeId('exp'),
          amount: item.amountPaise,
          category,
          date: item.date,
          note: item.description.slice(0, 120),
          importKey: item.importKey,
        });
      } else {
        newIncome.push({
          id: makeId('inc'),
          amount: item.amountPaise,
          source: item.description.slice(0, 60),
          date: item.date,
          note: item.description.length > 60 ? item.description.slice(0, 120) : '',
          importKey: item.importKey,
        });
      }
    }

    const nextExpenses = [...expenses, ...newExpenses];
    const nextIncome = [...income, ...newIncome];
    const nextKeys = Array.from(new Set([...importKeys, ...newKeys]));

    const ok = saveImportBatch(nextExpenses, nextIncome, nextKeys);
    if (!ok) {
      showToast('Import failed. Nothing was saved.', 'error');
      return false;
    }

    setExpenses(nextExpenses);
    setIncome(nextIncome);
    setImportKeys(nextKeys);
    showToast(
      `Imported ${items.length} ${items.length === 1 ? 'transaction' : 'transactions'}.`,
      'success'
    );
    return true;
  };

  const handleClearAllData = () => {
    clearAllExpenseStorage();
    setExpenses([]);
    setIncome([]);
    setRecurring([]);
    setBudgets([]);
    setSettings(DEFAULT_SETTINGS);
    setImportProfiles([]);
    setImportKeys([]);
    setSelectedMonth(getLocalCurrentMonth());
    showToast('All expense data cleared.', 'info');
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] text-[#1F1A17] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex md:flex-col md:w-64 lg:w-68 shrink-0 bg-[#FFFFFF] border-r border-[#E6DDD0] sticky top-0 h-screen p-5 justify-between"
      >
        <div className="space-y-6">
          <div>
            <span className="font-display text-xl font-bold text-[#1F1A17] tracking-tight block">
              Expense Tracker
            </span>
            <span className="text-xs text-[#5C534A] block mt-0.5">
              On-device rupee ledger
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add transaction</span>
          </button>

          <nav className="space-y-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = screen === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScreen(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#FDECE8] text-[#A82813] font-semibold'
                      : 'text-[#5C534A] hover:bg-[#FAF6F0] hover:text-[#1F1A17]'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden={true} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <p className="text-xs text-[#5C534A] px-1">
          Your data stays on this device.
        </p>
      </aside>

      {/* Mobile Header (scrolls naturally to respect <=15% fixed viewport cap) */}
      <header className="md:hidden bg-[#FFFFFF] border-b border-[#E6DDD0] px-4 py-3 flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold text-[#1F1A17] tracking-tight truncate">
          Expense Tracker
        </span>
        <span className="text-xs text-[#5C534A] whitespace-nowrap shrink-0">
          {formatMonthLabel(selectedMonth)}
        </span>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Desktop Top Action Bar */}
        <div className="hidden md:flex items-center justify-between gap-6 px-8 py-4 border-b border-[#E6DDD0] bg-[#FAF6F0]/90 backdrop-blur-sm sticky top-0 z-20">
          <div className="text-sm font-medium text-[#5C534A] whitespace-nowrap">
            {NAV_ITEMS.find((item) => item.id === screen)?.label}
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-36 md:pb-10">
          {screen === 'home' && (
            <HomeScreen
              selectedMonth={selectedMonth}
              onChangeMonth={handleChangeMonth}
              expenses={expenses}
              income={income}
              budgets={budgets}
              onOpenAdd={() => setAddOpen(true)}
              onNavigate={setScreen}
              onSelectExpense={(exp) =>
                setEditingTx({ ...exp, txType: 'expense' })
              }
            />
          )}

          {screen === 'transactions' && (
            <TransactionsScreen
              expenses={expenses}
              income={income}
              onSelectTransaction={(tx) => setEditingTx(tx)}
              onOpenAdd={() => setAddOpen(true)}
            />
          )}

          {screen === 'budget' && (
            <BudgetScreen
              selectedMonth={selectedMonth}
              onChangeMonth={handleChangeMonth}
              budgets={budgets}
              expenses={expenses}
              onSaveBudget={handleSaveBudget}
              onCopyBudgetToNextMonth={handleCopyBudgetToNextMonth}
            />
          )}

          {screen === 'reports' && (
            <ReportsScreen expenses={expenses} income={income} />
          )}

          {screen === 'settings' && (
            <SettingsScreen
              expenses={expenses}
              income={income}
              recurring={recurring}
              budgets={budgets}
              settings={settings}
              onTogglePauseRecurring={handleTogglePauseRecurring}
              onDeleteRecurring={handleDeleteRecurring}
              onImportBackup={handleImportBackup}
              onClearAllData={handleClearAllData}
              onNotify={showToast}
              existingImportKeys={importKeys}
              importProfiles={importProfiles}
              onSaveImportProfile={handleSaveImportProfile}
              onDeleteImportProfile={handleDeleteImportProfile}
              onCommitCsvImport={handleCommitCsvImport}
            />
          )}
        </main>
      </div>

      {/* Mobile Floating + Button */}
      <button
        type="button"
        onClick={() => setAddOpen(true)}
        aria-label="Add expense or income"
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-[#C83219] hover:bg-[#A82813] active:scale-[0.97] text-white shadow-lg flex items-center justify-center transition-transform"
      >
        <Plus className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E6DDD0] grid grid-cols-5 h-16"
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setScreen(id)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                active ? 'text-[#C83219] font-semibold' : 'text-[#5C534A] hover:text-[#1F1A17]'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden={true} />
              <span className="text-[10px] leading-none truncate max-w-full">
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Add Modal / Bottom Sheet */}
      <AddScreen
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddSave}
      />

      {/* Edit Modal / Bottom Sheet */}
      <EditTransactionDialog
        transaction={editingTx}
        onClose={() => setEditingTx(null)}
        onSave={handleEditSave}
        onDelete={handleDeleteTransaction}
      />

      {/* Live Toast Announcements */}
      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
