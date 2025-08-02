import React, { useState } from 'react';
import VideoCallSimple from '../components/VideoCallSimple';
import { useAuth } from '../context/AuthContext';

const VideoCallTest = () => {
  const { currentUser } = useAuth();
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [roomId, setRoomId] = useState('');

  const startCall = () => {
    if (!roomId.trim()) {
      alert('Vui lòng nhập Room ID');
      return;
    }
    setShowVideoCall(true);
  };

  const endCall = () => {
    setShowVideoCall(false);
  };

  const generateRoomId = () => {
    const id = Math.random().toString(36).substring(2, 15);
    setRoomId(id);
  };

  if (!currentUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <h2>Vui lòng đăng nhập để sử dụng video call</h2>
        <a href="/login" style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px'
        }}>
          Đăng nhập
        </a>
      </div>
    );
  }

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <h1>🎥 Video Call Test</h1>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3>Thông tin người dùng</h3>
        <p><strong>Tên:</strong> {currentUser.name}</p>
        <p><strong>ID:</strong> {currentUser.id}</p>
      </div>

      {!showVideoCall ? (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              Room ID:
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Nhập Room ID hoặc tạo mới"
              style={{
                padding: '10px',
                width: '300px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                marginRight: '10px'
              }}
            />
            <button
              onClick={generateRoomId}
              style={{
                padding: '10px 15px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Tạo Room ID
            </button>
          </div>

          <button
            onClick={startCall}
            disabled={!roomId.trim()}
            style={{
              padding: '15px 30px',
              backgroundColor: roomId.trim() ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: roomId.trim() ? 'pointer' : 'not-allowed',
              fontSize: '16px'
            }}
          >
            🎥 Bắt đầu Video Call
          </button>

          <div style={{
            marginTop: '30px',
            padding: '20px',
            backgroundColor: '#e9ecef',
            borderRadius: '8px',
            textAlign: 'left'
          }}>
            <h4>📋 Hướng dẫn test:</h4>
            <ol>
              <li>Nhập hoặc tạo một Room ID</li>
              <li>Click "Bắt đầu Video Call"</li>
              <li>Cho phép truy cập camera và microphone</li>
              <li>Mở tab/cửa sổ khác với cùng Room ID để test 2 người</li>
              <li>Hoặc chia sẻ Room ID cho người khác để tham gia</li>
            </ol>
            
            <div style={{ marginTop: '15px' }}>
              <strong>🔧 Signaling Server:</strong> http://localhost:3000<br/>
              <strong>📊 Server Stats:</strong> <a href="http://localhost:3000/stats" target="_blank" rel="noopener noreferrer">http://localhost:3000/stats</a>
            </div>
          </div>
        </div>
      ) : (
        <VideoCallSimple
          roomId={roomId}
          onClose={endCall}
        />
      )}
    </div>
  );
};

export default VideoCallTest;
