const express = require('express');
const { body } = require('express-validator');
const { verifyToken, requireSystemAdmin, requireCenterAdmin, requireOwnership } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getAllCenters,
  getCenterById,
  createCenter,
  updateCenter,
  deleteCenter,
  getCenterLifeguards,
  getCenterShifts,
  getCenterWeather,
  updateLocationCheckInSetting,
  getLocationCheckInSetting
} = require('../controllers/centerController');

const router = express.Router();

// Validation middleware
const validateCenter = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Center name is required and must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('location')
    .isObject()
    .withMessage('Location must be an object with lat and lng properties'),
  body('location.lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('operating_hours')
    .optional()
    .isObject()
    .withMessage('Operating hours must be an object')
];

// Routes
// GET /api/v1/centers - Get all centers (System Admin only)
router.get('/', verifyToken, requireSystemAdmin, asyncHandler(getAllCenters));

// POST /api/v1/centers - Create new center (System Admin only)
router.post('/', verifyToken, requireSystemAdmin, validateCenter, asyncHandler(createCenter));

// GET /api/v1/centers/:id/lifeguards - Get center lifeguards
router.get('/:id/lifeguards', verifyToken, requireCenterAdmin, requireOwnership('center'), asyncHandler(getCenterLifeguards));

// GET /api/v1/centers/:id/shifts - Get center shifts
router.get('/:id/shifts', verifyToken, requireCenterAdmin, requireOwnership('center'), asyncHandler(getCenterShifts));

// GET /api/v1/centers/:id/weather - Get center weather data
router.get('/:id/weather', verifyToken, requireCenterAdmin, requireOwnership('center'), asyncHandler(getCenterWeather));

// GET /api/v1/centers/:id/location-check-in - Get center location check-in setting
router.get('/:id/location-check-in', verifyToken, requireCenterAdmin, requireOwnership('center'), asyncHandler(getLocationCheckInSetting));

// PUT /api/v1/centers/:id/location-check-in - Update center location check-in setting
router.put('/:id/location-check-in', verifyToken, requireCenterAdmin, requireOwnership('center'), asyncHandler(updateLocationCheckInSetting));

// GET /api/v1/centers/:id - Get center by ID
router.get('/:id', verifyToken, asyncHandler(getCenterById));

// PUT /api/v1/centers/:id - Update center (Center Admin or System Admin)
router.put('/:id', verifyToken, requireCenterAdmin, requireOwnership('center'), validateCenter, asyncHandler(updateCenter));

// DELETE /api/v1/centers/:id - Delete center (System Admin only)
router.delete('/:id', verifyToken, requireSystemAdmin, asyncHandler(deleteCenter));

module.exports = router; 