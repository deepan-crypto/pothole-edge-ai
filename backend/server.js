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

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time communication
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Make io accessible to routes
app.set('io', io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
      devices: '/api/devices'
    }
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  // Handle device registration
  socket.on('registerDevice', (deviceId) => {
    socket.join(`device-${deviceId}`);
    console.log(`Device ${deviceId} registered`);
  });
  
  // Handle real-time detection stream from Jetson
  socket.on('detectionStream', async (data) => {
    // Broadcast to all connected clients
    socket.broadcast.emit('liveDetection', data);
  });
  
  // Handle device status updates
  socket.on('deviceStatusUpdate', (data) => {
    io.emit('deviceStatus', data);
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
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
