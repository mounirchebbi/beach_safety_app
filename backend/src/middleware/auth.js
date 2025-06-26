const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Get user from database
    const result = await query(
      'SELECT id, email, role, first_name, last_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Token verification error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Check if user has required role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check if user is system admin
const requireSystemAdmin = requireRole(['system_admin']);

// Check if user is center admin
const requireCenterAdmin = requireRole(['center_admin', 'system_admin']);

// Check if user is lifeguard
const requireLifeguard = requireRole(['lifeguard', 'center_admin', 'system_admin']);

// Check if user owns the resource or is admin
const requireOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.user.id;
      const userRole = req.user.role;

      // System admin can access everything
      if (userRole === 'system_admin') {
        return next();
      }

      let query;
      let params;

      switch (resourceType) {
        case 'center':
          // Center admin can only access their own center
          if (userRole === 'center_admin') {
            query = `
              SELECT c.id FROM centers c
              JOIN lifeguards l ON l.center_id = c.id
              JOIN users u ON u.id = l.user_id
              WHERE c.id = $1 AND u.id = $2
            `;
            params = [resourceId, userId];
          }
          break;

        case 'lifeguard':
          // Center admin can only access lifeguards in their center
          if (userRole === 'center_admin') {
            query = `
              SELECT l.id FROM lifeguards l
              JOIN users u ON u.id = l.user_id
              JOIN lifeguards admin_lifeguard ON admin_lifeguard.user_id = $1
              WHERE l.id = $2 AND l.center_id = admin_lifeguard.center_id
            `;
            params = [userId, resourceId];
          }
          break;

        case 'shift':
          // Users can only access their own shifts, center admin can access shifts in their center
          if (userRole === 'center_admin') {
            query = `
              SELECT s.id FROM shifts s
              JOIN lifeguards admin_lifeguard ON admin_lifeguard.user_id = $1
              WHERE s.id = $2 AND s.center_id = admin_lifeguard.center_id
            `;
            params = [userId, resourceId];
          } else if (userRole === 'lifeguard') {
            query = `
              SELECT s.id FROM shifts s
              JOIN lifeguards l ON l.id = s.lifeguard_id
              WHERE s.id = $1 AND l.user_id = $2
            `;
            params = [resourceId, userId];
          }
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid resource type'
          });
      }

      if (query) {
        const result = await query(query, params);
        if (result.rows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to this resource'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
};

module.exports = {
  verifyToken,
  requireRole,
  requireSystemAdmin,
  requireCenterAdmin,
  requireLifeguard,
  requireOwnership
}; 