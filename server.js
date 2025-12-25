import express, { json, raw } from 'express';
import cors from 'cors';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(json());

// Check if API key exists
if (!process.env.VAPI_API_KEY) {
  console.error('❌ ERROR: VAPI_API_KEY not found in .env file!');
  process.exit(1);
}

// Test endpoint - check if server is running
app.get('/api/test', (req, res) => {
  res.json({
    status: 'Server is running!',
    vapiConnected: !!process.env.VAPI_API_KEY
  });
});

// Start a call with Vapi
app.post('/api/call/start', async (req, res) => {
  const { assistantId, phoneNumber } = req.body;
  
  console.log('📞 Attempting to start call...');
  console.log('Assistant ID:', assistantId);
  console.log('Phone Number:', phoneNumber);
  
  // Validate phone number format
  if (!phoneNumber || !phoneNumber.match(/^\+\d{10,15}$/)) {
    return res.status(400).json({
      success: false,
      error: 'Phone number must be in E.164 format (e.g., +15551234567)'
    });
  }

  try {
    const callPayload = {
      assistantId: assistantId,
      customer: {
        number: phoneNumber
      }
    };

    // If you have a Vapi phone number ID, add it
    if (process.env.VAPI_PHONE_NUMBER_ID) {
      callPayload.phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    }

    console.log('Sending to Vapi:', JSON.stringify(callPayload, null, 2));

    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callPayload)
    });

    const data = await response.json();
    
    console.log('Vapi Response:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      throw new Error(data.message || 'Failed to start call');
    }

    console.log('✅ Call started successfully!');
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error starting call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// End a call
app.post('/api/call/end', async (req, res) => {
  const { callId } = req.body;
  
  try {
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      }
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get list of assistants
app.get('/api/assistants', async (req, res) => {
  try {
    const response = await fetch('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      }
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =============================================================================
// VAPI WEBHOOK - Handles incoming call events from Vapi
// =============================================================================
app.post('/api/vapi-webhook', async (req, res) => {
  const event = req.body;

  console.log('📞 Vapi webhook received:', JSON.stringify(event, null, 2));
  console.log('Event type:', event.message?.type || event.type);
  console.log('🕐 Timestamp:', new Date().toISOString());

  try {
    // Import Supabase dynamically since we're using CommonJS
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Persona mapping
    const personas = [
      { id: '37c03d2d-c045-42f5-b8f5-53beca2b34d8', name: 'Herbert' },
      { id: '23ed87ac-9f1e-4353-a3aa-c27d70d93342', name: 'Jolene' },
      { id: 'd99eeb74-6dad-4149-ac33-e2c7bb0dba57', name: 'Derek' },
      { id: 'b2243844-0748-442f-b7c8-395b6f342e0f', name: 'Danny' }
    ];

    // Handle different webhook event types
    const eventType = event.message?.type || event.type;

    // CALL STARTED EVENT
    if (eventType === 'status-update' && event.message?.status === 'ringing') {
      console.log('🔔 Call is ringing...');
    }

    if (eventType === 'status-update' && event.message?.status === 'in-progress') {
      console.log('✅ Call started!');
      const callerNumber = event.message.call?.customer?.number;
      const receivedOnNumber = event.message.phoneNumber?.number;

      // Extract forwarded-from number from SIP Diversion header
      let userPhoneNumber = receivedOnNumber;
      const diversionHeader = event.message.call?.phoneCallProviderDetails?.sip?.headers?.Diversion;
      if (diversionHeader) {
        const match = diversionHeader.match(/sip:(\+\d+)@/);
        if (match && match[1]) {
          userPhoneNumber = match[1];
        }
      }

      console.log('📞 Spam call from:', callerNumber, 'forwarded from user cell:', userPhoneNumber, 'to Vapi number:', receivedOnNumber);

      if (userPhoneNumber) {
        // Find user by their cell number (the one that forwarded to Vapi)
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', userPhoneNumber)
          .single();

        if (user) {
          console.log('📝 Call started for user:', user.email);
        }
      }
    }

    // CALL ENDED EVENT - This is the main one for logging
    if (eventType === 'end-of-call-report') {
      const callData = event.message;
      const callerNumber = callData.call?.customer?.number; // The spammer's number
      const receivedOnNumber = callData.phoneNumber?.number; // Vapi number that answered
      const assistantId = callData.call?.assistantId;
      const duration = callData.call?.endedAt
        ? Math.floor((new Date(callData.call.endedAt) - new Date(callData.call.startedAt)) / 1000)
        : 0;

      // Extract the FORWARDED FROM number (user's cell) from SIP Diversion header
      let userPhoneNumber = receivedOnNumber; // Default to Vapi number

      console.log('🔍 DEBUG: Checking for Diversion header...');
      console.log('🔍 DEBUG: phoneCallProviderDetails exists?', !!callData.call?.phoneCallProviderDetails);
      console.log('🔍 DEBUG: sip exists?', !!callData.call?.phoneCallProviderDetails?.sip);
      console.log('🔍 DEBUG: headers exists?', !!callData.call?.phoneCallProviderDetails?.sip?.headers);

      const diversionHeader = callData.call?.phoneCallProviderDetails?.sip?.headers?.Diversion;
      console.log('🔍 DEBUG: Diversion header:', diversionHeader);

      if (diversionHeader) {
        // Parse Diversion header: "<sip:+16184224956@64.125.111.10:5060>;reason=unconditional..."
        const match = diversionHeader.match(/sip:(\+\d+)@/);
        if (match && match[1]) {
          userPhoneNumber = match[1]; // Extract the forwarded-from number
          console.log('📞 Call forwarded from user cell:', userPhoneNumber);
        } else {
          console.log('⚠️ DEBUG: Diversion header found but regex did not match');
        }
      } else {
        console.log('⚠️ DEBUG: No Diversion header found');
      }

      console.log('📝 Call received on Vapi number:', receivedOnNumber);
      console.log('📝 Call from spam number:', callerNumber);
      console.log('📝 User cell number (for lookup):', userPhoneNumber);
      console.log('Duration:', duration, 'seconds');

      // Find user by their CELL number (the one that forwarded to Vapi)
      // Use order by updated_at and limit(1) to handle duplicates gracefully
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('phone_number', userPhoneNumber)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (userError) {
        console.error('❌ Error looking up user:', userError);
      }

      const user = users && users.length > 0 ? users[0] : null;

      if (!user) {
        console.log('⚠️ User not found for phone number:', userPhoneNumber);
        console.log('📋 Tried to look up with phone_number =', userPhoneNumber);
        return res.json({ received: true, warning: 'User not found' });
      }

      console.log('✅ Found user:', user.email, 'ID:', user.id);

      // Check if user has calls remaining before logging
      if (user.calls_used_this_month >= user.calls_limit) {
        console.log('⚠️ User over limit but call was completed');
      }

      // Find which persona was used
      const persona = personas.find(p => p.id === assistantId);

      // Debug: Log what we're about to save
      console.log('📝 Recording URL:', callData.recordingUrl);
      console.log('📝 Transcript:', callData.transcript ? 'Present' : 'Missing');
      console.log('📝 Call data keys:', Object.keys(callData));

      // Log call to database (save the SPAMMER's number, not yours)
      const callLogEntry = {
        user_id: user.id,
        caller_phone_number: callerNumber, // The spammer's number
        agent_name: persona?.name || 'Unknown',
        agent_id: assistantId,
        call_duration: duration,
        call_status: 'completed',
        vapi_call_id: callData.call?.id,
        transcript: callData.transcript || null,
        recording_url: callData.recordingUrl || null
      };

      console.log('📝 Inserting call log:', JSON.stringify(callLogEntry, null, 2));

      const { data: logData, error: logError } = await supabase
        .from('call_logs')
        .insert([callLogEntry])
        .select();

      if (logError) {
        console.error('❌ Error logging call:', logError);
      } else {
        console.log('✅ Call logged successfully');
        console.log('📝 Inserted call log ID:', logData?.[0]?.id);
      }

      // Increment user's call counter
      console.log('📊 Current count before update:', user.calls_used_this_month);
      console.log('📊 Updating user ID:', user.id);

      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({
          calls_used_this_month: user.calls_used_this_month + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();

      if (updateError) {
        console.error('❌ Error updating call count:', updateError);
      } else {
        console.log('✅ Call count updated:', user.calls_used_this_month + 1, '/', user.calls_limit);
        console.log('📊 Updated data returned:', updateData);
      }
    }

    // TRANSCRIPT UPDATE (Real-time transcript chunks)
    if (eventType === 'transcript') {
      console.log('📝 Transcript chunk received');
    }

    // FUNCTION CALL (if you're using Vapi functions)
    if (eventType === 'function-call') {
      const functionName = event.message?.functionCall?.name;
      console.log('🔧 Function called:', functionName);

      // Check if caller is spam/unknown and route accordingly
      if (functionName === 'checkSpamAndRoute') {
        // Extract user's cell number from Diversion header
        let userPhoneNumber = event.message.phoneNumber?.number;
        const diversionHeader = event.message.call?.phoneCallProviderDetails?.sip?.headers?.Diversion;
        if (diversionHeader) {
          const match = diversionHeader.match(/sip:(\+\d+)@/);
          if (match && match[1]) {
            userPhoneNumber = match[1];
          }
        }

        const callerNumber = event.message.call?.customer?.number;
        const callerName = event.message.call?.customer?.name || '';

        console.log('🔍 Checking spam status for caller:', callerNumber, 'Name:', callerName);

        // Check if user is registered and has calls remaining
        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', userPhoneNumber)
          .single();

        if (!user) {
          console.log('⚠️ User not registered');
          return res.json({
            result: {
              isSpam: false,
              shouldTransfer: true,
              transferTo: userPhoneNumber,
              message: 'User not registered. Transferring call.'
            }
          });
        }

        if (user.calls_used_this_month >= user.calls_limit) {
          console.log('⚠️ User over call limit');
          return res.json({
            result: {
              isSpam: false,
              shouldTransfer: true,
              transferTo: userPhoneNumber,
              message: 'Call limit reached. Transferring to your phone.'
            }
          });
        }

        // Spam detection: Check if caller ID is Unknown, Unavailable, or blocked
        const isUnknown = !callerNumber ||
                         callerNumber === 'Unknown' ||
                         callerNumber === 'Unavailable' ||
                         callerNumber === 'Anonymous' ||
                         callerName.toLowerCase().includes('unknown') ||
                         callerName.toLowerCase().includes('unavailable') ||
                         callerName.toLowerCase().includes('spam') ||
                         callerName.toLowerCase().includes('scam');

        // Check user's blocked numbers list
        const blockedNumbers = user.blocked_numbers || [];
        const isBlocked = blockedNumbers.includes(callerNumber);

        const isSpam = isUnknown || isBlocked;

        console.log('📊 Spam check result:', {
          isSpam,
          isUnknown,
          isBlocked,
          callerNumber,
          callerName
        });

        if (isSpam) {
          // This is spam - let Herbert handle it
          return res.json({
            result: {
              isSpam: true,
              shouldTransfer: false,
              message: 'Spam detected. AI will handle this call.'
            }
          });
        } else {
          // Legitimate call - transfer to user's phone
          return res.json({
            result: {
              isSpam: false,
              shouldTransfer: true,
              transferTo: userPhoneNumber,
              message: 'Legitimate caller detected. Transferring to your phone.'
            }
          });
        }
      }

      // Example: Check if user is allowed to make calls
      if (functionName === 'checkCallAllowed') {
        // Extract forwarded-from number from SIP Diversion header
        let userPhoneNumber = event.message.phoneNumber?.number;
        const diversionHeader = event.message.call?.phoneCallProviderDetails?.sip?.headers?.Diversion;
        if (diversionHeader) {
          const match = diversionHeader.match(/sip:(\+\d+)@/);
          if (match && match[1]) {
            userPhoneNumber = match[1];
          }
        }

        const { data: user } = await supabase
          .from('users')
          .select('*')
          .eq('phone_number', userPhoneNumber)
          .single();

        if (!user) {
          return res.json({
            result: {
              allowed: false,
              message: 'Phone number not registered'
            }
          });
        }

        if (user.calls_used_this_month >= user.calls_limit) {
          return res.json({
            result: {
              allowed: false,
              message: 'Monthly call limit reached. Please upgrade your plan.'
            }
          });
        }

        return res.json({
          result: {
            allowed: true,
            callsRemaining: user.calls_limit - user.calls_used_this_month
          }
        });
      }
    }

    // Always respond with success to acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Vapi webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  const { priceId, userId, userEmail } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${req.headers.origin}/?success=true`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
      customer_email: userEmail,
      metadata: {
        userId: userId
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe webhook to handle successful payments
app.post('/api/stripe-webhook', raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Payment successful!', session);
    // You'll update the user's subscription in Supabase here
  }

  res.json({received: true});
});

// Debug endpoint to check user data and recent call logs
app.get('/api/debug/user/:phoneNumber', async (req, res) => {
  const { phoneNumber } = req.params;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Find user by phone number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (userError || !user) {
      return res.json({
        success: false,
        message: 'User not found',
        phoneNumber: phoneNumber,
        error: userError
      });
    }

    // Get recent call logs for this user
    const { data: callLogs, error: logsError } = await supabase
      .from('call_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone_number: user.phone_number,
        clerk_user_id: user.clerk_user_id,
        calls_used: user.calls_used_this_month,
        calls_limit: user.calls_limit,
        subscription_tier: user.subscription_tier
      },
      callLogs: callLogs || [],
      totalCalls: callLogs?.length || 0
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔑 Vapi API Key: ${process.env.VAPI_API_KEY ? 'Connected' : 'Missing'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Connected' : 'Missing'}`);
  console.log(`🌐 Webhook URL: http://localhost:${PORT}/api/vapi-webhook`);
  if (process.env.VAPI_PHONE_NUMBER_ID) {
    console.log(`📞 Vapi Phone Number ID: ${process.env.VAPI_PHONE_NUMBER_ID}`);
  } else {
    console.log(`⚠️  No VAPI_PHONE_NUMBER_ID set - you may need to add one`);
  }
});