import type { ParsedImportRow } from '@/types/import';

const VALID_STATUSES = [
  'Active',
  'Placed',
  'DropOut',
  'Intern (Out Campus)',
  'Intern (In Campus)',
  'Completed',
  'Completed-Opted out for placement',
  'InActive',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a single parsed import row.
 * Returns the row with _valid and _errors fields populated.
 */
export function validateImportRow(row: ParsedImportRow): ParsedImportRow {
  const errors: string[] = [];

  // email is the PK — required and must be well-formed
  if (!row.email) {
    errors.push('email is required');
  } else if (!EMAIL_RE.test(row.email.trim())) {
    errors.push(`email "${row.email}" is not a valid email address`);
  }

  if (row.status && !VALID_STATUSES.includes(row.status)) {
    errors.push(
      `status "${row.status}" is not valid. Must be one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  if (row.entry_year !== undefined) {
    const y = Number(row.entry_year);
    if (isNaN(y) || y < 2000 || y > new Date().getFullYear() + 1) {
      errors.push(`entry_year "${row.entry_year}" is out of range`);
    }
  }

  if (row.year_of_placement !== undefined) {
    const y = Number(row.year_of_placement);
    if (isNaN(y) || y < 2000 || y > new Date().getFullYear() + 1) {
      errors.push(`year_of_placement "${row.year_of_placement}" is out of range`);
    }
  }

  if (row.starting_salary !== undefined && isNaN(Number(row.starting_salary))) {
    errors.push(`starting_salary "${row.starting_salary}" is not a valid number`);
  }

  return { ...row, _valid: errors.length === 0, _errors: errors };
}

/**
 * Validates all rows in a parsed import batch.
 */
export function validateImportRows(rows: ParsedImportRow[]): ParsedImportRow[] {
  return rows.map(validateImportRow);
}
