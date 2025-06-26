# Beach Safety Web App - Database Setup Guide

This guide provides step-by-step instructions for setting up the PostgreSQL database with PostGIS extension for the Beach Safety Web App.

## Prerequisites

Before setting up the database, ensure you have the following installed:

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib postgis postgresql-14-postgis-3
```

### CentOS/RHEL
```bash
sudo yum install postgresql postgresql-server postgis
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS
```bash
brew install postgresql postgis
brew services start postgresql
```

## Quick Setup (Recommended)

1. **Run the automated setup script:**
   ```bash
   ./setup_database.sh
   ```

2. **The script will:**
   - Create database user `myapp_user` with password `123`
   - Create database `myapp_db`
   - Enable PostGIS and UUID extensions
   - Create all required tables with proper indexes
   - Set up triggers for automatic timestamp updates
   - Insert sample data
   - Test the database connection

## Manual Setup

If you prefer to set up the database manually, follow these steps:

### 1. Create Database User
```bash
sudo -u postgres psql
CREATE USER myapp_user WITH PASSWORD '123';
\q
```

### 2. Create Database
```bash
sudo -u postgres psql
CREATE DATABASE myapp_db OWNER myapp_user;
\q
```

### 3. Run Database Schema Script
```bash
sudo -u postgres psql -d myapp_db -f database_setup.sql
```

### 4. Test Connection
```bash
PGPASSWORD=123 psql -h localhost -U myapp_user -d myapp_db -c "SELECT 'Connection successful' as status;"
```

## Database Configuration

### Connection Details
- **Host:** localhost
- **Port:** 5432 (default)
- **Database:** myapp_db
- **Username:** myapp_user
- **Password:** 123

### Connection String
```
postgresql://myapp_user:123@localhost:5432/myapp_db
```

## Database Schema

The database includes the following tables:

### Core Tables
1. **users** - User accounts with role-based access
2. **centers** - Lifeguard centers with geographic locations
3. **lifeguards** - Lifeguard profiles linked to centers
4. **shifts** - Work schedules for lifeguards
5. **safety_zones** - Geographic zones with safety classifications
6. **weather_data** - Real-time weather information
7. **safety_flags** - Current safety status flags
8. **emergency_alerts** - Emergency incident reports
9. **incident_reports** - Detailed incident documentation

### Key Features
- **PostGIS Integration:** Geographic data support for locations and zones
- **UUID Primary Keys:** Secure, globally unique identifiers
- **Automatic Timestamps:** Created and updated timestamps with triggers
- **Comprehensive Indexing:** Optimized for spatial and temporal queries
- **Referential Integrity:** Foreign key constraints with cascade options

## Troubleshooting

### Common Issues

#### 1. PostgreSQL Service Not Running
```bash
# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS
brew services start postgresql
```

#### 2. Permission Denied
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql
```

#### 3. PostGIS Extension Not Found
```bash
# Ubuntu/Debian
sudo apt install postgresql-14-postgis-3

# macOS
brew install postgis
```

#### 4. Connection Refused
```bash
# Check if PostgreSQL is listening
sudo netstat -tlnp | grep 5432

# Check PostgreSQL configuration
sudo -u postgres psql -c "SHOW listen_addresses;"
```

#### 5. Database Already Exists
If you get an error that the database or user already exists, you can drop them first:
```bash
sudo -u postgres psql
DROP DATABASE IF EXISTS myapp_db;
DROP USER IF EXISTS myapp_user;
\q
```

### Verification Commands

#### Check Database Exists
```bash
sudo -u postgres psql -l | grep myapp_db
```

#### Check Tables Created
```bash
PGPASSWORD=123 psql -h localhost -U myapp_user -d myapp_db -c "\dt"
```

#### Check PostGIS Extension
```bash
PGPASSWORD=123 psql -h localhost -U myapp_user -d myapp_db -c "SELECT PostGIS_Version();"
```

#### Check Sample Data
```bash
PGPASSWORD=123 psql -h localhost -U myapp_user -d myapp_db -c "SELECT * FROM users;"
PGPASSWORD=123 psql -h localhost -U myapp_user -d myapp_db -c "SELECT * FROM centers;"
```

## Security Considerations

### Production Environment
For production deployment, consider:

1. **Strong Passwords:** Use complex passwords instead of "123"
2. **Network Security:** Configure firewall rules
3. **SSL/TLS:** Enable encrypted connections
4. **Connection Pooling:** Use connection pooling for better performance
5. **Regular Backups:** Implement automated backup strategies

### Environment Variables
Store database credentials in environment variables:
```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=myapp_db
export DB_USER=myapp_user
export DB_PASSWORD=your_secure_password
```

## Next Steps

After successful database setup:

1. **Backend Configuration:** Update your Node.js backend with the database connection details
2. **API Development:** Start building the REST API endpoints
3. **Testing:** Create test data and verify all functionality
4. **Frontend Integration:** Connect the React frontend to the backend API

## Support

If you encounter any issues during setup:

1. Check the troubleshooting section above
2. Verify PostgreSQL and PostGIS are properly installed
3. Ensure you have sufficient permissions to create databases and users
4. Check system logs for detailed error messages

For additional help, refer to:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Node.js PostgreSQL](https://node-postgres.com/) 