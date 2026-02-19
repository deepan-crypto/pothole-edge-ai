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
    default: null
  },
  
  gps: {
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
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

// Type mapping for handling different client formats
const TYPE_MAPPING = {
  'Pothole': 'Severe Pothole',
  'pothole': 'Severe Pothole',
  'Crack': 'Asphalt Crack',
  'crack': 'Asphalt Crack',
  'Damage': 'Surface Damage',
  'damage': 'Surface Damage'
};

// Pre-save hook to validate and transform data
potholeDetectionSchema.pre('save', function(next) {
  // Map type values to valid enum values
  if (this.type && TYPE_MAPPING[this.type]) {
    this.type = TYPE_MAPPING[this.type];
  }
  
  // Auto-generate location from GPS if not provided
  if (!this.location && this.gps && this.gps.latitude && this.gps.longitude) {
    this.location = `GPS: ${this.gps.latitude.toFixed(4)}, ${this.gps.longitude.toFixed(4)}`;
  }
  
  next();
});

// Index for efficient queries
potholeDetectionSchema.index({ detectedAt: -1 });
potholeDetectionSchema.index({ severity: 1 });
potholeDetectionSchema.index({ deviceId: 1 });
potholeDetectionSchema.index({ 'gps.latitude': 1, 'gps.longitude': 1 });

module.exports = mongoose.model('PotholeDetection', potholeDetectionSchema);
