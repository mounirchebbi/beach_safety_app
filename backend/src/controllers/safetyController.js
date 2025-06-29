const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const weatherService = require('../services/weatherService');

// Get current safety flag for a center
const getCurrentSafetyFlag = async (req, res) => {
  try {
    const { centerId } = req.params;
    const userId = req.user.id;

    // Get the most recent safety flag for the center
    const result = await query(
      `SELECT 
        sf.id,
        sf.flag_status,
        sf.reason,
        sf.set_at,
        sf.expires_at,
        sf.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM safety_flags sf
      JOIN users u ON sf.set_by = u.id
      WHERE sf.center_id = $1
      ORDER BY sf.set_at DESC
      LIMIT 1`,
      [centerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No safety flag found for this center' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error getting current safety flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get safety flag history for a center
const getSafetyFlagHistory = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Get safety flag history with pagination
    const result = await query(
      `SELECT 
        sf.id,
        sf.flag_status,
        sf.reason,
        sf.set_at,
        sf.expires_at,
        sf.created_at,
        u.first_name,
        u.last_name,
        u.email
      FROM safety_flags sf
      JOIN users u ON sf.set_by = u.id
      WHERE sf.center_id = $1
      ORDER BY sf.set_at DESC
      LIMIT $2 OFFSET $3`,
      [centerId, limit, offset]
    );

    // Get total count for pagination
    const countResult = await query(
      'SELECT COUNT(*) FROM safety_flags WHERE center_id = $1',
      [centerId]
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      flags: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error getting safety flag history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Set a new safety flag
const setSafetyFlag = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { flag_status, reason, expires_at } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!flag_status) {
      return res.status(400).json({ error: 'Flag status is required' });
    }

    // Validate flag status
    const validStatuses = ['green', 'yellow', 'red', 'black'];
    if (!validStatuses.includes(flag_status)) {
      return res.status(400).json({ error: 'Invalid flag status. Must be green, yellow, red, or black' });
    }

    // Verify center exists
    const centerCheck = await query('SELECT id FROM centers WHERE id = $1', [centerId]);
    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Insert new safety flag
    const result = await query(
      `INSERT INTO safety_flags (center_id, flag_status, reason, set_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING 
         id,
         flag_status,
         reason,
         set_at,
         expires_at,
         created_at`,
      [centerId, flag_status, reason, userId, expires_at]
    );

    const newFlag = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    const response = {
      ...newFlag,
      set_by: {
        id: userId,
        first_name: userResult.rows[0].first_name,
        last_name: userResult.rows[0].last_name,
        email: userResult.rows[0].email
      }
    };

    logger.info('Safety flag set', { 
      centerId, 
      flagStatus: flag_status, 
      setBy: userId,
      reason 
    });

    res.status(201).json(response);
  } catch (error) {
    logger.error('Error setting safety flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update safety flag
const updateSafetyFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const { flag_status, reason, expires_at } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!flag_status) {
      return res.status(400).json({ error: 'Flag status is required' });
    }

    // Validate flag status
    const validStatuses = ['green', 'yellow', 'red', 'black'];
    if (!validStatuses.includes(flag_status)) {
      return res.status(400).json({ error: 'Invalid flag status. Must be green, yellow, red, or black' });
    }

    // Get the flag and verify it exists
    const flagResult = await query(
      'SELECT sf.*, c.id as center_id FROM safety_flags sf JOIN centers c ON sf.center_id = c.id WHERE sf.id = $1',
      [flagId]
    );

    if (flagResult.rows.length === 0) {
      return res.status(404).json({ error: 'Safety flag not found' });
    }

    const flag = flagResult.rows[0];

    // Update the safety flag
    const result = await query(
      `UPDATE safety_flags 
       SET flag_status = $1, reason = $2, expires_at = $3, set_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING 
         id,
         flag_status,
         reason,
         set_at,
         expires_at,
         created_at`,
      [flag_status, reason, expires_at, flagId]
    );

    const updatedFlag = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    const response = {
      ...updatedFlag,
      set_by: {
        id: userId,
        first_name: userResult.rows[0].first_name,
        last_name: userResult.rows[0].last_name,
        email: userResult.rows[0].email
      }
    };

    logger.info('Safety flag updated', { 
      flagId, 
      centerId: flag.center_id,
      flagStatus: flag_status, 
      setBy: userId,
      reason 
    });

    res.json(response);
  } catch (error) {
    logger.error('Error updating safety flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete safety flag
const deleteSafetyFlag = async (req, res) => {
  try {
    const { flagId } = req.params;
    const userId = req.user.id;

    // Get the flag and verify it exists
    const flagResult = await query(
      'SELECT sf.*, c.id as center_id FROM safety_flags sf JOIN centers c ON sf.center_id = c.id WHERE sf.id = $1',
      [flagId]
    );

    if (flagResult.rows.length === 0) {
      return res.status(404).json({ error: 'Safety flag not found' });
    }

    const flag = flagResult.rows[0];

    // Delete the safety flag
    await query('DELETE FROM safety_flags WHERE id = $1', [flagId]);

    logger.info('Safety flag deleted', { 
      flagId, 
      centerId: flag.center_id,
      deletedBy: userId 
    });

    res.json({ message: 'Safety flag deleted successfully' });
  } catch (error) {
    logger.error('Error deleting safety flag:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all safety flags for system admin
const getAllSafetyFlags = async (req, res) => {
  try {
    const { page = 1, limit = 20, center_id, flag_status } = req.query;
    const offset = (page - 1) * limit;

    // Build query with filters
    let whereClause = 'WHERE 1=1';
    const queryParams = [];
    let paramCount = 0;

    if (center_id) {
      paramCount++;
      whereClause += ` AND sf.center_id = $${paramCount}`;
      queryParams.push(center_id);
    }

    if (flag_status) {
      paramCount++;
      whereClause += ` AND sf.flag_status = $${paramCount}`;
      queryParams.push(flag_status);
    }

    // Get safety flags with pagination
    const result = await query(
      `SELECT 
        sf.id,
        sf.flag_status,
        sf.reason,
        sf.set_at,
        sf.expires_at,
        sf.created_at,
        c.name as center_name,
        c.id as center_id,
        u.first_name,
        u.last_name,
        u.email
      FROM safety_flags sf
      JOIN centers c ON sf.center_id = c.id
      JOIN users u ON sf.set_by = u.id
      ${whereClause}
      ORDER BY sf.set_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...queryParams, limit, offset]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) FROM safety_flags sf ${whereClause}`,
      queryParams
    );

    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      flags: result.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error getting all safety flags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get flag management mode for a center
const getFlagManagementMode = async (req, res) => {
  try {
    const { centerId } = req.params;
    const userId = req.user.id;

    // Check if center exists
    const centerCheck = await query('SELECT id FROM centers WHERE id = $1', [centerId]);
    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Get the most recent flag to determine if it was set automatically or manually
    const flagResult = await query(
      `SELECT 
        sf.id,
        sf.flag_status,
        sf.reason,
        sf.set_at,
        sf.set_by,
        u.role as set_by_role
      FROM safety_flags sf
      JOIN users u ON sf.set_by = u.id
      WHERE sf.center_id = $1
      ORDER BY sf.set_at DESC
      LIMIT 1`,
      [centerId]
    );

    let mode = 'automatic'; // Default mode
    let lastUpdate = null;
    let currentFlag = null;

    if (flagResult.rows.length > 0) {
      const flag = flagResult.rows[0];
      currentFlag = {
        status: flag.flag_status,
        reason: flag.reason,
        set_at: flag.set_at
      };
      
      // If the last flag was set by a system admin (automatic), mode is automatic
      // If set by a center admin or lifeguard (manual), mode is manual
      mode = flag.set_by_role === 'system_admin' ? 'automatic' : 'manual';
      lastUpdate = flag.set_at;
    }

    res.json({
      center_id: centerId,
      mode: mode,
      current_flag: currentFlag,
      last_update: lastUpdate
    });
  } catch (error) {
    logger.error('Error getting flag management mode:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Trigger automatic flag update for a center
const triggerAutomaticFlagUpdate = async (req, res) => {
  try {
    const { centerId } = req.params;
    const userId = req.user.id;

    // Check if center exists
    const centerCheck = await query('SELECT id FROM centers WHERE id = $1', [centerId]);
    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Trigger automatic flag update
    const result = await weatherService.updateSafetyFlagAutomatically(centerId, userId);

    res.json({
      success: true,
      message: result.updated ? 'Safety flag updated automatically' : 'No update needed',
      data: result
    });
  } catch (error) {
    logger.error('Error triggering automatic flag update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Switch to manual mode (override automatic)
const switchToManualMode = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { flag_status, reason, expires_at } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!flag_status) {
      return res.status(400).json({ error: 'Flag status is required' });
    }

    // Validate flag status
    const validStatuses = ['green', 'yellow', 'red', 'black'];
    if (!validStatuses.includes(flag_status)) {
      return res.status(400).json({ error: 'Invalid flag status. Must be green, yellow, red, or black' });
    }

    // Check if center exists
    const centerCheck = await query('SELECT id FROM centers WHERE id = $1', [centerId]);
    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Set manual flag (this overrides automatic mode)
    const result = await query(
      `INSERT INTO safety_flags (center_id, flag_status, reason, set_by, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING 
         id,
         flag_status,
         reason,
         set_at,
         expires_at,
         created_at`,
      [centerId, flag_status, reason, userId, expires_at]
    );

    const newFlag = result.rows[0];

    // Get user info for response
    const userResult = await query(
      'SELECT first_name, last_name, email FROM users WHERE id = $1',
      [userId]
    );

    const response = {
      ...newFlag,
      set_by: {
        id: userId,
        first_name: userResult.rows[0].first_name,
        last_name: userResult.rows[0].last_name,
        email: userResult.rows[0].email
      }
    };

    logger.info('Manual safety flag set (overriding automatic mode)', { 
      centerId, 
      flagStatus: flag_status, 
      setBy: userId,
      reason 
    });

    res.status(201).json({
      success: true,
      message: 'Manual flag set successfully (automatic mode overridden)',
      data: response
    });
  } catch (error) {
    logger.error('Error switching to manual mode:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getCurrentSafetyFlag,
  getSafetyFlagHistory,
  setSafetyFlag,
  updateSafetyFlag,
  deleteSafetyFlag,
  getAllSafetyFlags,
  getFlagManagementMode,
  triggerAutomaticFlagUpdate,
  switchToManualMode
}; 