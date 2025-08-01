import React, { useState, useRef, useEffect } from 'react';
import supabase from '../supabase';

export default function VideoCallTest() {
  const [isVisible, setIsVisible] = useState(false);
  const [userId] = useState('test-user-' + Math.random().toString(36).substr(2, 9));
  const [remoteUserId, setRemoteUserId] = useState('');
  const [messages, setMessages] = useState([]);
  const channelRef = useRef();

  useEffect(() => {
    if (!isVisible) return;

    console.log('🔄 Setting up video call test channel...');
    
    const channel = supabase.channel('video-call-test');
    channelRef.current = channel;

    channel.on('broadcast', { event: 'signal' }, payload => {
      console.log('📡 Received signal:', payload);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'received',
        data: payload.payload,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
    
    channel.subscribe((status) => {
      console.log('📡 Channel status:', status);
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'status',
        data: { status },
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
    
    return () => {
      console.log('🔄 Cleaning up video call test channel');
      supabase.removeChannel(channel);
    };
  }, [isVisible]);

  const sendTestSignal = (type) => {
    if (!channelRef.current || !remoteUserId) return;
    
    const signal = {
      type,
      from: userId,
      to: remoteUserId,
      timestamp: Date.now()
    };
    
    console.log('📤 Sending signal:', signal);
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload: signal
    });
    
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'sent',
      data: signal,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 bg-purple-500 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-600 z-50"
      >
        🧪 Video Call Test
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-gray-800 p-4 rounded-lg shadow-lg max-w-md z-50">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-bold">Video Call Test</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="mb-3">
        <div className="text-xs text-gray-400 mb-1">Your ID:</div>
        <div className="text-xs text-white font-mono bg-gray-700 p-1 rounded">{userId}</div>
      </div>
      
      <div className="mb-3">
        <input
          type="text"
          value={remoteUserId}
          onChange={(e) => setRemoteUserId(e.target.value)}
          placeholder="Remote user ID..."
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
        />
      </div>
      
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => sendTestSignal('call-request')}
          disabled={!remoteUserId}
          className="flex-1 bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600 disabled:opacity-50"
        >
          Call Request
        </button>
        <button
          onClick={() => sendTestSignal('offer')}
          disabled={!remoteUserId}
          className="flex-1 bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 disabled:opacity-50"
        >
          Send Offer
        </button>
        <button
          onClick={() => sendTestSignal('answer')}
          disabled={!remoteUserId}
          className="flex-1 bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600 disabled:opacity-50"
        >
          Send Answer
        </button>
      </div>
      
      <div className="max-h-32 overflow-y-auto">
        <div className="text-xs text-gray-400 mb-1">Messages:</div>
        {messages.map(msg => (
          <div key={msg.id} className="text-xs mb-1">
            <span className="text-gray-400">{msg.timestamp}:</span>
            <span className={`ml-1 ${
              msg.type === 'sent' ? 'text-green-400' : 
              msg.type === 'received' ? 'text-blue-400' : 
              'text-yellow-400'
            }`}>
              {msg.type === 'status' ? 
                `Status: ${msg.data.status}` : 
                `${msg.type}: ${msg.data.type || 'unknown'}`
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
