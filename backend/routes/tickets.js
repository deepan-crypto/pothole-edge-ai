const express = require('express');
const router = express.Router();
const RepairTicket = require('../models/RepairTicket');

// @route   GET /api/tickets
// @desc    Get all repair tickets
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, severity, limit = 50, skip = 0 } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (severity) {
      query.severity = severity;
    }
    
    const tickets = await RepairTicket.find(query)
      .sort({ reportedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await RepairTicket.countDocuments(query);
    
    res.json({
      success: true,
      data: tickets,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
    
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
});

// @route   GET /api/tickets/stats
// @desc    Get ticket statistics
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const [
      totalTickets,
      byStatus,
      totalCost,
      bySeverity
    ] = await Promise.all([
      RepairTicket.countDocuments(),
      RepairTicket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      RepairTicket.aggregate([
        { $group: { _id: null, total: { $sum: '$estimatedCost' } } }
      ]),
      RepairTicket.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ])
    ]);
    
    const completedTickets = byStatus.find(s => s._id === 'Repair Complete')?.count || 0;
    const pendingTickets = totalTickets - completedTickets;
    
    res.json({
      success: true,
      data: {
        totalTickets,
        completedTickets,
        pendingTickets,
        totalEstimatedCost: totalCost[0]?.total || 0,
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
    
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket statistics',
      error: error.message
    });
  }
});

// @route   PATCH /api/tickets/:id/status
// @desc    Update ticket status
// @access  Public
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = [
      'Pending Approval',
      'Under Review',
      'Approved',
      'Crew Dispatched',
      'In Progress',
      'Repair Complete'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }
    
    const ticket = await RepairTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    ticket.status = status;
    
    if (status === 'Repair Complete') {
      ticket.completedAt = new Date();
    }
    
    await ticket.save();
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('ticketUpdated', ticket);
    }
    
    res.json({
      success: true,
      message: 'Ticket status updated successfully',
      data: ticket
    });
    
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ticket',
      error: error.message
    });
  }
});

// @route   PATCH /api/tickets/:id/assign
// @desc    Assign crew to ticket
// @access  Public
router.patch('/:id/assign', async (req, res) => {
  try {
    const { assignedCrew } = req.body;
    
    const ticket = await RepairTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    ticket.assignedCrew = assignedCrew;
    ticket.status = 'Crew Dispatched';
    await ticket.save();
    
    // Emit real-time update
    if (req.app.get('io')) {
      req.app.get('io').emit('ticketUpdated', ticket);
    }
    
    res.json({
      success: true,
      message: 'Crew assigned successfully',
      data: ticket
    });
    
  } catch (error) {
    console.error('Error assigning crew:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning crew',
      error: error.message
    });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get single ticket by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const ticket = await RepairTicket.findById(req.params.id)
      .populate('potholeDetectionId');
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }
    
    res.json({
      success: true,
      data: ticket
    });
    
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket',
      error: error.message
    });
  }
});

module.exports = router;
