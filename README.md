# Expense Tracker

A fast, private, on-device personal expense and income ledger built with React, TypeScript, Vite, and Tailwind CSS.

**Your data stays on this device.** There are no accounts, no cloud sync, no servers, and no tracking.

## What the app does

- **Monthly overview (Home):** Track total spent, total income, net (income minus spent), budget progress (`Left in budget`), category breakdown, a 7-day spending bar chart, and live search with match highlighting.
- **Transactions:** Search by note, category, or source, filter by Expenses/Income/Category, view date-grouped entries, and edit or delete any transaction.
- **Monthly budgets:** Set an overall monthly spending limit and optional per-category limits (`Food`, `Rent`, etc.) with clear text and progress bars. Months without an explicit budget inherit the most recent earlier budget, or can be copied to the next month.
- **Recurring entries:** Create monthly repeating expenses or income (e.g., rent on day 31 clamps cleanly to Feb 28/29) with single-instance vs. future edits and pause/resume/delete controls in Settings.
- **Reports:** Compare spent, income, net, highest-spending category, and average monthly spending across the last 3 months, last 6 months, or the current year.
- **Bank statement CSV import:** Parse local `.csv` bank statements in the browser, save reusable column-mapping profiles, preview & recategorize rows before saving, reject bad dates/amounts at row level, and skip previously imported duplicates.
- **Keyboard shortcuts:** `n` to add a transaction, `Esc` to close dialogs, and `h` / `t` / `b` / `r` / `s` to switch tabs.

## How to run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (default `http://localhost:3000`).

To create a production static build in `dist/`:

```bash
npm run build
npm run preview
```

## Where data is stored

All records are saved locally in your browser's `localStorage` under keys prefixed with `wcic_`:

- `wcic_expense_expenses` — recorded expenses (stored in integer paise)
- `wcic_expense_income` — recorded income entries (stored in integer paise)
- `wcic_expense_recurring` — monthly recurring rules
- `wcic_expense_budgets` — monthly and per-category budget limits
- `wcic_expense_settings` — app settings (currency and category order)
- `wcic_expense_importProfiles` — saved bank CSV column mappings
- `wcic_expense_importKeys` — hashes of already-imported CSV rows for duplicate detection

## How to back up and restore

1. Go to **Settings -> Backup file**.
2. Click **Export backup (JSON)** to download a versioned `.json` snapshot containing your transactions, recurring rules, budgets, settings, and CSV import profiles/keys.
3. To restore on the same or another browser, click **Import backup** and select your `.json` file.

## How to add a category

1. Add the category name string to `CATEGORIES` in `src/utils/expenseUtils.js` and the `Category` union in `src/types.ts`.
2. Add its icon, badge background/foreground colors, and progress bar color to `CATEGORY_META` in `src/components/CategoryIcon.tsx`.
3. Optionally add merchant keywords for auto-categorization during CSV import to `KEYWORD_CATEGORY_RULES` in `src/utils/csvImport.js`.
