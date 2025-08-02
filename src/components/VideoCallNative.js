import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const VideoCallNative = () => {
  const [roomId, setRoomId] = useState('test123');
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('Chưa kết nối');
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerConnectionRef = useRef();
  const localStreamRef = useRef();
  const userId = useRef('user-' + Date.now()).current;
  const isInitiator = useRef(false);

  const pcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const createPeerConnection = () => {
    console.log('Creating peer connection...');
    const pc = new RTCPeerConnection(pcConfig);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        socketRef.current.emit('signal', {
          roomId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate
          },
          userId
        });
      }
    };
    
    pc.ontrack = (event) => {
      console.log('Received remote stream');
      setStatus('Nhận được video từ đối phương!');
      setHasRemoteStream(true);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setStatus('Đã kết nối P2P!');
      }
    };
    
    return pc;
  };

  const startCall = async () => {
    try {
      setStatus('Đang lấy camera...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setStatus('Đang kết nối server...');
      
      // Connect to signaling server
      const socket = io('http://localhost:3000');
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
        console.log('User joined - I am initiator');
        isInitiator.current = true;
        setStatus('Tạo kết nối...');
        initiatePeerConnection();
      });
      
      socket.on('user-already-in-room', () => {
        console.log('User already in room - I am receiver');
        isInitiator.current = false;
        setStatus('Chờ kết nối...');
        // Just create peer connection, wait for offer
        peerConnectionRef.current = createPeerConnection();
        addLocalStream();
      });
      
      socket.on('signal', async (data) => {
        console.log('Received signal:', data.signal.type);
        await handleSignal(data.signal);
      });
      
      setIsConnected(true);
      
    } catch (error) {
      console.error('Error:', error);
      setStatus('Lỗi: ' + error.message);
    }
  };

  const addLocalStream = () => {
    if (localStreamRef.current && peerConnectionRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, localStreamRef.current);
      });
      console.log('Added local stream to peer connection');
    }
  };

  const initiatePeerConnection = async () => {
    try {
      peerConnectionRef.current = createPeerConnection();
      addLocalStream();
      
      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      console.log('Sending offer');
      socketRef.current.emit('signal', {
        roomId,
        signal: offer,
        userId
      });
      
    } catch (error) {
      console.error('Error creating offer:', error);
      setStatus('Lỗi tạo offer: ' + error.message);
    }
  };

  const handleSignal = async (signal) => {
    try {
      if (!peerConnectionRef.current) {
        console.log('No peer connection, creating one...');
        peerConnectionRef.current = createPeerConnection();
        addLocalStream();
      }

      if (signal.type === 'offer') {
        console.log('Handling offer');
        await peerConnectionRef.current.setRemoteDescription(signal);
        
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        console.log('Sending answer');
        socketRef.current.emit('signal', {
          roomId,
          signal: answer,
          userId
        });
        
      } else if (signal.type === 'answer') {
        console.log('Handling answer');
        await peerConnectionRef.current.setRemoteDescription(signal);
        
      } else if (signal.type === 'ice-candidate') {
        console.log('Handling ICE candidate');
        await peerConnectionRef.current.addIceCandidate(signal.candidate);
      }
      
    } catch (error) {
      console.error('Error handling signal:', error);
      setStatus('Lỗi xử lý signal: ' + error.message);
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
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
      <h2>🎥 Video Call Native WebRTC</h2>
      
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

export default VideoCallNative;
