const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');
const bcrypt = require('bcrypt');

// @desc    Get all lifeguards for a center
// @route   GET /api/v1/lifeguards
// @access  Center Admin
const getAllLifeguards = asyncHandler(async (req, res) => {
  const centerAdminId = req.user.id;
  
  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id, c.name as center_name
     FROM centers c
     JOIN users u ON u.center_id = c.id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Get all lifeguards for this center
  const result = await query(
    `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact, l.created_at, l.updated_at,
            u.id as user_id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
            c.id as center_id, c.name as center_name
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = l.center_id
     WHERE l.center_id = $1 AND u.role = 'lifeguard'
     ORDER BY u.first_name, u.last_name`,
    [centerId]
  );

  logger.info('Retrieved lifeguards for center', {
    centerId,
    count: result.rows.length,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

// @desc    Get lifeguard by ID
// @route   GET /api/v1/lifeguards/:id
// @access  Center Admin
const getLifeguardById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users u ON u.center_id = c.id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Get the specific lifeguard
  const result = await query(
    `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact, l.created_at, l.updated_at,
            u.id as user_id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
            c.id as center_id, c.name as center_name
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     JOIN centers c ON c.id = l.center_id
     WHERE l.id = $1 AND l.center_id = $2 AND u.role = 'lifeguard'`,
    [id, centerId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard not found'
    });
  }

  logger.info('Retrieved lifeguard by ID', {
    lifeguardId: id,
    centerId,
    adminId: centerAdminId
  });

  res.json({
    success: true,
    data: result.rows[0]
  });
});

// @desc    Create a new lifeguard
// @route   POST /api/v1/lifeguards
// @access  Center Admin
const createLifeguard = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    first_name,
    last_name,
    phone,
    certification_level,
    certification_expiry,
    emergency_contact
  } = req.body;

  const centerAdminId = req.user.id;

  // Validate required fields
  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({
      success: false,
      message: 'Email, password, first name, and last name are required'
    });
  }

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id, c.name as center_name
     FROM centers c
     JOIN users u ON u.center_id = c.id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if email already exists
  const existingUser = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingUser.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists'
    });
  }

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Start transaction
  const client = await query('BEGIN');

  try {
    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, phone, role`,
      [email, passwordHash, 'lifeguard', first_name, last_name, phone]
    );

    const userId = userResult.rows[0].id;

    // Create lifeguard record
    const lifeguardResult = await query(
      `INSERT INTO lifeguards (user_id, center_id, certification_level, certification_expiry, emergency_contact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, certification_level, certification_expiry, emergency_contact, created_at, updated_at`,
      [userId, centerId, certification_level, certification_expiry, emergency_contact]
    );

    await query('COMMIT');

    // Get the complete lifeguard data
    const completeResult = await query(
      `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact, l.created_at, l.updated_at,
              u.id as user_id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
              c.id as center_id, c.name as center_name
       FROM lifeguards l
       JOIN users u ON u.id = l.user_id
       JOIN centers c ON c.id = l.center_id
       WHERE l.id = $1`,
      [lifeguardResult.rows[0].id]
    );

    logger.info('Created new lifeguard', {
      lifeguardId: lifeguardResult.rows[0].id,
      userId,
      centerId,
      adminId: centerAdminId,
      email
    });

    res.status(201).json({
      success: true,
      message: 'Lifeguard created successfully',
      data: completeResult.rows[0]
    });

  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
});

// @desc    Update lifeguard
// @route   PUT /api/v1/lifeguards/:id
// @access  Center Admin
const updateLifeguard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    email,
    first_name,
    last_name,
    phone,
    certification_level,
    certification_expiry,
    emergency_contact,
    is_active
  } = req.body;

  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users u ON u.center_id = c.id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if lifeguard exists and belongs to this center
  const existingLifeguard = await query(
    `SELECT l.id, l.user_id, u.email
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.center_id = $2 AND u.role = 'lifeguard'`,
    [id, centerId]
  );

  if (existingLifeguard.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard not found'
    });
  }

  const userId = existingLifeguard.rows[0].user_id;

  // Check if email is being changed and if it already exists
  if (email && email !== existingLifeguard.rows[0].email) {
    const emailExists = await query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (emailExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }
  }

  // Start transaction
  await query('BEGIN');

  try {
    // Update user information
    const userUpdateFields = [];
    const userUpdateValues = [];
    let paramCount = 1;

    if (email) {
      userUpdateFields.push(`email = $${paramCount++}`);
      userUpdateValues.push(email);
    }
    if (first_name) {
      userUpdateFields.push(`first_name = $${paramCount++}`);
      userUpdateValues.push(first_name);
    }
    if (last_name) {
      userUpdateFields.push(`last_name = $${paramCount++}`);
      userUpdateValues.push(last_name);
    }
    if (phone !== undefined) {
      userUpdateFields.push(`phone = $${paramCount++}`);
      userUpdateValues.push(phone);
    }
    if (is_active !== undefined) {
      userUpdateFields.push(`is_active = $${paramCount++}`);
      userUpdateValues.push(is_active);
    }

    if (userUpdateFields.length > 0) {
      userUpdateValues.push(userId);
      await query(
        `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = $${paramCount}`,
        userUpdateValues
      );
    }

    // Update lifeguard information
    const lifeguardUpdateFields = [];
    const lifeguardUpdateValues = [];
    paramCount = 1;

    if (certification_level !== undefined) {
      lifeguardUpdateFields.push(`certification_level = $${paramCount++}`);
      lifeguardUpdateValues.push(certification_level);
    }
    if (certification_expiry !== undefined) {
      lifeguardUpdateFields.push(`certification_expiry = $${paramCount++}`);
      lifeguardUpdateValues.push(certification_expiry);
    }
    if (emergency_contact !== undefined) {
      lifeguardUpdateFields.push(`emergency_contact = $${paramCount++}`);
      lifeguardUpdateValues.push(emergency_contact);
    }

    if (lifeguardUpdateFields.length > 0) {
      lifeguardUpdateValues.push(id);
      await query(
        `UPDATE lifeguards SET ${lifeguardUpdateFields.join(', ')} WHERE id = $${paramCount}`,
        lifeguardUpdateValues
      );
    }

    await query('COMMIT');

    // Get updated lifeguard data
    const result = await query(
      `SELECT l.id, l.certification_level, l.certification_expiry, l.emergency_contact, l.created_at, l.updated_at,
              u.id as user_id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
              c.id as center_id, c.name as center_name
       FROM lifeguards l
       JOIN users u ON u.id = l.user_id
       JOIN centers c ON c.id = l.center_id
       WHERE l.id = $1`,
      [id]
    );

    logger.info('Updated lifeguard', {
      lifeguardId: id,
      centerId,
      adminId: centerAdminId
    });

    res.json({
      success: true,
      message: 'Lifeguard updated successfully',
      data: result.rows[0]
    });

  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
});

// @desc    Delete lifeguard
// @route   DELETE /api/v1/lifeguards/:id
// @access  Center Admin
const deleteLifeguard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users u ON u.center_id = c.id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if lifeguard exists and belongs to this center
  const existingLifeguard = await query(
    `SELECT l.id, l.user_id, u.email, u.first_name, u.last_name
     FROM lifeguards l
     JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.center_id = $2 AND u.role = 'lifeguard'`,
    [id, centerId]
  );

  if (existingLifeguard.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard not found'
    });
  }

  const userId = existingLifeguard.rows[0].user_id;

  // Check if lifeguard has active shifts
  const activeShifts = await query(
    `SELECT COUNT(*) as count
     FROM shifts
     WHERE lifeguard_id = $1 AND status IN ('scheduled', 'active')`,
    [id]
  );

  if (parseInt(activeShifts.rows[0].count) > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete lifeguard with active shifts'
    });
  }

  // Start transaction
  await query('BEGIN');

  try {
    // Delete lifeguard record (this will cascade to user due to foreign key)
    await query('DELETE FROM lifeguards WHERE id = $1', [id]);

    // Delete user record
    await query('DELETE FROM users WHERE id = $1', [userId]);

    await query('COMMIT');

    logger.info('Deleted lifeguard', {
      lifeguardId: id,
      userId,
      centerId,
      adminId: centerAdminId
    });

    res.json({
      success: true,
      message: 'Lifeguard deleted successfully'
    });

  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
});

// @desc    Get lifeguard shifts
// @route   GET /api/v1/lifeguards/:id/shifts
// @access  Center Admin
const getLifeguardShifts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const centerAdminId = req.user.id;

  // Get the center ID for this center admin
  const centerResult = await query(
    `SELECT c.id as center_id
     FROM centers c
     JOIN users u ON u.center_id = c.id
     JOIN users u ON u.id = l.user_id
     WHERE u.id = $1 AND u.role = 'center_admin'
     LIMIT 1`,
    [centerAdminId]
  );

  if (centerResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Center not found for this admin'
    });
  }

  const centerId = centerResult.rows[0].center_id;

  // Check if lifeguard exists and belongs to this center
  const lifeguardExists = await query(
    `SELECT l.id
     FROM lifeguards l
     WHERE l.id = $1 AND l.center_id = $2`,
    [id, centerId]
  );

  if (lifeguardExists.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Lifeguard not found'
    });
  }

  // Get lifeguard shifts
  const result = await query(
    `SELECT s.id, s.start_time, s.end_time, s.status, s.check_in_time, s.check_out_time, s.created_at,
            l.id as lifeguard_id, u.first_name, u.last_name, u.email
     FROM shifts s
     JOIN lifeguards l ON l.id = s.lifeguard_id
     JOIN users u ON u.id = l.user_id
     WHERE s.lifeguard_id = $1
     ORDER BY s.start_time DESC`,
    [id]
  );

  logger.info('Retrieved lifeguard shifts', {
    lifeguardId: id,
    centerId,
    adminId: centerAdminId,
    count: result.rows.length
  });

  res.json({
    success: true,
    count: result.rows.length,
    data: result.rows
  });
});

module.exports = {
  getAllLifeguards,
  getLifeguardById,
  createLifeguard,
  updateLifeguard,
  deleteLifeguard,
  getLifeguardShifts
}; 