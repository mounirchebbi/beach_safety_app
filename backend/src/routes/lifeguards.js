const express = require('express');
const { verifyToken, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllLifeguards,
  getLifeguardById,
  createLifeguard,
  updateLifeguard,
  deleteLifeguard,
  getLifeguardShifts
} = require('../controllers/lifeguardController');

const router = express.Router();

// Routes
router.get('/', verifyToken, requireCenterAdmin, asyncHandler(getAllLifeguards));
router.post('/', verifyToken, requireCenterAdmin, asyncHandler(createLifeguard));
router.get('/:id', verifyToken, requireCenterAdmin, asyncHandler(getLifeguardById));
router.put('/:id', verifyToken, requireCenterAdmin, asyncHandler(updateLifeguard));
router.delete('/:id', verifyToken, requireCenterAdmin, asyncHandler(deleteLifeguard));
router.get('/:id/shifts', verifyToken, requireCenterAdmin, asyncHandler(getLifeguardShifts));

module.exports = router; 