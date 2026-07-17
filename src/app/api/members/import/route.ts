import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const supabase = createAdminClient();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Normalize columns — support various casings
    const normalizeKey = (key: string) => key.toLowerCase().replace(/\s+/g, '_');
    const normalized = rows.map((row) => {
      const entry: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        entry[normalizeKey(k)] = String(v).trim();
      }
      return entry;
    });

    // Map to ng_members shape and track skipped
    const skippedDetails: { reason: string; email?: string }[] = [];
    const members: any[] = [];
    
    normalized.forEach((row) => {
      if (!row.email || !row.full_name && !row.name) {
        skippedDetails.push({ reason: 'Missing email or full name', email: row.email });
        return;
      }
      
      members.push({
        email: row.email.toLowerCase().trim(),
        alt_email: row.alt_email_id || row.alt_email || row['alt_email_id'] || row['alt email id'] || row['alt email'] || null,
        full_name: row.full_name || row.name || '',
        team: row.team || null,
        group_name: row.group || row.group_name || null,
        updated_at: new Date().toISOString(),
      });
    });

    // Deduplicate members by email to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueMembersMap = new Map();
    for (const member of members) {
      if (uniqueMembersMap.has(member.email)) {
        skippedDetails.push({ reason: 'Duplicate email in CSV', email: member.email });
      }
      uniqueMembersMap.set(member.email, member);
    }
    const uniqueMembers = Array.from(uniqueMembersMap.values());

    const skipped = skippedDetails.length;

    if (uniqueMembers.length === 0) {
      return NextResponse.json({
        error: 'No valid rows found. Ensure columns are: Full Name, Email, Alt Email (optional), Team, Group',
      }, { status: 400 });
    }

    // Upsert — update existing by email, insert new
    const { error: upsertError } = await supabase
      .from('ng_members')
      .upsert(uniqueMembers, { onConflict: 'email', ignoreDuplicates: false });

    if (upsertError) {
      await supabase.from('ng_members_import_log').insert({
        filename: file.name,
        rows_imported: 0,
        rows_skipped: skipped,
        action: 'import',
        status: 'error',
        error_message: upsertError.message,
        duration_ms: Date.now() - start,
      });
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Log success
    await supabase.from('ng_members_import_log').insert({
      filename: file.name,
      rows_imported: uniqueMembers.length,
      rows_skipped: skipped,
      action: 'import',
      status: 'success',
      duration_ms: Date.now() - start,
    });

    return NextResponse.json({
      success: true,
      rowsImported: uniqueMembers.length,
      rowsSkipped: skipped,
      skippedDetails,
    });
  } catch (err: any) {
    await supabase.from('ng_members_import_log').insert({
      action: 'import',
      status: 'error',
      error_message: err.message,
      duration_ms: Date.now() - start,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
