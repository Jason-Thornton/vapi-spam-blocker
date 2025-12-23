// This is your backend server - it talks to Vapi securely
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔑 Vapi API Key: ${process.env.VAPI_API_KEY ? 'Connected' : 'Missing'}`);
  if (process.env.VAPI_PHONE_NUMBER_ID) {
    console.log(`📞 Vapi Phone Number ID: ${process.env.VAPI_PHONE_NUMBER_ID}`);
  } else {
    console.log(`⚠️  No VAPI_PHONE_NUMBER_ID set - you may need to add one`);
  }
});