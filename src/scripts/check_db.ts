import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await adminClient.from('coursera_activity').select('id, email, course_name').limit(5);
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  console.log('Sample:', data);
}

main().catch(console.error);
