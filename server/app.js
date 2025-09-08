const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import services
const wordPressService = require('./services/wordpressService');

// Import socket handlers
const ChatHandler = require('./sockets/chatHandler');
const simpleCallHandlers = require('./sockets/simpleCallHandler');
const videoRoomHandlers = require('./sockets/videoRoomHandler');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { setupSecurity, errorHandler, notFoundHandler, sanitizeInput } = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const socialRoutes = require('./routes/social');
const socialNetworkRoutes = require('./routes/socialRoutes');
const billingRoutes = require('./routes/billing');
const chatRoutes = require('./routes/chat');
const educationRoutes = require('./routes/education');
const paymentRoutes = require('./routes/payment');

const app = express();
const server = http.createServer(app);

// Setup Socket.IO with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:19006",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Setup security middleware
setupSecurity(app);

// Body parsing middleware - Apply JSON parsing conditionally
app.use((req, res, next) => {
  // Skip JSON parsing for file upload routes
  if (req.path.includes('/media/upload') || req.path.includes('/voice/upload')) {
    return next();
  }
  // Apply JSON parsing for other routes
  express.json({ limit: '10mb' })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', authenticateToken, userRoutes);
app.use('/api/social', authenticateToken, socialRoutes);
app.use('/api/social-network', authenticateToken, socialNetworkRoutes);
app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/education', authenticateToken, educationRoutes);
app.use('/api/payment', paymentRoutes); // Payment routes handle auth internally

// Direct endpoints that should be in chat routes but might be called differently
app.get('/chat/calls/history', authenticateToken, (req, res) => {
  // Redirect to the correct endpoint
  req.url = '/api/chat/calls/history' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  chatRoutes(req, res);
});

app.get('/chat/calls/missed/count', authenticateToken, (req, res) => {
  // Redirect to the correct endpoint
  req.url = '/api/chat/calls/missed/count' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  chatRoutes(req, res);
});

app.get('/chats', authenticateToken, (req, res) => {
  // Redirect to the correct endpoint
  req.url = '/api/chat/chats' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  chatRoutes(req, res);
});

app.get('/status/friends', authenticateToken, (req, res) => {
  // Redirect to the correct endpoint
  req.url = '/api/chat/status/friends' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  chatRoutes(req, res);
});

// Initialize Chat Handler, Call Handlers, and Video Room Handlers
const chatHandler = new ChatHandler(io);
const callHandlers = simpleCallHandlers(io);
const videoRoomHandler = videoRoomHandlers(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  chatHandler.handleConnection(socket);
  
  // Simple call event handlers - clean calling system (PRESERVED - NO CHANGES)
  socket.on('simple_call_offer', (data) => {
    console.log('🚨 [SERVER] simple_call_offer event received!', data);
    callHandlers.handleCallOffer(socket, data);
  });
  socket.on('simple_call_answer', (data) => callHandlers.handleCallAnswer(socket, data));
  socket.on('simple_call_reject', (data) => callHandlers.handleCallReject(socket, data));
  socket.on('simple_call_end', (data) => callHandlers.handleCallEnd(socket, data));
  socket.on('simple_ice_candidate', (data) => callHandlers.handleIceCandidate(socket, data));
  
  // Video Room event handlers - NEW (for group video calls in live classes)
  socket.on('video_room_join', (data) => {
    console.log('📹 [SERVER] video_room_join event received!', data);
    videoRoomHandler.handleVideoRoomJoin(socket, data);
  });
  socket.on('video_room_offer', (data) => videoRoomHandler.handleVideoRoomOffer(socket, data));
  socket.on('video_room_answer', (data) => videoRoomHandler.handleVideoRoomAnswer(socket, data));
  socket.on('video_room_ice_candidate', (data) => videoRoomHandler.handleVideoRoomIceCandidate(socket, data));
  socket.on('video_room_media_state', (data) => videoRoomHandler.handleVideoRoomMediaState(socket, data));
  socket.on('video_room_admin_action', (data) => videoRoomHandler.handleVideoRoomAdminAction(socket, data));
  socket.on('video_room_leave', () => videoRoomHandler.handleVideoRoomLeave(socket));
  
  // Test event for debugging socket connectivity (PRESERVED)
  socket.on('test_simple_call_connection', (data) => {
    console.log('🧪 [SERVER] Test connection event received:', data);
    console.log('🧪 [SERVER] Socket ID:', socket.id, 'User ID:', socket.userId);
    socket.emit('test_simple_call_response', { 
      message: 'Server received your test!',
      socketId: socket.id,
      userId: socket.userId,
      timestamp: Date.now()
    });
  });
  
  // Test helper for room joining (for testing only) (PRESERVED)
  socket.on('join-room', (roomName) => {
    socket.join(roomName);
    console.log(`📞 Test: Socket ${socket.id} joined room ${roomName}`);
  });
  
  // Handle disconnection cleanup for calls AND video rooms
  socket.on('disconnect', () => {
    if (socket.userId) {
      // Cleanup 1-1 calls (PRESERVED)
      callHandlers.cleanupUserCalls(socket.userId);
      
      // Cleanup video rooms (NEW)
      videoRoomHandler.cleanupVideoRoomUser(socket);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Olomak Chat & Social Service',
    onlineUsers: chatHandler ? (chatHandler.getOnlineUsersCount ? chatHandler.getOnlineUsersCount() : 0) : 0
  });
});

// Video room stats endpoint
app.get('/video-rooms/stats', (req, res) => {
  try {
    const stats = videoRoomHandler.getVideoRoomStats();
    res.status(200).json({
      ...stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get video room stats' });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

// Initialize WordPress service and start server
const startServer = async () => {
  try {
    await wordPressService.initialize();
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log('Socket.IO enabled for real-time chat');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  io.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  io.close();
  process.exit(0);
});

startServer();

module.exports = app;
