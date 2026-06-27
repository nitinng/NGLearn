import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { error } = await adminClient.rpc('exec_sql', { query: "ALTER TABLE public.coursera_metrics ADD COLUMN IF NOT EXISTS total_learning_hours NUMERIC NOT NULL DEFAULT 0;" });
  if (error) {
    console.error('Error running exec_sql, trying raw query...', error);
    // Let's just create a raw sql function in supabase if exec_sql doesn't exist, but it might not.
  } else {
    console.log('Success!');
  }
}

main().catch(console.error);
