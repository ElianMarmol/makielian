import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cvhqavwvolazynnvvlrw.supabase.co';
const supabaseKey = 'sb_publishable_qod2Vd1QjC7Kf8OpIWKNtw_hEJKh1GZ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data, error } = await supabase.from('adventures').select('*');
  console.log(JSON.stringify(data, null, 2));
}

checkDb();
