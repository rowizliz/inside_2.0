import React, { useEffect, useState } from 'react';
import { useCallManager } from '../context/CallManager';
import { PhoneArrowDownLeftIcon, PhoneArrowUpRightIcon } from '@heroicons/react/24/outline';

const IncomingCallNotification = () => {
  const { incomingCall, acceptIncomingCall, rejectIncomingCall } = useCallManager();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setIsVisible(true);
      setIsAnimating(true);
      
      // Vibrate on mobile devices
      if ('vibrate' in navigator) {
        // Vibrate pattern: vibrate 200ms, pause 100ms, repeat
        const vibrateInterval = setInterval(() => {
          navigator.vibrate(200);
        }, 300);
        
        return () => clearInterval(vibrateInterval);
      }
    } else {
      setIsAnimating(false);
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [incomingCall]);

  const handleAccept = () => {
    setIsAnimating(false);
    acceptIncomingCall();
  };

  const handleReject = () => {
    setIsAnimating(false);
    rejectIncomingCall();
  };

  if (!isVisible || !incomingCall) return null;

  return (
    <div className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}>
      {/* Blurred background */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
      
      {/* Main content */}
      <div className="relative h-full flex flex-col items-center justify-between py-16 px-8">
        {/* Top section - Caller info */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto text-center">
          {/* Status */}
          <p className="text-gray-300 text-sm mb-4 animate-pulse">
            Cuộc gọi video đến...
          </p>
          
          {/* Avatar */}
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-semibold shadow-2xl animate-pulse">
              {incomingCall.caller.avatar_url ? (
                <img 
                  src={incomingCall.caller.avatar_url} 
                  alt={incomingCall.caller.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                incomingCall.caller.name?.charAt(0).toUpperCase() || '?'
              )}
            </div>
            
            {/* Ripple effect */}
            <div className="absolute inset-0 rounded-full animate-ping bg-white/20" />
            <div className="absolute inset-0 rounded-full animate-ping bg-white/10 animation-delay-200" />
          </div>
          
          {/* Caller name */}
          <h2 className="text-white text-3xl font-medium mb-2">
            {incomingCall.caller.name || incomingCall.caller.email || 'Unknown'}
          </h2>
          
          {/* Call type */}
          <p className="text-gray-400 text-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" 
              />
            </svg>
            Video Call
          </p>
        </div>
        
        {/* Bottom section - Actions */}
        <div className="w-full max-w-sm">
          {/* Action buttons */}
          <div className="flex items-center justify-between gap-8 mb-8">
            {/* Reject button */}
            <button
              onClick={handleReject}
              className="group relative"
            >
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-200 group-hover:scale-110 group-active:scale-95">
                <PhoneArrowDownLeftIcon className="w-8 h-8 text-white" />
              </div>
              <p className="text-white text-sm mt-3 opacity-60">Từ chối</p>
            </button>
            
            {/* Accept button */}
            <button
              onClick={handleAccept}
              className="group relative"
            >
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg transform transition-all duration-200 group-hover:scale-110 group-active:scale-95">
                <PhoneArrowUpRightIcon className="w-8 h-8 text-white" />
              </div>
              <p className="text-white text-sm mt-3 opacity-60">Chấp nhận</p>
              
              {/* Pulse animation */}
              <div className="absolute inset-0 -z-10">
                <div className="w-20 h-20 bg-green-500 rounded-full animate-ping opacity-20" />
              </div>
            </button>
          </div>
          
          {/* Additional actions */}
          <div className="flex items-center justify-center gap-6">
            {/* Message */}
            <button className="p-3 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                />
              </svg>
            </button>
            
            {/* Remind me */}
            <button className="p-3 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition-colors">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallNotification;