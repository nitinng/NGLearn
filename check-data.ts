import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchema() {
  const { data: mData } = await supabase.from('coursera_computed_metrics').select('*').limit(2);
  console.log('coursera_computed_metrics:', mData);

  const { data: sData } = await supabase.from('coursera_snapshots').select('*').limit(2);
  console.log('coursera_snapshots:', sData);
}

checkSchema();
