import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkMappings() {
  console.log('📞 Checking phone number to user mappings...\n');

  const { data: users } = await supabase
    .from('users')
    .select('id, email, phone_number, calls_used_this_month')
    .order('email');

  const phoneMap = {};

  users.forEach(u => {
    if (u.phone_number) {
      if (!phoneMap[u.phone_number]) {
        phoneMap[u.phone_number] = [];
      }
      phoneMap[u.phone_number].push(u);
    }
  });

  console.log('Phone number assignments:\n');
  Object.keys(phoneMap).forEach(phone => {
    const usersWithPhone = phoneMap[phone];
    if (usersWithPhone.length > 1) {
      console.log(`⚠️  ${phone} - DUPLICATE! (${usersWithPhone.length} users)`);
    } else {
      console.log(`✅ ${phone}`);
    }
    usersWithPhone.forEach(u => {
      console.log(`   → ${u.email} (${u.calls_used_this_month} calls)`);
      console.log(`      User ID: ${u.id}`);
    });
    console.log('');
  });

  console.log('\n🔍 Checking recent call user ID...');
  const { data: recentCall } = await supabase
    .from('call_logs')
    .select('user_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Most recent call went to user ID:', recentCall.user_id);

  const userForCall = users.find(u => u.id === recentCall.user_id);
  console.log('Which is:', userForCall.email);
  console.log('Their phone number:', userForCall.phone_number);
}

checkMappings();
