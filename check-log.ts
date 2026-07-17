import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkLog() {
  const { data, error } = await supabase.from('coursera_import_log').select('*');
  if (error) {
    console.error('Error fetching log:', error.message);
  } else {
    console.log('coursera_import_log rows:', data.length);
    console.log(data);
  }
}

checkLog();
