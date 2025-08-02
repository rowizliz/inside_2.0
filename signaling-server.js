const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for Express
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// Store rooms and users
const rooms = new Map();
const users = new Map();

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Video Call Signaling Server',
    status: 'running',
    rooms: rooms.size,
    users: users.size
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const roomStats = Array.from(rooms.entries()).map(([roomId, room]) => ({
    roomId,
    users: room.users.length,
    userList: room.users.map(u => ({ id: u.userId, name: u.name }))
  }));

  res.json({
    totalRooms: rooms.size,
    totalUsers: users.size,
    rooms: roomStats
  });
});

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('join-room', (data) => {
    const { roomId, userId, name } = data;
    console.log(`👤 User ${userId} (${name || 'Unknown'}) joining room: ${roomId}`);

    // Store user info
    users.set(socket.id, { userId, name, roomId });

    // Join socket room
    socket.join(roomId);

    // Initialize room if doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: [] });
    }

    const room = rooms.get(roomId);

    // Check if user already in room
    const existingUser = room.users.find(u => u.userId === userId);
    if (!existingUser) {
      room.users.push({ userId, name, socketId: socket.id });
    }

    console.log(`📊 Room ${roomId} now has ${room.users.length} users`);

    // Notify others in room
    socket.to(roomId).emit('user-joined', { userId, name });

    // If there are already users in room, notify this user
    if (room.users.length > 1) {
      socket.emit('user-already-in-room', {
        users: room.users.filter(u => u.userId !== userId)
      });
    }
  });

  socket.on('signal', (data) => {
    const { roomId, signal, userId } = data;
    console.log(`📡 Relaying signal from ${userId} in room ${roomId}`);

    // Relay signal to all other users in room
    socket.to(roomId).emit('signal', { signal, userId });
  });

  socket.on('leave-room', (data) => {
    const { roomId, userId } = data;
    console.log(`👋 User ${userId} leaving room: ${roomId}`);

    handleUserLeave(socket, roomId, userId);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);

    const user = users.get(socket.id);
    if (user) {
      handleUserLeave(socket, user.roomId, user.userId);
    }
  });
});

function handleUserLeave(socket, roomId, userId) {
  if (!roomId) return;

  // Remove from room
  const room = rooms.get(roomId);
  if (room) {
    room.users = room.users.filter(u => u.userId !== userId);

    // If room is empty, delete it
    if (room.users.length === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ Deleted empty room: ${roomId}`);
    } else {
      console.log(`📊 Room ${roomId} now has ${room.users.length} users`);
    }
  }

  // Remove user
  users.delete(socket.id);

  // Notify others in room
  socket.to(roomId).emit('user-left', { userId });

  // Leave socket room
  socket.leave(roomId);
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Signaling server running on port ${PORT}`);
  console.log(`📊 Stats available at: http://localhost:${PORT}/stats`);
  console.log(`🎥 Ready for video calls!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down signaling server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});