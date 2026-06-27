import { createAdminClient } from '@/lib/supabase/admin';
import { setAuditContext } from '@/lib/audit';
import type { ParsedImportRow, ImportProcessResult } from '@/types/import';

/**
 * Processes a validated set of import rows into the database.
 *
 * For each row:
 *  - UPSERTs alumni_master ON CONFLICT(email)
 *  - Detects created vs updated via xmax
 *  - Writes an import_batch_records row
 *  - Updates import_batches counters on completion
 *
 * Uses the service-role client — bypasses RLS.
 * Audit log entries are written automatically by the DB trigger.
 */
export async function processImportRows(
  rows: ParsedImportRow[],
  batchId: string,
  uploader: { id: string; name: string; role: string }
): Promise<ImportProcessResult> {
  const supabaseAdmin = createAdminClient();

  // Set audit context so the trigger captures the importer's identity
  await setAuditContext(supabaseAdmin, uploader.name, 'IMPORT');

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  const validRows = rows.filter((r) => r._valid);
  const batchRecords: object[] = [];

  for (const row of validRows) {
    try {
      const { data, error } = await supabaseAdmin
        .from('alumni_master')
        .upsert(
          {
            email:               row.email.trim().toLowerCase(),
            name:                row.name,
            phone_number:        row.phone_number,
            gender:              row.gender,
            city:                row.city,
            state:               row.state,
            campus:              row.campus,
            course:              row.course,
            entry_year:          row.entry_year,
            technology_stack:    row.technology_stack,
            donor:               row.donor || null,
            cycle:               row.cycle,
            company:             row.company,
            starting_position:   row.starting_position,
            starting_salary:     row.starting_salary,
            month_of_placement:  row.month_of_placement,
            year_of_placement:   row.year_of_placement,
            linkedin_profile:    row.linkedin_profile,
            status:              row.status || null,
            dropout_date:        row.dropout_date || null,
            reason:              row.reason,
            import_batch_id:     batchId,
          },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        .select('email, xmax')
        .single();

      if (error) throw new Error(error.message);

      // xmax = 0 → INSERT (created); xmax ≠ 0 → UPDATE (updated)
      const wasInsert = (data as any).xmax === '0';
      const action = wasInsert ? 'created' : 'updated';
      wasInsert ? created++ : updated++;

      batchRecords.push({
        import_batch_id: batchId,
        alumni_email:    row.email.trim().toLowerCase(),
        action,
        status:          'success',
      });
    } catch (err: any) {
      failed++;
      errors.push({ email: row.email, error: err.message });
      batchRecords.push({
        import_batch_id: batchId,
        alumni_email:    row.email?.trim().toLowerCase() ?? null,
        action:          'failed',
        status:          'error',
        error_message:   err.message,
      });
    }
  }

  // Log skipped (invalid) rows
  for (const row of rows.filter((r) => !r._valid)) {
    batchRecords.push({
      import_batch_id: batchId,
      alumni_email:    row.email?.trim().toLowerCase() ?? null,
      action:          'skipped',
      status:          'error',
      error_message:   (row._errors ?? []).join('; '),
    });
  }

  // Write all batch records
  if (batchRecords.length > 0) {
    await supabaseAdmin.from('import_batch_records').insert(batchRecords);
  }

  const finalStatus = failed === validRows.length && validRows.length > 0 ? 'failed' : 'completed';

  // Update the import_batches row with final counters
  await supabaseAdmin
    .from('import_batches')
    .update({
      records_processed: rows.length,
      records_created:   created,
      records_updated:   updated,
      records_failed:    failed + rows.filter((r) => !r._valid).length,
      status:            finalStatus,
    })
    .eq('id', batchId);

  return {
    batch_id:          batchId,
    records_processed: rows.length,
    records_created:   created,
    records_updated:   updated,
    records_failed:    failed,
    status:            finalStatus,
    errors,
  };
}
