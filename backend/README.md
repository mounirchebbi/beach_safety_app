# Beach Safety Web App - Backend API

A comprehensive Node.js/Express backend API for the Beach Safety Web App with real-time features, role-based access control, and PostgreSQL/PostGIS integration.

##  Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Real-time Communication**: Socket.io for live updates and emergency alerts
- **Spatial Data Support**: PostGIS integration for geographic data
- **Weather Integration**: External weather API integration
- **Emergency Management**: SOS alerts and incident reporting
- **Shift Management**: Lifeguard scheduling and check-in/out system
- **Comprehensive Logging**: Winston logger with structured logging
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Error Handling**: Centralized error handling with proper HTTP status codes

##  Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database**: PostgreSQL 15+ with PostGIS 3.x
- **Real-time**: Socket.io
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Validation**: express-validator
- **Logging**: Winston
- **Security**: Helmet, CORS, express-rate-limit

##  Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ with PostGIS extension
- Database setup completed (see main README)

##  Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the environment example file and configure your settings:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp_db
DB_USER=myapp_user
DB_PASSWORD=123

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# External APIs
OPENWEATHER_API_KEY=your_openweather_api_key_here
MARINE_WEATHER_API_KEY=your_marine_weather_api_key_here

# Logging
LOG_LEVEL=info
```

### 3. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

##  Project Structure

```
backend/
 src/
    config/
       database.js          # Database configuration
    controllers/
       authController.js    # Authentication logic
       centerController.js  # Center management
       lifeguardController.js
       shiftController.js
       weatherController.js
       alertController.js
       reportController.js
       publicController.js
    middleware/
       auth.js              # JWT authentication
       errorHandler.js      # Error handling
    routes/
       auth.js              # Authentication routes
       centers.js           # Center routes
       lifeguards.js
       shifts.js
       weather.js
       alerts.js
       reports.js
       public.js
    services/
       socketService.js     # Socket.io real-time features
    utils/
       logger.js            # Winston logger configuration
    app.js                   # Main application file
 logs/                        # Application logs
 package.json
 env.example
 README.md
```

##  Authentication & Authorization

### User Roles

1. **System Admin**: Full access to all centers and system management
2. **Center Admin**: Manage their assigned center and lifeguards
3. **Lifeguard**: Access to their shifts, alerts, and incident reporting

### JWT Token

Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

##  API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/profile` - Update user profile
- `POST /api/v1/auth/logout` - User logout

### Centers (System Admin)
- `GET /api/v1/centers` - Get all centers
- `POST /api/v1/centers` - Create new center
- `GET /api/v1/centers/:id` - Get center by ID
- `PUT /api/v1/centers/:id` - Update center
- `DELETE /api/v1/centers/:id` - Delete center

### Centers (Center Admin)
- `GET /api/v1/centers/:id/lifeguards` - Get center lifeguards
- `GET /api/v1/centers/:id/shifts` - Get center shifts
- `GET /api/v1/centers/:id/weather` - Get center weather data

### Lifeguards (Center Admin)
- `GET /api/v1/lifeguards` - Get all lifeguards
- `POST /api/v1/lifeguards` - Create new lifeguard
- `GET /api/v1/lifeguards/:id` - Get lifeguard by ID
- `PUT /api/v1/lifeguards/:id` - Update lifeguard
- `DELETE /api/v1/lifeguards/:id` - Delete lifeguard
- `GET /api/v1/lifeguards/:id/shifts` - Get lifeguard shifts

### Shifts
- `GET /api/v1/shifts` - Get all shifts (Center Admin)
- `POST /api/v1/shifts` - Create new shift (Center Admin)
- `GET /api/v1/shifts/:id` - Get shift by ID (Lifeguard)
- `PUT /api/v1/shifts/:id` - Update shift (Center Admin)
- `DELETE /api/v1/shifts/:id` - Delete shift (Center Admin)
- `POST /api/v1/shifts/:id/check-in` - Check in to shift (Lifeguard)
- `POST /api/v1/shifts/:id/check-out` - Check out from shift (Lifeguard)

### Weather
- `GET /api/v1/weather/centers/:id/current` - Get current weather
- `GET /api/v1/weather/centers/:id/forecast` - Get weather forecast
- `GET /api/v1/weather/centers/:id/history` - Get weather history

### Emergency Alerts
- `POST /api/v1/alerts/sos` - Create SOS alert (Public)
- `GET /api/v1/alerts` - Get all alerts (Lifeguard)
- `GET /api/v1/alerts/:id` - Get alert by ID (Lifeguard)
- `PUT /api/v1/alerts/:id/status` - Update alert status (Lifeguard)
- `POST /api/v1/alerts/:id/assign` - Assign alert (Center Admin)

### Incident Reports
- `GET /api/v1/reports` - Get all reports (Center Admin)
- `POST /api/v1/reports` - Create new report (Lifeguard)
- `GET /api/v1/reports/:id` - Get report by ID (Center Admin)
- `PUT /api/v1/reports/:id` - Update report (Lifeguard)

### Public Endpoints (No Auth Required)
- `GET /api/v1/public/centers` - Get all centers
- `GET /api/v1/public/centers/:id/status` - Get center status
- `GET /api/v1/public/weather/current` - Get current weather

##  Real-time Features (Socket.io)

### Events

#### Client to Server
- `join_center` - Join center room for real-time updates
- `join_system` - Join system admin room
- `acknowledge_alert` - Acknowledge emergency alert
- `shift_checkin` - Check in to shift with location
- `shift_checkout` - Check out from shift
- `update_safety_flag` - Update safety flag status
- `emergency_broadcast` - Send emergency broadcast

#### Server to Client
- `weather_update` - Real-time weather data
- `emergency_alert` - New emergency alert
- `alert_acknowledged` - Alert acknowledgment notification
- `alert_status_change` - Alert status updates
- `shift_checkin` - Shift check-in notification
- `shift_checkout` - Shift check-out notification
- `safety_flag_updated` - Safety flag status updates
- `emergency_broadcast` - Emergency broadcast messages
- `system_notification` - System-wide notifications

### Usage Example

```javascript
// Connect to Socket.io
const socket = io('http://localhost:5000');

// Join center room
socket.emit('join_center', 'center-id');

// Listen for weather updates
socket.on('weather_update', (data) => {
  console.log('Weather update:', data);
});

// Listen for emergency alerts
socket.on('emergency_alert', (data) => {
  console.log('Emergency alert:', data);
});
```

##  Database Integration

The backend uses PostgreSQL with PostGIS extension for spatial data:

- **Geographic Data**: Centers, safety zones, emergency locations
- **Spatial Queries**: Find nearest center, check if location is in safety zone
- **Performance**: Optimized indexes for spatial and temporal queries

##  Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access Control**: Granular permissions per user role
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Helmet**: Security headers
- **Password Hashing**: bcrypt for secure password storage

##  Logging

Structured logging with Winston:

- **File Logging**: Separate files for errors and combined logs
- **Console Logging**: Development mode with colored output
- **Log Levels**: Error, warn, info, debug
- **Structured Data**: JSON format with metadata

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

##  Deployment

### Production Environment Variables

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.com
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=your-db-name
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
JWT_SECRET=your-super-secure-jwt-secret
OPENWEATHER_API_KEY=your-api-key
MARINE_WEATHER_API_KEY=your-api-key
LOG_LEVEL=warn
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Follow the existing code style
2. Add proper error handling
3. Include input validation
4. Write comprehensive tests
5. Update documentation

##  License

This project is licensed under the ISC License.

##  Support

For issues and questions:
1. Check the logs in the `logs/` directory
2. Verify database connection
3. Check environment variables
4. Review API documentation

##  Next Steps

- [ ] Implement remaining controller methods
- [ ] Add comprehensive testing
- [ ] Implement weather API integration
- [ ] Add file upload functionality
- [ ] Implement push notifications
- [ ] Add API documentation with Swagger
- [ ] Performance optimization
- [ ] Monitoring and analytics 