/**
 * Pure CSV parsing, column mapping, validation, categorization, and deduplication
 * utilities for local browser-only bank statement imports.
 */

import { CATEGORIES } from './expenseUtils.js';

export const IMPORT_STORAGE_KEYS = {
  importProfiles: 'wcic_expense_importProfiles',
  importKeys: 'wcic_expense_importKeys',
};

export const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_CSV_ROWS = 2000;

const KEYWORD_CATEGORY_RULES = [
  {
    category: 'Food',
    keywords: [
      'SWIGGY', 'ZOMATO', 'DOMINOS', 'PIZZA', 'MCDONALD', 'KFC',
      'BURGER KING', 'STARBUCKS', 'CAFE', 'RESTAURANT', 'BAKERY',
      'FOOD', 'DINING', 'CHAI', 'COFFEE', 'EATS', 'BIRYANI',
    ],
  },
  {
    category: 'Groceries',
    keywords: [
      'BLINKIT', 'ZEPTO', 'BIGBASKET', 'GROCERY', 'GROCERIES', 'DMART',
      'FRESH', 'SUPERMARKET', 'KIRANA', 'VEGETABLE', 'DAIRY', 'MILK',
      'INSTAMART', 'JIO MART', 'JIOMART',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'UBER', 'OLA', 'RAPIDO', 'METRO', 'PETROL', 'DIESEL', 'FUEL',
      'HPCL', 'BPCL', 'INDIAN OIL', 'FASTAG', 'TOLL', 'PARKING',
      'BUS', 'AUTO', 'CAB', 'COMMUTE',
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'IRCTC', 'RAILWAY', 'INDIGO', 'AIRLINE', 'FLIGHT', 'AIR INDIA',
      'VISTARA', 'MAKEMYTRIP', 'GOIBIBO', 'AIRBNB', 'HOTEL', 'RESORT',
      'BOOKING.COM', 'YATRA', 'TRIP',
    ],
  },
  {
    category: 'Rent',
    keywords: ['RENT', 'LANDLORD', 'LEASE', 'SOCIETY', 'MAINTENANCE', 'HOSTEL'],
  },
  {
    category: 'Bills',
    keywords: [
      'BROADBAND', 'WIFI', 'AIRTEL', 'JIO', 'VODAFONE', 'RECHARGE',
      'POSTPAID', 'DTH', 'INTERNET',
    ],
  },
  {
    category: 'Utilities',
    keywords: [
      'ELECTRICITY', 'BESCOM', 'TATA POWER', 'WATER BILL', 'GAS BILL',
      'UTILITY', 'PIPED GAS', 'INDANE', 'HP GAS', 'BHARAT GAS',
    ],
  },
  {
    category: 'Insurance',
    keywords: ['INSURANCE', 'LIC', 'HDFC ERGO', 'ICICI LOMBARD', 'STAR HEALTH', 'POLICYBAZAAR'],
  },
  {
    category: 'Investments',
    keywords: [
      'ZERODHA', 'GROWW', 'UPSTOX', 'KUVERA', 'COIN', 'SIP', 'MUTUAL FUND',
      'NIFTY', 'PPF', 'NPS', 'INVESTMENT', 'STOCK', 'ETF',
    ],
  },
  {
    category: 'Fitness',
    keywords: [
      'GYM', 'CULT.FIT', 'CULTFIT', 'DECATHLON', 'YOGA', 'FITNESS',
      'SPORTS', 'SWIMMING', 'BADMINTON',
    ],
  },
  {
    category: 'Subscriptions',
    keywords: [
      'NETFLIX', 'SPOTIFY', 'PRIME VIDEO', 'HOTSTAR', 'DISNEY', 'YOUTUBE',
      'APPLE.COM/BILL', 'GOOGLE ONE', 'ICLOUD', 'CHATGPT', 'SUBSCRIPTION',
      'MEMBERSHIP',
    ],
  },
  {
    category: 'Education',
    keywords: [
      'TUITION', 'SCHOOL', 'COLLEGE', 'UNIVERSITY', 'EXAM', 'COURSERA',
      'UDEMY', 'EDUCATION', 'BYJU', 'UNACADEMY', 'COACHING',
    ],
  },
  {
    category: 'Study',
    keywords: [
      'BOOK', 'KINDLE', 'STATIONERY', 'COURSE', 'LIBRARY',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'AMAZON', 'FLIPKART', 'MYNTRA', 'AJIO', 'MEESHO',
      'IKEA', 'MALL', 'RETAIL', 'STORE', 'APPAREL', 'ZUDIO',
    ],
  },
  {
    category: 'Healthcare',
    keywords: [
      'PHARMACY', 'APOLLO', '1MG', 'PHARMEASY', 'MEDPLUS', 'HOSPITAL',
      'CLINIC', 'DOCTOR', 'DENTAL', 'DIAGNOSTIC', 'LAB', 'HEALTHCARE',
    ],
  },
  {
    category: 'Health',
    keywords: ['HEALTH', 'MEDICINE', 'WELLNESS'],
  },
  {
    category: 'Personal Care',
    keywords: [
      'NYKAA', 'SALON', 'BARBER', 'HAIRCUT', 'SPA', 'GROOMING',
      'SKINCARE', 'COSMETIC', 'URBAN COMPANY',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'BOOKMYSHOW', 'PVR', 'INOX', 'CINEMA', 'MOVIE', 'STEAM',
      'PLAYSTATION', 'CONCERT', 'GAMING',
    ],
  },
  {
    category: 'Family',
    keywords: ['FAMILY', 'PARENTS', 'KIDS', 'DAYCARE', 'MAID', 'NANNY'],
  },
  {
    category: 'Charity',
    keywords: ['DONATION', 'CHARITY', 'NGO', 'KETTO', 'MILAAP'],
  },
  {
    category: 'Gifts',
    keywords: ['GIFT', 'FLORIST', 'FERNS N PETALS'],
  },
  {
    category: 'Pets',
    keywords: ['PET STORE', 'PET FOOD', 'PET CARE', 'HEADS UP FOR TAILS', 'VETERINARY', 'VET CLINIC'],
  },
];

/**
 * Detects the most likely CSV delimiter (comma, semicolon, or tab)
 * by inspecting the first non-empty lines outside quoted strings.
 */
export function detectDelimiter(text) {
  if (typeof text !== 'string' || !text.trim()) return ',';

  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (lines.length === 0) return ',';

  const candidates = [',', ';', '\t'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = lines.map((line) => {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (!inQuotes && ch === delim) {
          count += 1;
        }
      }
      return count;
    });

    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) continue;

    const first = counts[0];
    const consistentLines = counts.filter((c) => c === first && c > 0).length;
    const score = consistentLines * 100 + total;

    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }

  return bestDelim;
}

/**
 * Parses CSV text with support for quoted fields, escaped double-quotes (""),
 * embedded delimiters/newlines inside quotes, and skipping leading metadata rows.
 * Returns { headers: string[], rows: Array<Record<string, string>>, rawRows: string[][], error: string | null }.
 */
export function parseCsv(text, delimiter = ',', skipRows = 0) {
  if (typeof text !== 'string') {
    return { headers: [], rows: [], rawRows: [], error: 'Could not read CSV content.' };
  }

  if (/\u0000/.test(text)) {
    return {
      headers: [],
      rows: [],
      rawRows: [],
      error: 'This file appears to be binary or corrupted, not a text CSV file.',
    };
  }

  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    return { headers: [], rows: [], rawRows: [], error: null };
  }

  const delim = delimiter === '\t' || delimiter === ';' ? delimiter : ',';
  const parsedRows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentField += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (ch === '\r' && next === '\n') {
      currentRow.push(currentField.trim());
      parsedRows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      currentRow.push(currentField.trim());
      parsedRows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) {
    return {
      headers: [],
      rows: [],
      rawRows: [],
      error: 'Could not parse CSV: unclosed quotation mark ("). Check the file formatting and try again.',
    };
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    parsedRows.push(currentRow);
  }

  const nonEmptyRows = parsedRows.filter((row) => row.some((cell) => cell !== ''));
  const safeSkip = Number.isFinite(skipRows) && skipRows > 0 ? Math.floor(skipRows) : 0;
  const sliced = nonEmptyRows.slice(safeSkip);

  if (sliced.length === 0) {
    return { headers: [], rows: [], rawRows: [], error: null };
  }

  const rawHeaders = sliced[0];
  const seenHeaders = new Map();
  const headers = rawHeaders.map((h, idx) => {
    const base = h || `Column ${idx + 1}`;
    const count = seenHeaders.get(base) || 0;
    seenHeaders.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });

  const dataRows = sliced.slice(1).map((cells) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) {
      obj[headers[i]] = cells[i] ?? '';
    }
    return obj;
  });

  return {
    headers,
    rows: dataRows,
    rawRows: sliced,
    error: null,
  };
}

/**
 * Parses a currency amount string (supporting commas, ₹/Rs/INR symbols, and
 * accounting parentheses like "(450.00)" as negative) into signed integer paise
 * without IEEE-754 float multiplication drift. Returns null if invalid.
 */
export function parseAmountToPaise(text) {
  if (text === null || text === undefined) return null;
  let raw = String(text).trim();
  if (!raw || raw === '-' || raw === '--' || /^n\/?a$/i.test(raw)) {
    return null;
  }

  let isNegative = false;

  if (raw.startsWith('(') && raw.endsWith(')')) {
    isNegative = true;
    raw = raw.slice(1, -1).trim();
  }

  if (/\bDR\b$/i.test(raw)) {
    isNegative = true;
    raw = raw.replace(/\bDR\b$/i, '').trim();
  } else if (/\bCR\b$/i.test(raw)) {
    raw = raw.replace(/\bCR\b$/i, '').trim();
  }

  raw = raw.replace(/(?:₹|INR|Rs\.?)/gi, '').replace(/[,\s]/g, '');

  if (raw.startsWith('-')) {
    isNegative = !isNegative;
    raw = raw.slice(1);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }

  if (!raw || !/^\d+(\.\d+)?$/.test(raw)) {
    return null;
  }

  const [wholePart, fracPart = ''] = raw.split('.');
  if (fracPart.length > 2) {
    return null;
  }

  const rupees = parseInt(wholePart, 10);
  const paise = parseInt(fracPart.padEnd(2, '0'), 10);
  if (!Number.isSafeInteger(rupees) || !Number.isSafeInteger(paise)) {
    return null;
  }

  const absPaise = rupees * 100 + paise;
  if (absPaise === 0) return 0;
  return isNegative ? -absPaise : absPaise;
}

/**
 * Parses a date string strictly according to the selected format:
 * "DD/MM/YYYY", "YYYY-MM-DD", or "DD-MM-YYYY".
 * Rejects impossible calendar dates (e.g. 31/02/2026).
 * Returns ISO "YYYY-MM-DD" or null if invalid.
 */
export function parseDate(text, format) {
  if (typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;

  let day;
  let month;
  let year;

  if (format === 'YYYY-MM-DD') {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else if (format === 'DD/MM/YYYY') {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else if (format === 'DD-MM-YYYY') {
    const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  } else {
    return null;
  }

  if (year < 1970 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
}

/**
 * Suggests an expense category from a transaction description using keyword rules.
 * Defaults to "Other" when no rule matches.
 */
export function suggestCategory(description) {
  if (typeof description !== 'string' || !description.trim()) {
    return 'Other';
  }
  const upper = description.toUpperCase();
  for (const rule of KEYWORD_CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (upper.includes(kw)) {
        return CATEGORIES.includes(rule.category) ? rule.category : 'Other';
      }
    }
  }
  return 'Other';
}

/**
 * Computes a deterministic hash key from ISO date, integer paise amount,
 * and normalized description (uppercase, collapsed spaces).
 */
export function buildImportKey(entry) {
  const date = String(entry?.date || '').trim();
  const amount = Number.isFinite(entry?.amount) ? Math.round(entry.amount) : 0;
  const normalizedDesc = String(entry?.description || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');

  const input = `${date}|${amount}|${normalizedDesc}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `imp_${hex1}${hex2}`;
}

/**
 * Evaluates parsed CSV rows against the user's column mapping and existing importKeys.
 * Separates valid preview items from unreadable rows and counts duplicate skips.
 */
export function planImport(rows, mapping, existingKeys = [], headers = null) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      error: 'This file has no rows.',
      valid: [],
      invalid: [],
      skippedDuplicates: 0,
    };
  }

  const availableCols = new Set(
    Array.isArray(headers) && headers.length > 0 ? headers : Object.keys(rows[0] || {})
  );

  const requiredCols = [mapping.dateColumn, mapping.descriptionColumn];
  if (mapping.amountColumn) {
    requiredCols.push(mapping.amountColumn);
  } else {
    if (mapping.debitColumn) requiredCols.push(mapping.debitColumn);
    if (mapping.creditColumn) requiredCols.push(mapping.creditColumn);
  }

  for (const col of requiredCols) {
    if (!col || !availableCols.has(col)) {
      return {
        error: `Column '${col || 'Unknown'}' was not found in this file.`,
        valid: [],
        invalid: [],
        skippedDuplicates: 0,
      };
    }
  }

  if (!mapping.amountColumn && !mapping.debitColumn && !mapping.creditColumn) {
    return {
      error: 'Please select Debit/Credit columns or a single Amount column.',
      valid: [],
      invalid: [],
      skippedDuplicates: 0,
    };
  }

  const existingSet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  const valid = [];
  const invalid = [];
  let skippedDuplicates = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const rawDate = row[mapping.dateColumn] ?? '';
    const rawDesc = row[mapping.descriptionColumn] ?? '';
    const description = String(rawDesc).trim().replace(/\s+/g, ' ');

    const isoDate = parseDate(rawDate, mapping.dateFormat);
    if (!isoDate) {
      invalid.push({
        rowNumber,
        rawDate: String(rawDate),
        description: description || '-',
        reason: `Invalid date "${rawDate || ''}" for format ${mapping.dateFormat}.`,
      });
      return;
    }

    if (!description) {
      invalid.push({
        rowNumber,
        rawDate: String(rawDate),
        description: '-',
        reason: 'Missing description.',
      });
      return;
    }

    let txType = null;
    let amountPaise = 0;

    if (mapping.amountColumn) {
      const rawAmount = row[mapping.amountColumn] ?? '';
      const parsed = parseAmountToPaise(rawAmount);
      if (parsed === null) {
        invalid.push({
          rowNumber,
          rawDate: String(rawDate),
          description,
          reason: 'Could not read amount.',
        });
        return;
      }
      if (parsed === 0) {
        invalid.push({
          rowNumber,
          rawDate: String(rawDate),
          description,
          reason: 'Zero amount ignored.',
        });
        return;
      }
      if (parsed < 0) {
        txType = 'expense';
        amountPaise = Math.abs(parsed);
      } else {
        txType = 'income';
        amountPaise = parsed;
      }
    } else {
      const rawDebit = mapping.debitColumn ? row[mapping.debitColumn] ?? '' : '';
      const rawCredit = mapping.creditColumn ? row[mapping.creditColumn] ?? '' : '';
      const debitPaise = rawDebit.trim() ? parseAmountToPaise(rawDebit) : null;
      const creditPaise = rawCredit.trim() ? parseAmountToPaise(rawCredit) : null;

      const hasDebit = debitPaise !== null && debitPaise !== 0;
      const hasCredit = creditPaise !== null && creditPaise !== 0;

      if (hasDebit && hasCredit) {
        invalid.push({
          rowNumber,
          rawDate: String(rawDate),
          description,
          reason: 'Both debit and credit amounts are present.',
        });
        return;
      }

      if (hasDebit) {
        if (debitPaise < 0) {
          invalid.push({
            rowNumber,
            rawDate: String(rawDate),
            description,
            reason: 'Negative debit amount ignored.',
          });
          return;
        }
        txType = 'expense';
        amountPaise = debitPaise;
      } else if (hasCredit) {
        if (creditPaise < 0) {
          invalid.push({
            rowNumber,
            rawDate: String(rawDate),
            description,
            reason: 'Negative credit amount ignored.',
          });
          return;
        }
        txType = 'income';
        amountPaise = creditPaise;
      } else {
        invalid.push({
          rowNumber,
          rawDate: String(rawDate),
          description,
          reason: 'Zero or missing amount.',
        });
        return;
      }
    }

    const importKey = buildImportKey({
      date: isoDate,
      amount: amountPaise,
      description,
    });

    if (existingSet.has(importKey)) {
      skippedDuplicates += 1;
      return;
    }

    valid.push({
      id: `preview_${rowNumber}_${importKey}`,
      rowNumber,
      date: isoDate,
      description,
      txType,
      amountPaise,
      category: txType === 'expense' ? suggestCategory(description) : undefined,
      importKey,
      ignored: false,
    });
  });

  return {
    error: null,
    valid,
    invalid,
    skippedDuplicates,
  };
}

/**
 * Runs console.assert self-tests for CSV parsing, amount conversion,
 * strict date rejection, category suggestion, and duplicate skipping.
 */
export function runCsvImportSelfTests() {
  // 1. "1,250.50" becomes 125050 paise
  console.assert(
    parseAmountToPaise('1,250.50') === 125050,
    'CSV Self-test 1 failed: "1,250.50" should be 125050 paise'
  );

  // 2. "(450.00)" becomes an expense of 45000 paise
  const parenParsed = parseAmountToPaise('(450.00)');
  console.assert(
    parenParsed === -45000,
    'CSV Self-test 2a failed: "(450.00)" should parse to -45000 signed paise'
  );
  const parenPlan = planImport(
    [{ Date: '15/11/2026', Narration: 'SWIGGY ORDER', Amount: '(450.00)' }],
    {
      dateColumn: 'Date',
      descriptionColumn: 'Narration',
      amountColumn: 'Amount',
      dateFormat: 'DD/MM/YYYY',
    },
    []
  );
  console.assert(
    parenPlan.valid.length === 1 &&
      parenPlan.valid[0].txType === 'expense' &&
      parenPlan.valid[0].amountPaise === 45000,
    'CSV Self-test 2b failed: "(450.00)" should plan an expense of 45000 paise'
  );

  // 3. Quoted fields with commas stay in one column
  const quotedCsv = 'Date,Description,Debit\n17/11/2026,"Coffee, Muffin & Tea",250.00';
  const parsedQuoted = parseCsv(quotedCsv, ',', 0);
  console.assert(
    parsedQuoted.rows.length === 1 &&
      parsedQuoted.rows[0].Description === 'Coffee, Muffin & Tea',
    'CSV Self-test 3 failed: Quoted field with comma should stay in one column'
  );

  // 4. A row with 31/02/2026 is rejected
  console.assert(
    parseDate('31/02/2026', 'DD/MM/YYYY') === null,
    'CSV Self-test 4 failed: 31/02/2026 should be rejected'
  );

  // 5. Importing the same rows twice adds nothing the second time
  const firstPlan = planImport(
    [{ Date: '17/11/2026', Narration: 'METRO PASS', Debit: '500.00', Credit: '' }],
    {
      dateColumn: 'Date',
      descriptionColumn: 'Narration',
      debitColumn: 'Debit',
      creditColumn: 'Credit',
      dateFormat: 'DD/MM/YYYY',
    },
    []
  );
  const keysAfterFirst = firstPlan.valid.map((item) => item.importKey);
  const secondPlan = planImport(
    [{ Date: '17/11/2026', Narration: 'METRO PASS', Debit: '500.00', Credit: '' }],
    {
      dateColumn: 'Date',
      descriptionColumn: 'Narration',
      debitColumn: 'Debit',
      creditColumn: 'Credit',
      dateFormat: 'DD/MM/YYYY',
    },
    keysAfterFirst
  );
  console.assert(
    secondPlan.valid.length === 0 && secondPlan.skippedDuplicates === 1,
    'CSV Self-test 5 failed: Re-importing same row must skip it as duplicate'
  );

  // 6. "SWIGGY ORDER" suggests Food
  console.assert(
    suggestCategory('SWIGGY ORDER') === 'Food',
    'CSV Self-test 6 failed: "SWIGGY ORDER" should suggest Food'
  );
}

runCsvImportSelfTests();
