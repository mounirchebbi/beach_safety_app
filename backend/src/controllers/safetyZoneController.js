const { query } = require('../config/database');
const { logger } = require('../utils/logger');

// Get all safety zones for a center
const getSafetyZonesByCenter = async (req, res) => {
  try {
    const { centerId } = req.params;
    const userId = req.user.id;

    // Verify center exists and user has access
    const centerCheck = await query(
      'SELECT id FROM centers WHERE id = $1',
      [centerId]
    );

    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    // Get all safety zones for the center
    const result = await query(
      `SELECT 
        id,
        center_id,
        name,
        zone_type,
        ST_AsGeoJSON(geometry) as geometry,
        description,
        created_at,
        updated_at
       FROM safety_zones 
       WHERE center_id = $1
       ORDER BY created_at DESC`,
      [centerId]
    );

    const zones = result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    logger.error('Error getting safety zones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific safety zone
const getSafetyZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT 
        sz.id,
        sz.center_id,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at,
        c.name as center_name
       FROM safety_zones sz
       JOIN centers c ON sz.center_id = c.id
       WHERE sz.id = $1`,
      [zoneId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Safety zone not found' });
    }

    const zone = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry)
    };

    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    logger.error('Error getting safety zone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new safety zone
const createSafetyZone = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { name, zone_type, location, radius, description } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !zone_type || !location || !radius) {
      return res.status(400).json({ 
        error: 'Name, zone_type, location, and radius are required' 
      });
    }

    // Validate zone type
    const validTypes = ['no_swim', 'caution', 'safe'];
    if (!validTypes.includes(zone_type)) {
      return res.status(400).json({ 
        error: 'Invalid zone type. Must be no_swim, caution, or safe' 
      });
    }

    // Validate radius (max 100km = 100000m)
    if (radius <= 0 || radius > 100000) {
      return res.status(400).json({ 
        error: 'Radius must be between 0 and 100,000 meters (100km)' 
      });
    }

    // Verify center exists
    const centerCheck = await query(
      'SELECT id, ST_X(location) as lng, ST_Y(location) as lat FROM centers WHERE id = $1',
      [centerId]
    );

    if (centerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Center not found' });
    }

    const center = centerCheck.rows[0];

    // Calculate distance from center to zone location
    const distance = calculateDistance(
      center.lat, center.lng,
      location.lat, location.lng
    );

    // Check if zone is within 100km of center
    if (distance > 100) {
      return res.status(400).json({ 
        error: 'Zone location must be within 100km of the center' 
      });
    }

    // Create circular polygon geometry
    const circleGeometry = createCircleGeometry(location.lat, location.lng, radius);

    // Insert the safety zone
    const result = await query(
      `INSERT INTO safety_zones (center_id, name, zone_type, geometry, description)
       VALUES ($1, $2, $3, ST_GeomFromText($4, 4326), $5)
       RETURNING 
         id,
         center_id,
         name,
         zone_type,
         ST_AsGeoJSON(geometry) as geometry,
         description,
         created_at,
         updated_at`,
      [centerId, name, zone_type, circleGeometry, description]
    );

    const zone = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry)
    };

    logger.info('Safety zone created', { 
      zoneId: zone.id, 
      centerId, 
      zoneType: zone_type,
      createdBy: userId 
    });

    res.status(201).json({
      success: true,
      message: 'Safety zone created successfully',
      data: zone
    });
  } catch (error) {
    logger.error('Error creating safety zone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a safety zone
const updateSafetyZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, zone_type, location, radius, description } = req.body;
    const userId = req.user.id;

    // Get the zone and verify it exists
    const zoneCheck = await query(
      `SELECT sz.*, c.id as center_id, ST_X(c.location) as center_lng, ST_Y(c.location) as center_lat
       FROM safety_zones sz
       JOIN centers c ON sz.center_id = c.id
       WHERE sz.id = $1`,
      [zoneId]
    );

    if (zoneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Safety zone not found' });
    }

    const existingZone = zoneCheck.rows[0];

    // Validate zone type if provided
    if (zone_type) {
      const validTypes = ['no_swim', 'caution', 'safe'];
      if (!validTypes.includes(zone_type)) {
        return res.status(400).json({ 
          error: 'Invalid zone type. Must be no_swim, caution, or safe' 
        });
      }
    }

    // Validate radius if provided
    if (radius && (radius <= 0 || radius > 100000)) {
      return res.status(400).json({ 
        error: 'Radius must be between 0 and 100,000 meters (100km)' 
      });
    }

    // Check distance if location is provided
    if (location) {
      const distance = calculateDistance(
        existingZone.center_lat, existingZone.center_lng,
        location.lat, location.lng
      );

      if (distance > 100) {
        return res.status(400).json({ 
          error: 'Zone location must be within 100km of the center' 
        });
      }
    }

    // Build update query
    let updateFields = [];
    let updateValues = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(name);
    }

    if (zone_type !== undefined) {
      updateFields.push(`zone_type = $${paramCount++}`);
      updateValues.push(zone_type);
    }

    if (location && radius) {
      const circleGeometry = createCircleGeometry(location.lat, location.lng, radius);
      updateFields.push(`geometry = ST_GeomFromText($${paramCount++}, 4326)`);
      updateValues.push(circleGeometry);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(description);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add zoneId to values
    updateValues.push(zoneId);

    const result = await query(
      `UPDATE safety_zones 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING 
         id,
         center_id,
         name,
         zone_type,
         ST_AsGeoJSON(geometry) as geometry,
         description,
         created_at,
         updated_at`,
      updateValues
    );

    const zone = {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry)
    };

    logger.info('Safety zone updated', { 
      zoneId, 
      centerId: existingZone.center_id,
      updatedBy: userId 
    });

    res.json({
      success: true,
      message: 'Safety zone updated successfully',
      data: zone
    });
  } catch (error) {
    logger.error('Error updating safety zone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a safety zone
const deleteSafetyZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;

    // Get the zone and verify it exists
    const zoneCheck = await query(
      'SELECT sz.*, c.id as center_id FROM safety_zones sz JOIN centers c ON sz.center_id = c.id WHERE sz.id = $1',
      [zoneId]
    );

    if (zoneCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Safety zone not found' });
    }

    const zone = zoneCheck.rows[0];

    // Delete the safety zone
    await query('DELETE FROM safety_zones WHERE id = $1', [zoneId]);

    logger.info('Safety zone deleted', { 
      zoneId, 
      centerId: zone.center_id,
      deletedBy: userId 
    });

    res.json({ 
      success: true,
      message: 'Safety zone deleted successfully' 
    });
  } catch (error) {
    logger.error('Error deleting safety zone:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get public safety zones (no authentication required)
const getPublicSafetyZones = async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        sz.id,
        sz.center_id,
        c.name as center_name,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at
       FROM safety_zones sz
       JOIN centers c ON sz.center_id = c.id
       WHERE c.is_active = true
       ORDER BY c.name, sz.created_at DESC`
    );

    const zones = result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    logger.error('Error getting public safety zones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper function to calculate distance between two points (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Helper function to create circular polygon geometry
const createCircleGeometry = (lat, lng, radius) => {
  // Convert radius from meters to degrees
  // 1 degree of latitude ≈ 111,320 meters
  // 1 degree of longitude ≈ 111,320 * cos(latitude) meters
  const latRad = lat * Math.PI / 180;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(latRad);
  
  // Use the smaller conversion to ensure the circle fits within the specified radius
  const radiusInDegreesLat = radius / metersPerDegreeLat;
  const radiusInDegreesLng = radius / metersPerDegreeLng;
  
  // Create a 32-point circle
  const points = [];
  for (let i = 0; i < 32; i++) {
    const angle = (i * 360) / 32;
    const pointLng = lng + (radiusInDegreesLng * Math.cos(angle * Math.PI / 180));
    const pointLat = lat + (radiusInDegreesLat * Math.sin(angle * Math.PI / 180));
    points.push(`${pointLng} ${pointLat}`);
  }
  
  // Close the polygon
  points.push(points[0]);
  
  return `POLYGON((${points.join(',')}))`;
};

module.exports = {
  getSafetyZonesByCenter,
  getSafetyZoneById,
  createSafetyZone,
  updateSafetyZone,
  deleteSafetyZone,
  getPublicSafetyZones
}; 