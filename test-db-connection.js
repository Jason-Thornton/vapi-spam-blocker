// Quick test to verify database connection and user registration
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  // Test 1: List all users
  console.log('📋 Fetching all users...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, phone_number, subscription_tier, calls_used_this_month, calls_limit')
    .limit(10);

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
  } else {
    console.log(`✅ Found ${users.length} users:\n`);
    users.forEach(user => {
      console.log(`  📧 ${user.email}`);
      console.log(`     Phone: ${user.phone_number || 'NOT SET ❌'}`);
      console.log(`     Plan: ${user.subscription_tier}`);
      console.log(`     Calls: ${user.calls_used_this_month}/${user.calls_limit}`);
      console.log('');
    });
  }

  // Test 2: Check for registered phone numbers
  console.log('\n📱 Checking phone number registrations...');
  const { data: withPhone, error: phoneError } = await supabase
    .from('users')
    .select('email, phone_number')
    .not('phone_number', 'is', null);

  if (phoneError) {
    console.error('❌ Error:', phoneError);
  } else {
    if (withPhone.length === 0) {
      console.log('⚠️  NO USERS HAVE REGISTERED PHONE NUMBERS!');
      console.log('   This is why calls are not being saved.');
      console.log('   Users need to go to Settings and save their phone number.');
    } else {
      console.log(`✅ ${withPhone.length} user(s) have phone numbers registered:`);
      withPhone.forEach(u => {
        console.log(`   ${u.email} → ${u.phone_number}`);
      });
    }
  }

  // Test 3: Check call logs
  console.log('\n📞 Checking call logs...');
  const { data: callLogs, error: logsError } = await supabase
    .from('call_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logsError) {
    console.error('❌ Error fetching call logs:', logsError);
  } else {
    if (callLogs.length === 0) {
      console.log('⚠️  No call logs found');
      console.log('   Either no calls have been made, or users don\'t have phone numbers registered.');
    } else {
      console.log(`✅ Found ${callLogs.length} recent calls:`);
      callLogs.forEach(log => {
        console.log(`   ${log.created_at}: ${log.agent_name} handled ${log.caller_phone_number}`);
        console.log(`      Duration: ${log.call_duration}s`);
        console.log(`      Recording: ${log.recording_url ? '✅ Yes' : '❌ No'}`);
      });
    }
  }

  console.log('\n✅ Test complete!');
}

testConnection().catch(console.error);
