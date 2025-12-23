import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());

// CRITICAL: Stripe webhook MUST come BEFORE express.json() to receive raw body
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || 'skip');
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📨 Received webhook event:', event.type);

  try {
    // Handle successful checkout
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const subscriptionId = session.subscription;
      
      console.log('💳 Payment successful for user:', userId);

      // Get the subscription to find the price ID
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0].price.id;

      // Map price ID to tier
      const priceToTier = {
        'price_1ShVJw4B9Z0lrxzSA6s0oSSY': 'basic',
        'price_1ShVKa4B9Z0lrxzSUJ9GAJ2e': 'pro',
        'price_1ShVLV4B9Z0lrxzShnjg62aP': 'unlimited'
      };

      const tier = priceToTier[priceId];
      
      if (!tier) {
        console.error('❌ Unknown price ID:', priceId);
        return res.status(400).send('Unknown price ID');
      }

      // Update user in Supabase
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const callsLimit = tier === 'basic' ? 15 : tier === 'pro' ? 50 : 999999;

      const { data, error } = await supabase
        .from('users')
        .update({
          subscription_tier: tier,
          subscription_status: 'active',
          calls_limit: callsLimit,
          stripe_customer_id: session.customer,
          stripe_subscription_id: subscriptionId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error updating user:', error);
        return res.status(500).send('Database error');
      }

      console.log('✅ User upgraded to:', tier);
    }

    // Handle subscription cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const { error } = await supabase
        .from('users')
        .update({
          subscription_tier: 'free',
          subscription_status: 'cancelled',
          calls_limit: 5,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (error) {
        console.error('❌ Error downgrading user:', error);
      } else {
        console.log('✅ User downgraded to free');
      }
    }

    res.json({received: true});
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).send('Webhook handler failed');
  }
});

// NOW add JSON parser for other routes
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔑 Vapi API Key: ${process.env.VAPI_API_KEY ? 'Connected' : 'Missing'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Connected' : 'Missing'}`);
  if (process.env.VAPI_PHONE_NUMBER_ID) {
    console.log(`📞 Vapi Phone Number ID: ${process.env.VAPI_PHONE_NUMBER_ID}`);
  } else {
    console.log(`⚠️  No VAPI_PHONE_NUMBER_ID set`);
  }
});