const express = require('express');
const { verifyToken, requireLifeguard, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  createSOSAlert,
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  assignAlert
} = require('../controllers/alertController');

const router = express.Router();

// Routes
router.post('/sos', asyncHandler(createSOSAlert)); // Public route for SOS
router.get('/', verifyToken, requireLifeguard, asyncHandler(getAllAlerts));
router.get('/:id', verifyToken, requireLifeguard, asyncHandler(getAlertById));
router.put('/:id/status', verifyToken, requireLifeguard, asyncHandler(updateAlertStatus));
router.post('/:id/assign', verifyToken, requireCenterAdmin, asyncHandler(assignAlert));

module.exports = router; 