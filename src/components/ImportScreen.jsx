import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { CATEGORIES, formatDisplayDate, formatINR } from '../utils/expenseUtils.js';
import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  detectDelimiter,
  parseCsv,
  planImport,
} from '../utils/csvImport.js';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * Local browser-only CSV bank statement importer.
 * Steps: 1) Choose .csv file -> 2) Map columns & optional profile -> 3) Preview, categorize & import.
 */
export function ImportScreen({
  onBack,
  existingImportKeys,
  importProfiles,
  onSaveProfile,
  onDeleteProfile,
  onCommitImport,
}) {
  const fileInputRef = useRef(null);

  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');

  const [delimiter, setDelimiter] = useState(',');
  const [skipRows, setSkipRows] = useState(0);

  const [dateColumn, setDateColumn] = useState('');
  const [descriptionColumn, setDescriptionColumn] = useState('');
  const [amountMode, setAmountMode] = useState('split'); // 'split' | 'single'
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [amountColumn, setAmountColumn] = useState('');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');

  const [saveProfileChecked, setSaveProfileChecked] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [mappingError, setMappingError] = useState('');

  const [step, setStep] = useState('upload'); // 'upload' | 'map' | 'preview'
  const [previewValid, setPreviewValid] = useState([]);
  const [previewInvalid, setPreviewInvalid] = useState([]);
  const [skippedDuplicates, setSkippedDuplicates] = useState(0);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [batchError, setBatchError] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [preselectedProfileId, setPreselectedProfileId] = useState('');

  const parsedCsv = useMemo(() => {
    if (!rawText) return { headers: [], rows: [], rawRows: [], error: null };
    return parseCsv(rawText, delimiter, skipRows);
  }, [rawText, delimiter, skipRows]);

  const guessInitialColumns = (headers) => {
    const findMatch = (patterns) =>
      headers.find((h) => patterns.some((p) => h.toLowerCase().includes(p))) || '';

    const guessedDate = findMatch(['date', 'txn dt', 'value dt']);
    const guessedDesc = findMatch(['description', 'narration', 'particular', 'remark', 'memo', 'details']);
    const guessedDebit = findMatch(['debit', 'withdrawal', 'dr', 'spent', 'out']);
    const guessedCredit = findMatch(['credit', 'deposit', 'cr', 'in']);
    const guessedAmount = findMatch(['amount', 'amt', 'value']);

    setDateColumn(guessedDate || headers[0] || '');
    setDescriptionColumn(guessedDesc || headers[1] || headers[0] || '');

    if (guessedDebit || guessedCredit) {
      setAmountMode('split');
      setDebitColumn(guessedDebit);
      setCreditColumn(guessedCredit);
      setAmountColumn('');
    } else if (guessedAmount) {
      setAmountMode('single');
      setAmountColumn(guessedAmount);
      setDebitColumn('');
      setCreditColumn('');
    } else {
      setAmountMode('split');
      setDebitColumn('');
      setCreditColumn('');
      setAmountColumn('');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError('');
    setMappingError('');
    setBatchError('');
    setStatusAnnouncement('');

    if (!file.name.toLowerCase().endsWith('.csv')) {
      const msg = 'Only .csv files are supported. Please choose a CSV bank statement.';
      setFileError(msg);
      setStatusAnnouncement(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_CSV_BYTES) {
      const msg = 'This file exceeds the 2 MB limit. Please split it by month and try again.';
      setFileError(msg);
      setStatusAnnouncement(msg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsReading(true);
      setStatusAnnouncement('Reading CSV file...');
      const text = await file.text();
      const detected = detectDelimiter(text);
      const preProfile = importProfiles.find((p) => p.id === preselectedProfileId) || null;
      const initialSkip = preProfile ? preProfile.skipRows || 0 : 0;
      const initialParsed = parseCsv(text, detected, initialSkip);

      if (initialParsed.error) {
        setFileError(initialParsed.error);
        setStatusAnnouncement(initialParsed.error);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (initialParsed.rows.length === 0) {
        const msg = 'This file has no rows.';
        setFileError(msg);
        setStatusAnnouncement(msg);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (initialParsed.rows.length > MAX_CSV_ROWS) {
        const msg = `This file has ${initialParsed.rows.length} rows (over ${MAX_CSV_ROWS}). Please split the file by month before importing.`;
        setFileError(msg);
        setStatusAnnouncement(msg);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setRawText(text);
      setFileName(file.name);
      setDelimiter(detected);
      setSkipRows(initialSkip);
      if (preProfile) {
        applyProfile(preProfile);
      } else {
        guessInitialColumns(initialParsed.headers);
      }
      setStep('map');
      setStatusAnnouncement(`Loaded ${initialParsed.rows.length} rows from ${file.name}.`);
    } catch {
      const msg = 'Could not read this CSV file.';
      setFileError(msg);
      setStatusAnnouncement(msg);
    } finally {
      setIsReading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSkipOrDelimiterChange = (nextDelimiter, nextSkipRows) => {
    setDelimiter(nextDelimiter);
    setSkipRows(nextSkipRows);
    const nextParsed = parseCsv(rawText, nextDelimiter, nextSkipRows);
    if (nextParsed.error) {
      setMappingError(nextParsed.error);
      setStatusAnnouncement(nextParsed.error);
      return;
    }
    setMappingError('');
    if (nextParsed.headers.length > 0) {
      guessInitialColumns(nextParsed.headers);
    }
  };

  const applyProfile = (profile) => {
    setSkipRows(profile.skipRows || 0);
    setDateFormat(profile.dateFormat || 'DD/MM/YYYY');
    setDateColumn(profile.dateColumn || '');
    setDescriptionColumn(profile.descriptionColumn || '');
    if (profile.amountColumn) {
      setAmountMode('single');
      setAmountColumn(profile.amountColumn);
      setDebitColumn('');
      setCreditColumn('');
    } else {
      setAmountMode('split');
      setDebitColumn(profile.debitColumn || '');
      setCreditColumn(profile.creditColumn || '');
      setAmountColumn('');
    }
    setMappingError('');
    setStatusAnnouncement(`Applied profile ${profile.name}.`);
  };

  const handleBuildPreview = (e) => {
    e.preventDefault();
    setMappingError('');
    setBatchError('');

    if (parsedCsv.error) {
      setMappingError(parsedCsv.error);
      setStatusAnnouncement(parsedCsv.error);
      return;
    }

    if (parsedCsv.rows.length === 0) {
      setMappingError('This file has no rows.');
      setStatusAnnouncement('This file has no rows.');
      return;
    }

    if (parsedCsv.rows.length > MAX_CSV_ROWS) {
      setMappingError(
        `This file has ${parsedCsv.rows.length} rows (over ${MAX_CSV_ROWS}). Please split the file by month.`
      );
      return;
    }

    if (saveProfileChecked && !profileName.trim()) {
      setMappingError('Please enter a name for the import profile.');
      return;
    }

    const mapping = {
      dateColumn,
      descriptionColumn,
      dateFormat,
      ...(amountMode === 'single'
        ? { amountColumn }
        : { debitColumn, creditColumn }),
    };

    const result = planImport(
      parsedCsv.rows,
      mapping,
      existingImportKeys,
      parsedCsv.headers
    );

    if (result.error) {
      setMappingError(result.error);
      setStatusAnnouncement(result.error);
      return;
    }

    if (saveProfileChecked && profileName.trim()) {
      onSaveProfile({
        id: `prof_${Date.now()}`,
        name: profileName.trim().slice(0, 40),
        dateColumn,
        descriptionColumn,
        debitColumn: amountMode === 'split' ? debitColumn : '',
        creditColumn: amountMode === 'split' ? creditColumn : '',
        amountColumn: amountMode === 'single' ? amountColumn : undefined,
        dateFormat,
        skipRows,
      });
    }

    setPreviewValid(result.valid);
    setPreviewInvalid(result.invalid);
    setSkippedDuplicates(result.skippedDuplicates);
    setStep('preview');

    const parts = [`${result.valid.length} ready to import`];
    if (result.skippedDuplicates > 0) {
      parts.push(`Skipped ${result.skippedDuplicates} rows already imported`);
    }
    if (result.invalid.length > 0) {
      parts.push(`${result.invalid.length} unreadable rows excluded`);
    }
    setStatusAnnouncement(parts.join('. ') + '.');
  };

  const toggleIgnoreRow = (rowId) => {
    setPreviewValid((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, ignored: !item.ignored } : item
      )
    );
  };

  const updateRowCategory = (rowId, nextCategory) => {
    setPreviewValid((prev) =>
      prev.map((item) =>
        item.id === rowId ? { ...item, category: nextCategory } : item
      )
    );
  };

  const selectedToImport = useMemo(
    () => previewValid.filter((item) => !item.ignored),
    [previewValid]
  );

  const handleConfirmImport = () => {
    const ok = onCommitImport(selectedToImport);
    if (!ok) {
      const errMsg = 'Import failed. Nothing was saved.';
      setBatchError(errMsg);
      setStatusAnnouncement(errMsg);
      return;
    }
    console.info(`Imported ${selectedToImport.length} transactions from CSV.`);
    setRawText('');
    setPreviewValid([]);
    setPreviewInvalid([]);
    onBack();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setRawText('');
              onBack();
            }}
            aria-label="Back to Settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-[#1F1A17] tracking-tight truncate">
              Import bank statement
            </h1>
            <p className="text-sm text-[#5C534A] mt-0.5">
              Reads .csv locally in your browser. Nothing is uploaded.
            </p>
          </div>
        </div>
      </div>

      {/* Live region announcing parse / preview / import results */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {statusAnnouncement}
      </div>

      {/* Step 1: Choose CSV File */}
      {step === 'upload' && (
        <section
          aria-label="Choose CSV file"
          className="min-w-0 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-[#1F1A17]">
              1. Choose a CSV file
            </h2>
            <p className="text-xs text-[#5C534A] mt-1">
              Supports .csv files up to 2 MB and 2,000 rows. Raw files are never stored or sent.
            </p>
          </div>

          {importProfiles.length > 0 && (
            <div className="max-w-sm">
              <label
                htmlFor="preselect-profile"
                className="block text-xs font-medium text-[#1F1A17] mb-1"
              >
                Saved import profile (optional)
              </label>
              <select
                id="preselect-profile"
                value={preselectedProfileId}
                onChange={(e) => setPreselectedProfileId(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-sm text-[#1F1A17]"
              >
                <option value="">Auto-detect columns after upload</option>
                {importProfiles.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.name} ({prof.dateFormat})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="csv-file-input"
              className="min-h-[44px] px-5 py-3 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-[#C83219] focus-within:ring-offset-2"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{isReading ? 'Reading CSV file...' : 'Select CSV statement'}</span>
              <input
                ref={fileInputRef}
                id="csv-file-input"
                type="file"
                accept=".csv,text/csv"
                disabled={isReading}
                onChange={handleFileSelect}
                className="sr-only"
              />
            </label>
          </div>

          {fileError && (
            <p role="alert" className="text-sm font-medium text-[#C83219]">
              {fileError}
            </p>
          )}
        </section>
      )}

      {/* Step 2: Map Columns */}
      {step === 'map' && (
        <form onSubmit={handleBuildPreview} noValidate className="space-y-6 min-w-0">
          <section className="min-w-0 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                  2. Map columns
                </h2>
                <p className="text-xs text-[#5C534A] mt-0.5">
                  File: {fileName} · {parsedCsv.rows.length} data rows
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setRawText('');
                  setFileError('');
                }}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-xs font-semibold text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
              >
                Choose another file
              </button>
            </div>

            {/* Saved Import Profiles */}
            {importProfiles.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E6DDD0] space-y-2.5">
                <span className="block text-xs font-semibold text-[#1F1A17]">
                  Saved bank profiles
                </span>
                <div className="flex flex-wrap gap-2">
                  {importProfiles.map((prof) => (
                    <div
                      key={prof.id}
                      className="inline-flex max-w-full items-center rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => applyProfile(prof)}
                        className="min-h-[44px] px-3.5 text-xs font-semibold text-[#1F1A17] hover:bg-[#FAF6F0] transition-colors truncate max-w-[200px] sm:max-w-none"
                      >
                        Apply: {prof.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteProfile(prof.id);
                          setStatusAnnouncement(`Deleted profile ${prof.name}.`);
                        }}
                        aria-label={`Delete profile ${prof.name}`}
                        className="min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center text-[#5C534A] hover:text-[#C83219] border-l border-[#E6DDD0] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delimiter & Skip Rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="csv-delimiter"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Delimiter
                </label>
                <select
                  id="csv-delimiter"
                  value={delimiter}
                  onChange={(e) => handleSkipOrDelimiterChange(e.target.value, skipRows)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={'\t'}>Tab</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="csv-skip-rows"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Skip leading rows (before header)
                </label>
                <input
                  id="csv-skip-rows"
                  type="number"
                  min={0}
                  max={25}
                  value={skipRows}
                  onChange={(e) =>
                    handleSkipOrDelimiterChange(
                      delimiter,
                      Math.max(0, Math.min(25, Number(e.target.value) || 0))
                    )
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17] tabular-nums"
                />
              </div>
            </div>

            {/* Sample first 5 rows */}
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-[#5C534A] mb-2">
                First 5 rows preview
              </h3>
              <div className="w-full max-w-full overflow-x-auto border border-[#E6DDD0] rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E6DDD0]">
                      {parsedCsv.headers.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="py-2.5 px-3 text-left font-semibold text-[#1F1A17] whitespace-nowrap"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E8DC]">
                    {parsedCsv.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {parsedCsv.headers.map((header) => (
                          <td
                            key={header}
                            className="py-2 px-3 text-[#5C534A] whitespace-nowrap max-w-[200px] truncate"
                          >
                            {row[header] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column Mapping Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="map-date-col"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Date column
                </label>
                <select
                  id="map-date-col"
                  value={dateColumn}
                  onChange={(e) => setDateColumn(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                >
                  <option value="">Select column...</option>
                  {dateColumn && !parsedCsv.headers.includes(dateColumn) && (
                    <option value={dateColumn}>{dateColumn} (not found in file)</option>
                  )}
                  {parsedCsv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="map-date-format"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Date format
                </label>
                <select
                  id="map-date-format"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="map-desc-col"
                  className="block text-xs font-medium text-[#1F1A17] mb-1"
                >
                  Description column
                </label>
                <select
                  id="map-desc-col"
                  value={descriptionColumn}
                  onChange={(e) => setDescriptionColumn(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                >
                  <option value="">Select column...</option>
                  {descriptionColumn && !parsedCsv.headers.includes(descriptionColumn) && (
                    <option value={descriptionColumn}>
                      {descriptionColumn} (not found in file)
                    </option>
                  )}
                  {parsedCsv.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Column Mode */}
            <div className="space-y-3 pt-2 border-t border-[#E6DDD0]">
              <div
                role="group"
                aria-label="Amount column layout"
                className="grid grid-cols-1 sm:inline-grid sm:grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3ECE2]"
              >
                <button
                  type="button"
                  aria-pressed={amountMode === 'split'}
                  onClick={() => setAmountMode('split')}
                  className={`min-h-[44px] px-3.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    amountMode === 'split'
                      ? 'bg-[#FFFFFF] text-[#1F1A17] shadow-sm font-semibold'
                      : 'text-[#5C534A] hover:text-[#1F1A17]'
                  }`}
                >
                  Debit & Credit columns
                </button>
                <button
                  type="button"
                  aria-pressed={amountMode === 'single'}
                  onClick={() => setAmountMode('single')}
                  className={`min-h-[44px] px-3.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    amountMode === 'single'
                      ? 'bg-[#FFFFFF] text-[#1F1A17] shadow-sm font-semibold'
                      : 'text-[#5C534A] hover:text-[#1F1A17]'
                  }`}
                >
                  Single signed Amount
                </button>
              </div>

              {amountMode === 'split' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="map-debit-col"
                      className="block text-xs font-medium text-[#1F1A17] mb-1"
                    >
                      Debit column (money out)
                    </label>
                    <select
                      id="map-debit-col"
                      value={debitColumn}
                      onChange={(e) => setDebitColumn(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                    >
                      <option value="">None / not mapped</option>
                      {debitColumn && !parsedCsv.headers.includes(debitColumn) && (
                        <option value={debitColumn}>
                          {debitColumn} (not found in file)
                        </option>
                      )}
                      {parsedCsv.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="map-credit-col"
                      className="block text-xs font-medium text-[#1F1A17] mb-1"
                    >
                      Credit column (money in)
                    </label>
                    <select
                      id="map-credit-col"
                      value={creditColumn}
                      onChange={(e) => setCreditColumn(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                    >
                      <option value="">None / not mapped</option>
                      {creditColumn && !parsedCsv.headers.includes(creditColumn) && (
                        <option value={creditColumn}>
                          {creditColumn} (not found in file)
                        </option>
                      )}
                      {parsedCsv.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="max-w-sm">
                  <label
                    htmlFor="map-amount-col"
                    className="block text-xs font-medium text-[#1F1A17] mb-1"
                  >
                    Amount column (negative = expense, positive = income)
                  </label>
                  <select
                    id="map-amount-col"
                    value={amountColumn}
                    onChange={(e) => setAmountColumn(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                  >
                    <option value="">Select column...</option>
                    {amountColumn && !parsedCsv.headers.includes(amountColumn) && (
                      <option value={amountColumn}>
                        {amountColumn} (not found in file)
                      </option>
                    )}
                    {parsedCsv.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Save Profile Option */}
            <div className="pt-3 border-t border-[#E6DDD0] space-y-3">
              <label
                htmlFor="save-profile-toggle"
                className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer"
              >
                <input
                  id="save-profile-toggle"
                  type="checkbox"
                  checked={saveProfileChecked}
                  onChange={(e) => setSaveProfileChecked(e.target.checked)}
                  className="w-4 h-4 accent-[#C83219] rounded"
                />
                <span className="text-sm font-medium text-[#1F1A17]">
                  Save mapping as a reusable profile
                </span>
              </label>

              {saveProfileChecked && (
                <div className="max-w-sm">
                  <label
                    htmlFor="profile-name-input"
                    className="block text-xs font-medium text-[#1F1A17] mb-1"
                  >
                    Profile name
                  </label>
                  <input
                    id="profile-name-input"
                    type="text"
                    maxLength={40}
                    placeholder="e.g. HDFC Savings"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-sm text-[#1F1A17]"
                  />
                </div>
              )}
            </div>

            {mappingError && (
              <p role="alert" className="text-sm font-medium text-[#C83219]">
                {mappingError}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#C83219] hover:bg-[#A82813] text-white text-sm font-semibold transition-colors"
              >
                Preview transactions
              </button>
            </div>
          </section>
        </form>
      )}

      {/* Step 3: Preview, Categorize & Confirm */}
      {step === 'preview' && (
        <div className="space-y-6 min-w-0">
          <section className="min-w-0 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-[#1F1A17]">
                  3. Review & categorize
                </h2>
                <p className="text-xs text-[#5C534A] mt-0.5 tabular-nums">
                  {selectedToImport.length} selected for import · {previewInvalid.length} unreadable
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep('map')}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#E6DDD0] bg-[#FAF6F0] text-xs font-semibold text-[#1F1A17] hover:bg-[#F3ECE2] transition-colors"
              >
                Edit mapping
              </button>
            </div>

            {skippedDuplicates > 0 && (
              <div
                role="status"
                className="p-3.5 rounded-xl bg-[#E8F3EB] border border-[#B6D7BF] text-sm text-[#1C4728] flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Skipped {skippedDuplicates}{' '}
                  {skippedDuplicates === 1 ? 'row' : 'rows'} already imported.
                </span>
              </div>
            )}

            {batchError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#FDECE8] border border-[#E7B5AC] text-sm font-medium text-[#8E1F0C] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{batchError}</span>
              </div>
            )}

            {previewValid.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#5C534A]">
                No new transactions to import from this file.
              </p>
            ) : (
              <div className="w-full max-w-full overflow-x-auto border border-[#E6DDD0] rounded-xl">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E6DDD0] text-left text-xs font-semibold text-[#5C534A]">
                      <th scope="col" className="py-3 px-3">
                        Ignore
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Date
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Description
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Type
                      </th>
                      <th scope="col" className="py-3 px-3">
                        Category
                      </th>
                      <th scope="col" className="py-3 px-3 text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E8DC]">
                    {previewValid.map((row) => (
                      <tr
                        key={row.id}
                        className={row.ignored ? 'opacity-50 bg-[#FAF6F0]/60' : ''}
                      >
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={row.ignored}
                            onChange={() => toggleIgnoreRow(row.id)}
                            aria-label={`Ignore ${row.description} on ${formatDisplayDate(row.date)}`}
                            className="w-5 h-5 accent-[#C83219] rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs text-[#1F1A17]">
                          {formatDisplayDate(row.date)}
                        </td>
                        <td className="py-2.5 px-3 text-xs sm:text-sm text-[#1F1A17] min-w-[160px] max-w-[260px] truncate">
                          {row.description}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-xs font-semibold">
                          <span
                            className={
                              row.txType === 'expense'
                                ? 'text-[#C83219]'
                                : 'text-[#255B34]'
                            }
                          >
                            {row.txType === 'expense' ? 'Expense' : 'Income'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.txType === 'expense' ? (
                            <select
                              aria-label={`Category for ${row.description}`}
                              value={row.category || 'Other'}
                              disabled={row.ignored}
                              onChange={(e) => updateRowCategory(row.id, e.target.value)}
                              className="min-h-[44px] px-2.5 py-1.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-xs text-[#1F1A17]"
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-[#5C534A]">Income</span>
                          )}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap ${
                            row.txType === 'expense' ? 'text-[#C83219]' : 'text-[#255B34]'
                          }`}
                        >
                          {row.txType === 'expense' ? '-' : '+'}
                          {formatINR(row.amountPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  onBack();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E6DDD0] bg-[#FFFFFF] text-[#1F1A17] text-sm font-medium hover:bg-[#FAF6F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedToImport.length === 0}
                onClick={() => setConfirmImportOpen(true)}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#255B34] hover:bg-[#1C4728] disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                Import {selectedToImport.length}{' '}
                {selectedToImport.length === 1 ? 'transaction' : 'transactions'}
              </button>
            </div>
          </section>

          {/* Unreadable / Ignored Rows */}
          {previewInvalid.length > 0 && (
            <section
              aria-label="Could not import"
              className="min-w-0 bg-[#FFFFFF] border border-[#E6DDD0] rounded-2xl p-5 sm:p-6 space-y-3"
            >
              <h3 className="font-display text-sm font-semibold text-[#1F1A17]">
                Could not import ({previewInvalid.length})
              </h3>
              <div className="divide-y divide-[#F0E8DC] text-xs">
                {previewInvalid.map((bad) => (
                  <div
                    key={bad.rowNumber}
                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <div className="text-[#1F1A17] min-w-0 truncate">
                      Row {bad.rowNumber}: {bad.rawDate || '-'} · {bad.description}
                    </div>
                    <span className="text-[#C83219] font-medium break-words">
                      {bad.reason}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmImportOpen}
        onClose={() => setConfirmImportOpen(false)}
        onConfirm={handleConfirmImport}
        title={`Import ${selectedToImport.length} ${
          selectedToImport.length === 1 ? 'transaction' : 'transactions'
        }?`}
        message="These entries will be added to your on-device expense and income records."
        confirmLabel="Import"
        cancelLabel="Cancel"
        destructive={false}
      />
    </div>
  );
}
