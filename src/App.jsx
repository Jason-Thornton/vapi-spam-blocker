import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Settings, User, List, PlayCircle, Shield, CheckCircle, XCircle, CreditCard, Zap, BookOpen, Share2, Copy, Facebook, Twitter, MessageCircle, Mail, FileText, Send } from 'lucide-react';
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
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [shareModal, setShareModal] = useState(null);
  const [sharedCall, setSharedCall] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitStatus, setSubmitStatus] = useState('');

  // API URL - works in both dev and production
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Check if URL is a shared call link
  useEffect(() => {
    const path = window.location.pathname;
    const shareMatch = path.match(/\/share\/(.+)/);
    if (shareMatch) {
      const callId = shareMatch[1];
      fetchSharedCall(callId);
    }
  }, []);

  // Fetch shared call data
  const fetchSharedCall = async (callId) => {
    try {
      const response = await fetch(`${API_URL}/api/shared-call/${callId}`);
      const data = await response.json();

      if (data.success) {
        setSharedCall(data.call);
        setCurrentScreen('shared-call');
      }
    } catch (error) {
      console.error('Error fetching shared call:', error);
    }
  };

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

  // Function to refresh user data and call logs
  const refreshDashboardData = async () => {
    if (!userProfile?.id) return;

    try {
      // Fetch fresh user profile
      const { data: freshUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', userProfile.id)
        .single();

      if (freshUser) {
        setUserProfile(freshUser);
      }

      // Fetch fresh call logs
      const { data: callLogs } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (callLogs) {
        setCalls(callLogs.map(log => ({
          id: log.id,
          number: log.caller_phone_number,
          duration: log.call_duration ? `${log.call_duration}s` : '0s',
          status: 'blocked',
          persona: log.agent_name,
          timestamp: new Date(log.created_at).toLocaleString(),
          recording_url: log.recording_url,
          transcript: log.transcript
        })));
      }
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    }
  };

  const fetchOrCreateUserProfile = async () => {
    try {
      console.log('Fetching user profile for clerk_user_id:', user.id);

      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('clerk_user_id', user.id)
        .single();

      console.log('Supabase response - data:', existingUser, 'error:', fetchError);

      // If user exists (no error or data is present)
      if (existingUser && !fetchError) {
        console.log('✅ Existing user found:', existingUser);
        setUserProfile(existingUser);
        setSelectedPersona(personas.find(p => p.id === existingUser.selected_agent_id));

        // Load user settings from database
        setSettings({
          autoBlock: existingUser.auto_block ?? true,
          recordCalls: existingUser.record_calls ?? true,
          blockRobocalls: existingUser.block_robocalls ?? true,
          blockScammers: existingUser.block_scammers ?? true,
          blockTelemarketing: existingUser.block_telemarketing ?? true,
          notifications: existingUser.notifications ?? true,
          callForwarding: existingUser.call_forwarding ?? false
        });

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
            timestamp: new Date(log.created_at).toLocaleString(),
            recording_url: log.recording_url,
            transcript: log.transcript
          })));
        }
      } else if (fetchError) {
        // User doesn't exist or other error
        console.log('❌ Error fetching user. Code:', fetchError.code, 'Message:', fetchError.message);
        console.log('🆕 Creating new user and showing tutorial');

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

        if (createError) {
          console.error('❌ Error creating user:', createError);
          throw createError;
        }

        console.log('✅ New user created:', newUser);
        console.log('🎓 Setting tutorial screen. Current screen before:', currentScreen);

        setUserProfile(newUser);
        setSelectedPersona(personas[0]); // Default to Herbert
        setShowTutorial(true);
        setCurrentScreen('tutorial');

        console.log('🎓 Tutorial screen set. showTutorial:', true, 'currentScreen:', 'tutorial');
      }
    } catch (error) {
      console.error('💥 Error with user profile:', error);
    } finally {
      setLoading(false);
      console.log('Loading complete. Final currentScreen:', currentScreen);
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

  // Shared Call View (Public page for shared links)
  if (currentScreen === 'shared-call' && sharedCall) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-emerald-900/30 backdrop-blur-lg rounded-3xl p-8 border border-emerald-700/30 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 rounded-3xl flex items-center justify-center mb-4">
              <Shield className="w-12 h-12 text-emerald-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">SpamStopper in Action!</h1>
            <p className="text-emerald-300">Listen to how our AI handled this spam call</p>
          </div>

          <div className="bg-emerald-800/40 rounded-2xl p-6 border border-emerald-700/30 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-bold text-lg">{sharedCall.persona} vs Spammer</p>
                <p className="text-emerald-400 text-sm">{sharedCall.number}</p>
              </div>
              <div className="text-right">
                <p className="text-emerald-300 text-sm">Call Duration</p>
                <p className="text-white font-bold text-2xl">{sharedCall.duration}</p>
              </div>
            </div>

            {sharedCall.recording_url && (
              <div className="bg-emerald-900/50 rounded-xl p-4 mb-4">
                <audio controls className="w-full">
                  <source src={sharedCall.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            {sharedCall.transcript && (
              <div className="bg-emerald-900/50 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-2">Transcript</h4>
                <p className="text-emerald-300 text-sm whitespace-pre-wrap">{sharedCall.transcript}</p>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 rounded-2xl p-6 border border-emerald-500/30 text-center">
            <h3 className="text-white font-bold text-xl mb-3">Want to waste spammers' time too?</h3>
            <p className="text-emerald-300 mb-4">
              Join SpamStopper and let AI defenders handle your spam calls while you enjoy peace and quiet.
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 px-8 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/50"
            >
              Get Started Free - 5 Calls/Month
            </button>
            <p className="text-emerald-400 text-xs mt-3">No credit card required</p>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 text-center">
            <div className="bg-emerald-800/20 rounded-xl p-3">
              <Shield className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <p className="text-white text-sm font-semibold">AI Protection</p>
            </div>
            <div className="bg-emerald-800/20 rounded-xl p-3">
              <PlayCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <p className="text-white text-sm font-semibold">Call Recording</p>
            </div>
            <div className="bg-emerald-800/20 rounded-xl p-3">
              <Zap className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <p className="text-white text-sm font-semibold">Instant Setup</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tutorial Screen
  if (currentScreen === 'tutorial') {
    const tutorialSteps = [
      {
        title: 'Welcome to SpamStopper!',
        description: 'Let\'s get you set up in 3 easy steps',
        icon: <Shield className="w-16 h-16 text-emerald-400" />,
        content: (
          <div className="space-y-4 text-left">
            <p className="text-emerald-300">
              SpamStopper uses AI personas to answer and waste spammers' time, so you don't have to deal with them.
            </p>
            <div className="bg-emerald-800/40 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-2">What you'll learn:</h4>
              <ul className="space-y-2 text-emerald-300 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  How to choose your AI defender
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  How to forward spam calls
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  How to view call history
                </li>
              </ul>
            </div>
          </div>
        )
      },
      {
        title: 'Step 1: Choose Your AI Defender',
        description: 'Pick an AI persona to handle your spam calls',
        icon: <User className="w-16 h-16 text-emerald-400" />,
        content: (
          <div className="space-y-4 text-left">
            <p className="text-emerald-300">
              Each AI persona has a unique personality designed to keep spammers on the line as long as possible.
            </p>
            <div className="bg-emerald-800/40 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{personas[0].avatar}</span>
                <div>
                  <p className="text-white font-semibold">{personas[0].name}</p>
                  <p className="text-emerald-400 text-sm">{personas[0].description}</p>
                </div>
              </div>
              <p className="text-emerald-300 text-sm">
                On the free plan, you get access to Herbert. Upgrade to unlock all 4 AI defenders!
              </p>
            </div>
          </div>
        )
      },
      {
        title: 'Step 2: Set Up Call Forwarding',
        description: 'Automatically forward spam calls to your AI defender',
        icon: <Phone className="w-16 h-16 text-emerald-400" />,
        content: (
          <div className="space-y-4 text-left">
            <p className="text-emerald-300">
              Set up automatic call forwarding on your phone to send calls to your chosen AI persona's number.
            </p>
            <div className="bg-emerald-800/40 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-2">How it works:</h4>
              <ol className="space-y-2 text-emerald-300 text-sm list-decimal list-inside">
                <li>Forward your phone to: <span className="text-white font-mono font-bold">{personas[0].vapiPhoneNumber}</span></li>
                <li>When a call comes in, it automatically forwards to your AI</li>
                <li>Spam/unknown numbers are answered by your AI defender</li>
                <li>Known contacts can still reach you directly</li>
              </ol>
            </div>
            <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-4">
              <p className="text-amber-300 text-sm mb-3">
                <strong>Tip:</strong> Set up conditional call forwarding for unknown numbers only, so calls from your contacts still come through normally.
              </p>
              <div className="border-t border-amber-700/30 pt-3">
                <p className="text-amber-300 text-sm font-semibold mb-2">Turn off call forwarding:</p>
                <ul className="text-amber-300 text-xs space-y-1 ml-4">
                  <li>• iPhone: Settings → Phone → Call Forwarding → Toggle OFF</li>
                  <li>• Android: Phone app → Settings → Calls → Call forwarding → Disable</li>
                  <li>• Or dial: <span className="font-mono font-bold">##21#</span> to disable all forwarding</li>
                </ul>
              </div>
            </div>
          </div>
        )
      },
      {
        title: 'Step 3: Review & Enjoy',
        description: 'Listen to recordings and track your blocked calls',
        icon: <PlayCircle className="w-16 h-16 text-emerald-400" />,
        content: (
          <div className="space-y-4 text-left">
            <p className="text-emerald-300">
              After each call, you can review the recording and see how long your AI kept the spammer busy.
            </p>
            <div className="bg-emerald-800/40 rounded-xl p-4">
              <h4 className="text-white font-semibold mb-2">You can also:</h4>
              <ul className="space-y-2 text-emerald-300 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  View your call history in the Calls tab
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Register your phone number in Settings
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Upgrade your plan for more calls and personas
                </li>
              </ul>
            </div>
            <div className="bg-emerald-800/40 rounded-xl p-4 text-center">
              <p className="text-white font-semibold mb-2">Ready to get started?</p>
              <p className="text-emerald-400 text-sm">
                You have <strong>5 free calls</strong> this month to try it out!
              </p>
            </div>
          </div>
        )
      }
    ];

    const currentStep = tutorialSteps[tutorialStep];

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-emerald-900/30 backdrop-blur-lg rounded-3xl p-8 border border-emerald-700/30 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 rounded-3xl flex items-center justify-center mb-4">
              {currentStep.icon}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">{currentStep.title}</h2>
            <p className="text-emerald-300">{currentStep.description}</p>
          </div>

          <div className="mb-8">
            {currentStep.content}
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              {tutorialSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === tutorialStep ? 'w-8 bg-emerald-500' : 'w-2 bg-emerald-800'
                  }`}
                />
              ))}
            </div>
            <span className="text-emerald-400 text-sm">
              {tutorialStep + 1} of {tutorialSteps.length}
            </span>
          </div>

          <div className="flex gap-3">
            {tutorialStep > 0 && (
              <button
                onClick={() => setTutorialStep(tutorialStep - 1)}
                className="flex-1 bg-emerald-800/50 text-white font-bold py-3 px-6 rounded-xl hover:bg-emerald-800/70 transition-all"
              >
                ← Back
              </button>
            )}
            {tutorialStep < tutorialSteps.length - 1 ? (
              <button
                onClick={() => setTutorialStep(tutorialStep + 1)}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowTutorial(false);
                  setCurrentScreen('personas');
                }}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all"
              >
                Get Started →
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setShowTutorial(false);
              setCurrentScreen('personas');
            }}
            className="w-full mt-4 text-emerald-400 hover:text-emerald-300 text-sm transition-all"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    );
  }

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

            <div className="mb-6">
              <p className="text-white font-semibold mb-2">Create your free account to get started</p>
              <p className="text-emerald-400 text-sm">Already have an account? Log in</p>
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
        {userProfile && userProfile.calls_used_this_month !== undefined && userProfile.calls_limit !== undefined && (
          <div className="ml-4 px-3 py-1 bg-emerald-800/50 rounded-full text-xs text-emerald-300">
            {userProfile.calls_used_this_month} / {userProfile.calls_limit === Infinity ? '∞' : userProfile.calls_limit} calls used
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={refreshDashboardData}
          className="p-2 rounded-lg bg-emerald-800/50 hover:bg-emerald-700/50 transition-colors"
          title="Refresh data"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
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
            onClick={() => {
              setTutorialStep(0);
              setCurrentScreen('tutorial');
            }}
            className={`p-2 rounded-lg ${currentScreen === 'tutorial' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCurrentScreen('contact')}
            className={`p-2 rounded-lg ${currentScreen === 'contact' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <Mail className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setCurrentScreen('legal')}
            className={`p-2 rounded-lg ${currentScreen === 'legal' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
          >
            <FileText className="w-5 h-5 text-white" />
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

  // Settings handlers
  const handleSavePhone = async () => {
    const phoneInput = document.getElementById('phoneNumberInput').value;

    if (!phoneInput || !phoneInput.match(/^\+\d{10,15}$/)) {
      alert('Please enter a valid phone number in E.164 format (e.g., +15551234567)');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ phone_number: phoneInput })
        .eq('id', userProfile.id);

      if (error) throw error;

      setUserProfile({ ...userProfile, phone_number: phoneInput });
      alert('Phone number saved! You can now forward spam calls to your AI defender.');
    } catch (error) {
      console.error('Error saving phone number:', error);
      alert('Failed to save phone number');
    }
  };

  const handleToggleSetting = async (key, currentValue) => {
    const newValue = !currentValue;

    // Update local state immediately for responsive UI
    setSettings({ ...settings, [key]: newValue });
    setSavingSettings(true);

    try {
      // Save to database
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      console.log(`🔄 Attempting to save ${key} (${dbKey}) as:`, newValue);

      const { error } = await supabase
        .from('users')
        .update({ [dbKey]: newValue })
        .eq('id', userProfile.id);

      if (error) throw error;

      console.log(`✅ Setting ${key} saved:`, newValue);

      // Brief delay to show feedback
      setTimeout(() => setSavingSettings(false), 500);
    } catch (error) {
      console.error('Error saving setting:', error);
      // Revert on error
      setSettings({ ...settings, [key]: currentValue });
      setSavingSettings(false);
      alert('Failed to save setting. Please try again.');
    }
  };

  // Settings Screen
  if (currentScreen === 'settings') {

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Settings</h2>
                <p className="text-emerald-300">Manage your account and preferences</p>
              </div>
              {savingSettings && (
                <div className="flex items-center gap-2 bg-emerald-600/20 px-4 py-2 rounded-xl border border-emerald-500/30">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                  <span className="text-emerald-300 text-sm">Saving...</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30 mb-6">
            <h3 className="text-white font-bold mb-3">📞 Your Phone Number</h3>
            <p className="text-emerald-300 text-sm mb-4">
              Register your phone number so we can identify your spam calls
            </p>
            <div className="flex gap-3">
              <input
                id="phoneNumberInput"
                type="tel"
                defaultValue={userProfile?.phone_number || ''}
                placeholder="+1 (555) 123-4567"
                className="flex-1 bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleSavePhone}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold px-6 py-3 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all"
              >
                Save
              </button>
            </div>
            {userProfile?.phone_number && (
              <p className="text-emerald-400 text-xs mt-2">
                ✓ Registered: {userProfile.phone_number}
              </p>
            )}
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
                  onClick={() => handleToggleSetting(key, value)}
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

  // Contact/Support Screen
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('sending');

    // For now, just log to console - you can add email service later
    console.log('Contact form submitted:', contactForm);

    // Simulate sending
    setTimeout(() => {
      setSubmitStatus('success');
      setContactForm({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSubmitStatus(''), 3000);
    }, 1000);
  };

  if (currentScreen === 'contact') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-2xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Contact & Support</h2>
            <p className="text-emerald-300">Have a question? We're here to help!</p>
          </div>

          <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30 mb-6">
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="text-white font-semibold mb-2 block">Name</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                  className="w-full bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="text-white font-semibold mb-2 block">Email</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                  className="w-full bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label className="text-white font-semibold mb-2 block">Subject</label>
                <select
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  required
                  className="w-full bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select a topic</option>
                  <option value="billing">Billing & Subscriptions</option>
                  <option value="technical">Technical Support</option>
                  <option value="account">Account Issues</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-white font-semibold mb-2 block">Message</label>
                <textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  rows={6}
                  className="w-full bg-emerald-900/50 border border-emerald-700/50 rounded-xl px-4 py-3 text-white placeholder-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="How can we help you?"
                />
              </div>

              <button
                type="submit"
                disabled={submitStatus === 'sending'}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-3 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
                {submitStatus === 'sending' ? 'Sending...' : 'Send Message'}
              </button>

              {submitStatus === 'success' && (
                <div className="bg-emerald-600/20 border border-emerald-500/50 rounded-xl p-4 text-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-300">Message sent! We'll get back to you soon.</p>
                </div>
              )}
            </form>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-800/40 rounded-xl p-4 border border-emerald-700/30">
              <Mail className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="text-white font-semibold mb-1">Email Us</h3>
              <p className="text-emerald-300 text-sm">support@spamstopper.com</p>
            </div>

            <div className="bg-emerald-800/40 rounded-xl p-4 border border-emerald-700/30">
              <FileText className="w-6 h-6 text-emerald-400 mb-2" />
              <h3 className="text-white font-semibold mb-1">Documentation</h3>
              <button
                onClick={() => setCurrentScreen('tutorial')}
                className="text-emerald-400 text-sm hover:text-emerald-300"
              >
                View Tutorial →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Legal/Privacy Screen
  if (currentScreen === 'legal') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Legal & Privacy</h2>
            <p className="text-emerald-300">Our commitment to your privacy and security</p>
          </div>

          <div className="space-y-6">
            {/* Privacy Policy */}
            <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30">
              <h3 className="text-2xl font-bold text-white mb-4">Privacy Policy</h3>

              <div className="space-y-4 text-emerald-300">
                <div>
                  <h4 className="text-white font-semibold mb-2">Information We Collect</h4>
                  <p className="text-sm">
                    We collect information you provide directly to us, including your name, email address, phone number,
                    and payment information. We also collect call logs, recordings, and transcripts to provide our service.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">How We Use Your Information</h4>
                  <p className="text-sm">
                    We use the information we collect to provide, maintain, and improve our services, process transactions,
                    send you technical notices and support messages, and respond to your comments and questions.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Data Security</h4>
                  <p className="text-sm">
                    We take reasonable measures to help protect your personal information from loss, theft, misuse,
                    unauthorized access, disclosure, alteration, and destruction. All data is encrypted in transit and at rest.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Data Retention</h4>
                  <p className="text-sm">
                    We retain your information for as long as your account is active or as needed to provide you services.
                    You can request deletion of your data at any time by contacting support.
                  </p>
                </div>
              </div>
            </div>

            {/* Terms of Service */}
            <div className="bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30">
              <h3 className="text-2xl font-bold text-white mb-4">Terms of Service</h3>

              <div className="space-y-4 text-emerald-300">
                <div>
                  <h4 className="text-white font-semibold mb-2">Service Description</h4>
                  <p className="text-sm">
                    SpamStopper provides AI-powered spam call blocking and management services. We forward spam calls to
                    AI personas that engage with callers, keeping you free from unwanted interruptions.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Acceptable Use</h4>
                  <p className="text-sm">
                    You agree to use our service only for lawful purposes and in accordance with these Terms. You may not use
                    our service in any way that could damage, disable, or impair our servers or networks.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Subscription & Billing</h4>
                  <p className="text-sm">
                    Subscriptions are billed monthly in advance. You can cancel at any time, and your subscription will remain
                    active until the end of your current billing period. No refunds for partial months.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Limitation of Liability</h4>
                  <p className="text-sm">
                    SpamStopper is provided "as is" without warranties of any kind. We are not liable for any damages arising
                    from your use of the service, including but not limited to missed important calls or data loss.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-2">Contact</h4>
                  <p className="text-sm">
                    For questions about these terms or our privacy practices, please contact us at support@spamstopper.com
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-700/20 rounded-xl p-4 border border-emerald-600/30 text-center">
              <p className="text-emerald-300 text-sm">
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
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
                    <div className="flex items-center gap-3">
                      {call.recording_url ? (
                        <a
                          href={call.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold flex items-center gap-1"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Play Recording
                        </a>
                      ) : (
                        <span className="text-emerald-600 text-sm flex items-center gap-1">
                          <PlayCircle className="w-4 h-4" />
                          No Recording
                        </span>
                      )}
                      <button
                        onClick={() => setShareModal(call)}
                        className="text-emerald-400 hover:text-emerald-300 text-sm font-semibold flex items-center gap-1"
                      >
                        <Share2 className="w-4 h-4" />
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Share Modal */}
        {shareModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setShareModal(null)}>
            <div className="bg-emerald-900/95 backdrop-blur-lg rounded-3xl p-6 max-w-md w-full border border-emerald-700/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Share This Call</h3>
                <button onClick={() => setShareModal(null)} className="text-emerald-400 hover:text-emerald-300">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-emerald-800/40 rounded-xl p-4 mb-6 border border-emerald-700/30">
                <p className="text-white font-semibold mb-1">{shareModal.persona} vs Spammer</p>
                <p className="text-emerald-400 text-sm mb-2">{shareModal.number}</p>
                <p className="text-emerald-300 text-sm">Duration: {shareModal.duration}</p>
              </div>

              <p className="text-emerald-300 text-sm mb-4 text-center">
                Share this hilarious spam call with friends! Help spread the word about SpamStopper!
              </p>

              <div className="space-y-3 mb-4">
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${shareModal.id}`;
                    const text = `Check out this hilarious spam call blocked by SpamStopper! ${shareModal.persona} kept them busy for ${shareModal.duration}!`;
                    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`, '_blank');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Share on Facebook
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${shareModal.id}`;
                    const text = `Check out this hilarious spam call blocked by SpamStopper! ${shareModal.persona} kept them busy for ${shareModal.duration}! 😂`;
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                  }}
                  className="w-full bg-black hover:bg-gray-900 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Share on X (Twitter)
                </button>

                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/share/${shareModal.id}`;
                    navigator.clipboard.writeText(shareUrl);
                    alert('Link copied! You can now share it on TikTok, WhatsApp, or anywhere else!');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  Copy Link for TikTok/WhatsApp
                </button>
              </div>

              <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl p-3">
                <p className="text-amber-300 text-xs text-center">
                  💡 When friends click your link, they'll hear the recording and be prompted to create their own free account!
                </p>
              </div>
            </div>
          </div>
        )}
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