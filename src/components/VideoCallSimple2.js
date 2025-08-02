import React, { useState, useRef, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { SOCKET_URL } from '../config/environment';

const VideoCallSimple2 = () => {
  const [roomId, setRoomId] = useState('test123');
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Chưa kết nối');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();
  const userIdRef = useRef('user-' + Math.random().toString(36).substr(2, 9));

  // Cleanup function
  const cleanup = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {
        console.log('Peer destroy error:', e);
      }
      peerRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (e) {
        console.log('Socket disconnect error:', e);
      }
      socketRef.current = null;
    }
    setHasRemoteStream(false);
  }, []);

  // Create peer connection
  const createPeer = useCallback((initiator, stream) => {
    console.log(`🔧 Creating peer - initiator: ${initiator}`);

    // Cleanup existing peer
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (e) {
        console.log('Previous peer destroy error:', e);
      }
      peerRef.current = null;
    }
    
    let peer;
    try {
      peer = new Peer({
        initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });
    } catch (error) {
      console.error('Error creating peer:', error);
      setStatus('Lỗi tạo peer: ' + error.message);
      return;
    }

    peer.on('signal', (data) => {
      console.log('📡 Sending signal:', data.type);
      if (socketRef.current) {
        socketRef.current.emit('signal', {
          roomId,
          signal: data,
          userId: userIdRef.current
        });
      }
    });

    peer.on('connect', () => {
      console.log('🔗 P2P connection established!');
      setStatus('Đã kết nối P2P!');
    });

    peer.on('stream', (remoteStream) => {
      try {
        console.log('📺 Received remote stream:', remoteStream);
        console.log('Remote stream tracks:', remoteStream.getTracks());
        setStatus('Nhận được video từ đối phương!');
        setHasRemoteStream(true);

        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
          console.log('✅ Remote video set and playing');
        }
      } catch (error) {
        console.error('Error handling remote stream:', error);
        setStatus('Lỗi xử lý video: ' + error.message);
      }
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
      setStatus('Lỗi P2P: ' + error.message);
    });

    peer.on('close', () => {
      console.log('🔌 Peer connection closed');
      setHasRemoteStream(false);
    });

    peerRef.current = peer;
  }, [roomId]);

  const startCall = async () => {
    try {
      // Cleanup first
      cleanup();
      
      setStatus('Đang lấy camera...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(e => console.log('Local video play error:', e));
        console.log('✅ Local video set and playing');
      }
      
      setStatus('Đang kết nối server...');
      
      // Connect to signaling server
      const socket = io(SOCKET_URL, {
        forceNew: true,
        transports: ['websocket']
      });
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('🔌 Connected to signaling server');
        setStatus('Đang vào phòng...');
        socket.emit('join-room', {
          roomId,
          userId: userIdRef.current,
          name: 'Test User'
        });
      });
      
      socket.on('user-joined', (data) => {
        console.log('👤 User joined, creating peer as initiator');
        setStatus('Có người vào phòng, tạo kết nối...');
        setTimeout(() => createPeer(true, stream), 500);
      });
      
      socket.on('user-already-in-room', (data) => {
        console.log('👤 User already in room, creating peer as receiver');
        setStatus('Đã có người trong phòng, tham gia...');
        setTimeout(() => createPeer(false, stream), 500);
      });
      
      socket.on('signal', (data) => {
        console.log('📨 Received signal:', data.signal.type);
        if (peerRef.current) {
          peerRef.current.signal(data.signal);
        } else {
          console.error('❌ No peer to signal');
        }
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from server');
        setStatus('Mất kết nối server');
      });
      
      setIsConnected(true);
      
    } catch (error) {
      console.error('Error:', error);
      setStatus('Lỗi: ' + error.message);
    }
  };

  const endCall = () => {
    cleanup();
    setIsConnected(false);
    setStatus('Đã ngắt kết nối');
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🎥 Video Call Simple 2</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>Room ID: </label>
        <input 
          type="text" 
          value={roomId} 
          onChange={(e) => setRoomId(e.target.value)}
          disabled={isConnected}
          style={{ padding: '5px', marginLeft: '10px' }}
        />
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Trạng thái: </strong>{status}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>User ID: </strong>{userIdRef.current}
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        {!isConnected ? (
          <button 
            onClick={startCall}
            style={{
              padding: '10px 20px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Bắt đầu Video Call
          </button>
        ) : (
          <button 
            onClick={endCall}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Kết thúc Call
          </button>
        )}
      </div>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h3>📹 Video của bạn</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '300px',
              height: '200px',
              backgroundColor: '#000',
              border: '2px solid #ccc'
            }}
          />
        </div>
        
        <div>
          <h3>📺 Video đối phương {hasRemoteStream ? '✅' : '❌'}</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '300px',
              height: '200px',
              backgroundColor: '#000',
              border: hasRemoteStream ? '2px solid #4CAF50' : '2px solid #ccc'
            }}
          />
        </div>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>Hướng dẫn test:</strong></p>
        <ol>
          <li>Mở 2 tab browser với cùng URL này</li>
          <li>Nhập cùng Room ID ở cả 2 tab</li>
          <li>Click "Bắt đầu Video Call" ở cả 2 tab</li>
          <li>Cho phép truy cập camera/microphone</li>
          <li>Chờ vài giây để kết nối</li>
        </ol>
      </div>
    </div>
  );
};

export default VideoCallSimple2;
