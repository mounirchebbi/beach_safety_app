const express = require('express');
const { verifyToken, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllLifeguards,
  getLifeguardById,
  createLifeguard,
  updateLifeguard,
  deleteLifeguard,
  restoreLifeguard,
  hardDeleteLifeguard,
  getLifeguardShifts
} = require('../controllers/lifeguardController');

const router = express.Router();

// Routes
router.get('/', verifyToken, requireCenterAdmin, asyncHandler(getAllLifeguards));
router.post('/', verifyToken, requireCenterAdmin, asyncHandler(createLifeguard));
router.get('/:id', verifyToken, requireCenterAdmin, asyncHandler(getLifeguardById));
router.put('/:id', verifyToken, requireCenterAdmin, asyncHandler(updateLifeguard));
router.delete('/:id', verifyToken, requireCenterAdmin, asyncHandler(deleteLifeguard));
router.post('/:id/restore', verifyToken, (req, res, next) => {
  if (req.user.role !== 'system_admin') return res.status(403).json({ success: false, message: 'Only system admin can restore lifeguards' });
  next();
}, asyncHandler(restoreLifeguard));
router.delete('/:id/hard', verifyToken, (req, res, next) => {
  if (req.user.role !== 'system_admin') return res.status(403).json({ success: false, message: 'Only system admin can hard delete lifeguards' });
  next();
}, asyncHandler(hardDeleteLifeguard));
router.get('/:id/shifts', verifyToken, requireCenterAdmin, asyncHandler(getLifeguardShifts));

module.exports = router; 