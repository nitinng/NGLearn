import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: 'ALTER TABLE public.coursera_config ADD COLUMN IF NOT EXISTS allow_global_data_view BOOLEAN NOT NULL DEFAULT TRUE;' });
  
  if (error) {
    console.error('RPC failed', error);
  } else {
    console.log('Success!', data);
  }
}
run();
