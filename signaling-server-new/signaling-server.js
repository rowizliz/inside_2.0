const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Cấu hình CORS cho Express
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "https://your-domain.com"],
  methods: ["GET", "POST"],
  credentials: true
}));

// Cấu hình Socket.IO với CORS
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3001", "https://your-domain.com"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Lưu trữ thông tin rooms và users
const rooms = new Map();
const users = new Map();
const userSockets = new Map(); // Map userId -> socketId
const activeCalls = new Map(); // Map callId -> call info

// Utility functions
const getRoomUsers = (roomId) => {
  const room = rooms.get(roomId);
  return room ? Array.from(room.users.keys()) : [];
};

const addUserToRoom = (roomId, userId, socketId) => {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      users: new Map(),
      createdAt: new Date()
    });
  }

  const room = rooms.get(roomId);
  room.users.set(userId, {
    socketId,
    joinedAt: new Date()
  });

  console.log(`✅ User ${userId} joined room ${roomId}`);
  console.log(`📊 Room ${roomId} now has ${room.users.size} users`);
};

const removeUserFromRoom = (roomId, userId) => {
  const room = rooms.get(roomId);
  if (room) {
    room.users.delete(userId);
    console.log(`❌ User ${userId} left room ${roomId}`);

    if (room.users.size === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted (empty)`);
    } else {
      console.log(`📊 Room ${roomId} now has ${room.users.size} users`);
    }
  }
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);
  
  // Lấy userId từ query params nếu có
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSockets.set(userId, socket.id);
    console.log(`📝 Registered user ${userId} with socket ${socket.id}`);
  }

  // Xử lý join room
  socket.on('join-room', (data) => {
    const { roomId, userId } = data;
    console.log(`👤 User ${userId} wants to join room ${roomId}`);

    // Lưu thông tin user
    users.set(socket.id, { userId, roomId });
    socket.join(roomId);

    // Kiểm tra xem có ai trong room chưa
    const roomUsers = getRoomUsers(roomId);
    const isFirstUser = roomUsers.length === 0;

    // Thêm user vào room
    addUserToRoom(roomId, userId, socket.id);

    if (isFirstUser) {
      // User đầu tiên trong room
      socket.emit('waiting-for-peer');
      console.log(`⏳ User ${userId} is waiting for peer in room ${roomId}`);
    } else {
      // Có user khác trong room rồi
      const otherUsers = roomUsers.filter(id => id !== userId);

      // Thông báo cho user mới về users hiện có
      socket.emit('user-already-in-room', { users: otherUsers });

      // Thông báo cho users khác về user mới
      socket.to(roomId).emit('user-joined', { userId });

      console.log(`🤝 User ${userId} joined room ${roomId} with existing users: ${otherUsers.join(', ')}`);
    }
  });

  // Xử lý signaling
  socket.on('signal', (data) => {
    const { roomId, signal, userId } = data;
    console.log(`📡 Relaying signal from ${userId} in room ${roomId}`);

    // Gửi signal tới tất cả users khác trong room
    socket.to(roomId).emit('signal', {
      signal,
      userId
    });
  });

  // Xử lý leave room
  socket.on('leave-room', (data) => {
    const { roomId, userId } = data;
    console.log(`👋 User ${userId} leaving room ${roomId}`);

    socket.leave(roomId);
    removeUserFromRoom(roomId, userId);

    // Thông báo cho users khác
    socket.to(roomId).emit('user-left', { userId });

    users.delete(socket.id);
  });

  // Xử lý chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message } = data;
    console.log(`💬 Chat message in room ${roomId} from ${message.sender}`);

    // Gửi message tới tất cả users khác trong room
    socket.to(roomId).emit('chat-message', { message });
  });

  // Xử lý start-call (gọi đi)
  socket.on('start-call', (data) => {
    const { roomId, caller, targetUserId } = data;
    console.log(`📞 ${caller.name} is calling ${targetUserId}`);
    
    // Lưu thông tin cuộc gọi
    activeCalls.set(roomId, {
      roomId,
      caller,
      targetUserId,
      status: 'calling',
      startTime: new Date()
    });
    
    // Tìm socket của người nhận
    const targetSocketId = userSockets.get(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('incoming-call', {
        roomId,
        caller
      });
      console.log(`✅ Sent incoming call notification to ${targetUserId}`);
    } else {
      console.log(`❌ Target user ${targetUserId} not online`);
      socket.emit('call-failed', { reason: 'User offline' });
    }
  });
  
  // Xử lý accept-call
  socket.on('accept-call', (data) => {
    const { roomId, accepter } = data;
    console.log(`✅ ${accepter.name} accepted call in room ${roomId}`);
    
    const callInfo = activeCalls.get(roomId);
    if (callInfo) {
      callInfo.status = 'connected';
      callInfo.acceptedAt = new Date();
      
      // Thông báo cho người gọi
      const callerSocketId = userSockets.get(callInfo.caller.id);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-accepted', {
          roomId,
          accepter
        });
      }
    }
  });
  
  // Xử lý reject-call
  socket.on('reject-call', (data) => {
    const { roomId } = data;
    console.log(`❌ Call rejected in room ${roomId}`);
    
    const callInfo = activeCalls.get(roomId);
    if (callInfo) {
      // Thông báo cho người gọi
      const callerSocketId = userSockets.get(callInfo.caller.id);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-rejected', {
          roomId
        });
      }
      
      // Xóa thông tin cuộc gọi
      activeCalls.delete(roomId);
    }
  });
  
  // Xử lý end-call
  socket.on('end-call', (data) => {
    const { roomId } = data;
    console.log(`🔚 Call ended in room ${roomId}`);
    
    const callInfo = activeCalls.get(roomId);
    if (callInfo) {
      // Thông báo cho tất cả người trong cuộc gọi
      io.to(roomId).emit('call-ended', { roomId });
      
      // Xóa thông tin cuộc gọi
      activeCalls.delete(roomId);
    }
  });

  // Xử lý disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);

    // Xóa khỏi userSockets
    for (const [userId, socketId] of userSockets.entries()) {
      if (socketId === socket.id) {
        userSockets.delete(userId);
        console.log(`🗑️ Removed user ${userId} from userSockets`);
        break;
      }
    }

    const userInfo = users.get(socket.id);
    if (userInfo) {
      const { userId, roomId } = userInfo;

      removeUserFromRoom(roomId, userId);
      socket.to(roomId).emit('user-left', { userId });

      users.delete(socket.id);
      console.log(`🧹 Cleaned up user ${userId} from room ${roomId}`);
    }
  });

  // Xử lý lỗi
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size,
    activeConnections: users.size,
    activeCalls: activeCalls.size,
    onlineUsers: userSockets.size,
    rooms: Array.from(rooms.entries()).map(([roomId, room]) => ({
      roomId,
      userCount: room.users.size,
      createdAt: room.createdAt
    })),
    calls: Array.from(activeCalls.entries()).map(([callId, call]) => ({
      callId,
      status: call.status,
      caller: call.caller.name,
      duration: call.acceptedAt ? Math.floor((new Date() - call.acceptedAt) / 1000) : 0
    }))
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    rooms: rooms.size,
    connections: users.size,
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Stats: http://localhost:${PORT}/stats`);
});