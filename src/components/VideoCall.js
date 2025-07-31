import React, { useState, useRef, useEffect } from 'react';
import { PhoneIcon, VideoCameraIcon, XMarkIcon, MicrophoneIcon } from '@heroicons/react/24/solid';
import supabase from '../supabase';

const VideoCall = ({ isOpen, onClose, targetUser, currentUser }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected, ended
  const [callStartTime, setCallStartTime] = useState(null);
  const [callId, setCallId] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);

  // WebRTC configuration
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize media stream
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: isAudioEnabled
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      return null;
    }
  };

  // Create peer connection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    
    // Add local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send candidate to remote peer via signaling server
        sendSignalingMessage({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
        setIsCallActive(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setCallStatus('ended');
        setIsCallActive(false);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Send signaling message (placeholder - need to implement with your backend)
  const sendSignalingMessage = (message) => {
    // TODO: Implement with your signaling server (WebSocket, Socket.io, etc.)
    console.log('Sending signaling message:', message);
  };

  // Save call history to database
  const saveCallHistory = async (status, duration = null) => {
    if (!currentUser || !targetUser) return;
    
    try {
      const callData = {
        caller_id: currentUser.id,
        receiver_id: targetUser.id,
        call_type: isVideoEnabled ? 'video' : 'audio',
        status: status,
        duration: duration,
        started_at: callStartTime,
        ended_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('call_history')
        .insert(callData)
        .select()
        .single();

      if (error) {
        console.error('Error saving call history:', error);
      } else {
        console.log('Call history saved:', data);
      }
    } catch (error) {
      console.error('Error saving call history:', error);
    }
  };

  // Start call
  const startCall = async () => {
    try {
      setCallStatus('calling');
      setCallStartTime(new Date().toISOString());
      
      const stream = await initializeMedia();
      if (!stream) {
        console.error('Failed to get media stream');
        return;
      }

      const pc = createPeerConnection();
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send offer to remote peer
      sendSignalingMessage({
        type: 'offer',
        offer: offer
      });
      
    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
    }
  };

  // Answer call
  const answerCall = async () => {
    try {
      setCallStatus('connected');
      setCallStartTime(new Date().toISOString());
      
      const stream = await initializeMedia();
      if (!stream) {
        console.error('Failed to get media stream');
        return;
      }

      const pc = createPeerConnection();
      
      // TODO: Set remote description from incoming offer
      // await pc.setRemoteDescription(offer);
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer to remote peer
      sendSignalingMessage({
        type: 'answer',
        answer: answer
      });
      
    } catch (error) {
      console.error('Error answering call:', error);
      setCallStatus('idle');
    }
  };

  // End call
  const endCall = () => {
    // Calculate call duration
    let duration = null;
    if (callStartTime) {
      const startTime = new Date(callStartTime);
      const endTime = new Date();
      duration = Math.floor((endTime - startTime) / 1000); // Duration in seconds
    }

    // Save call history
    if (callStatus === 'connected') {
      saveCallHistory('answered', duration);
    } else if (callStatus === 'calling') {
      saveCallHistory('missed');
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    setCallStatus('ended');
    setIsCallActive(false);
    setCallStartTime(null);
    onClose();
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Handle incoming call
  useEffect(() => {
    if (isOpen && !isCallActive) {
      // Simulate incoming call for demo
      setTimeout(() => {
        setIsIncomingCall(true);
      }, 1000);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Debug: log targetUser data
  console.log('VideoCall - targetUser:', targetUser);
  console.log('VideoCall - currentUser:', currentUser);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-4xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
              {targetUser?.avatar_url ? (
                <img 
                  src={targetUser.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover" 
                />
              ) : (
                (targetUser?.display_name || targetUser?.displayName || targetUser?.email || 'U').charAt(0)
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold">
                {targetUser?.display_name || targetUser?.displayName || targetUser?.email || 'Unknown User'}
              </h3>
              <p className="text-gray-400 text-sm">
                {callStatus === 'calling' && 'Đang gọi...'}
                {callStatus === 'connected' && 'Đã kết nối'}
                {callStatus === 'ended' && 'Cuộc gọi kết thúc'}
                {isIncomingCall && 'Cuộc gọi đến'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Video Area */}
        <div className="relative mb-4">
          <div className="aspect-video bg-gray-800 rounded-xl overflow-hidden">
            {/* Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            {/* Local Video */}
            <div className="absolute top-4 right-4 w-32 h-24 bg-gray-700 rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          {/* Audio Toggle */}
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isAudioEnabled 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isAudioEnabled ? (
              <MicrophoneIcon className="w-5 h-5" />
            ) : (
              <div className="relative">
                <MicrophoneIcon className="w-5 h-5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-5 bg-red-500 transform rotate-45"></div>
                </div>
              </div>
            )}
          </button>

          {/* Video Toggle */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isVideoEnabled 
                ? 'bg-gray-600 hover:bg-gray-500 text-white' 
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {isVideoEnabled ? (
              <VideoCameraIcon className="w-5 h-5" />
            ) : (
              <div className="relative">
                <VideoCameraIcon className="w-5 h-5" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-5 bg-red-500 transform rotate-45"></div>
                </div>
              </div>
            )}
          </button>

          {/* Call Actions */}
          {!isCallActive && !isIncomingCall && (
            <button
              onClick={startCall}
              className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <PhoneIcon className="w-6 h-6" />
            </button>
          )}

          {isIncomingCall && (
            <div className="flex space-x-4">
              <button
                onClick={answerCall}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <PhoneIcon className="w-6 h-6" />
              </button>
              <button
                onClick={endCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          )}

          {isCallActive && (
            <button
              onClick={endCall}
              className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Status */}
        <div className="text-center mt-4">
          <p className="text-gray-400 text-sm">
            {callStatus === 'idle' && 'Sẵn sàng gọi'}
            {callStatus === 'calling' && 'Đang thiết lập cuộc gọi...'}
            {callStatus === 'connected' && 'Cuộc gọi đang diễn ra'}
            {callStatus === 'ended' && 'Cuộc gọi đã kết thúc'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VideoCall; 