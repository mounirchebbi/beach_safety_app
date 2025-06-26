const express = require('express');
const { verifyToken, requireLifeguard, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllReports,
  getReportById,
  createReport,
  updateReport
} = require('../controllers/reportController');

const router = express.Router();

// Routes
router.get('/', verifyToken, requireCenterAdmin, asyncHandler(getAllReports));
router.post('/', verifyToken, requireLifeguard, asyncHandler(createReport));
router.get('/:id', verifyToken, requireCenterAdmin, asyncHandler(getReportById));
router.put('/:id', verifyToken, requireLifeguard, asyncHandler(updateReport));

module.exports = router; 