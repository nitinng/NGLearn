import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLS() {
  console.log('Testing anon read access...');
  const { data, error } = await supabase.from('coursera_import_log').select('*');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Success! Found ${data?.length} rows.`);
    if (data?.length === 0) {
      console.log('WARNING: The query succeeded but returned 0 rows. This strongly implies RLS is enabled and blocking read access for anon/authenticated users (or the table is empty).');
    }
  }
}

testRLS();
