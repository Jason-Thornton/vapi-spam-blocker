import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Settings, User, List, PlayCircle, PauseCircle, Shield, CheckCircle, XCircle, Home } from 'lucide-react';

// AI Personas data
const personas = [
  {
    id: 'persona-1',
    name: 'Herbert',
    description: 'Friendly elderly gentleman who rambles',
    avatar: '👴',
    vapiAssistantId: '37c03d2d-c045-42f5-b8f5-53beca2b34d8',
    personality: 'rambling, friendly, storytelling'
  },
  {
    id: 'persona-2',
    name: 'Jolene',
    description: 'Sweet but incredibly talkative',
    avatar: '🧑',
    vapiAssistantId: '23ed87ac-9f1e-4353-a3aa-c27d70d93342',
    personality: 'talkative, sweet, never stops chatting'
  },
  {
    id: 'persona-3',
    name: 'Derek',
    description: 'Cryptocurrency day-trader and amateur conspiracy researcher',
    avatar: '👔',
    vapiAssistantId: 'd99eeb74-6dad-4149-ac33-e2c7bb0dba57',
    personality: 'crypto-obsessed, conspiracy theories, suspicious'
  },
  {
    id: 'persona-4',
    name: 'Danny',
    description: 'Aspiring standup comedian who works at a call center',
    avatar: '🤖',
    vapiAssistantId: 'b2243844-0748-442f-b7c8-395b6f342e0f',
    personality: 'jokes around, makes awkward comedy attempts'
  }
];

function App() {
  const [currentScreen, setCurrentScreen] = useState('welcome'); // welcome, personas, settings, calls, active-call
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [settings, setSettings] = useState({
    autoBlock: true,
    recordCalls: true,
    blockRobocalls: true,
    blockScammers: true,
    blockTelemarketing: true,
    notifications: true,
    callForwarding: false
  });
  const [calls, setCalls] = useState([
    { id: 1, number: '+1(888)123-4567', duration: '3:42', status: 'blocked', persona: 'Herbert', timestamp: '2 hours ago' },
    { id: 2, number: '+1(800)456-7890', duration: '5:18', status: 'blocked', persona: 'Jolene', timestamp: '5 hours ago' },
    { id: 3, number: '+1(877)098-7654', duration: '1:23', status: 'blocked', persona: 'Derek', timestamp: '1 day ago' }
  ]);
  const [activeCall, setActiveCall] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');

  useEffect(() => {
    // Check server connection
    fetch('/api/test')
      .then(res => res.json())
      .then(data => {
        setServerStatus(data.vapiConnected ? 'connected' : 'disconnected');
      })
      .catch(() => setServerStatus('disconnected'));
  }, []);

  const startCall = async (phoneNumber) => {
    if (!selectedPersona) {
      alert('Please select an AI persona first!');
      return;
    }

    try {
      const response = await fetch('/api/call/start', {
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
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Check console for details.');
    }
  };

  const endCall = async () => {
    if (!activeCall) return;

    try {
      await fetch('/api/call/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: activeCall.id })
      });

      setCalls([{
        id: Date.now(),
        number: activeCall.number,
        duration: Math.floor((new Date() - activeCall.startTime) / 1000) + 's',
        status: 'blocked',
        persona: activeCall.persona,
        timestamp: 'Just now'
      }, ...calls]);

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
                <p className="text-emerald-300 text-sm">Automatically detect and redirect spam calls</p>
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

          <button
            onClick={() => setCurrentScreen('personas')}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold py-4 px-6 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/50"
          >
            Get Started →
          </button>

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
      </div>
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
          onClick={() => setCurrentScreen('settings')}
          className={`p-2 rounded-lg ${currentScreen === 'settings' ? 'bg-emerald-600' : 'bg-emerald-800/50'}`}
        >
          <Settings className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );

  // Personas Screen
  if (currentScreen === 'personas') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950">
        <NavBar />
        <div className="max-w-4xl mx-auto p-6">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Choose Your AI Defender</h2>
            <p className="text-emerald-300">Select which persona will handle spam calls</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {personas.map(persona => (
              <div
                key={persona.id}
                onClick={() => setSelectedPersona(persona)}
                className={`p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 ${
                  selectedPersona?.id === persona.id
                    ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-500/50'
                    : 'bg-emerald-800/40 hover:bg-emerald-800/60'
                } border ${selectedPersona?.id === persona.id ? 'border-emerald-400' : 'border-emerald-700/30'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-5xl">{persona.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-white">{persona.name}</h3>
                      {selectedPersona?.id === persona.id && (
                        <CheckCircle className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <p className="text-emerald-200 text-sm mb-3">{persona.description}</p>
                    <div className="inline-block px-3 py-1 bg-emerald-900/50 rounded-full text-xs text-emerald-300">
                      {persona.personality}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedPersona && (
            <div className="bg-emerald-800/40 rounded-2xl p-6 border border-emerald-700/30">
              <h3 className="text-white font-bold mb-3">Test Your Defender</h3>
              <p className="text-emerald-300 text-sm mb-4">
                Enter a phone number to test {selectedPersona.name} in action
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
            <p className="text-emerald-300">Customize your spam protection</p>
          </div>

          <div className="space-y-3">
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

          <div className="mt-8 bg-emerald-800/40 rounded-xl p-6 border border-emerald-700/30">
            <h3 className="text-white font-bold mb-3">Active Persona</h3>
            {selectedPersona ? (
              <div className="flex items-center gap-3 p-3 bg-emerald-900/50 rounded-lg">
                <span className="text-3xl">{selectedPersona.avatar}</span>
                <div>
                  <p className="text-white font-semibold">{selectedPersona.name}</p>
                  <p className="text-emerald-400 text-sm">{selectedPersona.description}</p>
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
            <h2 className="text-3xl font-bold text-white mb-2">Blocked Calls</h2>
            <p className="text-emerald-300">{calls.length} spam calls intercepted</p>
          </div>

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

export default App;