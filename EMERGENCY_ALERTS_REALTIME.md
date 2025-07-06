# Real-Time Emergency Alerts - Lifeguard Dashboard

## Overview
The Lifeguard Dashboard now features enhanced real-time Emergency Alerts functionality that ensures the Emergency Alerts box is always up to date and shows the correct color based on active alerts.

## Key Features

### 1. Real-Time Updates
- **WebSocket Connection**: Automatic connection to real-time alert system
- **Live Status Indicator**: Visual indicator showing connection status (Live/Offline)
- **Instant Updates**: Emergency Alerts box updates immediately when new alerts are created or status changes
- **Automatic Refresh**: Count updates automatically when alerts are acknowledged or resolved

### 2. Visual Enhancements

#### Connection Status Indicator
- **Live Indicator**: Pulsing green dot when connected to WebSocket
- **Offline Indicator**: Dimmed dot when disconnected
- **Status Text**: "Live" or "Offline" label for clarity
- **Position**: Top-right corner of Emergency Alerts box

#### Dynamic Color Coding
- **Red Gradient**: When active alerts exist (`activeAlerts > 0`)
- **Green Gradient**: When no active alerts (`activeAlerts === 0`)
- **Smooth Transitions**: Color changes happen instantly with real-time updates

### 3. Interactive Features

#### Manual Refresh
- **Refresh Button**: Manual refresh option for immediate updates
- **Loading State**: "Updating..." text during refresh
- **Error Handling**: Graceful handling of network issues

#### Alert Notifications
- **Pop-up Notifications**: Automatic notification when new alerts are received
- **Auto-dismiss**: Notifications disappear after 5 seconds
- **Quick Action**: "View Alerts" button in notification
- **Manual Dismiss**: Close button to dismiss immediately

## Technical Implementation

### WebSocket Integration

#### Connection Management
```typescript
useEffect(() => {
  if (user?.center_info?.id) {
    const socket = socketService.connect();
    socketService.joinCenter(user.center_info.id);
    
    // Event listeners for real-time updates
    socketService.onEmergencyAlert((data) => {
      updateActiveAlertsCount();
      setShowAlertNotification(true);
    });
    
    socketService.onAlertStatusChange((data) => {
      updateActiveAlertsCount();
    });
    
    socketService.onAlertAcknowledged((data) => {
      updateActiveAlertsCount();
    });
    
    return () => {
      // Cleanup on unmount
      socketService.offEmergencyAlert();
      socketService.offAlertStatusChange();
      socketService.offAlertAcknowledged();
      socketService.disconnect();
    };
  }
}, [user?.center_info?.id]);
```

#### Real-Time Alert Count Updates
```typescript
const updateActiveAlertsCount = useCallback(async () => {
  if (user?.center_info?.id) {
    try {
      const alertsData = await apiService.getAlerts();
      const activeAlerts = alertsData.filter((alert: any) => 
        alert.status === 'active' && alert.center_id === user.center_info!.id
      ).length;
      
      setStats(prev => ({
        ...prev,
        activeAlerts
      }));
    } catch (err) {
      console.error('Failed to update active alerts count:', err);
    }
  }
}, [user?.center_info?.id]);
```

### Visual Components

#### Connection Status Indicator
```typescript
<Box sx={{
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 0.5
}}>
  <Box sx={{
    width: 8,
    height: 8,
    borderRadius: '50%',
    bgcolor: socketConnected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
    animation: socketConnected ? 'pulse 2s infinite' : 'none',
    '@keyframes pulse': {
      '0%': { opacity: 1 },
      '50%': { opacity: 0.5 },
      '100%': { opacity: 1 }
    }
  }} />
  <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.7rem' }}>
    {socketConnected ? 'Live' : 'Offline'}
  </Typography>
</Box>
```

#### Dynamic Background Colors
```typescript
background: stats.activeAlerts > 0 
  ? 'linear-gradient(135deg, #ff4444 0%, #ff6b6b 100%)' 
  : 'linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)'
```

## Event Handling

### WebSocket Events

#### Emergency Alert Events
- **`emergency_alert`**: New emergency alert created
- **`alert_status_change`**: Alert status updated (active → responding → resolved)
- **`alert_acknowledged`**: Alert acknowledged by lifeguard

#### Event Response
1. **Immediate Update**: Alert count updates instantly
2. **Notification**: Pop-up notification for new alerts
3. **Visual Feedback**: Color changes and badge updates
4. **Logging**: Console logs for debugging

### Error Handling

#### Connection Issues
- **Graceful Degradation**: Dashboard works without WebSocket
- **Reconnection**: Automatic reconnection attempts
- **Fallback**: Manual refresh button available
- **User Feedback**: Clear connection status indicators

#### API Errors
- **Error Logging**: Console errors for debugging
- **User Notification**: Error alerts for critical issues
- **Retry Logic**: Automatic retry for failed requests

## User Experience

### 1. Real-Time Awareness
- **Instant Updates**: No need to refresh page
- **Visual Feedback**: Immediate color and count changes
- **Status Clarity**: Clear indication of connection status
- **Alert Notifications**: Prominent notifications for new alerts

### 2. Reliability
- **Connection Monitoring**: Visual indicator of WebSocket status
- **Manual Override**: Refresh button for immediate updates
- **Error Recovery**: Graceful handling of network issues
- **Data Consistency**: Accurate count at all times

### 3. Performance
- **Efficient Updates**: Only updates when necessary
- **Memory Management**: Proper cleanup of event listeners
- **Optimized Rendering**: Minimal re-renders
- **Background Processing**: Non-blocking updates

## Benefits

### 1. Safety Improvements
- **Immediate Response**: Lifeguards see alerts instantly
- **Reduced Delays**: No manual refresh needed
- **Clear Status**: Always know if alerts are active
- **Quick Actions**: Direct navigation to alerts

### 2. Operational Efficiency
- **Real-Time Monitoring**: Always current information
- **Reduced Manual Work**: Automatic updates
- **Better Coordination**: Instant awareness of emergencies
- **Improved Response Times**: Faster alert acknowledgment

### 3. User Experience
- **Intuitive Interface**: Clear visual indicators
- **Reliable System**: Robust error handling
- **Responsive Design**: Smooth animations and transitions
- **Accessibility**: Clear status indicators for all users

## Testing

### Manual Testing
1. **Create Alert**: Create emergency alert as admin
2. **Verify Update**: Check lifeguard dashboard updates immediately
3. **Test Connection**: Disconnect/reconnect to test status indicator
4. **Test Refresh**: Use manual refresh button
5. **Test Notifications**: Verify pop-up notifications appear

### Automated Testing
- **WebSocket Connection**: Test connection establishment
- **Event Handling**: Test alert event processing
- **Error Scenarios**: Test network failures and recovery
- **Performance**: Test update frequency and responsiveness

## Future Enhancements

### Potential Improvements
1. **Sound Notifications**: Audio alerts for new emergencies
2. **Push Notifications**: Browser push notifications
3. **Alert Details**: Show alert preview in notification
4. **Priority Indicators**: Different colors for alert severity
5. **Historical Data**: Show alert trends over time
6. **Team Coordination**: Show which lifeguards are responding

The enhanced Emergency Alerts system ensures lifeguards always have the most current information about emergencies, improving response times and overall safety at the beach. 