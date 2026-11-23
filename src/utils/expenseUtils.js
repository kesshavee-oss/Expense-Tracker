/**
 * Pure utility functions for Expense Tracker.
 * All monetary amounts are stored and calculated in integer paise (1 INR = 100 paise).
 */

export const CATEGORIES = [
  'Food',
  'Groceries',
  'Transport',
  'Travel',
  'Rent',
  'Bills',
  'Utilities',
  'Subscriptions',
  'Education',
  'Study',
  'Shopping',
  'Healthcare',
  'Health',
  'Personal Care',
  'Fitness',
  'Investments',
  'Insurance',
  'Entertainment',
  'Family',
  'Gifts',
  'Charity',
  'Pets',
  'Other',
];

export const STORAGE_KEYS = {
  expenses: 'wcic_expense_expenses',
  income: 'wcic_expense_income',
  recurring: 'wcic_expense_recurring',
  budgets: 'wcic_expense_budgets',
  settings: 'wcic_expense_settings',
};

export const BACKUP_VERSION = 1;

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Converts a rupee string or number (up to 2 decimals) into integer paise
 * using string splitting to eliminate IEEE-754 float multiplication drift.
 * Returns null if the input is invalid or negative.
 */
export function toPaise(input) {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null;
  }

  const raw = String(input).trim().replace(/[₹,\s]/g, '');
  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
    return null;
  }

  const parts = raw.split('.');
  const wholePart = parts[0];
  const fracPart = parts[1] || '';

  if (fracPart.length > 2) {
    return null;
  }

  const rupees = parseInt(wholePart, 10);
  const paise = parseInt(fracPart.padEnd(2, '0'), 10);

  if (!Number.isSafeInteger(rupees) || !Number.isSafeInteger(paise)) {
    return null;
  }

  return rupees * 100 + paise;
}

/**
 * Formats integer paise using en-IN INR currency format.
 * Guards against null, undefined, and NaN.
 */
export function formatINR(paise) {
  const safePaise =
    typeof paise === 'number' && Number.isFinite(paise) ? Math.round(paise) : 0;
  return inrFormatter.format(safePaise / 100);
}

/**
 * Converts integer paise to a plain decimal string for form inputs (e.g. 49999 -> "499.99", 45000 -> "450").
 */
export function paiseToInputString(paise) {
  if (typeof paise !== 'number' || !Number.isFinite(paise) || paise <= 0) {
    return '';
  }
  const whole = Math.floor(paise / 100);
  const rem = paise % 100;
  if (rem === 0) return String(whole);
  if (rem % 10 === 0) return `${whole}.${Math.floor(rem / 10)}`;
  return `${whole}.${String(rem).padStart(2, '0')}`;
}

/**
 * Returns the device's local date as YYYY-MM-DD.
 */
export function getLocalTodayISO(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the device's local month as YYYY-MM.
 */
export function getLocalCurrentMonth(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Formats YYYY-MM-DD into "17 Nov 2026".
 */
export function formatDisplayDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return '-';
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthName = MONTH_NAMES_SHORT[m - 1];
  if (!monthName || !d || !y) return '-';
  return `${d} ${monthName} ${y}`;
}

/**
 * Formats YYYY-MM-DD into "Tue, 17 Nov" (or "Tue, 17 Nov 2026" when includeYear is true).
 */
export function formatWeekdayDate(dateStr, includeYear = false) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return '-';
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '-';
  const weekday = WEEKDAYS_SHORT[dt.getDay()];
  const monthName = MONTH_NAMES_SHORT[m - 1];
  if (!monthName) return '-';
  return includeYear
    ? `${weekday}, ${d} ${monthName} ${y}`
    : `${weekday}, ${d} ${monthName}`;
}

/**
 * Formats YYYY-MM into "Nov 2026".
 */
export function formatMonthLabel(monthStr) {
  if (typeof monthStr !== 'string' || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return '-';
  }
  const [y, m] = monthStr.split('-').map(Number);
  const monthName = MONTH_NAMES_SHORT[m - 1];
  if (!monthName || !y) return '-';
  return `${monthName} ${y}`;
}

/**
 * Shifts a YYYY-MM month string by delta months.
 */
export function shiftMonth(monthStr, delta) {
  if (typeof monthStr !== 'string' || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return getLocalCurrentMonth();
  }
  const [y, m] = monthStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Returns an inclusive chronological array of YYYY-MM strings from startMonth to endMonth.
 */
export function monthRange(startMonth, endMonth) {
  if (
    typeof startMonth !== 'string' ||
    typeof endMonth !== 'string' ||
    !/^\d{4}-\d{2}$/.test(startMonth) ||
    !/^\d{4}-\d{2}$/.test(endMonth)
  ) {
    return [];
  }
  if (startMonth > endMonth) return [];

  const result = [];
  let cursor = startMonth;
  let guard = 0;
  while (cursor <= endMonth && guard < 1200) {
    result.push(cursor);
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  return result;
}

/**
 * Returns the last day of a given YYYY-MM month (28, 29, 30, or 31).
 */
export function daysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Summarizes spending, income, and net (income minus expenses) for a YYYY-MM month.
 */
export function summarizeMonth(month, expenses = [], income = []) {
  let spentPaise = 0;
  let expenseCount = 0;
  for (const exp of expenses) {
    if (exp && typeof exp.date === 'string' && exp.date.startsWith(month)) {
      const amt = Number.isFinite(exp.amount) ? Math.round(exp.amount) : 0;
      spentPaise += amt;
      expenseCount += 1;
    }
  }

  let incomePaise = 0;
  let incomeCount = 0;
  for (const inc of income) {
    if (inc && typeof inc.date === 'string' && inc.date.startsWith(month)) {
      const amt = Number.isFinite(inc.amount) ? Math.round(inc.amount) : 0;
      incomePaise += amt;
      incomeCount += 1;
    }
  }

  return {
    month,
    spentPaise,
    incomePaise,
    netPaise: incomePaise - spentPaise,
    expenseCount,
    incomeCount,
  };
}

/**
 * Computes per-category spending breakdown for a given YYYY-MM month.
 */
export function categoryBreakdown(month, expenses = []) {
  const totals = new Map();
  const counts = new Map();
  for (const cat of CATEGORIES) {
    totals.set(cat, 0);
    counts.set(cat, 0);
  }

  let totalSpentPaise = 0;
  for (const exp of expenses) {
    if (exp && typeof exp.date === 'string' && exp.date.startsWith(month)) {
      const cat = CATEGORIES.includes(exp.category) ? exp.category : 'Other';
      const amt = Number.isFinite(exp.amount) ? Math.round(exp.amount) : 0;
      totals.set(cat, (totals.get(cat) || 0) + amt);
      counts.set(cat, (counts.get(cat) || 0) + 1);
      totalSpentPaise += amt;
    }
  }

  const rows = CATEGORIES.map((category, index) => {
    const amountPaise = totals.get(category) || 0;
    const sharePct =
      totalSpentPaise > 0 ? Math.round((amountPaise / totalSpentPaise) * 1000) / 10 : 0;
    return {
      category,
      amountPaise,
      sharePct,
      count: counts.get(category) || 0,
      orderIndex: index,
    };
  });

  rows.sort((a, b) => {
    if (b.amountPaise !== a.amountPaise) return b.amountPaise - a.amountPaise;
    return a.orderIndex - b.orderIndex;
  });

  return rows.map(({ category, amountPaise, sharePct, count }) => ({
    category,
    amountPaise,
    sharePct,
    count,
  }));
}

/**
 * Returns the effective budget for a YYYY-MM month.
 * If the month has no explicit entry, inherits from the most recent earlier budget.
 */
export function budgetForMonth(budgets = [], month) {
  if (!Array.isArray(budgets) || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const exact = budgets.find((b) => b && b.month === month);
  if (exact) {
    return {
      month,
      limitPaise: Number.isFinite(exact.limitPaise) ? Math.round(exact.limitPaise) : 0,
      perCategory: exact.perCategory ? { ...exact.perCategory } : {},
      inheritedFrom: null,
    };
  }

  const earlier = budgets
    .filter((b) => b && typeof b.month === 'string' && /^\d{4}-\d{2}$/.test(b.month) && b.month < month)
    .sort((a, b) => (a.month > b.month ? -1 : a.month < b.month ? 1 : 0));

  if (earlier.length === 0) return null;

  const latest = earlier[0];
  return {
    month,
    limitPaise: Number.isFinite(latest.limitPaise) ? Math.round(latest.limitPaise) : 0,
    perCategory: latest.perCategory ? { ...latest.perCategory } : {},
    inheritedFrom: latest.month,
  };
}

/**
 * Generates missing recurring expense/income instances from startMonth up to upToMonth.
 * Checks recurringId + YYYY-MM to guarantee zero duplicates.
 * Clamps dayOfMonth to the last day of each month (e.g. 31 -> Feb 28/29).
 * Skips paused recurring entries.
 */
export function generateRecurringInstances(
  recurringList = [],
  existingExpenses = [],
  existingIncome = [],
  upToMonth = getLocalCurrentMonth(),
  idFactory = () => `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
) {
  const newExpenses = [];
  const newIncome = [];

  const expenseKeys = new Set();
  for (const exp of existingExpenses) {
    if (exp && exp.recurringId && typeof exp.date === 'string') {
      expenseKeys.add(`${exp.recurringId}::${exp.date.slice(0, 7)}`);
    }
  }

  const incomeKeys = new Set();
  for (const inc of existingIncome) {
    if (inc && inc.recurringId && typeof inc.date === 'string') {
      incomeKeys.add(`${inc.recurringId}::${inc.date.slice(0, 7)}`);
    }
  }

  for (const rec of recurringList) {
    if (!rec || rec.paused) continue;
    if (!rec.startMonth || !/^\d{4}-\d{2}$/.test(rec.startMonth)) continue;

    const endBound =
      rec.endMonth && /^\d{4}-\d{2}$/.test(rec.endMonth) && rec.endMonth < upToMonth
        ? rec.endMonth
        : upToMonth;

    if (rec.startMonth > endBound) continue;

    const months = monthRange(rec.startMonth, endBound);
    for (const m of months) {
      const key = `${rec.id}::${m}`;
      const maxDay = daysInMonth(m);
      const rawDay = Number.isFinite(rec.dayOfMonth) ? Math.round(rec.dayOfMonth) : 1;
      const clampedDay = Math.min(Math.max(1, rawDay), maxDay);
      const dateStr = `${m}-${String(clampedDay).padStart(2, '0')}`;
      const amount = Number.isFinite(rec.amount) ? Math.round(rec.amount) : 0;

      if (rec.type === 'income') {
        if (!incomeKeys.has(key)) {
          incomeKeys.add(key);
          newIncome.push({
            id: idFactory(),
            amount,
            source: String(rec.source || 'Recurring income').slice(0, 60),
            date: dateStr,
            note: String(rec.note || '').slice(0, 120),
            recurringId: rec.id,
          });
        }
      } else {
        if (!expenseKeys.has(key)) {
          expenseKeys.add(key);
          const category = CATEGORIES.includes(rec.category) ? rec.category : 'Other';
          newExpenses.push({
            id: idFactory(),
            amount,
            category,
            date: dateStr,
            note: String(rec.note || '').slice(0, 120),
            recurringId: rec.id,
          });
        }
      }
    }
  }

  return {
    expenses: [...existingExpenses, ...newExpenses],
    income: [...existingIncome, ...newIncome],
    createdCount: newExpenses.length + newIncome.length,
  };
}

/**
 * Validates an imported JSON backup object.
 * Rejects newer versions, missing required wcic_expense_ keys, or invalid structures.
 */
export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, error: 'Backup file must contain a JSON object.' };
  }

  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version)) {
    return { valid: false, error: 'Backup file is missing a valid version number.' };
  }

  if (payload.version > BACKUP_VERSION) {
    return {
      valid: false,
      error: `Backup version ${payload.version} is newer than supported version ${BACKUP_VERSION}.`,
    };
  }

  if (payload.version < 1) {
    return { valid: false, error: 'Unsupported backup version.' };
  }

  const requiredKeys = Object.values(STORAGE_KEYS);
  for (const key of requiredKeys) {
    if (!(key in payload)) {
      return { valid: false, error: `Backup is missing required key "${key}".` };
    }
  }

  const expenses = payload[STORAGE_KEYS.expenses];
  const income = payload[STORAGE_KEYS.income];
  const recurring = payload[STORAGE_KEYS.recurring];
  const budgets = payload[STORAGE_KEYS.budgets];
  const settings = payload[STORAGE_KEYS.settings];

  if (!Array.isArray(expenses)) {
    return { valid: false, error: 'Invalid expenses list in backup.' };
  }
  if (!Array.isArray(income)) {
    return { valid: false, error: 'Invalid income list in backup.' };
  }
  if (!Array.isArray(recurring)) {
    return { valid: false, error: 'Invalid recurring list in backup.' };
  }
  if (!Array.isArray(budgets)) {
    return { valid: false, error: 'Invalid budgets list in backup.' };
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { valid: false, error: 'Invalid settings object in backup.' };
  }

  for (const exp of expenses) {
    if (
      !exp ||
      typeof exp !== 'object' ||
      typeof exp.id !== 'string' ||
      typeof exp.amount !== 'number' ||
      !Number.isFinite(exp.amount) ||
      exp.amount <= 0 ||
      typeof exp.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(exp.date) ||
      typeof exp.category !== 'string'
    ) {
      return { valid: false, error: 'One or more expense records are invalid.' };
    }
  }

  for (const inc of income) {
    if (
      !inc ||
      typeof inc !== 'object' ||
      typeof inc.id !== 'string' ||
      typeof inc.amount !== 'number' ||
      !Number.isFinite(inc.amount) ||
      inc.amount <= 0 ||
      typeof inc.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(inc.date) ||
      typeof inc.source !== 'string'
    ) {
      return { valid: false, error: 'One or more income records are invalid.' };
    }
  }

  for (const rec of recurring) {
    if (
      !rec ||
      typeof rec !== 'object' ||
      typeof rec.id !== 'string' ||
      (rec.type !== 'expense' && rec.type !== 'income') ||
      typeof rec.amount !== 'number' ||
      !Number.isFinite(rec.amount) ||
      rec.amount <= 0 ||
      typeof rec.dayOfMonth !== 'number' ||
      rec.dayOfMonth < 1 ||
      rec.dayOfMonth > 31 ||
      typeof rec.startMonth !== 'string' ||
      !/^\d{4}-\d{2}$/.test(rec.startMonth)
    ) {
      return { valid: false, error: 'One or more recurring entries are invalid.' };
    }
  }

  for (const b of budgets) {
    if (
      !b ||
      typeof b !== 'object' ||
      typeof b.month !== 'string' ||
      !/^\d{4}-\d{2}$/.test(b.month) ||
      typeof b.limitPaise !== 'number' ||
      !Number.isFinite(b.limitPaise) ||
      b.limitPaise <= 0
    ) {
      return { valid: false, error: 'One or more budget records are invalid.' };
    }
  }

  return {
    valid: true,
    data: {
      [STORAGE_KEYS.expenses]: expenses,
      [STORAGE_KEYS.income]: income,
      [STORAGE_KEYS.recurring]: recurring,
      [STORAGE_KEYS.budgets]: budgets,
      [STORAGE_KEYS.settings]: settings,
    },
  };
}

/**
 * Self-tests verifying core invariants on load.
 */
export function runExpenseUtilsSelfTests() {
  // 1. 499.99 converts to 49999 paise with no float drift
  console.assert(toPaise(499.99) === 49999, 'Self-test 1a failed: 499.99 should be 49999 paise');
  console.assert(toPaise('499.99') === 49999, 'Self-test 1b failed: "499.99" should be 49999 paise');

  // 2. Budget inherits from the earlier month when current month has no entry
  const testBudgets = [
    { month: '2026-08', limitPaise: 1500000 },
    { month: '2026-10', limitPaise: 2000000 },
  ];
  const inherited = budgetForMonth(testBudgets, '2026-11');
  console.assert(
    inherited && inherited.limitPaise === 2000000 && inherited.inheritedFrom === '2026-10',
    'Self-test 2 failed: Budget should inherit from most recent earlier month (2026-10)'
  );

  // 3. Recurring on the 31st creates February's instance on the 28th
  const testRecurring = [
    {
      id: 'rec_test_31',
      type: 'expense',
      amount: 100000,
      category: 'Rent',
      dayOfMonth: 31,
      startMonth: '2026-01',
      note: 'Monthly rent',
    },
  ];
  const genFeb = generateRecurringInstances(testRecurring, [], [], '2026-02', () => 'id_' + Math.random());
  const febInstance = genFeb.expenses.find((e) => e.date.startsWith('2026-02'));
  console.assert(
    febInstance && febInstance.date === '2026-02-28',
    'Self-test 3 failed: Recurring on 31st should create Feb instance on 2026-02-28'
  );

  // 4. Recurring instances are not duplicated when generation runs twice
  const genAgain = generateRecurringInstances(
    testRecurring,
    genFeb.expenses,
    genFeb.income,
    '2026-02',
    () => 'id_' + Math.random()
  );
  console.assert(
    genAgain.expenses.length === genFeb.expenses.length && genAgain.createdCount === 0,
    'Self-test 4 failed: Running generation twice must not duplicate instances'
  );

  // 5. Summary net equals income minus expenses
  const sum = summarizeMonth(
    '2026-11',
    [
      { id: 'e1', amount: 45000, category: 'Food', date: '2026-11-05', note: '' },
      { id: 'e2', amount: 15000, category: 'Transport', date: '2026-11-06', note: '' },
    ],
    [{ id: 'i1', amount: 100000, source: 'Salary', date: '2026-11-01', note: '' }]
  );
  console.assert(
    sum.netPaise === sum.incomePaise - sum.spentPaise && sum.netPaise === 40000,
    'Self-test 5 failed: Summary net must equal income minus expenses'
  );

  // 6. Backup validation rejects a newer version and a missing key
  const validPayload = {
    version: 1,
    [STORAGE_KEYS.expenses]: [],
    [STORAGE_KEYS.income]: [],
    [STORAGE_KEYS.recurring]: [],
    [STORAGE_KEYS.budgets]: [],
    [STORAGE_KEYS.settings]: { currency: '₹', categoryOrder: CATEGORIES },
  };
  const newerVer = validateBackup({ ...validPayload, version: 2 });
  console.assert(!newerVer.valid, 'Self-test 6a failed: Backup validation must reject newer version');

  const missingKeyPayload = { ...validPayload };
  delete missingKeyPayload[STORAGE_KEYS.budgets];
  const missingKeyRes = validateBackup(missingKeyPayload);
  console.assert(!missingKeyRes.valid, 'Self-test 6b failed: Backup validation must reject missing key');
}

runExpenseUtilsSelfTests();
