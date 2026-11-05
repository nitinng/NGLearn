import ExcelJS from 'exceljs';

export interface CohortMemberInput {
  full_name: string | null;
  email: string;
}

export interface ParsedCohortSheet {
  sheet: string;
  members: CohortMemberInput[];
  invalidRows: number;
  duplicateRows: number;
}

const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
export const MAX_COHORT_MEMBERS = 5000;

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map(r => r.text).join('');
    if ('text' in v && typeof (v as { text: unknown }).text === 'string') return (v as { text: string }).text;
    if ('hyperlink' in v) return String((v as { hyperlink: string }).hyperlink).replace(/^mailto:/i, '');
    if ('result' in v) return text((v as { result: ExcelJS.CellValue }).result);
  }
  return '';
}

export function normaliseMembers(rows: { full_name?: string | null; email?: string | null }[]): {
  members: CohortMemberInput[];
  invalidRows: number;
  duplicateRows: number;
} {
  const seen = new Map<string, CohortMemberInput>();
  let invalidRows = 0;
  let duplicateRows = 0;
  for (const r of rows) {
    const email = String(r.email ?? '').match(EMAIL_RE)?.[0]?.toLowerCase();
    if (!email) {
      invalidRows++;
      continue;
    }
    // Template example rows use the reserved example.org domain.
    if (email.endsWith('@example.org')) continue;
    const full_name = String(r.full_name ?? '').trim() || null;
    const prev = seen.get(email);
    if (prev) {
      duplicateRows++;
      prev.full_name ??= full_name;
      continue;
    }
    seen.set(email, { email, full_name });
  }
  return { members: [...seen.values()], invalidRows, duplicateRows };
}

/**
 * Reads every non-empty sheet as one cohort list. Columns are found by header:
 * any header containing "email" is the email, any containing "name" is the
 * full name (e.g. "Full Name", "NG email ID"). Without headers, the first cell
 * that looks like an email is used.
 */
export async function parseCohortWorkbook(buffer: ArrayBuffer): Promise<ParsedCohortSheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const out: ParsedCohortSheet[] = [];

  for (const ws of wb.worksheets) {
    if (ws.actualRowCount === 0) continue;
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => {
      headers[col] = text(c.value).trim().toLowerCase();
    });
    const emailCol = headers.findIndex(h => h?.includes('email') || h?.includes('e-mail'));
    const nameCol = headers.findIndex((h, i) => i !== emailCol && h?.includes('name'));
    const hasHeader = emailCol > 0;

    const rows: { full_name: string | null; email: string | null }[] = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      if (n === 1 && hasHeader) return;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (c, col) => {
        cells[col] = text(c.value).trim();
      });
      if (!cells.some(Boolean)) return;
      const email = hasHeader ? cells[emailCol] : cells.find(c => c && EMAIL_RE.test(c)) ?? null;
      const name = nameCol > 0 ? cells[nameCol] : cells.find(c => c && !EMAIL_RE.test(c)) ?? null;
      rows.push({ email: email || null, full_name: name || null });
    });

    const parsed = normaliseMembers(rows);
    // Sheets without any real emails (e.g. an Instructions sheet) are skipped.
    if (parsed.members.length) out.push({ sheet: ws.name, ...parsed });
  }
  return out;
}
