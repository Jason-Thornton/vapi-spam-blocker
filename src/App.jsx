import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Settings, User, List, PlayCircle, Shield, CheckCircle, XCircle, CreditCard, Zap } from 'lucide-react';
import { ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import { supabase } from './lib/supabase';
import stripePromise from './lib/stripe';

// Get Clerk publishable key from environment
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// AI Personas data
const personas = [
  {
    id: 'persona-1',
    name: 'Herbert',
    description: 'Friendly elderly gentleman who rambles',
    avatar: '👴',
    vapiAssistantId: '37c03d2d-c045-42f5-b8f5-53beca2b34d8',
    vapiPhoneNumber: '+1(618)352-8320',
    personality: 'rambling, friendly, storytelling',
    tier: 'free'
  },
  {
    id: 'persona-2',
    name: 'Jolene',
    description: 'Sweet but incredibly talkative',
    avatar: '🧑',
    vapiAssistantId: '23ed87ac-9f1e-4353-a3aa-c27d70d93342',
    vapiPhoneNumber: '+1(618)352-8316',
    personality: 'talkative, sweet, never stops chatting',
    tier: 'basic'
  },
  {
    id: 'persona-3',
    name: 'Derek',
    description: 'Cryptocurrency day-trader and amateur conspiracy researcher',
    avatar: '👔',
    vapiAssistantId: 'd99eeb74-6dad-4149-ac33-e2c7bb0dba57',
    vapiPhoneNumber: '+1(815)426-4287',
    personality: 'crypto-obsessed, conspiracy theories, suspicious',
    tier: 'basic'
  },
  {
    id: 'persona-4',
    name: 'Danny',
    description: 'Aspiring standup comedian who works at a call center',
    avatar: '🤖',
    vapiAssistantId: 'b2243844-0748-442f-b7c8-395b6f342e0f',
    vapiPhoneNumber: '+1(813)809-2181',
    personality: 'jokes around, makes awkward comedy attempts',
    tier: 'basic'
  }
];

// Subscription tiers with Stripe Price IDs
const subscriptionTiers = {
  free: { name: 'Free', price: 0, calls: 5, agents: 1, priceId: null },
  basic: { name: 'Basic', price: 1.99, calls: 15, agents: 4, priceId: 'price_1ShVJw4B9Z0lrxzSA6s0oSSY' },
  pro: { name: 'Pro', price: 4.99, calls: 50, agents: 4, priceId: 'price_1ShVKa4B9Z0lrxzSUJ9GAJ2e' },
  unlimited: { name: 'Unlimited', price: 9.99, calls: Infinity, agents: 4, priceId: 'price_1ShVLV4B9Z0lrxzShnjg62aP' }
};

function MainApp() {
  const { user, isLoaded } = useUser();
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    autoBlock: true,
    recordCalls: true,
    blockRobocalls: true,
    blockScammers: true,
    blockTelemarketing: true,
    notifications: true,
    callForwarding: false
  });
  const [calls, setCalls] = useState([]);
  const [activeCall, setActiveCall] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // API URL - works in both dev and production
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Handle Stripe checkout
  const handleUpgrade = async (tier) => {
    if (tier === 'free') {
      alert('To downgrade, please contact support.');
      return;
    }

    setCheckoutLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: subscriptionTiers[tier].priceId,
          userId: userProfile.id,
          userEmail: user.primaryEmailAddress?.emailAddress
        })
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Check server connection
  useEffect(() => {
    fetch(`${API_URL}/api/test`)
      .then(res => res.json())
      .then(data => {
        setServerStatus(data.vapiConnected ? 'connected' : 'disconnected');
      })
      .catch(() => setServerStatus('disconnected'));
  }, []);

  // Create or fetch user profile from Supabase
  useEffect(() => {
    if (isLoaded && user) {
      fetchOrCreateUserProfile();
    }
  }, [isLoaded, user]);

  const fetchOrCreateUserProfile = async () => {
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_user_id', user.id)
        .single();

      if (existingUser) {
        setUserProfile(existingUser);
        setSelectedPersona(personas.find(p => p.id === existingUser.selected_agent_id));
        
        // Fetch user's call logs
        const { data: callLogs } = await supabase
          .from('call_logs')
          .select('*')
          .eq('user_id', existingUser.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (callLogs) {
          setCalls(callLogs.map(log => ({
            id: log.id,
            number: log.caller_phone_number,
            duration: log.call_duration ? `${log.call_duration}s` : '0s',
            status: 'blocked',
            persona: log.agent_name,
            timestamp: new Date(log.created_at).toLocaleString()
          })));
        }
      } else {
        // Create new user profile
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert([
            {
              clerk_user_id: user.id,
              email: user.primaryEmailAddress?.emailAddress,
              subscription_tier: 'free',
              calls_limit: 5,
              calls_used_this_month: 0
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        setUserProfile(newUser);
        setSelectedPersona(personas[0]); // Default to Herbert
      }
    } catch (error) {
      console.error('Error with user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCall = async (phoneNumber) => {
    if (!selectedPersona) {
      alert('Please select an AI persona first!');
      return;
    }

    // Check if user has calls remaining
    if (userProfile.calls_used_this_month >= userProfile.calls_limit) {
      alert('You\'ve reached your monthly call limit! Please upgrade your plan.');
      setCurrentScreen('subscription');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/call/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistantId: selectedPersona.vapiAssistantId,
          phoneNumber: phoneNumber
        })
      });

      const data = await response.json();
      if (data.success) {
        setActiveCall({
          id: data.data.id,
          number: phoneNumber,
          persona: selectedPersona.name,
          startTime: new Date(),
          status: 'active'
        });
        setCurrentScreen('active-call');

        // Update call count
        const { data: updated } = await supabase
          .from('users')
          .update({ calls_used_this_month: userProfile.calls_used_this_month + 1 })
          .eq('id', userProfile.id)
          .select()
          .single();
        
        if (updated) setUserProfile(updated);
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Check console for details.');
    }
  };

  const endCall = async () => {
    if (!activeCall) return;

    try {
      await fetch(`${API_URL}/api/call/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id })
      });

      // Log call to database
      const { data: loggedCall } = await supabase
        .from('call_logs')
        .insert([{
          user_id: userProfile.id,
          caller_phone_number: activeCall.number,
          agent_name: activeCall.persona,
          agent_id: selectedPersona.id,
          call_duration: Math.floor((new Date() - activeCall.startTime) / 1000),
          call_status: 'completed',
          vapi_call_id: activeCall.id
        }])
        .select()
        .single();

      if (loggedCall) {
        setCalls([{
          id: loggedCall.id,
          number: loggedCall.caller_phone_number,
          duration: `${loggedCall.call_duration}s`,
          status: 'blocked',
          persona: loggedCall.agent_name,
          timestamp: 'Just now'
        }, ...calls]);
      }

      setActiveCall(null);
      setCurrentScreen('calls');
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  };

  // Welcome Screen
  if (currentScreen === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-emerald-900/30 backdrop-blur-lg rounded-3xl p-8 text-center border border-emerald-700/30 shadow-2xl">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/50 rotate-6 transform transition-transform hover:rotate-0">
              <Shield className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">SpamStopper</h1>
            <p className="text-emerald-300 text-lg">AI-Powered Call Protection</p>
          </div>

          <SignedOut>
            <div className="space-y-4 mb-8 text-left">
              <div className="flex items-start gap-3 p-4 bg-emerald-800/40 rounded-xl">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Smart AI Defense</h3>
                  <p className="text-emerald-300 text-sm">Let AI personas waste spammers' time, not yours</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-emerald-800/40 rounded-xl">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Auto Call Routing</h3>
                  <p className="text-emerald-300 text-sm">Forward spam calls to our AI defenders</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-emerald-800/40 rounded-xl">
                <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2"></div>
                <div>
                  <h3 className="text-white font-semibold mb-1">Call Recording</h3>
                  <p className="text-emerald-300 text-sm">Review hilarious conversations later</p>
                </div>
              </div>
            </div>

            <SignInButton mode="modal">
              <button className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/50">
                Sign In to Get Started →
              </button>
            </SignInButton>

            <p className="text-emerald-400 text-sm mt-4">
              Start with 5 free calls per month!
            </p>
          </SignedOut>

          <SignedIn>
            {loading ? (
              <div className="text-white">Loading your profile...</div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div className="bg-emerald-800/40 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-emerald-400 text-sm">Current Plan</span>
                      <span className="text-white font-bold">{subscriptionTiers[userProfile?.subscription_tier]?.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 text-sm">Calls This Month</span>
                      <span className="text-white font-bold">
                        {userProfile?.calls_used_this_month} / {userProfile?.calls_limit === Infinity ? '∞' : userProfile?.calls_limit}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setCurrentScreen('personas')}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/50 mb-3"
                >
                  Enter Dashboard →
                </button>

                {userProfile?.subscription_tier === 'free' && (
                  <button
                    onClick={() => setCurrentScreen('subscription')}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    Upgrade Plan
                  </button>
                )}
              </>
            )}
          </SignedIn>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${serverStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
            <span className="text-emerald-300">
              {serverStatus === 'connected' ? 'Connected to Vapi' : 'Checking connection...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Navigation Bar Component
  const NavBar = () => (
    <div className="bg-emerald-900/50 backdrop-blur-lg border-b border-emerald-700/30 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-emerald-400" />
        <h1 className="text-white font-bold text-lg">SpamStopper</h1>
        {userProfile && (
          <div className="ml-4 px-3 py-1 bg-emerald-800/50 rounded-full text-xs text-emerald-300">
            {userProfile.calls_used_this_month} / {userProfile.calls_limit === Infinity ? '∞' : userProfile.calls_limit} calls used
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentScreen('personas')}
            className={`p-2 rounded-lg ${currentScreen === 'personas' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <User className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCurrentScreen('calls')}
            className={`p-2 rounded-lg ${currentScreen === 'calls' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <List className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCurrentScreen('subscription')}
            className={`p-2 rounded-lg ${currentScreen === 'subscription' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <CreditCard className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCurrentScreen('settings')}
            className={`p-2 rounded-lg ${currentScreen === 'settings' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );

  // Subscription Screen
  if (currentScreen === 'subscription') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-6xl mx-auto p-6">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-2">Choose Your Plan</h2>
            <p className="text-emerald-300">Upgrade to unlock more AI defenders and calls</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {Object.entries(subscriptionTiers).map(([tier, info]) => (
              <div
                key={tier}
                className={`p-6 rounded-2xl border-2 ${
                  userProfile?.subscription_tier === tier
                    ? 'border-emerald-400 bg-gradient-to-br from-emerald-600/20 to-emerald-700/20'
                    : 'border-emerald-700/30 bg-emerald-800/20'
                } hover:border-emerald-500 transition-all`}
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{info.name}</h3>
                  <div className="text-4xl font-bold text-emerald-400 mb-2">
                    ${info.price}
                    <span className="text-lg text-emerald-500">/mo</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>{info.calls === Infinity ? 'Unlimited' : info.calls} calls/month</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>{info.agents} AI {info.agents === 1 ? 'agent' : 'agents'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>Call recordings</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                    <span>24/7 protection</span>
                  </div>
                </div>

                {userProfile?.subscription_tier === tier ? (
                  <button
                    disabled
                    className="w-full bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl cursor-not-allowed opacity-60"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={checkoutLoading}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkoutLoading ? 'Loading...' : tier === 'free' ? 'Downgrade' : 'Upgrade Now'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Personas Screen
  if (currentScreen === 'personas') {
    const userTier = userProfile?.subscription_tier || 'free';
    const availablePersonas = userTier === 'free' ? personas.filter(p => p.tier === 'free') : personas;

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Choose Your AI Defender</h2>
            <p className="text-emerald-300">Forward spam calls to your chosen agent's number</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {personas.map(persona => {
              const isLocked = userTier === 'free' && persona.tier !== 'free';
              return (
                <div
                  key={persona.id}
                  onClick={() => !isLocked && setSelectedPersona(persona)}
                  className={`p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 relative ${
                    isLocked ? 'opacity-50 cursor-not-allowed' :
                    selectedPersona?.id === persona.id
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-500/50'
                      : 'bg-emerald-800/40 hover:bg-emerald-800/60'
                  } border ${selectedPersona?.id === persona.id ? 'border-emerald-400' : 'border-emerald-700/30'}`}
                >
                  {isLocked && (
                    <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                      UPGRADE
                    </div>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="text-5xl">{persona.avatar}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-white">{persona.name}</h3>
                        {selectedPersona?.id === persona.id && !isLocked && (
                          <CheckCircle className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <p className="text-emerald-200 text-sm mb-3">{persona.description}</p>
                      <div className="inline-block px-3 py-1 bg-emerald-900/50 rounded-full text-xs text-emerald-300 mb-2">
                        {persona.personality}
                      </div>
                      {!isLocked && (
                        <div className="mt-3 p-2 bg-emerald-900/50 rounded-lg">
                          <p className="text-emerald-400 text-xs mb-1">Forward calls to:</p>
                          <p className="text-white font-mono font-bold">{persona.vapiPhoneNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedPersona && (
            <div className="bg-emerald-800/40 rounded-2xl p-6 border border-emerald-700/30">
              <h3 className="text-white font-bold mb-3">Test {selectedPersona.name}</h3>
              <p className="text-emerald-300 text-sm mb-4">
                Make a test call to see how {selectedPersona.name} handles spammers
              </p>
              <div className="flex gap-3">
                <input
                  id="phoneInput"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  className="flex-1 bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => {
                    const phoneNumber = document.getElementById('phoneInput').value;
                    if (!phoneNumber) {
                      alert('Please enter a phone number!');
                      return;
                    }
                    startCall(phoneNumber);
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2"
                >
                  <Phone className="w-5 h-5" />
                  Start Test Call
                </button>
              </div>
              <p className="text-emerald-500 text-xs mt-2">
                This will use 1 of your {userProfile?.calls_limit} monthly calls
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings Screen
  if (currentScreen === 'settings') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
            <p className="text-emerald-300">Manage your account and preferences</p>
          </div>

          <div className="space-y-3 mb-6">
            {Object.entries(settings).map(([key, value]) => (
              <div
                key={key}
                className="bg-emerald-800/40 backdrop-blur-lg rounded-xl p-4 border border-emerald-700/30 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-white font-semibold capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </h3>
                  <p className="text-emerald-400 text-sm">
                    {key === 'autoBlock' && 'Automatically route spam calls to AI'}
                    {key === 'recordCalls' && 'Save call recordings for playback'}
                    {key === 'blockRobocalls' && 'Detect and block robocalls'}
                    {key === 'blockScammers' && 'Identify scam attempts'}
                    {key === 'blockTelemarketing' && 'Block telemarketing calls'}
                    {key === 'notifications' && 'Get alerts for blocked calls'}
                    {key === 'callForwarding' && 'Forward calls to AI defenders'}
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, [key]: !value })}
                  className={`w-14 h-8 rounded-full transition-all ${
                    value ? 'bg-emerald-500' : 'bg-emerald-800'
                  } relative`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${
                      value ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30 mb-6">
            <h3 className="text-white font-bold mb-3">Account Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-emerald-400">Email:</span>
                <span className="text-white">{user?.primaryEmailAddress?.emailAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">Plan:</span>
                <span className="text-white">{subscriptionTiers[userProfile?.subscription_tier]?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-400">Calls Used:</span>
                <span className="text-white">{userProfile?.calls_used_this_month} / {userProfile?.calls_limit === Infinity ? '∞' : userProfile?.calls_limit}</span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30">
            <h3 className="text-white font-bold mb-3">Active Persona</h3>
            {selectedPersona ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-900/50 rounded-lg">
                <span className="text-3xl">{selectedPersona.avatar}</span>
                <div>
                  <p className="text-white font-semibold">{selectedPersona.name}</p>
                  <p className="text-emerald-400 text-sm">{selectedPersona.description}</p>
                  <p className="text-emerald-500 text-xs mt-1 font-mono">{selectedPersona.vapiPhoneNumber}</p>
                </div>
              </div>
            ) : (
              <p className="text-emerald-400 text-sm">No persona selected</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Calls List Screen
  if (currentScreen === 'calls') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Call History</h2>
            <p className="text-emerald-300">{calls.length} spam calls intercepted</p>
          </div>

          {calls.length === 0 ? (
            <div className="text-center py-12 bg-emerald-800/20 rounded-2xl border border-emerald-700/30">
              <Phone className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <p className="text-white font-semibold mb-2">No calls yet</p>
              <p className="text-emerald-400 text-sm">Your blocked spam calls will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {calls.map(call => (
                <div
                  key={call.id}
                  className="bg-emerald-800/40 backdrop-blur-lg rounded-xl p-4 border border-emerald-700/30 hover:bg-emerald-800/60 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-900/50 rounded-full flex items-center justify-center">
                        <Phone className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold">{call.number}</p>
                        <p className="text-emerald-400 text-sm">{call.timestamp}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 text-sm font-semibold">Blocked</span>
                      </div>
                      <p className="text-emerald-400 text-sm">{call.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-emerald-700/30">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 text-sm">Handled by:</span>
                      <span className="text-white text-sm font-semibold">{call.persona}</span>
                    </div>
                    <button className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold flex items-center gap-1">
                      <PlayCircle className="w-4 h-4" />
                      Play Recording
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active Call Screen
  if (currentScreen === 'active-call' && activeCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-emerald-800/40 backdrop-blur-lg rounded-3xl p-8 border border-emerald-700/30 text-center">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <Phone className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{activeCall.persona}</h3>
              <p className="text-emerald-300 mb-1">is talking to</p>
              <p className="text-xl text-white font-semibold">{activeCall.number}</p>
            </div>

            <div className="bg-emerald-900/50 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400 font-semibold">Call in Progress</span>
              </div>
              <div className="h-16 flex items-center justify-center gap-1">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-500 rounded-full animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      animationDelay: `${i * 0.1}s`
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={endCall}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-4 px-6 rounded-xl hover:from-red-600 hover:to-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/50"
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </button>

            <p className="text-emerald-400 text-sm mt-4">
              The AI is wasting the spammer's time so you don't have to!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function App() {
  if (!clerkPubKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <p className="text-xl font-bold mb-2">⚠️ Configuration Error</p>
          <p className="text-emerald-300">Missing Clerk Publishable Key</p>
          <p className="text-sm text-emerald-400 mt-2">Add VITE_CLERK_PUBLISHABLE_KEY to your .env file</p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <MainApp />
    </ClerkProvider>
  );
}

export default App;