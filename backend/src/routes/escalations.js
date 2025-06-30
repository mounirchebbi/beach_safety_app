const express = require('express');
const router = express.Router();
const { verifyToken, requireRole, requireLifeguard, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createEscalation,
  getCenterEscalations,
  getMyEscalations,
  acknowledgeEscalation,
  resolveEscalation,
  getEscalationById
} = require('../controllers/escalationController');

// Create escalation (Lifeguard only)
router.post('/', 
  verifyToken, 
  requireLifeguard, 
  asyncHandler(createEscalation)
);

// Get escalations for center (Center Admin only)
router.get('/center', 
  verifyToken, 
  requireCenterAdmin, 
  asyncHandler(getCenterEscalations)
);

// Get my escalations (Lifeguard only)
router.get('/my-escalations', 
  verifyToken, 
  requireLifeguard, 
  asyncHandler(getMyEscalations)
);

// Get escalation by ID (Center Admin, Lifeguard for own escalations)
router.get('/:id', 
  verifyToken, 
  requireRole(['center_admin', 'lifeguard']), 
  asyncHandler(getEscalationById)
);

// Acknowledge escalation (Center Admin only)
router.put('/:id/acknowledge', 
  verifyToken, 
  requireCenterAdmin, 
  asyncHandler(acknowledgeEscalation)
);

// Resolve escalation (Center Admin only)
router.put('/:id/resolve', 
  verifyToken, 
  requireCenterAdmin, 
  asyncHandler(resolveEscalation)
);

module.exports = router; 