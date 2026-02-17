const express = require('express');
const router = express.Router();

// In-memory storage for live stream data (shared with server.js via app context)
// This route provides HTTP endpoints for accessing live stream data

// @route   GET /api/live/status
// @desc    Get live streaming status and active devices
router.get('/status', (req, res) => {
  const io = req.app.get('io');
  const activeDevices = req.app.get('activeDevices') || new Map();
  
  const devices = [];
  activeDevices.forEach((value, key) => {
    devices.push({
      deviceId: key,
      connectedAt: value.connectedAt,
      lastSeen: value.lastSeen,
      status: value.status || null
    });
  });
  
  res.json({
    success: true,
    data: {
      activeDevices: devices,
      totalConnections: io ? io.engine.clientsCount : 0,
      timestamp: new Date()
    }
  });
});

// @route   GET /api/live/frame/:deviceId
// @desc    Get latest frame from a specific device
router.get('/frame/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  const latestFrames = req.app.get('latestFrames') || new Map();
  
  if (latestFrames.has(deviceId)) {
    const frameData = latestFrames.get(deviceId);
    res.json({
      success: true,
      data: frameData
    });
  } else {
    res.status(404).json({
      success: false,
      message: `No live data available for device ${deviceId}`
    });
  }
});

// @route   GET /api/live/devices
// @desc    Get list of all active streaming devices
router.get('/devices', (req, res) => {
  const activeDevices = req.app.get('activeDevices') || new Map();
  
  const devices = [];
  activeDevices.forEach((value, key) => {
    // Calculate if device is still active (last seen within 30 seconds)
    const isActive = (new Date() - new Date(value.lastSeen)) < 30000;
    
    devices.push({
      deviceId: key,
      socketId: value.socketId,
      connectedAt: value.connectedAt,
      lastSeen: value.lastSeen,
      isActive,
      status: value.status || {}
    });
  });
  
  res.json({
    success: true,
    data: devices
  });
});

// @route   POST /api/live/stream
// @desc    Receive live stream data via HTTP (fallback for WebSocket)
router.post('/stream', async (req, res) => {
  try {
    const {
      deviceId,
      frame,
      detections,
      gps,
      stats,
      timestamp
    } = req.body;
    
    const io = req.app.get('io');
    const latestFrames = req.app.get('latestFrames') || new Map();
    const activeDevices = req.app.get('activeDevices') || new Map();
    
    // Store latest frame
    const streamData = {
      deviceId,
      frame,
      detections: detections || [],
      gps: gps || {},
      stats: stats || {},
      timestamp: timestamp || new Date().toISOString(),
      receivedAt: new Date()
    };
    
    latestFrames.set(deviceId, streamData);
    
    // Update device status
    if (!activeDevices.has(deviceId)) {
      activeDevices.set(deviceId, {
        connectedAt: new Date(),
        lastSeen: new Date(),
        status: stats
      });
    } else {
      activeDevices.get(deviceId).lastSeen = new Date();
      activeDevices.get(deviceId).status = stats;
    }
    
    // Broadcast to WebSocket clients
    if (io) {
      io.emit('liveStream', streamData);
      
      if (detections && detections.length > 0) {
        io.emit('liveDetections', {
          deviceId,
          detections,
          gps,
          timestamp
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Stream data received',
      detectionCount: detections ? detections.length : 0
    });
    
  } catch (error) {
    console.error('Error processing live stream:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing stream data',
      error: error.message
    });
  }
});

// @route   SSE /api/live/events/:deviceId
// @desc    Server-Sent Events endpoint for live updates
router.get('/events/:deviceId', (req, res) => {
  const { deviceId } = req.params;
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ deviceId, timestamp: new Date() })}\n\n`);
  
  const io = req.app.get('io');
  
  // Create a handler for live stream events
  const streamHandler = (data) => {
    if (data.deviceId === deviceId || !deviceId || deviceId === 'all') {
      res.write(`event: liveStream\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  const detectionHandler = (data) => {
    if (data.deviceId === deviceId || !deviceId || deviceId === 'all') {
      res.write(`event: detection\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  const statusHandler = (data) => {
    if (data.deviceId === deviceId || !deviceId || deviceId === 'all') {
      res.write(`event: status\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  // Listen to Socket.IO events and forward to SSE
  if (io) {
    io.on('liveStream', streamHandler);
    io.on('liveDetections', detectionHandler);
    io.on('deviceStatus', statusHandler);
  }
  
  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date() })}\n\n`);
  }, 30000);
  
  // Cleanup on close
  req.on('close', () => {
    clearInterval(heartbeat);
    if (io) {
      io.off('liveStream', streamHandler);
      io.off('liveDetections', detectionHandler);
      io.off('deviceStatus', statusHandler);
    }
  });
});

module.exports = router;
