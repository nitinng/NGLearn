// ============================================================
// Import Types
// ============================================================

export type ImportStatus = 'processing' | 'completed' | 'failed' | 'rolled_back';
export type ImportAction = 'created' | 'updated' | 'skipped' | 'failed';
export type ImportFileType = 'csv' | 'xlsx';

/**
 * Mirrors the `import_batches` table.
 */
export interface ImportBatch {
  id: string;
  file_name: string;
  file_type: ImportFileType;
  file_size: number | null;
  uploaded_by: string | null;  // auth.users UUID
  uploaded_by_name: string;
  uploaded_at: string;         // ISO timestamp
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  status: ImportStatus;
  notes: string | null;
}

/**
 * Mirrors the `import_batch_records` table.
 * One row per alumni per import attempt.
 */
export interface ImportBatchRecord {
  id: string;
  import_batch_id: string;
  alumni_email: string | null;  // null if the row completely failed before upsert
  action: ImportAction;
  status: 'success' | 'error';
  error_message: string | null;
  created_at: string;
}

/**
 * A single parsed row from a CSV/XLSX import file,
 * mapped using the GHAR column config before validation.
 */
export interface ParsedImportRow {
  email: string;
  name?: string;
  phone_number?: string;
  gender?: string;
  city?: string;
  state?: string;
  campus?: string;
  course?: string;
  entry_year?: number;
  technology_stack?: string;
  donor?: string;
  cycle?: string;
  company?: string;
  starting_position?: string;
  starting_salary?: number;
  month_of_placement?: string;
  year_of_placement?: number;
  linkedin_profile?: string;
  status?: string;
  dropout_date?: string;
  reason?: string;
  // Validation result — populated during import-validator pass
  _valid?: boolean;
  _errors?: string[];
}

/**
 * The GHAR column map config shape (from ghar-column-map.json).
 * Keys are alumni_master DB column names.
 * Values are the exact column header strings in the GHAR export file.
 */
export type GharColumnMap = Partial<Record<keyof Omit<ParsedImportRow, '_valid' | '_errors'>, string>>;

/**
 * Summary returned after a preview parse (no DB writes).
 */
export interface ImportPreviewResult {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview: ParsedImportRow[];   // First 50 rows with validation results
  errors: { row: number; email: string; errors: string[] }[];
}

/**
 * Summary returned after a completed import process.
 */
export interface ImportProcessResult {
  batch_id: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  status: ImportStatus;
  errors: { email: string; error: string }[];
}
