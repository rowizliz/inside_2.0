import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const SimpleVideoTest = () => {
  const [status, setStatus] = useState('Sẵn sàng');
  const [isConnected, setIsConnected] = useState(false);
  const [roomId] = useState('test123');
  const [userId] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();

  // Cleanup function
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const startCall = async () => {
    try {
      // Prevent multiple calls
      if (isConnected || socketRef.current) {
        console.log('⚠️ Already connected or connecting...');
        return;
      }

      console.log('🚀 Starting simple video test...');
      setStatus('Đang lấy camera...');

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      console.log('📹 Got local stream, connecting to server...');
      setStatus('Đang kết nối server...');

      // Connect to server
      const socket = io('http://localhost:3001', {
        forceNew: true
      });
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('✅ Connected to server');
        setStatus('Đang vào phòng...');
        socket.emit('join-room', {
          roomId,
          userId,
          name: 'Test User'
        });
      });
      
      socket.on('user-joined', () => {
        console.log('👤 Another user joined, creating peer connection...');
        setStatus('Tạo kết nối P2P...');
        createPeer(true, stream);
      });
      
      socket.on('user-already-in-room', () => {
        console.log('👤 User already in room, joining...');
        setStatus('Tham gia cuộc gọi...');
        createPeer(false, stream);
      });
      
      socket.on('signal', (data) => {
        console.log('📨 Received signal');
        if (peerRef.current) {
          peerRef.current.signal(data.signal);
        }
      });
      
      setIsConnected(true);
      setStatus('Đã kết nối, chờ người khác...');
      
    } catch (error) {
      console.error('❌ Error:', error);
      setStatus('Lỗi: ' + error.message);
    }
  };

  const createPeer = (initiator, stream) => {
    console.log(`🔧 Creating peer (initiator: ${initiator})`);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream
    });

    peer.on('signal', (data) => {
      console.log('📡 Sending signal');
      socketRef.current.emit('signal', {
        roomId,
        signal: data,
        userId
      });
    });

    peer.on('connect', () => {
      console.log('🔗 P2P connected!');
      setStatus('Đã kết nối P2P!');
    });

    peer.on('stream', (remoteStream) => {
      console.log('📺 Received remote stream');
      setStatus('Nhận được video!');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('error', (error) => {
      console.error('❌ Peer error:', error);
      setStatus('Lỗi P2P: ' + error.message);
    });

    peerRef.current = peer;
  };

  const endCall = () => {
    console.log('🛑 Ending call...');

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsConnected(false);
    setStatus('Đã ngắt kết nối');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🎥 Simple Video Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Trạng thái:</strong> {status}</p>
        <p><strong>Room ID:</strong> {roomId}</p>
        <p><strong>User ID:</strong> {userId}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {!isConnected ? (
          <button 
            onClick={startCall}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            🎥 Bắt đầu Video Call
          </button>
        ) : (
          <button 
            onClick={endCall}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            ❌ Kết thúc
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
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
          <h3>📺 Video đối phương</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '300px',
              height: '200px',
              backgroundColor: '#000',
              border: '2px solid #ccc'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SimpleVideoTest;
