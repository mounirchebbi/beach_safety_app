const express = require('express');
const router = express.Router();
const { verifyToken, requireCenterAdmin } = require('../middleware/auth');
const {
  createInterCenterSupportRequest,
  getIncomingSupportRequests,
  getOutgoingSupportRequests,
  acknowledgeSupportRequest,
  resolveSupportRequest,
  declineSupportRequest,
  getSupportRequestById,
  getIncomingSupportRequestsCount
} = require('../controllers/interCenterSupportController');

// All routes require authentication and center_admin role
router.use(verifyToken);
router.use(requireCenterAdmin);

// Create inter-center support request
router.post('/', createInterCenterSupportRequest);

// Get incoming support requests (requests sent TO this center)
router.get('/incoming', getIncomingSupportRequests);

// Get count of incoming support requests for dashboard
router.get('/incoming/count', getIncomingSupportRequestsCount);

// Get outgoing support requests (requests sent FROM this center)
router.get('/outgoing', getOutgoingSupportRequests);

// Get specific support request by ID
router.get('/:id', getSupportRequestById);

// Acknowledge support request
router.put('/:id/acknowledge', acknowledgeSupportRequest);

// Resolve support request
router.put('/:id/resolve', resolveSupportRequest);

// Decline support request
router.put('/:id/decline', declineSupportRequest);

module.exports = router; 