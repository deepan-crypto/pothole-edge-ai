const mongoose = require('mongoose');

const potholeDetectionSchema = new mongoose.Schema({
  // Detection identification
  detectionId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Device information
  deviceId: {
    type: String,
    required: true,
    default: 'JETSON-001'
  },
  
  // Detection details
  type: {
    type: String,
    required: true,
    enum: ['Severe Pothole', 'Deep Pothole', 'Minor Pothole', 'Asphalt Crack', 
           'Manhole Depression', 'Road Edge Erosion', 'Surface Damage', 
           'Water Damage', 'Minor Surface Damage', 'Surface Cracks']
  },
  
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Location data
  location: {
    type: String,
    required: true
  },
  
  gps: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    }
  },
  
  // Bounding box data from detection
  boundingBox: {
    x: Number,
    y: Number,
    width: Number,
    height: Number
  },
  
  // Image data (base64 encoded or path)
  imagePath: {
    type: String
  },
  
  // Status tracking
  forwarded: {
    type: Boolean,
    default: false
  },
  
  forwardedAt: {
    type: Date
  },
  
  // Timestamps
  detectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
potholeDetectionSchema.index({ detectedAt: -1 });
potholeDetectionSchema.index({ severity: 1 });
potholeDetectionSchema.index({ deviceId: 1 });
potholeDetectionSchema.index({ 'gps.latitude': 1, 'gps.longitude': 1 });

module.exports = mongoose.model('PotholeDetection', potholeDetectionSchema);
