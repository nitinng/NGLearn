import * as XLSX from 'xlsx';
import type { GharColumnMap, ParsedImportRow } from '@/types/import';
import columnMap from './ghar-column-map.json';

const defaultColumnMap = columnMap as GharColumnMap;

/**
 * Parses a CSV or XLSX file buffer into an array of ParsedImportRow objects.
 * Uses the GHAR column map to translate export headers → DB field names.
 *
 * @param buffer   Raw file bytes
 * @param fileType 'csv' | 'xlsx'
 * @param map      Optional column map override (defaults to ghar-column-map.json)
 */
export function parseImportFile(
  buffer: ArrayBuffer,
  fileType: 'csv' | 'xlsx',
  map: GharColumnMap = defaultColumnMap
): ParsedImportRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false,
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  // Invert the map: GHAR header → DB field name
  const headerToField = Object.entries(map).reduce<Record<string, string>>(
    (acc, [dbField, gharHeader]) => {
      if (gharHeader) acc[gharHeader.trim().toLowerCase()] = dbField;
      return acc;
    },
    {}
  );

  return rawRows.map((raw) => {
    const row: Partial<ParsedImportRow> = {};

    for (const [rawHeader, rawValue] of Object.entries(raw)) {
      const dbField = headerToField[rawHeader.trim().toLowerCase()];
      if (!dbField) continue;
      const value = String(rawValue).trim();

      switch (dbField) {
        case 'entry_year':
        case 'year_of_placement':
          row[dbField as 'entry_year' | 'year_of_placement'] = value ? parseInt(value, 10) : undefined;
          break;
        case 'starting_salary':
          row.starting_salary = value ? parseFloat(value.replace(/[^0-9.]/g, '')) : undefined;
          break;
        default:
          (row as any)[dbField] = value || undefined;
      }
    }

    return row as ParsedImportRow;
  });
}
