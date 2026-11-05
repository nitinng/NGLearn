import { headerNames, loadWorkbook, sheetToObjects } from './excel';
import { MAX_COHORT_MEMBERS } from './constants';

export interface ParsedMember {
  email: string;
  alt_email: string | null;
  name: string | null;
}

export interface ParsedMemberList {
  members: ParsedMember[];
  invalid: string[];   // lines/rows with no usable email
  duplicates: number;
}

const EMAIL_RE = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const EMAIL_HEADERS = ['email', 'email id', 'email address', 'e-mail', 'mail', 'email_id'];
const ALT_HEADERS = ['alt email', 'alternate email', 'alt_email', 'coursera email', 'personal email', 'secondary email'];
const NAME_HEADERS = ['name', 'full name', 'full_name', 'student name', 'learner name'];

function finalise(list: ParsedMember[], invalid: string[]): ParsedMemberList {
  const seen = new Map<string, ParsedMember>();
  let duplicates = 0;
  for (const m of list) {
    if (m.alt_email === m.email) m.alt_email = null;
    const prev = seen.get(m.email);
    if (prev) {
      duplicates++;
      prev.alt_email ??= m.alt_email;
      prev.name ??= m.name;
    } else {
      seen.set(m.email, m);
    }
  }
  const members = [...seen.values()];
  if (members.length > MAX_COHORT_MEMBERS) {
    throw new Error(`A cohort can have at most ${MAX_COHORT_MEMBERS.toLocaleString()} members.`);
  }
  return { members, invalid, duplicates };
}

/**
 * Pasted text or CSV: one person per line. The first email on a line is their
 * main email, a second email is treated as the alternate (e.g. Coursera) email,
 * and any remaining text is the name.
 */
export function parseMemberText(text: string): ParsedMemberList {
  const out: ParsedMember[] = [];
  const invalid: string[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const emails = (line.match(EMAIL_RE) ?? []).map(e => e.toLowerCase());
    if (!emails.length) {
      // Skip a CSV header row silently.
      if (i === 0 && /e-?mail/i.test(line)) continue;
      invalid.push(line.slice(0, 120));
      continue;
    }
    const rest = line
      .replace(EMAIL_RE, ' ')
      .split(/[,;\t|]/)
      .map(s => s.replace(/^["'\s]+|["'\s]+$/g, ''))
      .filter(Boolean)
      .join(' ')
      .trim();
    out.push({ email: emails[0], alt_email: emails[1] ?? null, name: rest || null });
  }
  return finalise(out, invalid);
}

export async function parseMemberWorkbook(buffer: ArrayBuffer): Promise<ParsedMemberList> {
  const wb = await loadWorkbook(buffer);
  const sheet = wb.worksheets.find(s => s.actualRowCount > 0);
  if (!sheet) throw new Error('The workbook is empty.');

  const headers = headerNames(sheet);
  const find = (cands: string[]) => headers.find(h => cands.includes(h.toLowerCase()));
  const emailCol = find(EMAIL_HEADERS);
  if (!emailCol) throw new Error(`No "Email" column found. Columns: ${headers.join(', ')}`);
  const altCol = find(ALT_HEADERS);
  const nameCol = find(NAME_HEADERS);

  const out: ParsedMember[] = [];
  const invalid: string[] = [];
  for (const row of sheetToObjects(sheet)) {
    const email = String(row[emailCol] ?? '').match(EMAIL_RE)?.[0]?.toLowerCase();
    if (!email) {
      invalid.push(Object.values(row).filter(v => v !== null).join(', ').slice(0, 120));
      continue;
    }
    const alt = altCol ? String(row[altCol] ?? '').match(EMAIL_RE)?.[0]?.toLowerCase() ?? null : null;
    const name = nameCol && row[nameCol] != null ? String(row[nameCol]).trim() || null : null;
    out.push({ email, alt_email: alt, name });
  }
  return finalise(out, invalid);
}
