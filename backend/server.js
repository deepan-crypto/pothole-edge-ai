require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Route imports
const detectionRoutes = require('./routes/detections');
const ticketRoutes = require('./routes/tickets');
const deviceRoutes = require('./routes/devices');
const liveRoutes = require('./routes/live');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time communication
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'https://pothole-edge-ai.vercel.app',
  'https://pothole-edge-ai.vercel.app/' // Handle trailing slash
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Make io accessible to routes
app.set('io', io);

// Store active device connections and latest data
const activeDevices = new Map();
const latestFrames = new Map();

// Make shared state accessible to routes
app.set('activeDevices', activeDevices);
app.set('latestFrames', latestFrames);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Large limit for image data
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/detections', detectionRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/live', liveRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pothole Detection API is running',
    timestamp: new Date().toISOString(),
    mongodb: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Pothole Edge AI Detection API',
    version: '1.0.0',
    description: 'Backend API for Smart Car Pothole Detection System',
    endpoints: {
      health: '/api/health',
      detections: '/api/detections',
      tickets: '/api/tickets',
      devices: '/api/devices',
      live: '/api/live'
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Handle device registration (Jetson Nano)
  socket.on('registerDevice', (deviceId) => {
    socket.join(`device-${deviceId}`);
    socket.deviceId = deviceId;
    activeDevices.set(deviceId, {
      socketId: socket.id,
      connectedAt: new Date(),
      lastSeen: new Date()
    });
    console.log(`Device ${deviceId} registered`);

    // Notify frontend clients
    io.emit('deviceConnected', { deviceId, timestamp: new Date() });
  });

  // Handle frontend client joining to watch a device
  socket.on('watchDevice', (deviceId) => {
    socket.join(`watch-${deviceId}`);
    console.log(`Client ${socket.id} watching device ${deviceId}`);

    // Send latest frame if available
    if (latestFrames.has(deviceId)) {
      socket.emit('liveStream', latestFrames.get(deviceId));
    }
  });

  // Handle live stream from Jetson Nano (with video frame)
  socket.on('liveStream', (data) => {
    const deviceId = data.deviceId || socket.deviceId;

    // Update device last seen
    if (activeDevices.has(deviceId)) {
      activeDevices.get(deviceId).lastSeen = new Date();
    }

    // Store latest frame for new viewers
    latestFrames.set(deviceId, {
      ...data,
      receivedAt: new Date()
    });

    io.to(`watch-${deviceId}`).emit('liveStream', data);
    socket.broadcast.emit('liveStream', data);

    // If there are detections, emit separate event for detection list
    if (data.detections && data.detections.length > 0) {
      socket.broadcast.emit('liveDetections', {
        deviceId,
        detections: data.detections,
        gps: data.gps,
        timestamp: data.timestamp
      });
    }
  });

  // Handle real-time detection stream from Jetson (legacy support)
  socket.on('detectionStream', async (data) => {
    // Broadcast to all connected clients
    socket.broadcast.emit('liveDetection', data);
  });

  // Handle device status updates
  socket.on('deviceStatusUpdate', (data) => {
    const deviceId = data.deviceId || socket.deviceId;

    // Update device info
    if (activeDevices.has(deviceId)) {
      activeDevices.get(deviceId).lastSeen = new Date();
      activeDevices.get(deviceId).status = data;
    }

    io.emit('deviceStatus', data);
  });

  // Handle request for active devices
  socket.on('getActiveDevices', () => {
    const devices = [];
    activeDevices.forEach((value, key) => {
      devices.push({
        deviceId: key,
        ...value
      });
    });
    socket.emit('activeDevices', devices);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove device if it was a Jetson
    if (socket.deviceId) {
      activeDevices.delete(socket.deviceId);
      latestFrames.delete(socket.deviceId);
      io.emit('deviceDisconnected', { deviceId: socket.deviceId, timestamp: new Date() });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       Pothole Edge AI Detection Backend Server                ║
╠═══════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                     ║
║  MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/pothole_detection'}
║  Environment: ${process.env.NODE_ENV || 'development'}                              ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
