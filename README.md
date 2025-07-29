# Beach Safety Management System

A comprehensive web application for managing beach safety operations with real-time monitoring, emergency response coordination, administrative controls, and advanced audit/compliance features.

##  Overview

The Beach Safety Management System is a full-stack web application designed to enhance beach safety operations through:

- **Real-time Monitoring**: Live tracking of lifeguard positions and emergency situations
- **Emergency Response**: Instant alert system for rapid response coordination
- **Weather Integration**: Real-time weather data for safety assessment
- **Role-based Access**: Three distinct user roles with appropriate permissions
- **Interactive Mapping**: Geographic visualization of safety zones and incidents
- **Audit & Compliance**: Full audit log and soft/hard delete support for key entities

##  Architecture

### Tech Stack

**Backend:**
- Node.js with Express.js
- PostgreSQL with PostGIS for spatial data
- Socket.io for real-time communication
- JWT for authentication
- bcrypt for password hashing
- Winston for logging
- Helmet, CORS, express-rate-limit for security

**Frontend:**
- React 18 with TypeScript
- Material-UI for modern UI components
- React Router for navigation
- Socket.io Client for real-time features
- Leaflet for interactive mapping
- date-fns for date handling

**External APIs:**
- OpenWeatherMap API for weather data
- Marine Weather API for ocean conditions

##  User Roles

### 1. Lifeguards
- **Shift Management**: Check in/out, view schedules
- **Emergency Response**: Receive and respond to alerts
- **Incident Reporting**: Document safety incidents
- **Real-time Location**: GPS tracking during shifts

### 2. Center Administrators
- **Center Management**: Update center information and operating hours
- **Staff Management**: Manage lifeguard assignments and certifications
- **Shift Scheduling**: Create and manage work schedules
- **Safety Protocols**: Manage safety flags and zones
- **Real-time Dashboard**: Live updates for all center activity

### 3. System Administrators
- **System-wide Management**: Oversee all centers and users
- **User Administration**: Manage all user accounts and permissions
- **Analytics & Reporting**: System-wide performance metrics
- **Configuration**: Global system settings and policies
- **Audit Log**: View all delete/restore/hard delete actions

##  Current Status

###  Completed Features

**Backend:**
- Database setup with PostgreSQL and PostGIS
- User authentication and authorization
- Center management system
- Lifeguard management (center-based, secure, with soft/hard delete)
- Shift scheduling and tracking
- Weather data integration (real-time, center-specific)
- Emergency alert system (multi-level, real-time)
- Incident reporting
- Real-time Socket.io communication (alerts, weather, flags, shifts, lifeguards)
- API documentation and testing
- Soft/hard delete and audit log for users, lifeguards, and centers
- Inter-center support and escalation workflows

**Frontend:**
- React TypeScript application setup
- Material-UI design system
- Authentication system (login/register)
- Role-based routing and navigation
- Responsive layout with sidebar
- Public dashboard
- API service layer
- Socket.io client integration
- Form validation with Yup
- TypeScript type definitions
- Real-time dashboard and notification system
- Weather widget and map integration
- Enhanced lifeguard management UI

###  In Progress
- Advanced analytics and reporting
- Mobile app development
- Push notifications
- Multi-tenant support

##  Project Structure

```
Beach_Safety_App/
 backend/                  # Node.js/Express backend
    src/
       controllers/      # API controllers
       routes/           # API routes
       middleware/       # Auth and error handling
       services/         # Business logic
       utils/            # Utilities and logging
    database_setup.sql    # Database schema
    package.json
 frontend/                 # React TypeScript frontend
    src/
       components/       # React components
       services/         # API and Socket services
       context/          # React context
       types/            # TypeScript definitions
    package.json
 database_setup.sql        # Complete database setup
 setup_database.sh         # Database setup script
 README.md
```

##  Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 15+ with PostGIS extension
- npm or yarn

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Beach_Safety_App
   ```

2. **Setup Database**:
   ```bash
   ./setup_database.sh
   ```

3. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm start
   ```

5. **Access the Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/health

### Environment Configuration

**Backend (.env):**
```env
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_db
DB_USER=myapp_user
DB_PASSWORD=123
JWT_SECRET=your-secret-key
OPENWEATHER_API_KEY=your-api-key
```

**Frontend (.env):**
```env
REACT_APP_API_URL=http://localhost:5000
```

##  API Endpoints (Key Examples)

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/profile` - Update user profile
- `POST /api/v1/auth/logout` - User logout
- `DELETE /api/v1/auth/users/:id` - Soft delete user
- `POST /api/v1/auth/users/:id/restore` - Restore user
- `DELETE /api/v1/auth/users/:id/hard` - Hard delete user

### Centers
- `GET /api/v1/centers` - List all centers
- `POST /api/v1/centers` - Create center
- `GET /api/v1/centers/:id` - Get center details
- `PUT /api/v1/centers/:id` - Update center
- `DELETE /api/v1/centers/:id` - Delete center
- `GET /api/v1/centers/:id/lifeguards` - Get center lifeguards
- `GET /api/v1/centers/:id/shifts` - Get center shifts
- `GET /api/v1/centers/:id/weather` - Get center weather data

### Lifeguards
- `GET /api/v1/lifeguards` - List all lifeguards
- `POST /api/v1/lifeguards` - Create lifeguard
- `GET /api/v1/lifeguards/:id` - Get lifeguard details
- `PUT /api/v1/lifeguards/:id` - Update lifeguard
- `DELETE /api/v1/lifeguards/:id` - Soft delete lifeguard
- `POST /api/v1/lifeguards/:id/restore` - Restore lifeguard
- `DELETE /api/v1/lifeguards/:id/hard` - Hard delete lifeguard
- `GET /api/v1/lifeguards/:id/shifts` - Get lifeguard shifts

### Shifts
- `GET /api/v1/shifts` - List all shifts
- `POST /api/v1/shifts` - Create shift
- `GET /api/v1/shifts/:id` - Get shift details
- `PUT /api/v1/shifts/:id` - Update shift
- `DELETE /api/v1/shifts/:id` - Delete shift
- `POST /api/v1/shifts/:id/check-in` - Check in to shift
- `POST /api/v1/shifts/:id/check-out` - Check out from shift

### Safety Flags
- `GET /api/v1/safety/centers/:centerId/current` - Get current safety flag
- `GET /api/v1/safety/centers/:centerId/history` - Get flag history
- `POST /api/v1/safety/centers/:centerId/flags` - Set manual safety flag
- `POST /api/v1/safety/centers/:centerId/auto-update` - Trigger automatic flag update
- `POST /api/v1/safety/centers/:centerId/manual` - Switch to manual flag mode
- `GET /api/v1/safety/centers/:centerId/mode` - Get flag management mode

### Emergency Alerts
- `GET /api/v1/alerts` - List all emergency alerts
- `GET /api/v1/alerts/:id` - Get alert details
- `POST /api/v1/alerts` - Create a new emergency alert
- `PUT /api/v1/alerts/:id/status` - Update alert status
- `POST /api/v1/alerts/:id/assign` - Assign alert

### Incident Reports
- `GET /api/v1/reports` - Get all reports
- `POST /api/v1/reports` - Create new report
- `GET /api/v1/reports/:id` - Get report by ID
- `PUT /api/v1/reports/:id` - Update report

### Weather
- `GET /api/v1/weather/centers/:id/current` - Get current weather
- `GET /api/v1/weather/centers/:id/forecast` - Get weather forecast
- `GET /api/v1/weather/centers/:id/history` - Get weather history

### Public Endpoints
- `GET /api/v1/public/centers` - Public center information
- `GET /api/v1/public/weather/current` - Public weather data

### Audit Log
- All delete/restore/hard delete actions are logged and viewable by System Admins

### Inter-Center Support & Escalations
- `GET /api/v1/escalations` - List all escalations
- `POST /api/v1/escalations` - Create escalation
- `GET /api/v1/inter-center-support` - List all support requests
- `POST /api/v1/inter-center-support` - Create support request

##  Real-time Events (Socket.io)

**Client to Server:**
- `join_center` - Join center-specific room
- `join_system` - Join system admin room
- `acknowledge_alert` - Acknowledge emergency alert
- `shift_checkin` - Check in to shift
- `shift_checkout` - Check out from shift
- `update_safety_flag` - Update safety flag status
- `emergency_broadcast` - Send emergency broadcast

**Server to Client:**
- `weather_update` - Real-time weather updates
- `emergency_alert` - New emergency alerts
- `alert_status_change` - Alert status updates
- `safety_flag_updated` - Safety flag changes
- `lifeguard_status_change` - Lifeguard status updates
- `shift_status_change` - Shift status updates
- `system_notification` - System-wide notifications

##  Frontend Features

- **Modern Design**: Material-UI components with custom theme
- **Responsive Layout**: Mobile-first design approach
- **Role-based Navigation**: Dynamic sidebar based on user role
- **Real-time Updates**: Live data updates via WebSocket
- **Weather Widget**: Real-time weather and marine data
- **Interactive Map**: Visualize centers, safety zones, and alerts
- **Enhanced Lifeguard Management**: CRUD, validation, and audit
- **Notification System**: Real-time, auto-dismiss, and status indicators

##  Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Role-based Authorization**: Fine-grained access control
- **Input Validation**: Comprehensive validation on all inputs
- **CORS Configuration**: Proper cross-origin resource sharing
- **Rate Limiting**: API rate limiting for security
- **Audit Logging**: All critical actions logged
- **Soft/Hard Delete**: Data recoverability and compliance

##  Database Schema (Key Tables)

- `users` - User accounts and authentication (soft/hard delete, audit log)
- `centers` - Beach safety centers (soft/hard delete, audit log)
- `lifeguards` - Lifeguard information and certifications (soft/hard delete, audit log)
- `shifts` - Work schedules and attendance
- `weather_data` - Weather and marine conditions
- `emergency_alerts` - Emergency situations and responses
- `incident_reports` - Safety incident documentation
- `safety_flags` - Beach safety status flags
- `safety_zones` - Geographic safety zones
- `audit_log` - Tracks all delete/restore/hard delete actions
- `inter_center_support_requests` - Inter-center support workflow
- `emergency_escalations` - Escalation workflow

### Key Features
- **PostGIS Integration**: Spatial data for locations and zones
- **Indexes**: Optimized database performance
- **Triggers**: Automated data updates
- **Foreign Keys**: Referential integrity
- **Audit Trails**: Change tracking and logging
- **Soft/Hard Delete**: Data recoverability and compliance

## 🧪 Testing

### Backend Testing
```bash
cd backend
npm test
```

### Frontend Testing
```bash
cd frontend
npm test
```

### API Testing
- Health check: `GET /health`
- Authentication endpoints
- CRUD operations for all entities
- Real-time Socket.io events

##  Deployment

### Production Setup

1. **Environment Configuration**:
   - Set production environment variables
   - Configure database connections
   - Set up SSL certificates

2. **Database Migration**:
   ```bash
   ./setup_database.sh
   ```

3. **Backend Deployment**:
   ```bash
   cd backend
   npm install --production
   npm start
   ```

4. **Frontend Build**:
   ```bash
   cd frontend
   npm run build
   ```

5. **Reverse Proxy**: Configure nginx or similar for serving the application

##  Roadmap

### Phase 1: Core Features 
- [x] User authentication and authorization
- [x] Center and lifeguard management
- [x] Shift scheduling and tracking
- [x] Weather integration
- [x] Emergency alert system
- [x] Real-time dashboard and notifications
- [x] Soft/hard delete and audit log

### Phase 2: Advanced Features 
- [ ] Advanced analytics and reporting
- [ ] Mobile app development
- [ ] Push notifications
- [ ] Multi-tenant support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

##  License

This project is licensed under the MIT License - see the LICENSE file for details.

##  Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Beach Safety Management System** - Making beaches safer through technology and real-time coordination. 