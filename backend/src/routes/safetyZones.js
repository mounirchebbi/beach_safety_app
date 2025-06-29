const express = require('express');
const router = express.Router();
const { verifyToken, requireRole, requireCenterAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getSafetyZonesByCenter,
  getSafetyZoneById,
  createSafetyZone,
  updateSafetyZone,
  deleteSafetyZone,
  getPublicSafetyZones
} = require('../controllers/safetyZoneController');

// Public routes (no authentication required)
router.get('/public', asyncHandler(getPublicSafetyZones));

// Protected routes for center admins and system admins
router.get('/centers/:centerId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  asyncHandler(getSafetyZonesByCenter)
);

router.get('/:zoneId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  asyncHandler(getSafetyZoneById)
);

router.post('/centers/:centerId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  asyncHandler(createSafetyZone)
);

router.put('/:zoneId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  asyncHandler(updateSafetyZone)
);

router.delete('/:zoneId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  asyncHandler(deleteSafetyZone)
);

module.exports = router; 