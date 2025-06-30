const asyncHandler = require('express-async-handler');
const db = require('../config/database');
const { logger } = require('../utils/logger');
const { emitInterCenterSupportNotification, emitInterCenterSupportStatusUpdate } = require('../services/socketService');

// @desc    Create inter-center support request (Center Admin)
// @route   POST /api/v1/inter-center-support
// @access  Center Admin
const createInterCenterSupportRequest = asyncHandler(async (req, res) => {
  const centerAdminId = req.user.id;
  const {
    target_center_id,
    escalation_id,
    request_type,
    priority = 'medium',
    title,
    description,
    requested_resources
  } = req.body;

  try {
    // Validate required fields
    if (!target_center_id || !request_type || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Target center ID, request type, title, and description are required'
      });
    }

    // Validate request type
    const validRequestTypes = ['personnel_support', 'equipment_support', 'medical_support', 'evacuation_support', 'coordination_support'];
    if (!validRequestTypes.includes(request_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request type'
      });
    }

    // Get requesting center ID for the admin
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

    const requestingCenterId = userResult.rows[0].center_id;

    // Verify target center exists and is different from requesting center
    if (requestingCenterId === target_center_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request support from your own center'
      });
    }

    const targetCenterResult = await db.query(
      'SELECT id, name FROM centers WHERE id = $1 AND is_active = true',
      [target_center_id]
    );

    if (targetCenterResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Target center not found or inactive'
      });
    }

    // Verify escalation exists if provided
    if (escalation_id) {
      const escalationResult = await db.query(
        'SELECT id FROM emergency_escalations WHERE id = $1',
        [escalation_id]
      );

      if (escalationResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid escalation ID'
        });
      }
    }

    // Create the inter-center support request
    const result = await db.query(
      `INSERT INTO inter_center_support_requests 
       (requesting_center_id, requesting_admin_id, target_center_id, escalation_id, request_type, priority, title, description, requested_resources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [requestingCenterId, centerAdminId, target_center_id, escalation_id, request_type, priority, title, description, requested_resources]
    );

    const supportRequest = result.rows[0];

    logger.info('Created inter-center support request', {
      requestId: supportRequest.id,
      requestingCenterId,
      targetCenterId: target_center_id,
      requestType: request_type,
      priority
    });

    // Emit socket notification to target center
    try {
      await emitInterCenterSupportNotification(supportRequest);
    } catch (error) {
      logger.error('Failed to emit inter-center support notification', { error: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Inter-center support request created successfully',
      data: supportRequest
    });
  } catch (error) {
    logger.error('Error creating inter-center support request', { error: error.message, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to create inter-center support request'
    });
  }
});

// @desc    Get incoming support requests for center (Center Admin)
// @route   GET /api/v1/inter-center-support/incoming
// @access  Center Admin
const getIncomingSupportRequests = asyncHandler(async (req, res) => {
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
        icsr.id,
        icsr.request_type,
        icsr.priority,
        icsr.title,
        icsr.description,
        icsr.requested_resources,
        icsr.status,
        icsr.created_at,
        icsr.acknowledged_at,
        icsr.resolved_at,
        icsr.declined_reason,
        icsr.escalation_id,
        req_center.name as requesting_center_name,
        req_admin.first_name as requesting_admin_first_name,
        req_admin.last_name as requesting_admin_last_name,
        req_admin.email as requesting_admin_email,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name,
        ee.escalation_type,
        ee.priority as escalation_priority
      FROM inter_center_support_requests icsr
      JOIN centers req_center ON icsr.requesting_center_id = req_center.id
      JOIN users req_admin ON icsr.requesting_admin_id = req_admin.id
      LEFT JOIN users ack ON icsr.acknowledged_by = ack.id
      LEFT JOIN emergency_escalations ee ON icsr.escalation_id = ee.id
      WHERE icsr.target_center_id = $1
    `;

    const queryParams = [centerId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND icsr.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND icsr.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    query += ` ORDER BY icsr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM inter_center_support_requests icsr
      WHERE icsr.target_center_id = $1
    `;
    const countParams = [centerId];

    if (status) {
      countQuery += ` AND icsr.status = $2`;
      countParams.push(status);
    }

    if (priority) {
      countQuery += ` AND icsr.priority = $${countParams.length + 1}`;
      countParams.push(priority);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved incoming support requests', {
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
    logger.error('Error retrieving incoming support requests', { error: error.message, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incoming support requests'
    });
  }
});

// @desc    Get outgoing support requests from center (Center Admin)
// @route   GET /api/v1/inter-center-support/outgoing
// @access  Center Admin
const getOutgoingSupportRequests = asyncHandler(async (req, res) => {
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
        icsr.id,
        icsr.request_type,
        icsr.priority,
        icsr.title,
        icsr.description,
        icsr.requested_resources,
        icsr.status,
        icsr.created_at,
        icsr.acknowledged_at,
        icsr.resolved_at,
        icsr.declined_reason,
        icsr.escalation_id,
        target_center.name as target_center_name,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name,
        ee.escalation_type,
        ee.priority as escalation_priority
      FROM inter_center_support_requests icsr
      JOIN centers target_center ON icsr.target_center_id = target_center.id
      LEFT JOIN users ack ON icsr.acknowledged_by = ack.id
      LEFT JOIN emergency_escalations ee ON icsr.escalation_id = ee.id
      WHERE icsr.requesting_center_id = $1
    `;

    const queryParams = [centerId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND icsr.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND icsr.priority = $${paramCount}`;
      queryParams.push(priority);
    }

    query += ` ORDER BY icsr.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM inter_center_support_requests icsr
      WHERE icsr.requesting_center_id = $1
    `;
    const countParams = [centerId];

    if (status) {
      countQuery += ` AND icsr.status = $2`;
      countParams.push(status);
    }

    if (priority) {
      countQuery += ` AND icsr.priority = $${countParams.length + 1}`;
      countParams.push(priority);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved outgoing support requests', {
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
    logger.error('Error retrieving outgoing support requests', { error: error.message, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve outgoing support requests'
    });
  }
});

// @desc    Acknowledge support request (Center Admin)
// @route   PUT /api/v1/inter-center-support/:id/acknowledge
// @access  Center Admin
const acknowledgeSupportRequest = asyncHandler(async (req, res) => {
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

    // Verify the support request is for this center
    const requestResult = await db.query(
      'SELECT id FROM inter_center_support_requests WHERE id = $1 AND target_center_id = $2',
      [id, centerId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found or access denied'
      });
    }

    // Update the support request status
    const result = await db.query(
      `UPDATE inter_center_support_requests 
       SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [centerAdminId, id]
    );

    logger.info('Support request acknowledged', {
      requestId: id,
      centerAdminId,
      centerId
    });

    // Emit socket notification about status update
    try {
      await emitInterCenterSupportStatusUpdate(id, 'acknowledged', 'Center Admin');
    } catch (error) {
      logger.error('Failed to emit support request status update', { error: error.message });
    }

    res.json({
      success: true,
      message: 'Support request acknowledged successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error acknowledging support request', { error: error.message, requestId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge support request'
    });
  }
});

// @desc    Resolve support request (Center Admin)
// @route   PUT /api/v1/inter-center-support/:id/resolve
// @access  Center Admin
const resolveSupportRequest = asyncHandler(async (req, res) => {
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

    // Verify the support request is for this center
    const requestResult = await db.query(
      'SELECT id FROM inter_center_support_requests WHERE id = $1 AND target_center_id = $2',
      [id, centerId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found or access denied'
      });
    }

    // Update the support request status
    const result = await db.query(
      `UPDATE inter_center_support_requests 
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    logger.info('Support request resolved', {
      requestId: id,
      centerAdminId,
      centerId
    });

    // Emit socket notification about status update
    try {
      await emitInterCenterSupportStatusUpdate(id, 'resolved', 'Center Admin');
    } catch (error) {
      logger.error('Failed to emit support request status update', { error: error.message });
    }

    res.json({
      success: true,
      message: 'Support request resolved successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error resolving support request', { error: error.message, requestId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to resolve support request'
    });
  }
});

// @desc    Decline support request (Center Admin)
// @route   PUT /api/v1/inter-center-support/:id/decline
// @access  Center Admin
const declineSupportRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
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

    // Verify the support request is for this center
    const requestResult = await db.query(
      'SELECT id FROM inter_center_support_requests WHERE id = $1 AND target_center_id = $2',
      [id, centerId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found or access denied'
      });
    }

    // Update the support request status
    const result = await db.query(
      `UPDATE inter_center_support_requests 
       SET status = 'declined', declined_reason = $1
       WHERE id = $2
       RETURNING *`,
      [reason, id]
    );

    logger.info('Support request declined', {
      requestId: id,
      centerAdminId,
      centerId,
      reason
    });

    // Emit socket notification about status update
    try {
      await emitInterCenterSupportStatusUpdate(id, 'declined', 'Center Admin');
    } catch (error) {
      logger.error('Failed to emit support request status update', { error: error.message });
    }

    res.json({
      success: true,
      message: 'Support request declined successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error declining support request', { error: error.message, requestId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to decline support request'
    });
  }
});

// @desc    Get support request by ID
// @route   GET /api/v1/inter-center-support/:id
// @access  Center Admin
const getSupportRequestById = asyncHandler(async (req, res) => {
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

    // Get support request details
    const result = await db.query(
      `SELECT 
        icsr.id,
        icsr.request_type,
        icsr.priority,
        icsr.title,
        icsr.description,
        icsr.requested_resources,
        icsr.status,
        icsr.created_at,
        icsr.acknowledged_at,
        icsr.resolved_at,
        icsr.declined_reason,
        icsr.escalation_id,
        req_center.name as requesting_center_name,
        req_admin.first_name as requesting_admin_first_name,
        req_admin.last_name as requesting_admin_last_name,
        req_admin.email as requesting_admin_email,
        target_center.name as target_center_name,
        ack.first_name as acknowledged_by_first_name,
        ack.last_name as acknowledged_by_last_name,
        ee.escalation_type,
        ee.priority as escalation_priority,
        ee.description as escalation_description
      FROM inter_center_support_requests icsr
      JOIN centers req_center ON icsr.requesting_center_id = req_center.id
      JOIN users req_admin ON icsr.requesting_admin_id = req_admin.id
      JOIN centers target_center ON icsr.target_center_id = target_center.id
      LEFT JOIN users ack ON icsr.acknowledged_by = ack.id
      LEFT JOIN emergency_escalations ee ON icsr.escalation_id = ee.id
      WHERE icsr.id = $1 AND (icsr.requesting_center_id = $2 OR icsr.target_center_id = $2)`,
      [id, centerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Support request not found'
      });
    }

    logger.info('Retrieved support request', {
      requestId: id,
      centerAdminId,
      centerId
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error retrieving support request', { error: error.message, requestId: id, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve support request'
    });
  }
});

module.exports = {
  createInterCenterSupportRequest,
  getIncomingSupportRequests,
  getOutgoingSupportRequests,
  acknowledgeSupportRequest,
  resolveSupportRequest,
  declineSupportRequest,
  getSupportRequestById
}; 