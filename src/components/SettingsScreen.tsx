import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Pause,
  Play,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import type {
  AppSettings,
  Expense,
  Income,
  MonthlyBudget,
  RecurringRule,
} from '../types';
import {
  IMPORT_STORAGE_KEYS,
  type ImportProfile,
  type PlannedImportItem,
} from '../utils/csvImport.js';
import {
  BACKUP_VERSION,
  STORAGE_KEYS,
  formatINR,
  formatMonthLabel,
  getLocalTodayISO,
  validateBackup,
} from '../utils/expenseUtils.js';
import { CategoryIcon } from './CategoryIcon';
import { ConfirmDialog } from './ConfirmDialog';
import { ImportScreen } from './ImportScreen';

interface SettingsScreenProps {
  expenses: Expense[];
  income: Income[];
  recurring: RecurringRule[];
  budgets: MonthlyBudget[];
  settings: AppSettings;
  onTogglePauseRecurring: (id: string) => void;
  onDeleteRecurring: (id: string) => void;
  onImportBackup: (data: {
    expenses: Expense[];
    income: Income[];
    recurring: RecurringRule[];
    budgets: MonthlyBudget[];
    settings: AppSettings;
    importProfiles?: ImportProfile[];
    importKeys?: string[];
  }) => void;
  onClearAllData: () => void;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  existingImportKeys: string[];
  importProfiles: ImportProfile[];
  onSaveImportProfile: (profile: ImportProfile) => void;
  onDeleteImportProfile: (id: string) => void;
  onCommitCsvImport: (items: PlannedImportItem[]) => boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  expenses,
  income,
  recurring,
  budgets,
  settings,
  onTogglePauseRecurring,
  onDeleteRecurring,
  onImportBackup,
  onClearAllData,
  onNotify,
  existingImportKeys,
  importProfiles,
  onSaveImportProfile,
  onDeleteImportProfile,
  onCommitCsvImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [deleteRecurringId, setDeleteRecurringId] = useState<string | null>(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const handleExport = () => {
    const payload = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      [STORAGE_KEYS.expenses]: expenses,
      [STORAGE_KEYS.income]: income,
      [STORAGE_KEYS.recurring]: recurring,
      [STORAGE_KEYS.budgets]: budgets,
      [STORAGE_KEYS.settings]: settings,
      [IMPORT_STORAGE_KEYS.importProfiles]: importProfiles,
      [IMPORT_STORAGE_KEYS.importKeys]: existingImportKeys,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-tracker-backup-${getLocalTodayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onNotify('Backup exported as JSON.', 'success');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateBackup(parsed);
      if (!result.valid) {
        setImportError(result.error);
        onNotify(result.error, 'error');
      } else {
        const restoredProfiles = Array.isArray(parsed?.[IMPORT_STORAGE_KEYS.importProfiles])
          ? (parsed[IMPORT_STORAGE_KEYS.importProfiles] as ImportProfile[]).filter(
              (p) =>
                p &&
                typeof p === 'object' &&
                typeof p.id === 'string' &&
                typeof p.name === 'string' &&
                typeof p.dateColumn === 'string' &&
                typeof p.descriptionColumn === 'string' &&
                typeof p.dateFormat === 'string'
            )
          : undefined;
        const restoredKeys = Array.isArray(parsed?.[IMPORT_STORAGE_KEYS.importKeys])
          ? (parsed[IMPORT_STORAGE_KEYS.importKeys] as unknown[]).filter(
              (k): k is string => typeof k === 'string' && k.length > 0
            )
          : undefined;

        onImportBackup({
          expenses: result.data[STORAGE_KEYS.expenses],
          income: result.data[STORAGE_KEYS.income],
          recurring: result.data[STORAGE_KEYS.recurring],
          budgets: result.data[STORAGE_KEYS.budgets],
          settings: result.data[STORAGE_KEYS.settings],
          importProfiles: restoredProfiles,
          importKeys: restoredKeys,
        });
      }
    } catch {
      const msg = 'Could not read backup file. Make sure it is a valid JSON export.';
      setImportError(msg);
      onNotify(msg, 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const targetRecurring = recurring.find((r) => r.id === deleteRecurringId);

  if (showCsvImport) {
    return (
      <ImportScreen
        onBack={() => setShowCsvImport(false)}
        existingImportKeys={existingImportKeys}
        importProfiles={importProfiles}
        onSaveProfile={onSaveImportProfile}
        onDeleteProfile={onDeleteImportProfile}
        onCommitImport={onCommitCsvImport}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[#5C534A] mt-0.5">
          Manage recurring entries, backups, and device storage
        </p>
      </div>

      {/* Recurring Entries */}
      <section
        aria-label="Recurring entries"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div>
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Recurring entries
          </h2>
          <p className="text-xs text-[#5C534A] mt-0.5">
            Paused entries stop generating new monthly instances.
          </p>
        </div>

        {recurring.length === 0 ? (
          <p className="text-sm text-[#5C534A] py-3">
            No recurring entries yet. Enable “Repeat every month” when adding a transaction.
          </p>
        ) : (
          <div className="divide-y divide-[#F0E8DC]">
            {recurring.map((rec) => {
              const isExpense = rec.type === 'expense';
              const label = isExpense ? rec.category || 'Other' : rec.source || 'Income';
              return (
                <div
                  key={rec.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon
                      category={isExpense ? rec.category : undefined}
                      isIncome={!isExpense}
                      label={label}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#1F1A17] truncate">
                          {label}
                        </span>
                        <span className="text-xs text-[#5C534A] tabular-nums">
                          · {formatINR(rec.amount)}
                        </span>
                        <span
                          className={`text-xs font-semibold ${
                            rec.paused ? 'text-[#82520B]' : 'text-[#255B34]'
                          }`}
                        >
                          · {rec.paused ? 'Paused' : 'Active'}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C534A] mt-0.5">
                        Day {rec.dayOfMonth} every month · From {formatMonthLabel(rec.startMonth)}
                        {rec.endMonth ? ` to ${formatMonthLabel(rec.endMonth)}` : ''}
                        {rec.note ? ` · ${rec.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => onTogglePauseRecurring(rec.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-xs font-semibold text-[#1F1A17] hover:bg-[#F3ECE2] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      {rec.paused ? (
                        <>
                          <Play className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Resume</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Pause</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteRecurringId(rec.id)}
                      aria-label={`Delete recurring rule for ${label}`}
                      className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-[#E7B5AC] bg-[#FDECE8] text-[#A82813] hover:bg-[#FADAD3] inline-flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bank Statement CSV Import */}
      <section
        aria-label="Import bank statement"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Bank statement (CSV)
          </h2>
          <p className="text-xs text-[#5C534A] mt-0.5">
            Import expenses and income in bulk from a local .csv file. Nothing is uploaded.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCsvImport(true)}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          <span>Import bank statement</span>
        </button>
      </section>

      {/* Backup & Restore */}
      <section
        aria-label="Backup and restore"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-4"
      >
        <div>
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Backup file
          </h2>
          <p className="text-xs text-[#5C534A] mt-0.5">
            Save a JSON copy of your records or restore from a previous backup (version 1).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#255B34] hover:bg-[#1C4728] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Export backup (JSON)</span>
          </button>

          <label className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] hover:bg-[#F3ECE2] text-[#1F1A17] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap">
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>Import backup</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="Import backup JSON file"
            />
          </label>
        </div>

        {importError && (
          <p role="alert" className="text-xs font-medium text-[#C83219]">
            {importError}
          </p>
        )}
      </section>

      {/* Clear All Data */}
      <section
        aria-label="Clear device data"
        className="bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="font-display text-base font-semibold text-[#1F1A17]">
            Clear all expense data
          </h2>
          <p className="text-xs text-[#5C534A] mt-0.5">
            Removes all expenses, income, recurring rules, and budgets from this browser.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setClearAllConfirmOpen(true)}
          className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E7B5AC] bg-[#FDECE8] text-[#A82813] text-sm font-semibold hover:bg-[#FADAD3] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
          <span>Clear all data</span>
        </button>
      </section>

      {/* Privacy Notice */}
      <div className="flex items-center justify-center gap-2 py-2 text-xs text-[#5C534A]">
        <ShieldCheck className="w-4 h-4 text-[#255B34] shrink-0" aria-hidden="true" />
        <span>Your data stays on this device.</span>
      </div>

      {/* Confirm delete recurring rule */}
      <ConfirmDialog
        open={Boolean(deleteRecurringId)}
        onClose={() => setDeleteRecurringId(null)}
        onConfirm={() => {
          if (deleteRecurringId) {
            onDeleteRecurring(deleteRecurringId);
          }
        }}
        title="Delete recurring rule"
        message={
          targetRecurring
            ? `Stop future recurring entries for ${
                targetRecurring.type === 'expense'
                  ? targetRecurring.category
                  : targetRecurring.source
              }? Existing transactions already created will remain.`
            : 'Delete this recurring rule?'
        }
        confirmLabel="Delete rule"
      />

      {/* Confirm clear all data */}
      <ConfirmDialog
        open={clearAllConfirmOpen}
        onClose={() => setClearAllConfirmOpen(false)}
        onConfirm={onClearAllData}
        title="Clear all expense data?"
        message="This will permanently delete all expenses, income, recurring entries, and monthly budgets from this device. This action cannot be undone."
        confirmLabel="Clear all data"
      />
    </div>
  );
};
