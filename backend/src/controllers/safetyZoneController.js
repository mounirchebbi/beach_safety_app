const { query } = require('../config/database');
const logger = require('../utils/logger');

// Get safety zones by center
const getSafetyZonesByCenter = async (req, res) => {
  try {
    const { centerId } = req.params;

    const result = await query(
      `SELECT 
        sz.id,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at
       FROM safety_zones sz
       WHERE sz.center_id = $1
       ORDER BY sz.created_at DESC`,
      [centerId]
    );

    const zones = result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));

    res.json({
      success: true,
      message: 'Safety zones retrieved successfully',
      data: zones
    });
  } catch (error) {
    logger.error('Error getting safety zones by center:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get safety zone by ID
const getSafetyZoneById = async (req, res) => {
  try {
    const { zoneId } = req.params;

    const result = await query(
      `SELECT 
        sz.id,
        sz.center_id,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at
       FROM safety_zones sz
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
      message: 'Safety zone retrieved successfully',
      data: zone
    });
  } catch (error) {
    logger.error('Error getting safety zone by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create safety zone
const createSafetyZone = async (req, res) => {
  try {
    const { centerId } = req.params;
    const { name, zone_type, geometry, description } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !zone_type || !geometry) {
      return res.status(400).json({ 
        error: 'Name, zone_type, and geometry are required' 
      });
    }

    // Validate zone_type
    const validZoneTypes = ['no_swim', 'caution', 'safe'];
    if (!validZoneTypes.includes(zone_type)) {
      return res.status(400).json({ 
        error: 'Invalid zone_type. Must be one of: no_swim, caution, safe' 
      });
    }

    // Validate geometry (expecting GeoJSON)
    if (!geometry.type || !geometry.coordinates) {
      return res.status(400).json({ 
        error: 'Invalid geometry format. Expected GeoJSON' 
      });
    }

    // Convert GeoJSON to PostGIS format
    const geometryString = JSON.stringify(geometry);

    const result = await query(
      `INSERT INTO safety_zones (center_id, name, zone_type, geometry, description, created_at, updated_at)
       VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [centerId, name, zone_type, geometryString, description]
    );

    const newZoneId = result.rows[0].id;

    // Get the created zone
    const zoneResult = await query(
      `SELECT 
        sz.id,
        sz.center_id,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at
       FROM safety_zones sz
       WHERE sz.id = $1`,
      [newZoneId]
    );

    const zone = {
      ...zoneResult.rows[0],
      geometry: JSON.parse(zoneResult.rows[0].geometry)
    };

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

// Update safety zone
const updateSafetyZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, zone_type, geometry, description } = req.body;
    const userId = req.user.id;

    // Check if zone exists
    const existingZone = await query(
      'SELECT id, center_id FROM safety_zones WHERE id = $1',
      [zoneId]
    );

    if (existingZone.rows.length === 0) {
      return res.status(404).json({ error: 'Safety zone not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (zone_type !== undefined) {
      // Validate zone_type
      const validZoneTypes = ['no_swim', 'caution', 'safe'];
      if (!validZoneTypes.includes(zone_type)) {
        return res.status(400).json({ 
          error: 'Invalid zone_type. Must be one of: no_swim, caution, safe' 
        });
      }
      updates.push(`zone_type = $${paramCount++}`);
      values.push(zone_type);
    }

    if (geometry !== undefined) {
      // Validate geometry
      if (!geometry.type || !geometry.coordinates) {
        return res.status(400).json({ 
          error: 'Invalid geometry format. Expected GeoJSON' 
        });
      }
      updates.push(`geometry = ST_GeomFromGeoJSON($${paramCount++})`);
      values.push(JSON.stringify(geometry));
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(zoneId);

    const updateQuery = `
      UPDATE safety_zones 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id
    `;

    await query(updateQuery, values);

    // Get the updated zone
    const zoneResult = await query(
      `SELECT 
        sz.id,
        sz.center_id,
        sz.name,
        sz.zone_type,
        ST_AsGeoJSON(sz.geometry) as geometry,
        sz.description,
        sz.created_at,
        sz.updated_at
       FROM safety_zones sz
       WHERE sz.id = $1`,
      [zoneId]
    );

    const zone = {
      ...zoneResult.rows[0],
      geometry: JSON.parse(zoneResult.rows[0].geometry)
    };

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

// Delete safety zone
const deleteSafetyZone = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;

    // Check if zone exists
    const existingZone = await query(
      'SELECT id FROM safety_zones WHERE id = $1',
      [zoneId]
    );

    if (existingZone.rows.length === 0) {
      return res.status(404).json({ error: 'Safety zone not found' });
    }

    // Delete the zone
    await query(
      'DELETE FROM safety_zones WHERE id = $1',
      [zoneId]
    );

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
       ORDER BY c.name, sz.created_at DESC`,
      []
    );

    const zones = result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));

    res.json({
      success: true,
      message: 'Public safety zones retrieved successfully',
      data: zones
    });
  } catch (error) {
    logger.error('Error getting public safety zones:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getSafetyZonesByCenter,
  getSafetyZoneById,
  createSafetyZone,
  updateSafetyZone,
  deleteSafetyZone,
  getPublicSafetyZones
}; 