#!/bin/bash

# Beach Safety Web App Database Setup Script
# This script sets up PostgreSQL database with PostGIS extension

echo "=========================================="
echo "Beach Safety Web App Database Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
DB_NAME="myapp_db"
DB_USER="myapp_user"
DB_PASSWORD="123"

echo -e "${YELLOW}Database Configuration:${NC}"
echo "Database Name: $DB_NAME"
echo "Database User: $DB_USER"
echo "Database Password: $DB_PASSWORD"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}PostgreSQL is not installed. Please install PostgreSQL first.${NC}"
    echo "Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib postgis"
    echo "CentOS/RHEL: sudo yum install postgresql postgresql-server postgis"
    echo "macOS: brew install postgresql postgis"
    exit 1
fi

# Check if PostGIS is installed
if ! psql -lqt | cut -d \| -f 1 | grep -qw postgis; then
    echo -e "${YELLOW}PostGIS extension not found. Installing PostGIS...${NC}"
    echo "Please install PostGIS extension:"
    echo "Ubuntu/Debian: sudo apt-get install postgis"
    echo "CentOS/RHEL: sudo yum install postgis"
    echo "macOS: brew install postgis"
    echo ""
    read -p "Press Enter after installing PostGIS..."
fi

echo -e "${YELLOW}Step 1: Creating database user...${NC}"
# Create user (run as postgres superuser)
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database user created successfully${NC}"
else
    echo -e "${YELLOW}⚠ User might already exist, continuing...${NC}"
fi

echo -e "${YELLOW}Step 2: Creating database...${NC}"
# Create database
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database created successfully${NC}"
else
    echo -e "${YELLOW}⚠ Database might already exist, continuing...${NC}"
fi

echo -e "${YELLOW}Step 3: Setting up database schema...${NC}"
# Run the SQL setup script
sudo -u postgres psql -d $DB_NAME -f database_setup.sql
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database schema created successfully${NC}"
else
    echo -e "${RED}✗ Error creating database schema${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 4: Testing database connection...${NC}"
# Test connection
PGPASSWORD=$DB_PASSWORD psql -h localhost -U $DB_USER -d $DB_NAME -c "SELECT 'Connection successful' as status;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database connection test successful${NC}"
else
    echo -e "${RED}✗ Database connection test failed${NC}"
    echo "Please check your PostgreSQL configuration and try again."
    exit 1
fi

echo ""
echo -e "${GREEN}=========================================="
echo "Database Setup Completed Successfully!"
echo "==========================================${NC}"
echo ""
echo "Database Details:"
echo "- Host: localhost"
echo "- Port: 5432 (default)"
echo "- Database: $DB_NAME"
echo "- Username: $DB_USER"
echo "- Password: $DB_PASSWORD"
echo ""
echo "Connection string for your application:"
echo "postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your application's database configuration"
echo "2. Start building your backend API"
echo "3. Test the database connection from your application"
echo "" 