import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import io from 'socket.io-client';
import Peer from 'simple-peer';

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

  // Internal flags
  const inRoomRef = useRef(false);
  const joiningRoomRef = useRef(false);
  const connectingRef = useRef(false);

  // Signaling buffers and timers
  const pendingSignalsRef = useRef([]);
  const connectingTimerRef = useRef(null);
  const lastSignalAtRef = useRef(0);
  
  // Audio references
  const ringtoneRef = useRef(null);
  const callToneRef = useRef(null);
  
  // Phát ringtone
  const playRingtone = useCallback(() => {
    console.log('🔔 Playing ringtone...');
    try {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('/sounds/ringtone.wav');
        ringtoneRef.current.loop = true;
      }
      
      if (ringtoneRef.current.paused) {
        ringtoneRef.current.play().catch(e => console.error('❌ Ringtone play error:', e));
      }
    } catch (error) {
      console.error('❌ Ringtone error:', error);
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
    console.log(`🔊 Playing ${type} tone...`);
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
      
      callToneRef.current.play().catch(e => console.error('❌ Call tone play error:', e));
    } catch (error) {
      console.error('❌ Call tone error:', error);
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

    // Rời room nếu có
    if (socketRef.current && inRoomRef.current && activeCall?.roomId) {
      socketRef.current.emit('leave-room', {
        roomId: activeCall.roomId,
        userId: currentUser?.id
      });
      inRoomRef.current = false;
      joiningRoomRef.current = false;
    }

    // Reset trạng thái cuộc gọi
    setIncomingCall(null);
    setActiveCall(null);
    setRemoteStream(null);
    connectingRef.current = false;
  }, [cleanupWebRTC, stopRingtone, activeCall, currentUser]);
  
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
      if (inRoomRef.current) {
        socketRef.current.emit('leave-room', {
          roomId: activeCall.roomId,
          userId: currentUser?.id
        });
        inRoomRef.current = false;
        joiningRoomRef.current = false;
      }
    }

    // Cleanup WebRTC
    cleanupWebRTC();

    // Reset trạng thái
    setActiveCall(null);
    setIncomingCall(null);

    // Phát âm thanh kết thúc
    playCallTone('ended');
    connectingRef.current = false;
  }, [activeCall, cleanupWebRTC, playCallTone, stopRingtone, currentUser]);
  
  // Khởi tạo WebRTC connection
  const initializeWebRTC = useCallback(async (initiator, roomId) => {
    try {
      if (connectingRef.current) {
        console.log('⏳ initializeWebRTC ignored: already connecting');
        return;
      }
      connectingRef.current = true;

      // Clear previous buffers/timers
      pendingSignalsRef.current = [];
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }

      console.log('🌐 Initializing WebRTC connection...');
      console.log('📍 Details:', {
        initiator,
        roomId,
        socketConnected: socketRef.current?.connected,
        currentUserId: currentUser?.id
      });

      // Ensure joined room before signaling
      if (socketRef.current && !inRoomRef.current && !joiningRoomRef.current && roomId) {
        console.log('🚪 Joining signaling room:', roomId);
        joiningRoomRef.current = true;
        socketRef.current.emit('join-room', { roomId, userId: currentUser?.id });
        inRoomRef.current = true;
      }

      // Lấy media stream với constraints thân thiện iOS + fallback
      let stream;
      const tryGetUserMedia = async () => {
        // Ưu tiên camera trước (selfie) và micro
        const primary = { audio: true, video: { facingMode: 'user' } };
        try {
          return await navigator.mediaDevices.getUserMedia(primary);
        } catch (e) {
          // Nếu lỗi do deviceId/facingMode không khả dụng hoặc NotFound → fallback video:any
          if (e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError' || e.name === 'AbortError')) {
            console.warn('⚠️ Primary constraints failed, retrying with generic {audio:true, video:true}', e);
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          }
          // Nếu bị chặn quyền, ném lại để nhánh catch ngoài xử lý thông báo
          throw e;
        }
      };

      try {
        stream = await tryGetUserMedia();
      } catch (e) {
        // Thử xóa deviceId đã cache (nếu có) và thử lại lần cuối
        try {
          console.warn('⚠️ Retry without any cached deviceId, using minimal audio-only as last resort');
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'user' } });
        } catch (e2) {
          // Thử audio-only để tránh chặn camera trên iOS Private
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch (e3) {
            throw e; // trả về lỗi gốc để xử lý phía dưới
          }
        }
      }

      console.log('📹 Got local stream:', stream && stream.id);

      setLocalStream(stream);

      // Safety: ensure we are in signaling room
      if (socketRef.current && !inRoomRef.current && !joiningRoomRef.current && roomId) {
        console.log('🚪 Joining signaling room:', roomId);
        joiningRoomRef.current = true;
        socketRef.current.emit('join-room', { roomId, userId: currentUser?.id });
        inRoomRef.current = true;
      }

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
        // Debounce ICE candidates to avoid spam (10ms window)
        const now = Date.now();
        if (data.candidate && now - lastSignalAtRef.current < 10) {
          return;
        }
        lastSignalAtRef.current = now;

        console.log('📡 Sending signal:', data.type || (data.candidate ? 'candidate' : 'data'));
        if (socketRef.current && socketRef.current.connected && currentUser && currentUser.id && roomId && inRoomRef.current) {
          socketRef.current.emit('signal', {
            roomId: roomId,
            signal: data,
            userId: currentUser.id
          });
        } else {
          console.warn('⚠️ Queueing signal because requirements not ready');
          pendingSignalsRef.current.push(data);
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
        connectingRef.current = false;
      });
      
      peer.on('error', (error) => {
        console.error('❌ Peer connection error:', error);
        connectingRef.current = false;
        endCall();
      });
      
    } catch (error) {
      console.error('❌ Error initializing WebRTC:', error);
      // Thông điệp thân thiện cho các lỗi phổ biến trên mobile
      if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        alert('Trình duyệt đã chặn quyền Camera/Micro. Vui lòng vào Settings/Safari → Website → cấp quyền Camera & Micro cho inside-app.vercel.app, sau đó tải lại trang.');
      } else if (error && (error.name === 'NotFoundError' || error.message?.includes('Requested device not found'))) {
        alert('Không tìm thấy thiết bị Camera/Micro phù hợp. Hãy kiểm tra lại quyền truy cập, tắt chế độ ẩn danh/Private hoặc thử cắm tai nghe có mic.');
      } else {
        alert('Không thể khởi tạo cuộc gọi do lỗi thiết bị. Vui lòng thử lại.');
      }
      connectingRef.current = false;
      endCall();
    }
  }, [currentUser, handleCallEnded, endCall, stopRingtone, playCallTone]);
  
  // Xử lý cuộc gọi đến
  const handleIncomingCall = useCallback((data) => {
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
  }, [playRingtone, stopRingtone]);
  
  // Xử lý chấp nhận cuộc gọi
  const handleCallAccepted = useCallback((data) => {
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
  }, [initializeWebRTC, stopRingtone]);
  
  // Xử lý từ chối cuộc gọi
  const handleCallRejected = useCallback((data) => {
    // Dừng ringtone
    stopRingtone();
    
    // Reset trạng thái cuộc gọi
    setIncomingCall(null);
    setActiveCall(null);
    
    // Phát âm thanh từ chối
    playCallTone('busy');
  }, [playCallTone, stopRingtone]);
  
  // Cleanup socket connection
  const cleanupSocket = useCallback(() => {
    // Không tự ý disconnect socket trong lifecycle nếu đang có call HOẶC đang connecting
    if (activeCall || connectingRef.current) {
      console.log('⏳ Skip socket cleanup during active call/connecting');
      return;
    }
    if (socketRef.current) {
      console.log('🧹 Cleaning up socket connection...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [activeCall]);
  
  // Khởi tạo socket connection
  const initializeSocket = useCallback(() => {
    if (!socketRef.current && currentUser && currentUser.id) {
      console.log('🔌 Initializing socket connection...');
      console.log('👤 Current user ID:', currentUser.id);
      
      // Kết nối đến signaling server – ép dùng wss và path chuẩn cho iOS
      const socket = io('wss://inside-new-signal.up.railway.app', {
        path: '/socket.io',
        transports: ['websocket'], // ép WS để tránh long-poll trên iOS
        timeout: 20000,
        forceNew: true,
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        query: {
          userId: currentUser.id
        }
      });
      
      socketRef.current = socket;
      
      // Socket event listeners
      socket.on('connect', () => {
        console.log('✅ Connected to signaling server');
        console.log('🆔 Socket ID:', socket.id);

        // Nếu đang có cuộc gọi mà chưa ở trong phòng, tự join lại
        if (activeCall?.roomId && !inRoomRef.current) {
          console.log('🔁 Rejoining room after reconnect:', activeCall.roomId);
          socket.emit('join-room', { roomId: activeCall.roomId, userId: currentUser?.id });
          inRoomRef.current = true;
        }

        // Flush các outbound signals đã queue (nếu có peer và đang ở trong phòng)
        if (peerRef.current && !peerRef.current.destroyed && inRoomRef.current && pendingSignalsRef.current.length) {
          console.log(`🚀 Flushing ${pendingSignalsRef.current.length} pending outbound signals`);
          const toSend = [...pendingSignalsRef.current];
          pendingSignalsRef.current = [];
          toSend.forEach(sig => {
            socket.emit('signal', {
              roomId: activeCall?.roomId,
              signal: sig,
              userId: currentUser?.id
            });
          });
        }
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
        console.error('🔍 Error type:', error.type);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from signaling server:', reason);
        // Không cleanup trong lúc đang có cuộc gọi; để Socket.IO tự reconnect
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          socket.connect();
        }
      });
      
      socket.on('incoming-call', (data) => {
        console.log('📞 Incoming call:', data);
        handleIncomingCall(data);
      });
      
      socket.on('call-accepted', (data) => {
        console.log('✅ Call accepted:', data);

        // Join room before creating peer for caller
        if (!inRoomRef.current) {
          console.log('🚪 Caller joining room:', data.roomId);
          socket.emit('join-room', { roomId: data.roomId, userId: currentUser?.id });
          inRoomRef.current = true;
        }

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
        console.log('📡 Signal received:', data.signal?.type || (data.signal?.candidate ? 'candidate' : 'unknown'));

        // Nếu peer chưa sẵn sàng, buffer lại
        if (!peerRef.current || peerRef.current.destroyed) {
          console.warn('⚠️ Peer not ready, buffering inbound signal');
          pendingSignalsRef.current.push(data.signal);
          return;
        }

        // Nếu có signal đang pending trước đó, flush trước rồi mới apply tín hiệu mới
        if (pendingSignalsRef.current.length) {
          console.log(`🧰 Flushing ${pendingSignalsRef.current.length} buffered inbound signals`);
          const buffered = [...pendingSignalsRef.current];
          pendingSignalsRef.current = [];
          buffered.forEach(sig => {
            try {
              peerRef.current.signal(sig);
            } catch (e) {
              console.error('❌ Error applying buffered signal:', e);
            }
          });
        }

        console.log('✅ Applying signal to peer');
        try {
          peerRef.current.signal(data.signal);
        } catch (e) {
          console.error('❌ Error applying signal, will retry once:', e);
          setTimeout(() => {
            try {
              peerRef.current && peerRef.current.signal(data.signal);
            } catch (e2) {
              console.error('❌ Retry failed applying signal:', e2);
            }
          }, 300);
        }
      });
    }
  }, [currentUser, handleCallAccepted, handleCallEnded, handleCallRejected, handleIncomingCall]);
  
  // Bắt đầu cuộc gọi đi
  const startOutgoingCall = useCallback(async (targetUser) => {
    console.log('📞 Start outgoing call requested');

    if (!currentUser || !currentUser.id) {
      console.error('❌ No current user');
      return;
    }

    if (!socketRef.current || !socketRef.current.connected) {
      console.error('❌ Socket not connected');
      alert('Không thể kết nối đến server. Vui lòng thử lại sau.');
      return;
    }

    try {
      console.log('📞 Starting outgoing call to:', targetUser);

      // Tạo room ID - sử dụng string comparison cho UUIDs
      const userIds = [currentUser.id, targetUser.id].sort();
      const roomId = `call-${userIds[0]}-${userIds[1]}`;

      // Join room trước khi gửi start-call
      if (!inRoomRef.current) {
        console.log('🚪 Caller pre-joining room:', roomId);
        socketRef.current.emit('join-room', { roomId, userId: currentUser.id });
        inRoomRef.current = true;
      }

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
  }, [currentUser, playRingtone, stopRingtone]);
  
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
  }, [incomingCall, stopRingtone]);
  
  // Chấp nhận cuộc gọi đến
  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !socketRef.current || !currentUser || !currentUser.id) return;

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

      // Callee join room trước
      if (!inRoomRef.current) {
        console.log('🚪 Callee joining room:', incomingCall.roomId);
        socketRef.current.emit('join-room', { roomId: incomingCall.roomId, userId: currentUser.id });
        inRoomRef.current = true;
      }

      // Khởi tạo WebRTC connection (callee tạo peer trước)
      await initializeWebRTC(false, incomingCall.roomId);

      // Sau khi peer sẵn sàng, gửi chấp nhận đến signaling server
      socketRef.current.emit('accept-call', {
        roomId: incomingCall.roomId,
        accepter: {
          id: currentUser.id,
          name: currentUser.display_name || currentUser.email,
          avatar_url: currentUser.avatar_url
        }
      });

    } catch (error) {
      console.error('❌ Error accepting incoming call:', error);
      rejectIncomingCall();
    }
  }, [incomingCall, currentUser, initializeWebRTC, stopRingtone, rejectIncomingCall]);
  
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
      // Chỉ cleanup khi không có cuộc gọi đang diễn ra HOẶC đang connecting
      if (!activeCall && !connectingRef.current) {
        cleanupSocket();
        cleanupWebRTC();
        stopRingtone();
        inRoomRef.current = false;
        joiningRoomRef.current = false;
        connectingRef.current = false;
      } else {
        console.log('⏳ Skip cleanup on unmount due to active call/connecting');
      }
    };
  }, [currentUser, initializeSocket, cleanupSocket, cleanupWebRTC, stopRingtone, activeCall]);

  // Watchdog: tự kết thúc nếu connecting quá lâu
  useEffect(() => {
    // Clear timer cũ nếu có
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }

    const isConnecting = !!activeCall && (activeCall.status === 'calling' || activeCall.status === 'connecting');

    if (isConnecting) {
      connectingTimerRef.current = setTimeout(() => {
        // Nếu sau timeout vẫn chưa có remoteStream và chưa connected, kết thúc cuộc gọi
        if (!remoteStream && activeCall && (activeCall.status === 'calling' || activeCall.status === 'connecting')) {
          console.warn('⏱️ Connecting timeout reached, ending call');
          endCall();
        }
      }, 15000); // 15s
    }

    return () => {
      if (connectingTimerRef.current) {
        clearTimeout(connectingTimerRef.current);
        connectingTimerRef.current = null;
      }
    };
  }, [activeCall, remoteStream, endCall]);
  
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
    toggleAudio,
    
    // References (for debugging)
    peerRef: peerRef.current,
    socketConnected: socketRef.current?.connected || false
  };
  
  // Chỉ render children khi đã có currentUser hoặc đang loading
  if (!currentUser) {
    return <div>Loading...</div>;
  }
  
  return (
    <CallManagerContext.Provider value={value}>
      {children}
    </CallManagerContext.Provider>
  );
};