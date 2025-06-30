const asyncHandler = require('express-async-handler');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const { emitEscalationNotification, emitEscalationStatusUpdate } = require('../services/socketService');

// @desc    Create emergency escalation (Lifeguard)
// @route   POST /api/v1/escalations
// @access  Lifeguard
const createEscalation = asyncHandler(async (req, res) => {
  const lifeguardUserId = req.user.id;
  const {
    alert_id,
    escalation_type,
    priority = 'medium',
    description,
    requested_resources
  } = req.body;

  try {
    // Validate required fields
    if (!alert_id || !escalation_type || !description) {
      return res.status(400).json({
        success: false,
        message: 'Alert ID, escalation type, and description are required'
      });
    }

    // Validate escalation type
    const validEscalationTypes = ['backup_request', 'medical_support', 'equipment_request', 'guidance_request', 'evacuation_support'];
    if (!validEscalationTypes.includes(escalation_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid escalation type'
      });
    }

    // Get lifeguard ID
    const lifeguardResult = await db.query(
      'SELECT id, center_id FROM lifeguards WHERE user_id = $1',
      [lifeguardUserId]
    );

    if (lifeguardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lifeguard profile not found'
      });
    }

    const lifeguardId = lifeguardResult.rows[0].id;
    const centerId = lifeguardResult.rows[0].center_id;

    // Verify the alert belongs to the lifeguard's center
    const alertResult = await db.query(
      'SELECT id FROM emergency_alerts WHERE id = $1 AND center_id = $2',
      [alert_id, centerId]
    );

    if (alertResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid alert ID or alert does not belong to your center'
      });
    }

    // Create the escalation
    const result = await db.query(
      `INSERT INTO emergency_escalations 
       (alert_id, lifeguard_id, escalation_type, priority, description, requested_resources)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [alert_id, lifeguardId, escalation_type, priority, description, requested_resources]
    );

    const escalation = result.rows[0];

    logger.info('Created emergency escalation', {
      escalationId: escalation.id,
      alertId: alert_id,
      lifeguardId,
      centerId,
      escalationType: escalation_type,
      priority
    });

    // Emit socket notification to center admin
    try {
      await emitEscalationNotification(escalation);
    } catch (error) {
      logger.error('Failed to emit escalation notification', { error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Emergency escalation created successfully',
      data: escalation
    });
  } catch (error) {
    logger.error('Error creating emergency escalation', { error: error.message, lifeguardUserId });
    res.status(500).json({
      success: false,
      message: 'Failed to create emergency escalation'
    });
  }
});

// @desc    Get escalations for center (Center Admin)
// @route   GET /api/v1/escalations/center
// @access  Center Admin
const getCenterEscalations = asyncHandler(async (req, res) => {
  const centerAdminId = req.user.id;
  const { page = 1, limit = 10, status, priority } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Get center ID for the admin
    const userResult = await db.query(
      'SELECT center_id FROM users WHERE id = $1',
      [centerAdminId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].center_id) {
      return res.status(404).json({
        success: false,
        message: 'Center not found for this admin'
      });
    }

    const centerId = userResult.rows[0].center_id;

    // Build query with filters
    let query = `
      SELECT 
        ee.id,
        ee.escalation_type,
        ee.priority,
        ee.description,
        ee.requested_resources,
        ee.status,
        ee.created_at,
        ee.acknowledged_at,
        ee.resolved_at,
        ea.alert_type,
        ea.severity,
        ea.location as alert_location,
        ea.description as alert_description,
        l.id as lifeguard_id,
        u.first_name,
        u.last_name,
        u.email as lifeguard_email,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name
      FROM emergency_escalations ee
      JOIN emergency_alerts ea ON ee.alert_id = ea.id
      JOIN lifeguards l ON ee.lifeguard_id = l.id
      JOIN users u ON l.user_id = u.id
      LEFT JOIN users ack ON ee.acknowledged_by = ack.id
      WHERE ea.center_id = $1
    `;

    const queryParams = [centerId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND ee.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND ee.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    query += ` ORDER BY ee.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM emergency_escalations ee
      JOIN emergency_alerts ea ON ee.alert_id = ea.id
      WHERE ea.center_id = $1
    `;
    const countParams = [centerId];

    if (status) {
      countQuery += ` AND ee.status = $2`;
      countParams.push(status);
    }

    if (priority) {
      countQuery += ` AND ee.priority = $${countParams.length + 1}`;
      countParams.push(priority);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved escalations for center', {
      centerId,
      count: result.rows.length,
      totalCount,
      adminId: centerAdminId
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('Error retrieving escalations', { error: error.message, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve escalations'
    });
  }
});

// @desc    Get my escalations (Lifeguard)
// @route   GET /api/v1/escalations/my-escalations
// @access  Lifeguard
const getMyEscalations = asyncHandler(async (req, res) => {
  const lifeguardUserId = req.user.id;
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Get lifeguard ID
    const lifeguardResult = await db.query(
      'SELECT id FROM lifeguards WHERE user_id = $1',
      [lifeguardUserId]
    );

    if (lifeguardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lifeguard profile not found'
      });
    }

    const lifeguardId = lifeguardResult.rows[0].id;

    // Get escalations for this lifeguard
    const result = await db.query(
      `SELECT 
        ee.id,
        ee.escalation_type,
        ee.priority,
        ee.description,
        ee.requested_resources,
        ee.status,
        ee.created_at,
        ee.acknowledged_at,
        ee.resolved_at,
        ea.alert_type,
        ea.severity,
        ea.location as alert_location,
        ea.description as alert_description,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name
      FROM emergency_escalations ee
      JOIN emergency_alerts ea ON ee.alert_id = ea.id
      LEFT JOIN users ack ON ee.acknowledged_by = ack.id
      WHERE ee.lifeguard_id = $1
      ORDER BY ee.created_at DESC
      LIMIT $2 OFFSET $3`,
      [lifeguardId, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM emergency_escalations WHERE lifeguard_id = $1',
      [lifeguardId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved lifeguard escalations', {
      lifeguardId,
      count: result.rows.length,
      totalCount,
      lifeguardUserId
    });

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    logger.error('Error retrieving lifeguard escalations', { error: error.message, lifeguardUserId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve escalations'
    });
  }
});

// @desc    Acknowledge escalation (Center Admin)
// @route   PUT /api/v1/escalations/:id/acknowledge
// @access  Center Admin
const acknowledgeEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  try {
    // Get center ID for the admin
    const userResult = await db.query(
      'SELECT center_id FROM users WHERE id = $1',
      [centerAdminId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].center_id) {
      return res.status(404).json({
        success: false,
        message: 'Center not found for this admin'
      });
    }

    const centerId = userResult.rows[0].center_id;

    // Verify the escalation belongs to the admin's center
    const escalationResult = await db.query(
      `SELECT ee.id FROM emergency_escalations ee
       JOIN emergency_alerts ea ON ee.alert_id = ea.id
       WHERE ee.id = $1 AND ea.center_id = $2`,
      [id, centerId]
    );

    if (escalationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Escalation not found or access denied'
      });
    }

    // Update the escalation status
    const result = await db.query(
      `UPDATE emergency_escalations 
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [centerAdminId, id]
    );

    logger.info('Escalation acknowledged', {
      escalationId: id,
      centerAdminId,
      centerId
    });

    // Emit socket notification about status update
    try {
      await emitEscalationStatusUpdate(id, 'acknowledged', 'Center Admin');
    } catch (error) {
      logger.error('Failed to emit escalation status update', { error: error.message });
    }

    res.json({
      success: true,
      message: 'Escalation acknowledged successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error acknowledging escalation', { error: error.message, escalationId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge escalation'
    });
  }
});

// @desc    Resolve escalation (Center Admin)
// @route   PUT /api/v1/escalations/:id/resolve
// @access  Center Admin
const resolveEscalation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  try {
    // Get center ID for the admin
    const userResult = await db.query(
      'SELECT center_id FROM users WHERE id = $1',
      [centerAdminId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].center_id) {
      return res.status(404).json({
        success: false,
        message: 'Center not found for this admin'
      });
    }

    const centerId = userResult.rows[0].center_id;

    // Verify the escalation belongs to the admin's center
    const escalationResult = await db.query(
      `SELECT ee.id FROM emergency_escalations ee
       JOIN emergency_alerts ea ON ee.alert_id = ea.id
       WHERE ee.id = $1 AND ea.center_id = $2`,
      [id, centerId]
    );

    if (escalationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Escalation not found or access denied'
      });
    }

    // Update the escalation status
    const result = await db.query(
      `UPDATE emergency_escalations 
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    logger.info('Escalation resolved', {
      escalationId: id,
      centerAdminId,
      centerId
    });

    // Emit socket notification about status update
    try {
      await emitEscalationStatusUpdate(id, 'resolved', 'Center Admin');
    } catch (error) {
      logger.error('Failed to emit escalation status update', { error: error.message });
    }

    res.json({
      success: true,
      message: 'Escalation resolved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error resolving escalation', { error: error.message, escalationId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to resolve escalation'
    });
  }
});

// @desc    Get escalation by ID
// @route   GET /api/v1/escalations/:id
// @access  Center Admin, Lifeguard (own escalations)
const getEscalationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = `
      SELECT 
        ee.id,
        ee.escalation_type,
        ee.priority,
        ee.description,
        ee.requested_resources,
        ee.status,
        ee.created_at,
        ee.acknowledged_at,
        ee.resolved_at,
        ea.alert_type,
        ea.severity,
        ea.location as alert_location,
        ea.description as alert_description,
        l.id as lifeguard_id,
        u.first_name,
        u.last_name,
        u.email as lifeguard_email,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name
      FROM emergency_escalations ee
      JOIN emergency_alerts ea ON ee.alert_id = ea.id
      JOIN lifeguards l ON ee.lifeguard_id = l.id
      JOIN users u ON l.user_id = u.id
      LEFT JOIN users ack ON ee.acknowledged_by = ack.id
      WHERE ee.id = $1
    `;

    const queryParams = [id];

    // If lifeguard, ensure they can only see their own escalations
    if (userRole === 'lifeguard') {
      query += ` AND l.user_id = $2`;
      queryParams.push(userId);
    }

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Escalation not found'
      });
    }

    logger.info('Retrieved escalation', {
      escalationId: id,
      userId,
      userRole
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error retrieving escalation', { error: error.message, escalationId: id, userId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve escalation'
    });
  }
});

module.exports = {
  createEscalation,
  getCenterEscalations,
  getMyEscalations,
  acknowledgeEscalation,
  resolveEscalation,
  getEscalationById
}; 