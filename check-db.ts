import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkDb() {
  const { data: prevMonthRow } = await supabase
    .from('coursera_snapshots')
    .select('snapshot_month')
    .lt('snapshot_month', '2026-04-30')
    .order('snapshot_month', { ascending: false })
    .limit(1)
    .single();

  console.log('prevMonth for April:', prevMonthRow);
  
  const { data: rpcData } = await supabase.rpc('get_prev_month_learner_totals', { p_month: prevMonthRow?.snapshot_month });
  
  console.log(`RPC rows: ${rpcData?.length}`);
  
  if (rpcData && rpcData.length > 0) {
    let totalPrevHours = 0;
    for (const row of rpcData) {
      totalPrevHours += Number(row.prev_hours);
    }
    console.log('Total prev hours in RPC:', totalPrevHours);
  }
}

checkDb();
