const asyncHandler = require('express-async-handler');
const db = require('../config/database');
const { logger } = require('../utils/logger');

// @desc    Get all incident reports for a center (Center Admin)
// @route   GET /api/v1/reports
// @access  Center Admin
const getAllReports = asyncHandler(async (req, res) => {
  const centerAdminId = req.user.id;
  const { page = 1, limit = 10, status, lifeguard_id } = req.query;
  const offset = (page - 1) * limit;

  try {
    // Get center ID for the admin - check users table first for center_admin role
    let centerId;
    
    if (req.user.role === 'center_admin') {
      // For center admins, get center_id directly from users table
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

      centerId = userResult.rows[0].center_id;
    } else {
      // For other roles, check lifeguards table (legacy approach)
      const centerResult = await db.query(
        'SELECT center_id FROM lifeguards WHERE user_id = $1 LIMIT 1',
        [centerAdminId]
      );

      if (centerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Center not found for this admin'
        });
      }

      centerId = centerResult.rows[0].center_id;
    }

    // Build query with filters
    let query = `
      SELECT 
        ir.id,
        ir.incident_type,
        ir.description,
        ir.action_taken,
        ir.outcome,
        ir.involved_persons,
        ir.created_at,
        ir.updated_at,
        ea.alert_type,
        ea.severity,
        ea.status as alert_status,
        ea.location as alert_location,
        ea.description as alert_description,
        l.id as lifeguard_id,
        u.first_name,
        u.last_name,
        u.email as lifeguard_email
      FROM incident_reports ir
      LEFT JOIN emergency_alerts ea ON ir.alert_id = ea.id
      LEFT JOIN lifeguards l ON ir.lifeguard_id = l.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.center_id = $1
    `;

    const queryParams = [centerId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND ea.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (lifeguard_id) {
      paramCount++;
      query += ` AND ir.lifeguard_id = $${paramCount}`;
      queryParams.push(lifeguard_id);
    }

    query += ` ORDER BY ir.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) 
      FROM incident_reports ir
      LEFT JOIN lifeguards l ON ir.lifeguard_id = l.id
      WHERE l.center_id = $1
    `;
    const countParams = [centerId];

    if (status) {
      countQuery += ` AND EXISTS (
        SELECT 1 FROM emergency_alerts ea 
        WHERE ea.id = ir.alert_id AND ea.status = $2
      )`;
      countParams.push(status);
    }

    if (lifeguard_id) {
      countQuery += ` AND ir.lifeguard_id = $${countParams.length + 1}`;
      countParams.push(lifeguard_id);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved incident reports for center', {
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
    logger.error('Error retrieving incident reports', { error: error.message, centerAdminId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident reports'
    });
  }
});

// @desc    Get incident report by ID
// @route   GET /api/v1/reports/:id
// @access  Center Admin, Lifeguard (own reports)
const getReportById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let query = `
      SELECT 
        ir.id,
        ir.incident_type,
        ir.description,
        ir.action_taken,
        ir.outcome,
        ir.involved_persons,
        ir.created_at,
        ir.updated_at,
        ea.id as alert_id,
        ea.alert_type,
        ea.severity,
        ea.status as alert_status,
        ea.location as alert_location,
        ea.description as alert_description,
        l.id as lifeguard_id,
        u.first_name,
        u.last_name,
        u.email as lifeguard_email
      FROM incident_reports ir
      LEFT JOIN emergency_alerts ea ON ir.alert_id = ea.id
      LEFT JOIN lifeguards l ON ir.lifeguard_id = l.id
      LEFT JOIN users u ON l.user_id = u.id
      WHERE ir.id = $1
    `;

    const queryParams = [id];

    // If lifeguard, ensure they can only see their own reports
    if (userRole === 'lifeguard') {
      query += ` AND l.user_id = $2`;
      queryParams.push(userId);
    }

    const result = await db.query(query, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found'
      });
    }

    logger.info('Retrieved incident report', {
      reportId: id,
      userId,
      userRole
    });

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error retrieving incident report', { error: error.message, reportId: id, userId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident report'
    });
  }
});

// @desc    Create incident report
// @route   POST /api/v1/reports
// @access  Lifeguard
const createReport = asyncHandler(async (req, res) => {
  const {
    alert_id,
    incident_type,
    description,
    action_taken,
    outcome,
    involved_persons
  } = req.body;

  const lifeguardUserId = req.user.id;

  // Validate required fields
  if (!incident_type || !description) {
    return res.status(400).json({
      success: false,
      message: 'Incident type and description are required'
    });
  }

  try {
    // Get lifeguard ID for the user
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

    // Handle alert_id - set to null if empty or null
    const alertId = alert_id && alert_id.trim() !== '' ? alert_id : null;

    // If alert_id is provided, verify it exists and belongs to the same center
    if (alertId) {
      const alertResult = await db.query(
        'SELECT id FROM emergency_alerts WHERE id = $1 AND center_id = $2',
        [alertId, centerId]
      );

      if (alertResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid alert ID or alert does not belong to your center'
        });
      }
    }

    // Create the incident report
    const result = await db.query(
      `INSERT INTO incident_reports 
       (alert_id, lifeguard_id, incident_type, description, action_taken, outcome, involved_persons)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [alertId, lifeguardId, incident_type, description, action_taken, outcome, involved_persons]
    );

    // If this is linked to an alert, update the alert status to resolved
    if (alertId) {
      await db.query(
        'UPDATE emergency_alerts SET status = $1, resolved_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['resolved', alertId]
      );
    }

    logger.info('Created incident report', {
      reportId: result.rows[0].id,
      lifeguardId,
      centerId,
      alertId: alertId,
      incidentType: incident_type
    });

    res.status(201).json({
      success: true,
      message: 'Incident report created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error creating incident report', { error: error.message, lifeguardUserId });
    res.status(500).json({
      success: false,
      message: 'Failed to create incident report'
    });
  }
});

// @desc    Update incident report
// @route   PUT /api/v1/reports/:id
// @access  Lifeguard (own reports)
const updateReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    incident_type,
    description,
    action_taken,
    outcome,
    involved_persons
  } = req.body;

  const lifeguardUserId = req.user.id;

  try {
    // Verify the report exists and belongs to the lifeguard
    const reportResult = await db.query(
      `SELECT ir.id FROM incident_reports ir
       JOIN lifeguards l ON ir.lifeguard_id = l.id
       WHERE ir.id = $1 AND l.user_id = $2`,
      [id, lifeguardUserId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident report not found or access denied'
      });
    }

    // Update the report
    const result = await db.query(
      `UPDATE incident_reports 
       SET incident_type = COALESCE($1, incident_type),
           description = COALESCE($2, description),
           action_taken = COALESCE($3, action_taken),
           outcome = COALESCE($4, outcome),
           involved_persons = COALESCE($5, involved_persons),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [incident_type, description, action_taken, outcome, involved_persons, id]
    );

    logger.info('Updated incident report', {
      reportId: id,
      lifeguardUserId
    });

    res.json({
      success: true,
      message: 'Incident report updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Error updating incident report', { error: error.message, reportId: id, lifeguardUserId });
    res.status(500).json({
      success: false,
      message: 'Failed to update incident report'
    });
  }
});

// @desc    Get my incident reports (Lifeguard)
// @route   GET /api/v1/reports/my-reports
// @access  Lifeguard
const getMyReports = asyncHandler(async (req, res) => {
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

    // Get reports for this lifeguard
    const result = await db.query(
      `SELECT 
        ir.id,
        ir.incident_type,
        ir.description,
        ir.action_taken,
        ir.outcome,
        ir.involved_persons,
        ir.created_at,
        ir.updated_at,
        ea.alert_type,
        ea.severity,
        ea.status as alert_status,
        ea.location as alert_location,
        ea.description as alert_description
      FROM incident_reports ir
      LEFT JOIN emergency_alerts ea ON ir.alert_id = ea.id
      WHERE ir.lifeguard_id = $1
      ORDER BY ir.created_at DESC
      LIMIT $2 OFFSET $3`,
      [lifeguardId, limit, offset]
    );

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM incident_reports WHERE lifeguard_id = $1',
      [lifeguardId]
    );
    const totalCount = parseInt(countResult.rows[0].count);

    logger.info('Retrieved lifeguard incident reports', {
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
    logger.error('Error retrieving lifeguard incident reports', { error: error.message, lifeguardUserId });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident reports'
    });
  }
});

module.exports = {
  getAllReports,
  getReportById,
  createReport,
  updateReport,
  getMyReports
}; 