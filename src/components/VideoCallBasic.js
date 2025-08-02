import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { SOCKET_URL } from '../config/environment';

const VideoCallBasic = () => {
  const [roomId, setRoomId] = useState('test123');
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Chưa kết nối');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();
  const userId = useRef('user-' + Date.now()).current;

  const startCall = async () => {
    try {
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
      
      setStatus('Đang kết nối server...');
      
      // Connect to signaling server
      const socket = io(SOCKET_URL);
      socketRef.current = socket;
      
      socket.on('connect', () => {
        console.log('Connected to server');
        setStatus('Đang vào phòng...');
        socket.emit('join-room', {
          roomId,
          userId,
          name: 'Test User'
        });
      });
      
      socket.on('user-joined', () => {
        console.log('User joined - creating initiator peer');
        setStatus('Tạo kết nối...');
        createPeer(true, stream);
      });
      
      socket.on('user-already-in-room', () => {
        console.log('User already in room - creating receiver peer');
        setStatus('Tham gia kết nối...');
        createPeer(false, stream);
      });
      
      socket.on('signal', (data) => {
        console.log('Received signal:', data.signal.type);
        if (peerRef.current) {
          peerRef.current.signal(data.signal);
        }
      });
      
      setIsConnected(true);
      
    } catch (error) {
      console.error('Error:', error);
      setStatus('Lỗi: ' + error.message);
    }
  };

  const createPeer = (initiator, stream) => {
    console.log('Creating peer, initiator:', initiator);
    
    const peer = new Peer({
      initiator,
      trickle: false,
      stream
    });

    peer.on('signal', (data) => {
      console.log('Sending signal:', data.type);
      socketRef.current.emit('signal', {
        roomId,
        signal: data,
        userId
      });
    });

    peer.on('connect', () => {
      console.log('Peer connected!');
      setStatus('Đã kết nối P2P!');
    });

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream');
      setStatus('Nhận được video!');
      setHasRemoteStream(true);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on('error', (error) => {
      console.error('Peer error:', error);
      setStatus('Lỗi P2P: ' + error.message);
    });

    peerRef.current = peer;
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    setIsConnected(false);
    setHasRemoteStream(false);
    setStatus('Đã ngắt kết nối');
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🎥 Video Call Basic</h2>
      
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
        <strong>User ID: </strong>{userId}
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

export default VideoCallBasic;
