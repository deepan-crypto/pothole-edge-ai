const mongoose = require('mongoose');

const deviceStatusSchema = new mongoose.Schema({
  // Device identification
  deviceId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Device name/label
  name: {
    type: String,
    default: 'Smart Car Unit'
  },
  
  // Connection status
  isOnline: {
    type: Boolean,
    default: false
  },
  
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  // Hardware metrics
  temperature: {
    type: Number,
    default: 45
  },
  
  cpuUsage: {
    type: Number,
    default: 0
  },
  
  memoryUsage: {
    type: Number,
    default: 0
  },
  
  // Network status
  signalStrength: {
    type: Number,
    default: 85
  },
  
  networkType: {
    type: String,
    default: '4G LTE'
  },
  
  // Sensor status
  mpuStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Error'],
    default: 'Active'
  },
  
  cameraStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Error'],
    default: 'Active'
  },
  
  gpsStatus: {
    type: String,
    enum: ['Active', 'Inactive', 'Error'],
    default: 'Active'
  },
  
  // Current location
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  
  // Vehicle info
  vehicleSpeed: {
    type: Number,
    default: 0
  },
  
  // AI Model info
  modelVersion: {
    type: String,
    default: 'pothole.pt'
  },
  
  inferenceRate: {
    type: Number,
    default: 30 // FPS
  },
  
  // Detection stats
  totalDetections: {
    type: Number,
    default: 0
  },
  
  todayDetections: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeviceStatus', deviceStatusSchema);
