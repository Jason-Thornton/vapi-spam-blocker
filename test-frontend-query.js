import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Use ANON key like the frontend does
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY  // Frontend key!
);

async function testFrontendAccess() {
  console.log('🔍 Testing frontend (anon key) access...\n');

  const userId = '4ce36bbd-ce05-420d-982d-491b49585086'; // Jason's user ID

  // Try to fetch calls like the frontend does
  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ ERROR accessing call_logs with anon key:');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    console.error('   Details:', error.details);
    console.error('\n🔒 This means RLS (Row Level Security) is blocking the frontend!');
    console.error('   You need to add RLS policies to allow users to read their own call_logs.');
  } else {
    console.log('✅ Successfully fetched', calls.length, 'calls with anon key');
    console.log('   Frontend should be working!');
  }
}

testFrontendAccess().catch(console.error);
