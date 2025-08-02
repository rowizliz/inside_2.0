import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const VideoCallTest = () => {
  const [roomId, setRoomId] = useState('test123');
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Chưa kết nối');
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9));
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();

  const startCall = async () => {
    try {
      console.log('🚀 Starting video call...');

      // Cleanup existing connections first
      if (socketRef.current) {
        console.log('🧹 Cleaning up previous socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (peerRef.current) {
        console.log('🧹 Cleaning up previous peer connection');
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (localStreamRef.current) {
        console.log('🧹 Cleaning up previous media stream');
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      setStatus('Đang lấy camera...');
      console.log('📹 Requesting user media...');

      // Get user media with better error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true
        });
        console.log('✅ Got media stream:', stream.getTracks().map(t => t.kind));
      } catch (mediaError) {
        console.error('❌ Media error:', mediaError);
        setStatus('Lỗi truy cập camera/mic: ' + mediaError.message);
        return;
      }

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        try {
          await localVideoRef.current.play();
          console.log('✅ Local video playing');
        } catch (playError) {
          console.log('Local video play error:', playError);
        }
      }

      setStatus('Đang kết nối server...');
      console.log('🔌 Connecting to signaling server...');

      // Connect to signaling server
      const socket = io('http://localhost:3001', {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });
      socketRef.current = socket;
      console.log('📡 Socket created, waiting for connection...');
      
      socket.on('connect', () => {
        console.log('✅ Connected to server');
        setStatus('Đang vào phòng...');
        socket.emit('join-room', {
          roomId,
          userId,
          name: 'Test User'
        });
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setStatus('Lỗi kết nối server: ' + error.message);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setStatus('Mất kết nối server: ' + reason);
      });

      socket.on('user-joined', (data) => {
        console.log('👤 User joined, creating peer as initiator');
        setStatus('Có người vào phòng, tạo kết nối...');
        setTimeout(() => createPeer(true, stream), 100);
      });

      socket.on('user-already-in-room', (data) => {
        console.log('👤 User already in room, creating peer as receiver');
        setStatus('Đã có người trong phòng, tham gia...');
        setTimeout(() => createPeer(false, stream), 100);
      });

      socket.on('signal', (data) => {
        console.log('📨 Received signal:', data.signal.type);
        if (peerRef.current) {
          try {
            peerRef.current.signal(data.signal);
          } catch (signalError) {
            console.error('Error processing signal:', signalError);
          }
        } else {
          console.error('❌ No peer to signal');
        }
      });

      setIsConnected(true);
      
    } catch (error) {
      console.error('Error:', error);
      setStatus('Lỗi: ' + error.message);
    }
  };

  const createPeer = (initiator, stream) => {
    try {
      // Cleanup existing peer
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }

      console.log(`🔧 Creating peer - initiator: ${initiator}`);
      console.log('Stream tracks:', stream ? stream.getTracks().map(t => t.kind) : 'No stream');

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: stream || undefined,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('signal', (data) => {
        console.log('📡 Sending signal:', data.type);
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('signal', {
            roomId,
            signal: data,
            userId
          });
        }
      });

      peer.on('connect', () => {
        console.log('🔗 P2P connection established!');
        setStatus('Đã kết nối P2P!');
      });

      peer.on('stream', (remoteStream) => {
        try {
          setStatus('Nhận được video từ đối phương!');
          console.log('📺 Received remote stream:', remoteStream);
          console.log('Remote stream tracks:', remoteStream.getTracks());

          if (remoteVideoRef.current && remoteStream.getTracks().length > 0) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(e => console.log('Remote video play error:', e));
            console.log('✅ Remote video set and playing');
          }
        } catch (error) {
          console.error('Error handling remote stream:', error);
        }
      });

      peer.on('error', (error) => {
        console.error('Peer error:', error);
        setStatus('Lỗi P2P: ' + error.message);
      });

      peer.on('close', () => {
        console.log('Peer connection closed');
        setStatus('Kết nối P2P đã đóng');
      });

      peerRef.current = peer;
    } catch (error) {
      console.error('Error creating peer:', error);
      setStatus('Lỗi tạo kết nối P2P: ' + error.message);
    }
  };

  const endCall = () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
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
    } catch (error) {
      console.error('Error ending call:', error);
      setStatus('Lỗi khi ngắt kết nối: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🎥 Video Call Test</h2>
      
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

export default VideoCallTest;
