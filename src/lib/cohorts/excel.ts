import ExcelJS from 'exceljs';

export type CellPrimitive = string | number | boolean | Date | null;

/** Flattens ExcelJS cell values (rich text, hyperlinks, formulas) to a primitive. */
export function cellToPrimitive(value: ExcelJS.CellValue): CellPrimitive {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(r => r.text).join('');
    }
    if ('hyperlink' in value) {
      const text = (value as { text?: unknown }).text;
      if (typeof text === 'string') return text;
      if (text && typeof text === 'object' && 'richText' in text) {
        return (text as { richText: { text: string }[] }).richText.map(r => r.text).join('');
      }
      return String((value as { hyperlink: string }).hyperlink);
    }
    if ('result' in value) {
      return cellToPrimitive((value as { result: ExcelJS.CellValue }).result);
    }
    if ('error' in value) return null;
  }
  return String(value);
}

export async function loadWorkbook(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

/**
 * Reads a worksheet into objects keyed by the (trimmed) header text of row 1.
 * Fully empty rows are skipped.
 */
export function sheetToObjects(sheet: ExcelJS.Worksheet): Record<string, CellPrimitive>[] {
  const headerRow = sheet.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const v = cellToPrimitive(cell.value);
    headers[col] = v === null ? null : String(v).trim();
  });

  const out: Record<string, CellPrimitive>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, CellPrimitive> = {};
    let hasData = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cellToPrimitive(cell.value);
      if (v !== null && v !== '') hasData = true;
      obj[key] = v;
    });
    if (hasData) out.push(obj);
  });
  return out;
}

export function headerNames(sheet: ExcelJS.Worksheet): string[] {
  const names: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: false }, cell => {
    const v = cellToPrimitive(cell.value);
    if (v !== null) names.push(String(v).trim());
  });
  return names;
}
