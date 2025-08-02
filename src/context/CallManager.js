import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { SOCKET_URL } from '../config/environment';

// Tạo CallManager Context
const CallManagerContext = createContext();

// Hook để sử dụng CallManager
export const useCallManager = () => {
  const context = useContext(CallManagerContext);
  if (!context) {
    throw new Error('useCallManager must be used within a CallManagerProvider');
  }
  return context;
};

// Provider component
export const CallManagerProvider = ({ children }) => {
  const { currentUser } = useAuth();
  
  // Trạng thái cuộc gọi
  const [activeCall, setActiveCall] = useState(null); // { roomId, targetUser, status, startTime }
  const [incomingCall, setIncomingCall] = useState(null); // { roomId, caller, status }
  
  // Trạng thái media
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  // WebRTC references
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  
  // Audio references
  const ringtoneRef = useRef(null);
  const callToneRef = useRef(null);
  
  // Phát ringtone
  const playRingtone = useCallback(() => {
    try {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/sounds/ringtone.wav');
        ringtoneRef.current.loop = true;
      }

      if (ringtoneRef.current.paused) {
        ringtoneRef.current.play().catch(e => console.log('Ringtone play error:', e));
      }
    } catch (error) {
      console.log('Ringtone error:', error);
    }
  }, []);
  
  // Dừng ringtone
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current && !ringtoneRef.current.paused) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  }, []);
  
  // Phát âm thanh cuộc gọi
  const playCallTone = useCallback((type) => {
    try {
      let soundFile = '';
      switch (type) {
        case 'connected':
          soundFile = '/sounds/connected.wav';
          break;
        case 'busy':
          soundFile = '/sounds/busy.wav';
          break;
        case 'ended':
          soundFile = '/sounds/ended.wav';
          break;
        default:
          return;
      }

      if (!callToneRef.current) {
        callToneRef.current = new Audio(soundFile);
      } else {
        callToneRef.current.src = soundFile;
      }

      callToneRef.current.play().catch(e => console.log('Call tone play error:', e));
    } catch (error) {
      console.log('Call tone error:', error);
    }
  }, []);
  
  // Cleanup WebRTC connection
  const cleanupWebRTC = useCallback(() => {
    console.log('🧹 Cleaning up WebRTC connection...');
    
    // Dừng local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Dừng remote stream
    setRemoteStream(null);
    
    // Dừng peer connection
    if (peerRef.current && !peerRef.current.destroyed) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
  }, [localStream]);
  
  // Xử lý kết thúc cuộc gọi
  const handleCallEnded = useCallback((data) => {
    // Dừng ringtone
    stopRingtone();

    // Cleanup WebRTC
    cleanupWebRTC();

    // Reset trạng thái cuộc gọi
    setIncomingCall(null);
    setActiveCall(null);
    setRemoteStream(null);
  }, []); // Không cần dependencies vì các function được định nghĩa trong component
  
  // Kết thúc cuộc gọi
  const endCall = useCallback(() => {
    console.log('🔚 Ending call');
    
    // Dừng ringtone
    stopRingtone();
    
    // Gửi kết thúc đến signaling server
    if (socketRef.current && activeCall) {
      socketRef.current.emit('end-call', {
        roomId: activeCall.roomId
      });
    }
    
    // Cleanup WebRTC
    cleanupWebRTC();
    
    // Reset trạng thái
    setActiveCall(null);
    setIncomingCall(null);
    
    // Phát âm thanh kết thúc
    playCallTone('ended');
  }, [activeCall]); // Chỉ phụ thuộc vào activeCall
  
  // Khởi tạo WebRTC connection
  const initializeWebRTC = useCallback(async (initiator, roomId) => {
    try {
      console.log('🌐 Initializing WebRTC connection...');
      console.log('RoomId:', roomId);
      
      // Lấy media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      setLocalStream(stream);
      
      // Tạo peer connection
      const peer = new Peer({
        initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
      
      peerRef.current = peer;
      
      // Peer event listeners
      peer.on('signal', (data) => {
        console.log('📡 Sending signal:', data.type || 'data');
        if (socketRef.current && socketRef.current.connected && currentUser && currentUser.id && roomId) {
          socketRef.current.emit('signal', {
            roomId: roomId,
            signal: data,
            userId: currentUser.id
          });
        } else {
          console.error('Cannot send signal - missing requirements:', {
            socket: !!socketRef.current,
            connected: socketRef.current?.connected,
            currentUser: !!currentUser,
            roomId: roomId
          });
        }
      });
      
      peer.on('connect', () => {
        console.log('✅ Peer connection established');
        setActiveCall(prev => ({
          ...prev,
          status: 'connected'
        }));
        
        // Dừng ringtone và phát âm thanh kết nối
        stopRingtone();
        playCallTone('connected');
      });
      
      peer.on('stream', (stream) => {
        console.log('📺 Remote stream received');
        setRemoteStream(stream);
      });
      
      peer.on('close', () => {
        console.log('🔚 Peer connection closed');
        handleCallEnded();
      });
      
      peer.on('error', (error) => {
        console.error('❌ Peer connection error:', error);
        endCall();
      });
      
    } catch (error) {
      console.error('❌ Error initializing WebRTC:', error);
      if (error.name === 'NotAllowedError') {
        // Người dùng từ chối quyền truy cập
        alert('Vui lòng cấp quyền truy cập camera và microphone để thực hiện cuộc gọi video.');
      }
      endCall();
    }
  }, [currentUser]); // Chỉ phụ thuộc vào currentUser
  
  // Xử lý cuộc gọi đến
  const handleIncomingCall = useCallback((data) => {
    console.log('📞 Incoming call data:', data);

    // Kiểm tra data hợp lệ
    if (!data || !data.roomId || !data.caller) {
      console.error('❌ Invalid incoming call data:', data);
      return;
    }

    // Dừng ringtone hiện tại nếu có
    stopRingtone();

    // Phát ringtone
    playRingtone();

    // Set incoming call state
    setIncomingCall({
      roomId: data.roomId,
      caller: data.caller,
      status: 'ringing'
    });
  }, []); // Không cần dependencies
  
  // Xử lý chấp nhận cuộc gọi
  const handleCallAccepted = useCallback((data) => {
    console.log('✅ Call accepted data:', data);

    // Kiểm tra data hợp lệ
    if (!data || !data.roomId || !data.accepter) {
      console.error('❌ Invalid call accepted data:', data);
      return;
    }

    // Dừng ringtone
    stopRingtone();

    // Set active call
    setActiveCall({
      roomId: data.roomId,
      targetUser: data.accepter,
      status: 'connecting',
      startTime: new Date()
    });

    // Khởi tạo WebRTC connection
    initializeWebRTC(true, data.roomId);
  }, []); // Không cần dependencies
  
  // Xử lý từ chối cuộc gọi
  const handleCallRejected = useCallback((data) => {
    console.log('❌ Call rejected data:', data);

    // Dừng ringtone
    stopRingtone();

    // Reset trạng thái cuộc gọi
    setIncomingCall(null);
    setActiveCall(null);

    // Phát âm thanh từ chối
    playCallTone('busy');
  }, []); // Không cần dependencies
  
  // Cleanup socket connection
  const cleanupSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('🧹 Cleaning up socket connection...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);
  
  // Khởi tạo socket connection
  const initializeSocket = useCallback(() => {
    if (!socketRef.current && currentUser && currentUser.id) {
      console.log('🔌 Initializing socket connection...');
      
      // Kết nối đến signaling server
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        query: {
          userId: currentUser.id
        }
      });
      
      socketRef.current = socket;
      
      // Socket event listeners
      socket.on('connect', () => {
        console.log('✅ Connected to signaling server');
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from signaling server:', reason);
      });
      
      socket.on('incoming-call', (data) => {
        console.log('📞 Incoming call:', data);
        handleIncomingCall(data);
      });
      
      socket.on('call-accepted', (data) => {
        console.log('✅ Call accepted:', data);
        handleCallAccepted(data);
      });
      
      socket.on('call-rejected', (data) => {
        console.log('❌ Call rejected:', data);
        handleCallRejected(data);
      });
      
      socket.on('call-ended', (data) => {
        console.log('🔚 Call ended:', data);
        handleCallEnded(data);
      });
      
      socket.on('signal', (data) => {
        console.log('📡 Signal received:', data.type);
        if (peerRef.current && !peerRef.current.destroyed) {
          peerRef.current.signal(data.signal);
        }
      });
    }
  }, [currentUser]); // Chỉ phụ thuộc vào currentUser
  
  // Bắt đầu cuộc gọi đi
  const startOutgoingCall = useCallback(async (targetUser) => {
    console.log('📞 Starting outgoing call to:', targetUser);
    console.log('Current user:', currentUser);

    if (!currentUser || !currentUser.id || !socketRef.current) {
      console.error('❌ Cannot start call - missing requirements:', {
        currentUser: !!currentUser,
        currentUserId: currentUser?.id,
        socket: !!socketRef.current
      });
      return;
    }

    if (!targetUser || !targetUser.id) {
      console.error('❌ Cannot start call - invalid target user:', targetUser);
      return;
    }

    try {
      // Tạo room ID - sử dụng string comparison cho UUIDs
      const userIds = [currentUser.id, targetUser.id].sort();
      const roomId = `call-${userIds[0]}-${userIds[1]}`;

      console.log('📞 Room ID:', roomId);

      // Set active call state
      setActiveCall({
        roomId,
        targetUser,
        status: 'calling',
        startTime: new Date()
      });
      
      // Phát ringtone
      playRingtone();
      
      // Gửi yêu cầu cuộc gọi đến signaling server
      socketRef.current.emit('start-call', {
        roomId,
        caller: {
          id: currentUser.id,
          name: currentUser.display_name || currentUser.email,
          avatar_url: currentUser.avatar_url
        },
        targetUserId: targetUser.id
      });
      
    } catch (error) {
      console.error('❌ Error starting outgoing call:', error);
      setActiveCall(null);
      stopRingtone();
    }
  }, [currentUser]); // Chỉ phụ thuộc vào currentUser
  
  // Từ chối cuộc gọi đến
  const rejectIncomingCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return;
    
    console.log('❌ Rejecting incoming call from:', incomingCall.caller);
    
    // Dừng ringtone
    stopRingtone();
    
    // Gửi từ chối đến signaling server
    socketRef.current.emit('reject-call', {
      roomId: incomingCall.roomId
    });
    
    // Reset trạng thái
    setIncomingCall(null);
  }, [incomingCall]); // Chỉ phụ thuộc vào incomingCall
  
  // Chấp nhận cuộc gọi đến
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !incomingCall.caller || !socketRef.current || !currentUser || !currentUser.id) {
      console.error('❌ Cannot accept call - missing requirements:', {
        incomingCall: !!incomingCall,
        caller: !!incomingCall?.caller,
        socket: !!socketRef.current,
        currentUser: !!currentUser
      });
      return;
    }

    try {
      console.log('✅ Accepting incoming call from:', incomingCall.caller);

      // Dừng ringtone
      stopRingtone();

      // Set active call
      setActiveCall({
        roomId: incomingCall.roomId,
        targetUser: incomingCall.caller,
        status: 'connecting',
        startTime: new Date()
      });
      
      // Reset incoming call
      setIncomingCall(null);
      
      // Gửi chấp nhận đến signaling server
      socketRef.current.emit('accept-call', {
        roomId: incomingCall.roomId,
        accepter: {
          id: currentUser.id,
          name: currentUser.display_name || currentUser.email,
          avatar_url: currentUser.avatar_url
        }
      });
      
      // Khởi tạo WebRTC connection
      await initializeWebRTC(false, incomingCall.roomId);
      
    } catch (error) {
      console.error('❌ Error accepting incoming call:', error);
      rejectIncomingCall();
    }
  }, [incomingCall, currentUser]); // Chỉ phụ thuộc vào incomingCall và currentUser
  
  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);
  
  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, [localStream]);
  
  // Khởi tạo socket khi component mount
  useEffect(() => {
    if (currentUser) {
      initializeSocket();
    }

    return () => {
      cleanupSocket();
      cleanupWebRTC();
      stopRingtone();
    };
  }, [currentUser]); // Chỉ phụ thuộc vào currentUser
  
  // Context value
  const value = {
    // Trạng thái
    activeCall,
    incomingCall,
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    
    // Hàm điều khiển
    startOutgoingCall,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleVideo,
    toggleAudio
  };
  
  return (
    <CallManagerContext.Provider value={value}>
      {children}
    </CallManagerContext.Provider>
  );
};