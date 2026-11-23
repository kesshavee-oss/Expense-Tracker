import type { Category } from '../types';

export type CsvDateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';

export interface ImportProfile {
  id: string;
  name: string;
  dateColumn: string;
  descriptionColumn: string;
  debitColumn: string;
  creditColumn: string;
  amountColumn?: string;
  dateFormat: CsvDateFormat;
  skipRows: number;
}

export interface CsvColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  dateFormat: CsvDateFormat;
}

export interface PlannedImportItem {
  id: string;
  rowNumber: number;
  date: string;
  description: string;
  txType: 'expense' | 'income';
  amountPaise: number;
  category?: Category;
  importKey: string;
  ignored: boolean;
}

export interface InvalidImportRow {
  rowNumber: number;
  rawDate: string;
  description: string;
  reason: string;
}

export declare const IMPORT_STORAGE_KEYS: {
  importProfiles: 'wcic_expense_importProfiles';
  importKeys: 'wcic_expense_importKeys';
};

export declare const MAX_CSV_BYTES: number;
export declare const MAX_CSV_ROWS: number;

export declare function detectDelimiter(text: string): ',' | ';' | '\t';
export declare function parseCsv(
  text: string,
  delimiter?: string,
  skipRows?: number
): {
  headers: string[];
  rows: Array<Record<string, string>>;
  rawRows: string[][];
  error: string | null;
};
export declare function parseAmountToPaise(text: string | number | null | undefined): number | null;
export declare function parseDate(text: string, format: CsvDateFormat): string | null;
export declare function suggestCategory(description: string): Category;
export declare function buildImportKey(entry: {
  date: string;
  amount: number;
  description: string;
}): string;
export declare function planImport(
  rows: Array<Record<string, string>>,
  mapping: CsvColumnMapping,
  existingKeys?: string[] | Set<string>,
  headers?: string[] | null
): {
  error: string | null;
  valid: PlannedImportItem[];
  invalid: InvalidImportRow[];
  skippedDuplicates: number;
};
export declare function runCsvImportSelfTests(): void;
