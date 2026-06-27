import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function updateConfig() {
  const { data, error } = await supabase
    .from('coursera_config')
    .update({ total_licenses: 2000 })
    .eq('id', 1)
    .select();
    
  if (error) {
    console.error('Error updating config:', error);
  } else {
    console.log('Successfully updated config:', data);
  }
}

updateConfig();
