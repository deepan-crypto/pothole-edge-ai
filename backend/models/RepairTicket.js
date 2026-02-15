const mongoose = require('mongoose');

const repairTicketSchema = new mongoose.Schema({
  // Ticket identification
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Reference to pothole detection
  potholeDetectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PotholeDetection'
  },
  
  // Hazard details
  hazardType: {
    type: String,
    required: true
  },
  
  severity: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High']
  },
  
  // Location
  location: {
    type: String,
    required: true
  },
  
  gps: {
    type: String,
    required: true
  },
  
  // Cost and status
  estimatedCost: {
    type: Number,
    required: true
  },
  
  status: {
    type: String,
    required: true,
    enum: ['Pending Approval', 'Under Review', 'Approved', 'Crew Dispatched', 'In Progress', 'Repair Complete'],
    default: 'Pending Approval'
  },
  
  // Vehicle/Device that reported
  vehicleId: {
    type: String,
    required: true
  },
  
  // Timestamps
  reportedTime: {
    type: String,
    required: true
  },
  
  reportedAt: {
    type: Date,
    default: Date.now
  },
  
  // Crew assignment
  assignedCrew: {
    type: String
  },
  
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
repairTicketSchema.index({ status: 1 });
repairTicketSchema.index({ severity: 1 });
repairTicketSchema.index({ reportedAt: -1 });

module.exports = mongoose.model('RepairTicket', repairTicketSchema);
