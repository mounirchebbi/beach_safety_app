const { logger } = require('../utils/logger');
const { query } = require('../config/database');

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
const emitWeatherUpdate = (centerId, weatherData) => {
  if (io) {
    io.to(`center_${centerId}`).emit('weather_update', {
      ...weatherData,
      timestamp: new Date().toISOString()
    });
    logger.info('Weather update emitted', { centerId });
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

// Emit alert status change
const emitAlertStatusChange = (alertId, centerId, status, assignedLifeguardId = null) => {
  if (io) {
    io.to(`center_${centerId}`).emit('alert_status_change', {
      alertId,
      status,
      assignedLifeguardId,
      timestamp: new Date().toISOString()
    });
    
    logger.info('Alert status change emitted', { alertId, status, centerId });
  }
};

// Emit system-wide notification
const emitSystemNotification = (notification) => {
  if (io) {
    io.to('system_admin').emit('system_notification', {
      ...notification,
      timestamp: new Date().toISOString()
    });
    
    logger.info('System notification emitted', { notification });
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
  emitEmergencyAlert,
  emitAlertStatusChange,
  emitSystemNotification,
  getConnectedClientsCount
}; 