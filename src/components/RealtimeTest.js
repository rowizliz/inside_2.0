import React, { useState, useEffect } from 'react';
import supabase from '../supabase';

export default function RealtimeTest() {
  const [messages, setMessages] = useState([]);
  const [testMessage, setTestMessage] = useState('');
  const [channelStatus, setChannelStatus] = useState('disconnected');

  useEffect(() => {
    console.log('🔄 Setting up realtime test channel...');
    
    const channel = supabase.channel('realtime-test');
    
    channel.on('broadcast', { event: 'test' }, payload => {
      console.log('📡 Received test broadcast:', payload);
      setMessages(prev => [...prev, {
        id: Date.now(),
        message: payload.payload.message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
    
    channel.subscribe((status) => {
      console.log('📡 Channel status:', status);
      setChannelStatus(status);
    });
    
    return () => {
      console.log('🔄 Cleaning up realtime test channel');
      supabase.removeChannel(channel);
    };
  }, []);

  const sendTestMessage = () => {
    if (!testMessage.trim()) return;
    
    console.log('📤 Sending test message:', testMessage);
    
    const channel = supabase.channel('realtime-test');
    channel.send({
      type: 'broadcast',
      event: 'test',
      payload: { message: testMessage }
    });
    
    setTestMessage('');
  };

  return (
    <div className="fixed top-4 right-4 bg-gray-800 p-4 rounded-lg shadow-lg max-w-sm z-50">
      <h3 className="text-white font-bold mb-2">Realtime Test</h3>
      
      <div className="mb-2">
        <span className="text-sm text-gray-300">Status: </span>
        <span className={`text-sm font-bold ${
          channelStatus === 'SUBSCRIBED' ? 'text-green-400' : 
          channelStatus === 'CHANNEL_ERROR' ? 'text-red-400' : 
          'text-yellow-400'
        }`}>
          {channelStatus}
        </span>
      </div>
      
      <div className="mb-3">
        <input
          type="text"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Test message..."
          className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
          onKeyPress={(e) => e.key === 'Enter' && sendTestMessage()}
        />
        <button
          onClick={sendTestMessage}
          className="w-full mt-1 bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
        >
          Send Test
        </button>
      </div>
      
      <div className="max-h-32 overflow-y-auto">
        <div className="text-xs text-gray-400 mb-1">Messages:</div>
        {messages.map(msg => (
          <div key={msg.id} className="text-xs text-white mb-1">
            <span className="text-gray-400">{msg.timestamp}:</span> {msg.message}
          </div>
        ))}
      </div>
    </div>
  );
}
