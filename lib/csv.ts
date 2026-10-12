/**
 * Safely escapes and sanitizes a cell value for CSV export.
 * Mitigates Formula Injection (CSV Injection) attacks where spreadsheet formulas
 * starting with '=', '+', '-', '@', '\t', '\r' execute arbitrary code in Excel/Sheets.
 */
export function sanitizeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);

  // Protect against formula injection by prefixing risky leading characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Replace internal double quotes with escaped double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

