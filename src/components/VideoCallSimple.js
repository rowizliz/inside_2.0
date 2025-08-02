import React, { useState, useRef, useEffect, useCallback } from 'react';
import Peer from 'simple-peer';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const VideoCallSimple = ({ roomId, onClose }) => {
  const { currentUser } = useAuth();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('initializing');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const socketRef = useRef();

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up video call...');

    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
    }

    if (peerRef.current && !peerRef.current.destroyed) {
      try {
        peerRef.current.destroy();
        console.log('🗑️ Peer destroyed');
      } catch (error) {
        console.log('⚠️ Error destroying peer:', error);
      }
      peerRef.current = null;
    }

    if (socketRef.current && socketRef.current.connected) {
      try {
        socketRef.current.disconnect();
        console.log('🔌 Socket disconnected');
      } catch (error) {
        console.log('⚠️ Error disconnecting socket:', error);
      }
      socketRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream]);

  // Ensure local video plays when stream is available
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
    }
  }, [localStream]);

  // Ensure remote video plays when stream is available
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
    }
  }, [remoteStream]);

  const initializeCall = useCallback(async () => {
    try {
      console.log('🎥 Starting video call...');
      setCallStatus('getting-media');

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log('✅ Got local stream:', stream);
      console.log('Stream tracks:', stream.getTracks());
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Set local video srcObject');
      } else {
        console.error('❌ localVideoRef.current is null');
      }

      setCallStatus('connecting');

      // Connect to signaling server
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('🔌 Connected to signaling server');
        setCallStatus('joining-room');
        socket.emit('join-room', {
          roomId,
          userId: currentUser.id,
          name: currentUser.name || 'User'
        });
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setCallStatus('connection-error');
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected, try to reconnect
          socket.connect();
        }
      });

      socket.on('user-joined', (data) => {
        console.log('👤 User joined:', data);
        if (data.userId !== currentUser.id) {
          createPeer(true, stream);
        }
      });

      socket.on('user-already-in-room', (data) => {
        console.log('👤 User already in room, joining as receiver', data);
        createPeer(false, stream);
      });

      socket.on('signal', (data) => {
        console.log('📥 Received WebRTC signal from user:', data.userId);
        if (peerRef.current && !peerRef.current.destroyed && data.userId !== currentUser.id) {
          try {
            peerRef.current.signal(data.signal);
            console.log('✅ Signal processed successfully');
          } catch (error) {
            console.error('❌ Error processing signal:', error);
          }
        } else {
          console.log('⚠️ Cannot process signal - peer not ready or destroyed');
        }
      });

      socket.on('user-left', () => {
        console.log('👤 User left');
        setCallStatus('peer-disconnected');
        setRemoteStream(null);
      });

    } catch (error) {
      console.error('❌ Error initializing call:', error);
      setCallStatus('error');
      if (error.name === 'NotAllowedError') {
        setCallStatus('permission-denied');
      }
    }
  }, [roomId, currentUser.id]);

  const createPeer = useCallback((initiator, stream) => {
    console.log(`🔗 Creating peer connection - initiator: ${initiator}`);

    // Clean up existing peer
    if (peerRef.current && !peerRef.current.destroyed) {
      try {
        peerRef.current.destroy();
        console.log('🗑️ Destroyed existing peer');
      } catch (error) {
        console.log('⚠️ Error destroying existing peer:', error);
      }
    }

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

    peer.on('signal', (data) => {
      console.log('📤 Sending WebRTC signal:', data.type);
      if (socketRef.current && socketRef.current.connected && !peer.destroyed) {
        socketRef.current.emit('signal', {
          roomId,
          signal: data,
          userId: currentUser.id
        });
      } else {
        console.log('⚠️ Cannot send signal - socket disconnected or peer destroyed');
      }
    });

    peer.on('connect', () => {
      console.log('✅ Peer connection established');
      setCallStatus('connected');
    });

    peer.on('stream', (remoteStream) => {
      console.log('📺 Received remote stream:', remoteStream);
      console.log('Remote stream tracks:', remoteStream.getTracks());
      if (!peer.destroyed) {
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          console.log('✅ Set remote video srcObject');
        } else {
          console.error('❌ remoteVideoRef.current is null');
        }
      }
    });

    peer.on('error', (error) => {
      console.error('❌ Peer connection error:', error);
      if (!peer.destroyed) {
        setCallStatus('peer-error');
        setRemoteStream(null);
      }
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed');
      setCallStatus('peer-disconnected');
      setRemoteStream(null);
    });

    peerRef.current = peer;
  }, [roomId, currentUser.id]);

  useEffect(() => {
    initializeCall();
    return cleanup;
  }, [initializeCall, cleanup]);

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    console.log('📞 Ending call');
    setCallStatus('ending');
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('leave-room', { roomId, userId: currentUser.id });
    }
    
    cleanup();
    onClose();
  };

  const getStatusMessage = () => {
    switch (callStatus) {
      case 'initializing': return 'Đang khởi tạo...';
      case 'getting-media': return 'Đang truy cập camera/mic...';
      case 'connecting': return 'Đang kết nối server...';
      case 'joining-room': return 'Đang tham gia phòng...';
      case 'connected': return 'Đã kết nối';
      case 'peer-error': return 'Lỗi kết nối peer';
      case 'peer-disconnected': return 'Người khác đã ngắt kết nối';
      case 'permission-denied': return 'Không có quyền truy cập camera/mic';
      case 'connection-error': return 'Lỗi kết nối server - Vui lòng thử lại';
      case 'ending': return 'Đang kết thúc cuộc gọi...';
      case 'error': return 'Có lỗi xảy ra';
      default: return 'Đang xử lý...';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '20px',
        maxWidth: '90%',
        width: '100%',
        justifyContent: 'center'
      }}>
        {/* Local Video */}
        <div style={{ position: 'relative' }}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '300px',
              height: '200px',
              backgroundColor: '#000',
              borderRadius: '8px'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            color: 'white',
            fontSize: '12px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            Bạn
          </div>
        </div>

        {/* Remote Video */}
        <div style={{ position: 'relative' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '300px',
              height: '200px',
              backgroundColor: '#000',
              borderRadius: '8px'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            color: 'white',
            fontSize: '12px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {remoteStream ? 'Người khác' : 'Đang chờ...'}
          </div>
        </div>
      </div>

      {/* Status */}
      <div style={{
        color: 'white',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        {getStatusMessage()}
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <button
          onClick={toggleVideo}
          style={{
            padding: '10px 20px',
            backgroundColor: isVideoEnabled ? '#28a745' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {isVideoEnabled ? '📹 Video On' : '📹 Video Off'}
        </button>

        <button
          onClick={toggleAudio}
          style={{
            padding: '10px 20px',
            backgroundColor: isAudioEnabled ? '#28a745' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          {isAudioEnabled ? '🎤 Mic On' : '🎤 Mic Off'}
        </button>

        <button
          onClick={endCall}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          📞 End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCallSimple;
