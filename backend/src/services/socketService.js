const { logger } = require('../utils/logger');
const { query } = require('../config/database');
const weatherService = require('./weatherService');

let io;

// Initialize Socket.io
const initializeSocket = (socketIo) => {
  io = socketIo;

  io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Join center room for real-time updates
    socket.on('join_center', (centerId) => {
      socket.join(`center_${centerId}`);
      logger.info('Client joined center room', { socketId: socket.id, centerId });
    });

    // Join system-wide room for admin updates
    socket.on('join_system', () => {
      socket.join('system_admin');
      logger.info('Client joined system admin room', { socketId: socket.id });
    });

    // Handle emergency alert acknowledgment
    socket.on('acknowledge_alert', async (data) => {
      try {
        const { alertId, lifeguardId } = data;
        
        // Update alert status in database
        await query(
          'UPDATE emergency_alerts SET status = $1, assigned_lifeguard_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          ['responding', lifeguardId, alertId]
        );

        // Get alert details
        const alertResult = await query(
          'SELECT * FROM emergency_alerts WHERE id = $1',
          [alertId]
        );

        if (alertResult.rows.length > 0) {
          const alert = alertResult.rows[0];
          
          // Notify center about alert acknowledgment
          io.to(`center_${alert.center_id}`).emit('alert_acknowledged', {
            alertId,
            lifeguardId,
            status: 'responding',
            timestamp: new Date().toISOString()
          });
        }

        logger.info('Alert acknowledged', { alertId, lifeguardId });
      } catch (error) {
        logger.error('Error acknowledging alert:', error);
      }
    });

    // Handle shift check-in
    socket.on('shift_checkin', async (data) => {
      try {
        const { shiftId, location } = data;
        
        // Update shift status in database
        await query(
          'UPDATE shifts SET status = $1, check_in_time = CURRENT_TIMESTAMP, check_in_location = ST_GeomFromText($2, 4326) WHERE id = $3',
          ['active', `POINT(${location.lng} ${location.lat})`, shiftId]
        );

        // Get shift details
        const shiftResult = await query(
          'SELECT s.*, c.id as center_id FROM shifts s JOIN centers c ON c.id = s.center_id WHERE s.id = $1',
          [shiftId]
        );

        if (shiftResult.rows.length > 0) {
          const shift = shiftResult.rows[0];
          
          // Notify center about check-in
          io.to(`center_${shift.center_id}`).emit('shift_checkin', {
            shiftId,
            lifeguardId: shift.lifeguard_id,
            checkInTime: new Date().toISOString(),
            location
          });
        }

        logger.info('Shift check-in recorded', { shiftId, location });
      } catch (error) {
        logger.error('Error recording shift check-in:', error);
      }
    });

    // Handle shift check-out
    socket.on('shift_checkout', async (data) => {
      try {
        const { shiftId } = data;
        
        // Update shift status in database
        await query(
          'UPDATE shifts SET status = $1, check_out_time = CURRENT_TIMESTAMP WHERE id = $2',
          ['completed', shiftId]
        );

        // Get shift details
        const shiftResult = await query(
          'SELECT s.*, c.id as center_id FROM shifts s JOIN centers c ON c.id = s.center_id WHERE s.id = $1',
          [shiftId]
        );

        if (shiftResult.rows.length > 0) {
          const shift = shiftResult.rows[0];
          
          // Notify center about check-out
          io.to(`center_${shift.center_id}`).emit('shift_checkout', {
            shiftId,
            lifeguardId: shift.lifeguard_id,
            checkOutTime: new Date().toISOString()
          });
        }

        logger.info('Shift check-out recorded', { shiftId });
      } catch (error) {
        logger.error('Error recording shift check-out:', error);
      }
    });

    // Handle safety flag updates
    socket.on('update_safety_flag', async (data) => {
      try {
        const { centerId, flagStatus, reason, setBy } = data;
        
        // Insert new safety flag
        const result = await query(
          'INSERT INTO safety_flags (center_id, flag_status, reason, set_by) VALUES ($1, $2, $3, $4) RETURNING *',
          [centerId, flagStatus, reason, setBy]
        );

        const flag = result.rows[0];
        
        // Notify center about flag update
        io.to(`center_${centerId}`).emit('safety_flag_updated', {
          flagId: flag.id,
          flagStatus,
          reason,
          setBy,
          setAt: flag.set_at,
          timestamp: new Date().toISOString()
        });

        logger.info('Safety flag updated', { centerId, flagStatus, setBy });
      } catch (error) {
        logger.error('Error updating safety flag:', error);
      }
    });

    // Handle emergency broadcast
    socket.on('emergency_broadcast', async (data) => {
      try {
        const { centerId, message, severity, broadcastBy } = data;
        
        // Broadcast to all connected clients in the center
        io.to(`center_${centerId}`).emit('emergency_broadcast', {
          message,
          severity,
          broadcastBy,
          timestamp: new Date().toISOString()
        });

        // Also broadcast to system admin room
        io.to('system_admin').emit('emergency_broadcast', {
          centerId,
          message,
          severity,
          broadcastBy,
          timestamp: new Date().toISOString()
        });

        logger.info('Emergency broadcast sent', { centerId, message, severity, broadcastBy });
      } catch (error) {
        logger.error('Error sending emergency broadcast:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });
};

// Emit weather update to specific center
const emitWeatherUpdate = async (centerId) => {
  try {
    if (!io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    // Fetch fresh weather data
    const weatherData = await weatherService.getCurrentWeather(centerId);
    
    // Emit to center room
    io.to(`center_${centerId}`).emit('weather_update', {
      ...weatherData,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Weather update emitted', { centerId });
  } catch (error) {
    logger.error('Error emitting weather update:', error);
  }
};

// Emit weather updates to all centers
const emitWeatherUpdatesToAllCenters = async () => {
  try {
    const centersResult = await query(
      'SELECT id, name FROM centers WHERE is_active = true'
    );

    const updatePromises = centersResult.rows.map(async (center) => {
      try {
        await emitWeatherUpdate(center.id);
        logger.info('Weather update sent to center', { centerId: center.id, centerName: center.name });
      } catch (error) {
        logger.error('Failed to send weather update to center', { 
          centerId: center.id, 
          centerName: center.name, 
          error: error.message 
        });
      }
    });

    await Promise.allSettled(updatePromises);
    logger.info('Weather updates completed for all centers');
  } catch (error) {
    logger.error('Error in weather update broadcast:', error);
  }
};

// Emit alert status change
const emitAlertStatusChange = (alertData) => {
  if (io) {
    io.to(`center_${alertData.center_id}`).emit('alert_status_change', {
      alertId: alertData.id,
      status: alertData.status,
      assignedLifeguardId: alertData.assigned_lifeguard_id,
      timestamp: new Date().toISOString()
    });
    
    // Also notify system admin
    io.to('system_admin').emit('alert_status_change', {
      alertId: alertData.id,
      status: alertData.status,
      assignedLifeguardId: alertData.assigned_lifeguard_id,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Alert status change emitted', { 
      alertId: alertData.id, 
      centerId: alertData.center_id,
      status: alertData.status 
    });
  }
};

// Emit new emergency alert
const emitEmergencyAlert = (alertData) => {
  if (io) {
    io.to(`center_${alertData.center_id}`).emit('emergency_alert', {
      ...alertData,
      timestamp: new Date().toISOString()
    });
    
    // Also notify system admin
    io.to('system_admin').emit('emergency_alert', {
      ...alertData,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Emergency alert emitted', { alertId: alertData.id, centerId: alertData.center_id });
  }
};

// Emit system notification
const emitSystemNotification = (notification) => {
  try {
    if (!io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    io.to('system_admin').emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });

    logger.info('System notification emitted', notification);
  } catch (error) {
    logger.error('Error emitting system notification:', error);
  }
};

// Emit escalation notification to center admin
const emitEscalationNotification = async (escalationData) => {
  try {
    if (!io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    // Get escalation details with lifeguard and alert info
    const result = await query(
      `SELECT 
        ee.id,
        ee.escalation_type,
        ee.priority,
        ee.description,
        ee.status,
        ee.created_at,
        ea.center_id,
        ea.alert_type,
        ea.severity,
        u.first_name,
        u.last_name,
        u.email as lifeguard_email
       FROM emergency_escalations ee
       JOIN emergency_alerts ea ON ee.alert_id = ea.id
       JOIN lifeguards l ON ee.lifeguard_id = l.id
       JOIN users u ON l.user_id = u.id
       WHERE ee.id = $1`,
      [escalationData.id]
    );

    if (result.rows.length > 0) {
      const escalation = result.rows[0];
      
      // Emit to the specific center
      io.to(`center_${escalation.center_id}`).emit('new_escalation', {
        escalationId: escalation.id,
        escalationType: escalation.escalation_type,
        priority: escalation.priority,
        description: escalation.description,
        lifeguardName: `${escalation.first_name} ${escalation.last_name}`,
        lifeguardEmail: escalation.lifeguard_email,
        alertType: escalation.alert_type,
        alertSeverity: escalation.severity,
        createdAt: escalation.created_at,
        timestamp: new Date().toISOString()
      });

      logger.info('Escalation notification emitted', {
        escalationId: escalation.id,
        centerId: escalation.center_id,
        escalationType: escalation.escalation_type,
        priority: escalation.priority
      });
    }
  } catch (error) {
    logger.error('Error emitting escalation notification:', error);
  }
};

// Emit escalation status update
const emitEscalationStatusUpdate = async (escalationId, status, updatedBy) => {
  try {
    if (!io) {
      logger.warn('Socket.io not initialized');
      return;
    }

    // Get escalation details
    const result = await query(
      `SELECT 
        ee.id,
        ee.escalation_type,
        ee.priority,
        ee.status,
        ea.center_id,
        u.first_name,
        u.last_name
       FROM emergency_escalations ee
       JOIN emergency_alerts ea ON ee.alert_id = ea.id
       LEFT JOIN users u ON ee.acknowledged_by = u.id
       WHERE ee.id = $1`,
      [escalationId]
    );

    if (result.rows.length > 0) {
      const escalation = result.rows[0];
      
      // Emit to the specific center
      io.to(`center_${escalation.center_id}`).emit('escalation_status_updated', {
        escalationId: escalation.id,
        escalationType: escalation.escalation_type,
        priority: escalation.priority,
        status: escalation.status,
        updatedBy: escalation.first_name ? `${escalation.first_name} ${escalation.last_name}` : updatedBy,
        timestamp: new Date().toISOString()
      });

      logger.info('Escalation status update emitted', {
        escalationId: escalation.id,
        centerId: escalation.center_id,
        status: escalation.status
      });
    }
  } catch (error) {
    logger.error('Error emitting escalation status update:', error);
  }
};

// Get connected clients count
const getConnectedClientsCount = () => {
  if (io) {
    return io.engine.clientsCount;
  }
  return 0;
};

module.exports = {
  initializeSocket,
  emitWeatherUpdate,
  emitWeatherUpdatesToAllCenters,
  emitEmergencyAlert,
  emitAlertStatusChange,
  emitSystemNotification,
  emitEscalationNotification,
  emitEscalationStatusUpdate,
  getConnectedClientsCount
}; 