const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET", "POST"]
}));

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const users = {};

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);
  
  // Gửi ID của user về client
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    console.log('🔌 User disconnected:', socket.id);
    delete users[socket.id];
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    console.log('📞 Call user:', data.userToCall);
    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name
    });
  });

  socket.on("answerCall", (data) => {
    console.log('✅ Answer call to:', data.to);
    io.to(data.to).emit("callAccepted", data.signal);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log('🚀 Simple signaling server running on port', PORT);
  console.log('📡 Ready for video calls!');
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Video Call Signaling Server',
    status: 'running',
    connectedUsers: Object.keys(users).length
  });
});
