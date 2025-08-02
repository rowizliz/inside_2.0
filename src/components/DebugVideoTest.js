import React, { useState, useRef } from 'react';
import io from 'socket.io-client';

const DebugVideoTest = () => {
  const [status, setStatus] = useState('Sẵn sàng');
  const [logs, setLogs] = useState([]);
  const [roomId] = useState('test123');
  const [userId] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));
  
  const socketRef = useRef();

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  const testConnection = () => {
    addLog('🚀 Testing connection...');
    setStatus('Đang kết nối...');
    
    const socket = io('http://localhost:3001', {
      forceNew: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      addLog('✅ Connected to server');
      setStatus('Đã kết nối server');
      
      socket.emit('join-room', {
        roomId,
        userId,
        name: 'Debug User'
      });
      addLog(`📤 Sent join-room: ${roomId}, ${userId}`);
    });

    socket.on('connect_error', (error) => {
      addLog('❌ Connection error: ' + error.message);
      setStatus('Lỗi kết nối');
    });

    socket.on('disconnect', (reason) => {
      addLog('🔌 Disconnected: ' + reason);
      setStatus('Đã ngắt kết nối');
    });

    socket.on('user-joined', (data) => {
      addLog('👤 User joined: ' + JSON.stringify(data));
      setStatus('Có người vào phòng!');
    });

    socket.on('user-already-in-room', (data) => {
      addLog('👤 User already in room: ' + JSON.stringify(data));
      setStatus('Đã có người trong phòng!');
    });

    socket.on('signal', (data) => {
      addLog('📨 Received signal: ' + data.signal.type);
    });

    socket.on('room-users', (data) => {
      addLog('👥 Room users: ' + JSON.stringify(data));
    });
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      addLog('🛑 Manually disconnected');
      setStatus('Đã ngắt kết nối');
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🐛 Debug Video Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Trạng thái:</strong> {status}</p>
        <p><strong>Room ID:</strong> {roomId}</p>
        <p><strong>User ID:</strong> {userId}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testConnection}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          🔌 Test Connection
        </button>
        
        <button 
          onClick={disconnect}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            marginRight: '10px'
          }}
        >
          ❌ Disconnect
        </button>

        <button 
          onClick={clearLogs}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🧹 Clear Logs
        </button>
      </div>

      <div style={{
        border: '1px solid #ccc',
        padding: '10px',
        height: '400px',
        overflowY: 'scroll',
        backgroundColor: '#f9f9f9',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}>
        <h3>📋 Logs:</h3>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '5px' }}>
            {log}
          </div>
        ))}
        {logs.length === 0 && (
          <div style={{ color: '#666' }}>No logs yet...</div>
        )}
      </div>
    </div>
  );
};

export default DebugVideoTest;
