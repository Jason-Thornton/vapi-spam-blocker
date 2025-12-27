import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function verify() {
  const { data } = await supabase
    .from('call_logs')
    .select('*')
    .eq('user_id', '4ce36bbd-ce05-420d-982d-491b49585086')
    .limit(1)
    .single();

  console.log('Sample call log structure:');
  console.log(JSON.stringify(data, null, 2));
}

verify();
