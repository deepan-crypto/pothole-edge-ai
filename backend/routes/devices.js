const express = require('express');
const router = express.Router();
const DeviceStatus = require('../models/DeviceStatus');

// @route   POST /api/devices/status
// @desc    Update device status from Jetson Nano
// @access  Public
router.post('/status', async (req, res) => {
  try {
    const {
      deviceId,
      temperature,
      cpuUsage,
      memoryUsage,
      signalStrength,
      networkType,
      mpuStatus,
      cameraStatus,
      gpsStatus,
      latitude,
      longitude,
      address,
      vehicleSpeed,
      inferenceRate
    } = req.body;
    
    // Find or create device status
    let device = await DeviceStatus.findOne({ deviceId });
    
    if (!device) {
      device = new DeviceStatus({ deviceId });
    }
    
    // Update fields
    if (temperature !== undefined) device.temperature = temperature;
    if (cpuUsage !== undefined) device.cpuUsage = cpuUsage;
    if (memoryUsage !== undefined) device.memoryUsage = memoryUsage;
    if (signalStrength !== undefined) device.signalStrength = signalStrength;
    if (networkType !== undefined) device.networkType = networkType;
    if (mpuStatus !== undefined) device.mpuStatus = mpuStatus;
    if (cameraStatus !== undefined) device.cameraStatus = cameraStatus;
    if (gpsStatus !== undefined) device.gpsStatus = gpsStatus;
    if (vehicleSpeed !== undefined) device.vehicleSpeed = vehicleSpeed;
    if (inferenceRate !== undefined) device.inferenceRate = inferenceRate;
    
    if (latitude !== undefined && longitude !== undefined) {
      device.currentLocation = {
        latitude,
        longitude,
        address: address || device.currentLocation?.address
      };
    }
    
    device.isOnline = true;
    device.lastSeen = new Date();
    
    await device.save();
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('deviceStatus', device);
    }
    
    res.json({
      success: true,
      message: 'Device status updated',
      data: device
    });
    
  } catch (error) {
    console.error('Error updating device status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating device status',
      error: error.message
    });
  }
});

// @route   GET /api/devices
// @desc    Get all devices
// @access  Public
router.get('/', async (req, res) => {
  try {
    const devices = await DeviceStatus.find().sort({ lastSeen: -1 });
    
    // Mark devices as offline if not seen in last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    
    const devicesWithStatus = devices.map(device => {
      const isOnline = device.lastSeen > thirtySecondsAgo;
      return {
        ...device.toObject(),
        isOnline
      };
    });
    
    res.json({
      success: true,
      data: devicesWithStatus
    });
    
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching devices',
      error: error.message
    });
  }
});

// @route   GET /api/devices/:deviceId
// @desc    Get single device status
// @access  Public
router.get('/:deviceId', async (req, res) => {
  try {
    const device = await DeviceStatus.findOne({ deviceId: req.params.deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    // Check if online
    const thirtySecondsAgo = new Date(Date.now() - 30000);
    const isOnline = device.lastSeen > thirtySecondsAgo;
    
    res.json({
      success: true,
      data: {
        ...device.toObject(),
        isOnline
      }
    });
    
  } catch (error) {
    console.error('Error fetching device:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching device',
      error: error.message
    });
  }
});

// @route   POST /api/devices/:deviceId/heartbeat
// @desc    Device heartbeat to maintain online status
// @access  Public
router.post('/:deviceId/heartbeat', async (req, res) => {
  try {
    let device = await DeviceStatus.findOne({ deviceId: req.params.deviceId });
    
    if (!device) {
      device = new DeviceStatus({ deviceId: req.params.deviceId });
    }
    
    device.isOnline = true;
    device.lastSeen = new Date();
    await device.save();
    
    res.json({
      success: true,
      message: 'Heartbeat received'
    });
    
  } catch (error) {
    console.error('Error processing heartbeat:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing heartbeat',
      error: error.message
    });
  }
});

// @route   POST /api/devices/:deviceId/detection-count
// @desc    Increment detection count for device
// @access  Public
router.post('/:deviceId/detection-count', async (req, res) => {
  try {
    const device = await DeviceStatus.findOne({ deviceId: req.params.deviceId });
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }
    
    device.totalDetections += 1;
    device.todayDetections += 1;
    await device.save();
    
    res.json({
      success: true,
      data: {
        totalDetections: device.totalDetections,
        todayDetections: device.todayDetections
      }
    });
    
  } catch (error) {
    console.error('Error updating detection count:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating detection count',
      error: error.message
    });
  }
});

module.exports = router;
