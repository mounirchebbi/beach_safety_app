const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  getCurrentSafetyFlag,
  getSafetyFlagHistory,
  setSafetyFlag,
  updateSafetyFlag,
  deleteSafetyFlag,
  getAllSafetyFlags,
  getFlagManagementMode,
  triggerAutomaticFlagUpdate,
  switchToManualMode
} = require('../controllers/safetyController');

// Get current safety flag for a center (Center Admin, System Admin)
router.get('/centers/:centerId/current', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  getCurrentSafetyFlag
);

// Get safety flag history for a center (Center Admin, System Admin)
router.get('/centers/:centerId/history', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  getSafetyFlagHistory
);

// Set a new safety flag (Center Admin, System Admin)
router.post('/centers/:centerId/flags', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  setSafetyFlag
);

// Update safety flag (Center Admin, System Admin)
router.put('/flags/:flagId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  updateSafetyFlag
);

// Delete safety flag (Center Admin, System Admin)
router.delete('/flags/:flagId', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  deleteSafetyFlag
);

// Get all safety flags (System Admin only)
router.get('/flags', 
  verifyToken, 
  requireRole(['system_admin']), 
  getAllSafetyFlags
);

// Get flag management mode for a center (Center Admin, System Admin)
router.get('/centers/:centerId/mode', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  getFlagManagementMode
);

// Trigger automatic flag update for a center (Center Admin, System Admin)
router.post('/centers/:centerId/auto-update', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  triggerAutomaticFlagUpdate
);

// Switch to manual mode (override automatic) (Center Admin, System Admin)
router.post('/centers/:centerId/manual', 
  verifyToken, 
  requireRole(['center_admin', 'system_admin']), 
  switchToManualMode
);

module.exports = router; 