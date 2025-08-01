const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Cấu hình CORS cho Socket.io
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store active users and rooms
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins with their info
  socket.on('user-joined', (userData) => {
    users.set(socket.id, {
      ...userData,
      socketId: socket.id,
      status: 'online'
    });
    
    console.log('User joined:', userData.name, socket.id);
    
    // Broadcast updated user list
    io.emit('users-updated', Array.from(users.values()));
  });

  // Handle video call initiation
  socket.on('initiate-call', (data) => {
    const { targetUserId, callType, callerInfo } = data;
    console.log('Call initiated:', callerInfo.name, '->', targetUserId, 'Type:', callType);
    
    // Find target user's socket
    const targetUser = Array.from(users.values()).find(user => user.id === targetUserId);
    if (targetUser) {
      // Send call invitation to target user
      io.to(targetUser.socketId).emit('incoming-call', {
        callerId: socket.id,
        callerInfo,
        callType,
        roomId: `room_${socket.id}_${targetUser.socketId}`
      });
    }
  });

  // Handle call acceptance
  socket.on('accept-call', (data) => {
    const { callerId, roomId } = data;
    console.log('Call accepted by:', socket.id, 'Room:', roomId);
    
    // Join both users to the room
    socket.join(roomId);
    io.sockets.sockets.get(callerId)?.join(roomId);
    
    // Notify caller that call was accepted
    io.to(callerId).emit('call-accepted', { roomId, accepterId: socket.id });
  });

  // Handle call rejection
  socket.on('reject-call', (data) => {
    const { callerId } = data;
    console.log('Call rejected by:', socket.id);
    
    io.to(callerId).emit('call-rejected', { rejecterId: socket.id });
  });

  // Handle WebRTC signaling
  socket.on('webrtc-offer', (data) => {
    const { roomId, offer } = data;
    console.log('WebRTC offer in room:', roomId);
    
    socket.to(roomId).emit('webrtc-offer', {
      offer,
      senderId: socket.id
    });
  });

  socket.on('webrtc-answer', (data) => {
    const { roomId, answer } = data;
    console.log('WebRTC answer in room:', roomId);
    
    socket.to(roomId).emit('webrtc-answer', {
      answer,
      senderId: socket.id
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    const { roomId, candidate } = data;
    console.log('ICE candidate in room:', roomId);
    
    socket.to(roomId).emit('webrtc-ice-candidate', {
      candidate,
      senderId: socket.id
    });
  });

  // Handle call end
  socket.on('end-call', (data) => {
    const { roomId } = data;
    console.log('Call ended in room:', roomId);
    
    // Notify all users in room
    socket.to(roomId).emit('call-ended', { enderId: socket.id });
    
    // Leave room
    socket.leave(roomId);
  });

  // Enhanced heartbeat for connection monitoring
  socket.on('heartbeat', () => {
    socket.emit('heartbeat-response', { timestamp: Date.now() });
  });

  // Handle connection quality reporting
  socket.on('connection-quality', (data) => {
    const { roomId, quality, metrics } = data;
    console.log(`Connection quality in room ${roomId}: ${quality}`, metrics);

    // Broadcast quality info to other users in room
    socket.to(roomId).emit('peer-connection-quality', {
      quality,
      metrics,
      from: socket.id
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from active users
    users.delete(socket.id);
    
    // Broadcast updated user list
    io.emit('users-updated', Array.from(users.values()));
    
    // Notify any ongoing calls
    socket.broadcast.emit('user-disconnected', { userId: socket.id });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});
