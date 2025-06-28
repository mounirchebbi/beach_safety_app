const express = require('express');
const { verifyToken, requireCenterAdmin, requireLifeguard } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  checkInShift,
  checkOutShift,
  getMyShifts
} = require('../controllers/shiftController');

const router = express.Router();

// Routes - Specific routes must come before parameterized routes
router.get('/my-shifts', verifyToken, requireLifeguard, asyncHandler(getMyShifts));
router.get('/', verifyToken, requireCenterAdmin, asyncHandler(getAllShifts));
router.post('/', verifyToken, requireCenterAdmin, asyncHandler(createShift));
router.get('/:id', verifyToken, requireCenterAdmin, asyncHandler(getShiftById));
router.put('/:id', verifyToken, requireCenterAdmin, asyncHandler(updateShift));
router.delete('/:id', verifyToken, requireCenterAdmin, asyncHandler(deleteShift));
router.post('/:id/check-in', verifyToken, requireLifeguard, asyncHandler(checkInShift));
router.post('/:id/check-out', verifyToken, requireLifeguard, asyncHandler(checkOutShift));

module.exports = router; 