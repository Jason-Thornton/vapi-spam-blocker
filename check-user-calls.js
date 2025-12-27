import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkUserCalls() {
  // Get the user
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'jason.thornton.dev@gmail.com')
    .single();

  console.log('👤 User:', user.email);
  console.log('🆔 User ID:', user.id);
  console.log('🔑 Clerk User ID:', user.clerk_user_id);
  console.log('📞 Phone:', user.phone_number);
  console.log('📊 Calls used:', user.calls_used_this_month, '/', user.calls_limit);
  console.log('');

  // Get calls for this user
  const { data: calls, error } = await supabase
    .from('call_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  console.log('📞 Call logs query:');
  console.log('   Looking for user_id:', user.id);
  console.log('   Found:', calls?.length || 0, 'calls');

  if (error) {
    console.error('❌ Error:', error);
  }

  if (calls && calls.length > 0) {
    console.log('\n✅ Calls in database:');
    calls.forEach((call, idx) => {
      console.log(`\n${idx + 1}. ${call.agent_name} vs ${call.caller_phone_number}`);
      console.log(`   ID: ${call.id}`);
      console.log(`   User ID: ${call.user_id}`);
      console.log(`   Duration: ${call.call_duration}s`);
      console.log(`   Recording: ${call.recording_url || 'None'}`);
      console.log(`   Created: ${call.created_at}`);
    });
  } else {
    console.log('\n⚠️ No calls found for this user_id');
    console.log('Checking if calls exist with different user_id...');

    const { data: allCalls } = await supabase
      .from('call_logs')
      .select('user_id, agent_name, caller_phone_number, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\nRecent calls (any user):');
    allCalls.forEach(c => {
      console.log(`  User ID: ${c.user_id}, Agent: ${c.agent_name}, From: ${c.caller_phone_number}`);
    });
  }
}

checkUserCalls().catch(console.error);
