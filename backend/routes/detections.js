const express = require('express');
const router = express.Router();
const PotholeDetection = require('../models/PotholeDetection');
const RepairTicket = require('../models/RepairTicket');
const { v4: uuidv4 } = require('uuid');

// Helper to generate ticket ID
const generateTicketId = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PWD-${year}-${random}`;
};

// Helper to estimate repair cost based on severity and type
const estimateRepairCost = (severity, type) => {
  const baseCosts = {
    'Severe Pothole': 15000,
    'Deep Pothole': 12000,
    'Minor Pothole': 5000,
    'Asphalt Crack': 8000,
    'Manhole Depression': 20000,
    'Road Edge Erosion': 30000,
    'Surface Damage': 10000,
    'Water Damage': 40000,
    'Minor Surface Damage': 3000,
    'Surface Cracks': 7000
  };
  
  const severityMultipliers = {
    'low': 0.7,
    'medium': 1.0,
    'high': 1.4
  };
  
  const baseCost = baseCosts[type] || 10000;
  const multiplier = severityMultipliers[severity] || 1.0;
  
  return Math.round(baseCost * multiplier);
};

// @route   POST /api/detections
// @desc    Receive new pothole detection from Jetson Nano
// @access  Public (should be secured in production)
router.post('/', async (req, res) => {
  try {
    const {
      deviceId,
      type,
      severity,
      confidence,
      location,
      latitude,
      longitude,
      boundingBox,
      imagePath
    } = req.body;
    
    // Generate unique detection ID
    const detectionId = `DET-${Date.now()}-${uuidv4().substring(0, 8)}`;
    
    // Create new detection record
    const detection = new PotholeDetection({
      detectionId,
      deviceId: deviceId || process.env.DEVICE_ID || 'JETSON-001',
      type,
      severity,
      confidence,
      location,
      gps: {
        latitude,
        longitude
      },
      boundingBox,
      imagePath,
      forwarded: false,
      detectedAt: new Date()
    });
    
    await detection.save();
    
    // Emit real-time update via Socket.IO (if available)
    if (req.app.get('io')) {
      req.app.get('io').emit('newDetection', detection);
    }
    
    res.status(201).json({
      success: true,
      message: 'Detection recorded successfully',
      data: detection
    });
    
  } catch (error) {
    console.error('Error saving detection:', error);
    res.status(500).json({
      success: false,
      message: 'Error recording detection',
      error: error.message
    });
  }
});

// @route   GET /api/detections
// @desc    Get all detections with optional filters
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { severity, limit = 50, skip = 0, deviceId, startDate, endDate } = req.query;
    
    let query = {};
    
    if (severity) {
      query.severity = severity;
    }
    
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    if (startDate || endDate) {
      query.detectedAt = {};
      if (startDate) query.detectedAt.$gte = new Date(startDate);
      if (endDate) query.detectedAt.$lte = new Date(endDate);
    }
    
    const detections = await PotholeDetection.find(query)
      .sort({ detectedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await PotholeDetection.countDocuments(query);
    
    // Format for frontend compatibility
    const formattedDetections = detections.map(d => ({
      id: d._id,
      timestamp: d.detectedAt.toLocaleTimeString('en-US', { hour12: false }),
      severity: d.severity,
      type: d.type,
      location: d.location,
      gps: `${d.gps.latitude.toFixed(4)}°N, ${d.gps.longitude.toFixed(4)}°E`,
      forwarded: d.forwarded,
      confidence: d.confidence,
      detectionId: d.detectionId
    }));
    
    res.json({
      success: true,
      data: formattedDetections,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
  } catch (error) {
    console.error('Error fetching detections:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching detections',
      error: error.message
    });
  }
});

// @route   GET /api/detections/stats
// @desc    Get detection statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalDetections, todayDetections, bySeverity, byType] = await Promise.all([
      PotholeDetection.countDocuments(),
      PotholeDetection.countDocuments({ detectedAt: { $gte: today } }),
      PotholeDetection.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      PotholeDetection.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    ]);
    
    const forwardedCount = await PotholeDetection.countDocuments({ forwarded: true });
    
    res.json({
      success: true,
      data: {
        totalDetections,
        todayDetections,
        forwardedCount,
        pendingCount: totalDetections - forwardedCount,
        bySeverity: bySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topTypes: byType.map(item => ({
          type: item._id,
          count: item.count
        }))
      }
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
});

// @route   POST /api/detections/:id/forward
// @desc    Forward detection to PWD (create repair ticket)
// @access  Public
router.post('/:id/forward', async (req, res) => {
  try {
    const detection = await PotholeDetection.findById(req.params.id);
    
    if (!detection) {
      return res.status(404).json({
        success: false,
        message: 'Detection not found'
      });
    }
    
    if (detection.forwarded) {
      return res.status(400).json({
        success: false,
        message: 'Detection already forwarded'
      });
    }
    
    // Create repair ticket
    const ticketId = generateTicketId();
    const estimatedCost = estimateRepairCost(detection.severity, detection.type);
    
    const ticket = new RepairTicket({
      ticketId,
      potholeDetectionId: detection._id,
      hazardType: detection.type,
      severity: detection.severity.charAt(0).toUpperCase() + detection.severity.slice(1),
      location: detection.location,
      gps: `${detection.gps.latitude.toFixed(4)}°N, ${detection.gps.longitude.toFixed(4)}°E`,
      estimatedCost,
      status: 'Pending Approval',
      vehicleId: detection.deviceId.replace('JETSON', 'SC'),
      reportedTime: detection.detectedAt.toLocaleTimeString('en-US', { hour12: false })
    });
    
    await ticket.save();
    
    // Update detection status
    detection.forwarded = true;
    detection.forwardedAt = new Date();
    await detection.save();
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('newTicket', ticket);
      req.app.get('io').emit('detectionUpdated', detection);
    }
    
    res.json({
      success: true,
      message: 'Detection forwarded to PWD successfully',
      data: {
        detection,
        ticket
      }
    });
    
  } catch (error) {
    console.error('Error forwarding detection:', error);
    res.status(500).json({
      success: false,
      message: 'Error forwarding detection',
      error: error.message
    });
  }
});

// @route   GET /api/detections/latest
// @desc    Get latest detections for real-time feed
// @access  Public
router.get('/latest', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const detections = await PotholeDetection.find()
      .sort({ detectedAt: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      data: detections
    });
    
  } catch (error) {
    console.error('Error fetching latest detections:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest detections',
      error: error.message
    });
  }
});

module.exports = router;
