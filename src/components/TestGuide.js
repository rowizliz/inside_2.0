import React, { useState } from 'react';

export default function TestGuide() {
  const [isVisible, setIsVisible] = useState(false);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 left-4 bg-yellow-500 text-black px-3 py-2 rounded-lg shadow-lg hover:bg-yellow-600 z-50 text-sm font-bold"
      >
        📋 Test Guide
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 bg-gray-900 p-4 rounded-lg shadow-lg max-w-md z-50 border border-gray-600">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-bold">🧪 Video Call Test Guide</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="text-sm text-gray-300 space-y-3 max-h-96 overflow-y-auto">
        <div>
          <h4 className="text-yellow-400 font-semibold mb-1">🎯 Current Status</h4>
          <ul className="text-xs space-y-1">
            <li>✅ Debug logging added</li>
            <li>✅ Realtime test component</li>
            <li>✅ Simple video call implementation</li>
            <li>✅ Improved signaling channel</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-blue-400 font-semibold mb-1">🧪 How to Test</h4>
          <ol className="text-xs space-y-1 list-decimal list-inside">
            <li>Check "Realtime Test" (top-right corner)</li>
            <li>Send test messages to verify Supabase Realtime</li>
            <li>Open "Video Call Test" (bottom-left)</li>
            <li>Copy your User ID</li>
            <li>Open another browser tab/incognito</li>
            <li>Login with different user</li>
            <li>Test signaling: Call Request → Offer → Answer</li>
            <li>Try actual video call in direct chat</li>
          </ol>
        </div>
        
        <div>
          <h4 className="text-green-400 font-semibold mb-1">🔧 Debug Info</h4>
          <ul className="text-xs space-y-1">
            <li>• Check browser console for logs</li>
            <li>• Look for 📡 📤 📥 emojis in console</li>
            <li>• Allow camera/microphone permissions</li>
            <li>• Try Chrome/Safari instead of other browsers</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-red-400 font-semibold mb-1">⚠️ Common Issues</h4>
          <ul className="text-xs space-y-1">
            <li>• Browser permissions denied</li>
            <li>• Supabase Realtime not enabled</li>
            <li>• Network/firewall blocking WebRTC</li>
            <li>• STUN/TURN servers not accessible</li>
          </ul>
        </div>
        
        <div>
          <h4 className="text-purple-400 font-semibold mb-1">🛠️ Quick Fixes</h4>
          <ul className="text-xs space-y-1">
            <li>• Refresh page and try again</li>
            <li>• Check browser settings for camera/mic</li>
            <li>• Try incognito mode</li>
            <li>• Test with 2 tabs same browser</li>
            <li>• Disable VPN if using</li>
          </ul>
        </div>
        
        <div className="bg-gray-800 p-2 rounded">
          <div className="text-yellow-300 text-xs font-semibold mb-1">💡 Pro Tip:</div>
          <div className="text-xs">
            Open browser DevTools (F12) → Console tab to see detailed debug logs 
            while testing video call functionality.
          </div>
        </div>
      </div>
    </div>
  );
}
