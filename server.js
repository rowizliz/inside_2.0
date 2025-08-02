const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://192.168.1.27:3000",
    "https://inside-app-production.up.railway.app"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// Socket.io configuration
const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3003",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3003",
      "http://192.168.1.27:3000",
      "http://192.168.1.27:3003",
      "https://inside-app-production.up.railway.app"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Store connected users and rooms
const connectedUsers = new Map();
const rooms = new Map(); // For Simple Peer rooms

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // User joins with info
  socket.on('user-joined', (userInfo) => {
    console.log(`👤 User joined:`, userInfo);
    connectedUsers.set(socket.id, {
      ...userInfo,
      socketId: socket.id,
      joinedAt: new Date()
    });

    // Broadcast updated user list
    const userList = Array.from(connectedUsers.values());
    io.emit('users-updated', userList);
  });



  // Simple Peer room management
  socket.on('join-room', (data) => {
    const { roomId, userId } = data;
    console.log(`🏠 User ${userId} joining room: ${roomId}`);

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    const room = rooms.get(roomId);

    // If room has users, notify them
    if (room.size > 0) {
      socket.to(roomId).emit('user-joined', { userId });
      socket.emit('user-already-in-room');
    }

    room.add(socket.id);
    console.log(`🏠 Room ${roomId} now has ${room.size} users`);
  });

  socket.on('signal', (data) => {
    const { roomId, signal, userId } = data;
    console.log(`📡 Relaying signal in room ${roomId} from user ${userId}`);
    socket.to(roomId).emit('signal', { signal, userId });
  });

  socket.on('leave-room', (data) => {
    const { roomId, userId } = data;
    console.log(`🚪 User ${userId} leaving room: ${roomId}`);

    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId });

    const room = rooms.get(roomId);
    if (room) {
      room.delete(socket.id);
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`🏠 Room ${roomId} deleted (empty)`);
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);

    // Remove from connected users
    connectedUsers.delete(socket.id);

    // Clean up rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        socket.to(roomId).emit('user-left');
        if (room.size === 0) {
          rooms.delete(roomId);
          console.log(`🏠 Room ${roomId} deleted (user disconnected)`);
        }
      }
    }



    // Broadcast updated user list
    const userList = Array.from(connectedUsers.values());
    io.emit('users-updated', userList);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeUsers: connectedUsers.size,
    activeRooms: rooms.size
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Socket.io server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🔧 Enhanced CORS and debugging enabled`);
});