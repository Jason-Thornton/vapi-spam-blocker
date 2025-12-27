import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRecent() {
  console.log('🔍 Checking all recent calls (last 24 hours)...\n');

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: calls } = await supabase
    .from('call_logs')
    .select('*')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false });

  console.log(`Found ${calls.length} calls in last 24 hours:\n`);

  calls.forEach(call => {
    const createdAt = new Date(call.created_at);
    const timeAgo = Math.floor((Date.now() - createdAt.getTime()) / 1000 / 60);
    console.log(`${call.agent_name} vs ${call.caller_phone_number}`);
    console.log(`  Created: ${createdAt.toString()} (${timeAgo} min ago)`);
    console.log(`  User ID: ${call.user_id}`);
    console.log('');
  });

  console.log('\n📊 Checking users table for call counts...\n');

  const { data: users } = await supabase
    .from('users')
    .select('email, calls_used_this_month, updated_at')
    .order('updated_at', { ascending: false });

  users.forEach(u => {
    const updatedAt = new Date(u.updated_at);
    const timeAgo = Math.floor((Date.now() - updatedAt.getTime()) / 1000 / 60);
    console.log(`${u.email}: ${u.calls_used_this_month} calls (updated ${timeAgo} min ago)`);
  });
}

checkRecent();
