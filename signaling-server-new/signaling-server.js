const WebSocket = require('ws');

const wss = new WebSocket.Server({ 
  port: process.env.PORT || 8080,
  // Thêm CORS headers
  perMessageDeflate: false,
  clientTracking: true
});

const users = {};

wss.on('connection', function connection(ws, req) {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  console.log('Headers:', req.headers);
  
  ws.on('message', function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
      console.log('Received message:', data.type, 'from:', data.userId || 'unknown');
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }

    // Đăng ký userId cho mỗi kết nối
    if (data.type === 'register' && data.userId) {
      ws.userId = data.userId;
      users[data.userId] = ws;
      console.log('User registered:', data.userId);
      console.log('Active users:', Object.keys(users));
      return;
    }

    // Gửi signaling message tới user đích
    if (data.to && users[data.to]) {
      console.log('Forwarding message to:', data.to);
      users[data.to].send(JSON.stringify({ ...data, from: ws.userId }));
    } else if (data.to) {
      console.log('User not found:', data.to);
    }
  });

  ws.on('close', function () {
    if (ws.userId && users[ws.userId]) {
      delete users[ws.userId];
      console.log('User disconnected:', ws.userId);
      console.log('Active users:', Object.keys(users));
    }
    console.log('WebSocket connection closed');
  });

  ws.on('error', function (error) {
    console.error('WebSocket error:', error);
  });

  ws.on('ping', function () {
    console.log('Received ping');
  });

  ws.on('pong', function () {
    console.log('Received pong');
  });
});

console.log('WebSocket signaling server running on port', process.env.PORT || 8080); 