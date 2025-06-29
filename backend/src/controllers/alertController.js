const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { emitEmergencyAlert } = require('../services/socketService');

// Find the nearest center to given coordinates
const findNearestCenter = async (lat, lng) => {
  const result = await query(`
    SELECT id, name, 
           ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as distance
    FROM centers 
    WHERE is_active = true
    ORDER BY location <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
    LIMIT 1
  `, [lng, lat]);
  
  return result.rows[0];
};

// Create SOS alert from public user
const createSOSAlert = asyncHandler(async (req, res) => {
  const { location, description, alert_type = 'sos', severity = 'critical', center_id } = req.body;
  
  if (!location || !location.lat || !location.lng) {
    return res.status(400).json({
      success: false,
      message: 'Location coordinates are required'
    });
  }

  let targetCenterId = center_id;
  
  // If no center specified, find the nearest one
  if (!targetCenterId) {
    const nearestCenter = await findNearestCenter(location.lat, location.lng);
    if (!nearestCenter) {
      return res.status(404).json({
        success: false,
        message: 'No active beach centers found'
      });
    }
    targetCenterId = nearestCenter.id;
    logger.info('Nearest center found for emergency alert', {
      centerId: targetCenterId,
      centerName: nearestCenter.name,
      distance: nearestCenter.distance
    });
  }

  // Create the emergency alert
  const result = await query(`
    INSERT INTO emergency_alerts (
      center_id, alert_type, severity, location, description, reported_by, status
    ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, 'active')
    RETURNING *
  `, [
    targetCenterId,
    alert_type,
    severity,
    location.lng,
    location.lat,
    description || 'Emergency alert from public user',
    req.body.reported_by || 'Anonymous beachgoer'
  ]);

  const alert = result.rows[0];
  
  // Emit real-time alert to center
  emitEmergencyAlert(alert);
  
  logger.info('Emergency alert created', {
    alertId: alert.id,
    centerId: targetCenterId,
    alertType: alert.alert_type,
    severity: alert.severity
  });

  res.status(201).json({
    success: true,
    message: 'Emergency alert created successfully',
    data: {
      id: alert.id,
      center_id: alert.center_id,
      alert_type: alert.alert_type,
      severity: alert.severity,
      status: alert.status,
      created_at: alert.created_at
    }
  });
});

// Get all alerts for a center (for lifeguards and admins)
const getAllAlerts = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status, limit = 50, offset = 0 } = req.query;
  
  let centerId;
  
  // Get center_id based on user role
  if (userRole === 'lifeguard') {
    const lifeguardResult = await query(
      'SELECT center_id FROM lifeguards WHERE user_id = $1',
      [userId]
    );
    
    if (lifeguardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lifeguard record not found'
      });
    }
    
    centerId = lifeguardResult.rows[0].center_id;
  } else if (userRole === 'center_admin') {
    const centerResult = await query(
      'SELECT center_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center admin record not found'
      });
    }
    
    centerId = centerResult.rows[0].center_id;
  } else {
    // System admin can see all alerts
    centerId = null;
  }
  
  let whereClause = centerId ? 'WHERE ea.center_id = $1' : '';
  let params = centerId ? [centerId] : [];
  let paramIndex = centerId ? 2 : 1;
  
  if (status) {
    whereClause += centerId ? ` AND ea.status = $${paramIndex}` : `WHERE ea.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }
  
  const result = await query(`
    SELECT 
      ea.*,
      c.name as center_name,
      l.first_name as lifeguard_first_name,
      l.last_name as lifeguard_last_name
    FROM emergency_alerts ea
    LEFT JOIN centers c ON ea.center_id = c.id
    LEFT JOIN lifeguards lg ON ea.assigned_lifeguard_id = lg.id
    LEFT JOIN users l ON lg.user_id = l.id
    ${whereClause}
    ORDER BY ea.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, [...params, limit, offset]);
  
  res.json({
    success: true,
    message: 'Alerts retrieved successfully',
    data: result.rows
  });
});

// Get alert by ID
const getAlertById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  let centerId;
  
  // Get center_id based on user role
  if (userRole === 'lifeguard') {
    const lifeguardResult = await query(
      'SELECT center_id FROM lifeguards WHERE user_id = $1',
      [userId]
    );
    
    if (lifeguardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lifeguard record not found'
      });
    }
    
    centerId = lifeguardResult.rows[0].center_id;
  } else if (userRole === 'center_admin') {
    const centerResult = await query(
      'SELECT center_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center admin record not found'
      });
    }
    
    centerId = centerResult.rows[0].center_id;
  } else {
    // System admin can see all alerts
    centerId = null;
  }
  
  const whereCondition = centerId ? 'ea.id = $1 AND ea.center_id = $2' : 'ea.id = $1';
  const params = centerId ? [id, centerId] : [id];
  
  const result = await query(`
    SELECT 
      ea.*,
      c.name as center_name,
      l.first_name as lifeguard_first_name,
      l.last_name as lifeguard_last_name
    FROM emergency_alerts ea
    LEFT JOIN centers c ON ea.center_id = c.id
    LEFT JOIN lifeguards lg ON ea.assigned_lifeguard_id = lg.id
    LEFT JOIN users l ON lg.user_id = l.id
    WHERE ${whereCondition}
  `, params);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }
  
  res.json({
    success: true,
    message: 'Alert retrieved successfully',
    data: result.rows[0]
  });
});

// Update alert status (for lifeguards)
const updateAlertStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  if (!['active', 'responding', 'resolved', 'closed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }
  
  let centerId;
  
  // Get center_id based on user role
  if (userRole === 'lifeguard') {
    const lifeguardResult = await query(
      'SELECT center_id FROM lifeguards WHERE user_id = $1',
      [userId]
    );
    
    if (lifeguardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lifeguard record not found'
      });
    }
    
    centerId = lifeguardResult.rows[0].center_id;
  } else if (userRole === 'center_admin') {
    const centerResult = await query(
      'SELECT center_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center admin record not found'
      });
    }
    
    centerId = centerResult.rows[0].center_id;
  } else {
    // System admin can update all alerts
    centerId = null;
  }
  
  const whereCondition = centerId ? 'id = $1 AND center_id = $2' : 'id = $1';
  const params = centerId ? [id, centerId] : [id];
  
  const result = await query(`
    UPDATE emergency_alerts 
    SET status = $${params.length + 1}, updated_at = CURRENT_TIMESTAMP
    ${status === 'resolved' ? ', resolved_at = CURRENT_TIMESTAMP' : ''}
    WHERE ${whereCondition}
    RETURNING *
  `, [...params, status]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }
  
  const alert = result.rows[0];
  
  // Emit status change notification
  const { emitAlertStatusChange } = require('../services/socketService');
  emitAlertStatusChange(alert);
  
  logger.info('Alert status updated', {
    alertId: id,
    newStatus: status,
    centerId: centerId
  });
  
  res.json({
    success: true,
    message: 'Alert status updated successfully',
    data: alert
  });
});

// Assign alert to lifeguard (for center admins)
const assignAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lifeguard_id } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  let centerId;
  
  // Get center_id based on user role
  if (userRole === 'center_admin') {
    const centerResult = await query(
      'SELECT center_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (centerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Center admin record not found'
      });
    }
    
    centerId = centerResult.rows[0].center_id;
  } else if (userRole === 'system_admin') {
    // System admin can assign alerts to any lifeguard
    centerId = null;
  } else {
    return res.status(403).json({
      success: false,
      message: 'Only center admins and system admins can assign alerts'
    });
  }
  
  // Verify lifeguard belongs to the center
  const lifeguardCheckQuery = centerId 
    ? 'SELECT id FROM lifeguards WHERE id = $1 AND center_id = $2'
    : 'SELECT id FROM lifeguards WHERE id = $1';
  const lifeguardCheckParams = centerId ? [lifeguard_id, centerId] : [lifeguard_id];
  
  const lifeguardCheck = await query(lifeguardCheckQuery, lifeguardCheckParams);
  
  if (lifeguardCheck.rows.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid lifeguard ID or lifeguard does not belong to this center'
    });
  }
  
  const whereCondition = centerId ? 'id = $1 AND center_id = $2' : 'id = $1';
  const params = centerId ? [id, centerId] : [id];
  
  const result = await query(`
    UPDATE emergency_alerts 
    SET assigned_lifeguard_id = $${params.length + 1}, status = 'responding', updated_at = CURRENT_TIMESTAMP
    WHERE ${whereCondition}
    RETURNING *
  `, [...params, lifeguard_id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }
  
  const alert = result.rows[0];
  
  // Emit assignment notification
  const { emitAlertStatusChange } = require('../services/socketService');
  emitAlertStatusChange(alert);
  
  logger.info('Alert assigned to lifeguard', {
    alertId: id,
    lifeguardId: lifeguard_id,
    centerId: centerId
  });
  
  res.json({
    success: true,
    message: 'Alert assigned successfully',
    data: alert
  });
});

// Get public emergency statistics
const getEmergencyStats = asyncHandler(async (req, res) => {
  const { center_id } = req.params;
  
  const result = await query(`
    SELECT 
      COUNT(*) as total_alerts,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
      COUNT(CASE WHEN status = 'responding' THEN 1 END) as responding_alerts,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
      COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_alerts
    FROM emergency_alerts 
    WHERE center_id = $1
  `, [center_id]);
  
  res.json({
    success: true,
    message: 'Emergency statistics retrieved successfully',
    data: result.rows[0]
  });
});

module.exports = {
  createSOSAlert,
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  assignAlert,
  getEmergencyStats
}; 