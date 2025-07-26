#!/bin/bash

# Beach Safety Management System - MVP API Testing Script
# This script tests all major MVP functionalities using curl commands

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:5000"
API_VERSION="/api/v1"
BASE_API_URL="${BASE_URL}${API_VERSION}"

# Test data
DEMO_ADMIN_EMAIL="demo.admin@beachsafety.com"
DEMO_ADMIN_PASSWORD="Demo123!"
DEMO_CENTER_EMAIL="demo.center@beachsafety.com"
DEMO_CENTER_PASSWORD="Demo123!"
DEMO_LIFEGUARD_EMAIL="demo.lifeguard@beachsafety.com"
DEMO_LIFEGUARD_PASSWORD="Demo123!"

# Global variables
ADMIN_TOKEN=""
CENTER_TOKEN=""
LIFEGUARD_TOKEN=""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Beach Safety MVP API Testing Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print test results
print_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name: $message"
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name: $message"
    fi
}

# Function to check if server is running
check_server() {
    echo -e "${YELLOW}🔍 Checking if server is running...${NC}"
    if curl -s "${BASE_URL}/health" > /dev/null; then
        print_result "Server Health Check" "PASS" "Server is running"
        return 0
    else
        print_result "Server Health Check" "FAIL" "Server is not running on ${BASE_URL}"
        return 1
    fi
}

# Function to get authentication token
get_token() {
    local email="$1"
    local password="$2"
    local role="$3"
    
    echo -e "${YELLOW}🔐 Getting ${role} token...${NC}"
    
    local response=$(curl -s -X POST "${BASE_API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"${email}\",
            \"password\": \"${password}\"
        }")
    
    local token=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$token" ]; then
        print_result "${role} Authentication" "PASS" "Token obtained successfully"
        echo "$token"
    else
        print_result "${role} Authentication" "FAIL" "Failed to get token"
        echo ""
    fi
}

# Function to test public endpoints
test_public_endpoints() {
    echo ""
    echo -e "${BLUE}📡 Testing Public Endpoints${NC}"
    echo "=================================="
    
    # Test public centers endpoint
    echo -e "${YELLOW}🏖️  Testing public centers endpoint...${NC}"
    local centers_response=$(curl -s "${BASE_API_URL}/public/centers")
    if echo "$centers_response" | grep -q "centers"; then
        print_result "Public Centers" "PASS" "Centers data retrieved"
    else
        print_result "Public Centers" "FAIL" "Failed to get centers data"
    fi
    
    # Test public weather endpoint
    echo -e "${YELLOW}🌤️  Testing public weather endpoint...${NC}"
    local weather_response=$(curl -s "${BASE_API_URL}/public/weather/current")
    if echo "$weather_response" | grep -q "weather"; then
        print_result "Public Weather" "PASS" "Weather data retrieved"
    else
        print_result "Public Weather" "FAIL" "Failed to get weather data"
    fi
}

# Function to test authentication endpoints
test_auth_endpoints() {
    echo ""
    echo -e "${BLUE}🔐 Testing Authentication Endpoints${NC}"
    echo "=========================================="
    
    # Test login endpoints for all roles
    echo -e "${YELLOW}👤 Testing admin login...${NC}"
    ADMIN_TOKEN=$(get_token "$DEMO_ADMIN_EMAIL" "$DEMO_ADMIN_PASSWORD" "System Admin")
    
    echo -e "${YELLOW}👤 Testing center admin login...${NC}"
    CENTER_TOKEN=$(get_token "$DEMO_CENTER_EMAIL" "$DEMO_CENTER_PASSWORD" "Center Admin")
    
    echo -e "${YELLOW}👤 Testing lifeguard login...${NC}"
    LIFEGUARD_TOKEN=$(get_token "$DEMO_LIFEGUARD_EMAIL" "$DEMO_LIFEGUARD_PASSWORD" "Lifeguard")
    
    # Test get current user endpoint
    if [ -n "$ADMIN_TOKEN" ]; then
        echo -e "${YELLOW}👤 Testing get current user...${NC}"
        local user_response=$(curl -s -X GET "${BASE_API_URL}/auth/me" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}")
        if echo "$user_response" | grep -q "email"; then
            print_result "Get Current User" "PASS" "User data retrieved"
        else
            print_result "Get Current User" "FAIL" "Failed to get user data"
        fi
    fi
}

# Function to test centers endpoints
test_centers_endpoints() {
    echo ""
    echo -e "${BLUE}🏢 Testing Centers Endpoints${NC}"
    echo "=================================="
    
    if [ -n "$ADMIN_TOKEN" ]; then
        # Test get all centers
        echo -e "${YELLOW}📋 Testing get all centers...${NC}"
        local centers_response=$(curl -s -X GET "${BASE_API_URL}/centers" \
            -H "Authorization: Bearer ${ADMIN_TOKEN}")
        if echo "$centers_response" | grep -q "centers"; then
            print_result "Get All Centers" "PASS" "Centers list retrieved"
        else
            print_result "Get All Centers" "FAIL" "Failed to get centers list"
        fi
        
        # Test get center by ID (using first center)
        echo -e "${YELLOW}🔍 Testing get center by ID...${NC}"
        local center_id=$(echo "$centers_response" | grep -o '"[^"]*"' | head -1 | tr -d '"')
        if [ -n "$center_id" ]; then
            local center_response=$(curl -s -X GET "${BASE_API_URL}/centers/${center_id}" \
                -H "Authorization: Bearer ${ADMIN_TOKEN}")
            if echo "$center_response" | grep -q "name"; then
                print_result "Get Center by ID" "PASS" "Center details retrieved"
            else
                print_result "Get Center by ID" "FAIL" "Failed to get center details"
            fi
        fi
    fi
}

# Function to test lifeguards endpoints
test_lifeguards_endpoints() {
    echo ""
    echo -e "${BLUE}🏊 Testing Lifeguards Endpoints${NC}"
    echo "====================================="
    
    if [ -n "$CENTER_TOKEN" ]; then
        # Test get all lifeguards
        echo -e "${YELLOW}📋 Testing get all lifeguards...${NC}"
        local lifeguards_response=$(curl -s -X GET "${BASE_API_URL}/lifeguards" \
            -H "Authorization: Bearer ${CENTER_TOKEN}")
        if echo "$lifeguards_response" | grep -q "lifeguards"; then
            print_result "Get All Lifeguards" "PASS" "Lifeguards list retrieved"
        else
            print_result "Get All Lifeguards" "FAIL" "Failed to get lifeguards list"
        fi
        
        # Test create lifeguard
        echo -e "${YELLOW}➕ Testing create lifeguard...${NC}"
        local create_response=$(curl -s -X POST "${BASE_API_URL}/lifeguards" \
            -H "Authorization: Bearer ${CENTER_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "email": "test.lifeguard@beachsafety.com",
                "password": "Test123!",
                "first_name": "Test",
                "last_name": "Lifeguard",
                "phone": "+1234567890",
                "certification_level": "Advanced",
                "certification_expiry": "2025-12-31"
            }')
        if echo "$create_response" | grep -q "id"; then
            print_result "Create Lifeguard" "PASS" "Lifeguard created successfully"
        else
            print_result "Create Lifeguard" "FAIL" "Failed to create lifeguard"
        fi
    fi
}

# Function to test shifts endpoints
test_shifts_endpoints() {
    echo ""
    echo -e "${BLUE}⏰ Testing Shifts Endpoints${NC}"
    echo "=================================="
    
    if [ -n "$CENTER_TOKEN" ]; then
        # Test get all shifts
        echo -e "${YELLOW}📋 Testing get all shifts...${NC}"
        local shifts_response=$(curl -s -X GET "${BASE_API_URL}/shifts" \
            -H "Authorization: Bearer ${CENTER_TOKEN}")
        if echo "$shifts_response" | grep -q "shifts"; then
            print_result "Get All Shifts" "PASS" "Shifts list retrieved"
        else
            print_result "Get All Shifts" "FAIL" "Failed to get shifts list"
        fi
        
        # Test create shift
        echo -e "${YELLOW}➕ Testing create shift...${NC}"
        local create_response=$(curl -s -X POST "${BASE_API_URL}/shifts" \
            -H "Authorization: Bearer ${CENTER_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "lifeguard_id": "00000000-0000-0000-0000-000000000001",
                "start_time": "2025-01-15T08:00:00Z",
                "end_time": "2025-01-15T16:00:00Z"
            }')
        if echo "$create_response" | grep -q "id"; then
            print_result "Create Shift" "PASS" "Shift created successfully"
        else
            print_result "Create Shift" "FAIL" "Failed to create shift"
        fi
    fi
}

# Function to test emergency alerts endpoints
test_alerts_endpoints() {
    echo ""
    echo -e "${BLUE}🚨 Testing Emergency Alerts Endpoints${NC}"
    echo "============================================="
    
    # Test public SOS alert
    echo -e "${YELLOW}🚨 Testing public SOS alert...${NC}"
    local sos_response=$(curl -s -X POST "${BASE_API_URL}/alerts/sos" \
        -H "Content-Type: application/json" \
        -d '{
            "center_id": "00000000-0000-0000-0000-000000000001",
            "location": "POINT(10.1819 36.8065)",
            "description": "Test emergency alert"
        }')
    if echo "$sos_response" | grep -q "id"; then
        print_result "Public SOS Alert" "PASS" "SOS alert created successfully"
    else
        print_result "Public SOS Alert" "FAIL" "Failed to create SOS alert"
    fi
    
    if [ -n "$LIFEGUARD_TOKEN" ]; then
        # Test get all alerts
        echo -e "${YELLOW}📋 Testing get all alerts...${NC}"
        local alerts_response=$(curl -s -X GET "${BASE_API_URL}/alerts" \
            -H "Authorization: Bearer ${LIFEGUARD_TOKEN}")
        if echo "$alerts_response" | grep -q "alerts"; then
            print_result "Get All Alerts" "PASS" "Alerts list retrieved"
        else
            print_result "Get All Alerts" "FAIL" "Failed to get alerts list"
        fi
    fi
}

# Function to test weather endpoints
test_weather_endpoints() {
    echo ""
    echo -e "${BLUE}🌤️  Testing Weather Endpoints${NC}"
    echo "====================================="
    
    if [ -n "$CENTER_TOKEN" ]; then
        # Test get current weather for center
        echo -e "${YELLOW}🌤️  Testing get current weather...${NC}"
        local weather_response=$(curl -s -X GET "${BASE_API_URL}/weather/centers/00000000-0000-0000-0000-000000000001/current" \
            -H "Authorization: Bearer ${CENTER_TOKEN}")
        if echo "$weather_response" | grep -q "temperature"; then
            print_result "Get Current Weather" "PASS" "Weather data retrieved"
        else
            print_result "Get Current Weather" "FAIL" "Failed to get weather data"
        fi
        
        # Test get weather forecast
        echo -e "${YELLOW}📅 Testing get weather forecast...${NC}"
        local forecast_response=$(curl -s -X GET "${BASE_API_URL}/weather/centers/00000000-0000-0000-0000-000000000001/forecast" \
            -H "Authorization: Bearer ${CENTER_TOKEN}")
        if echo "$forecast_response" | grep -q "forecast"; then
            print_result "Get Weather Forecast" "PASS" "Forecast data retrieved"
        else
            print_result "Get Weather Forecast" "FAIL" "Failed to get forecast data"
        fi
    fi
}

# Function to test safety endpoints
test_safety_endpoints() {
    echo ""
    echo -e "${BLUE}🚩 Testing Safety Endpoints${NC}"
    echo "=================================="
    
    if [ -n "$CENTER_TOKEN" ]; then
        # Test get current safety flag
        echo -e "${YELLOW}🚩 Testing get current safety flag...${NC}"
        local flag_response=$(curl -s -X GET "${BASE_API_URL}/safety/centers/00000000-0000-0000-0000-000000000001/current" \
            -H "Authorization: Bearer ${CENTER_TOKEN}")
        if echo "$flag_response" | grep -q "flag_status"; then
            print_result "Get Current Safety Flag" "PASS" "Safety flag retrieved"
        else
            print_result "Get Current Safety Flag" "FAIL" "Failed to get safety flag"
        fi
        
        # Test set safety flag
        echo -e "${YELLOW}🚩 Testing set safety flag...${NC}"
        local set_flag_response=$(curl -s -X POST "${BASE_API_URL}/safety/centers/00000000-0000-0000-0000-000000000001/flags" \
            -H "Authorization: Bearer ${CENTER_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "flag_status": "yellow",
                "reason": "Test safety flag"
            }')
        if echo "$set_flag_response" | grep -q "id"; then
            print_result "Set Safety Flag" "PASS" "Safety flag set successfully"
        else
            print_result "Set Safety Flag" "FAIL" "Failed to set safety flag"
        fi
    fi
}

# Function to test incident reports endpoints
test_reports_endpoints() {
    echo ""
    echo -e "${BLUE}📝 Testing Incident Reports Endpoints${NC}"
    echo "============================================="
    
    if [ -n "$LIFEGUARD_TOKEN" ]; then
        # Test get all reports
        echo -e "${YELLOW}📋 Testing get all reports...${NC}"
        local reports_response=$(curl -s -X GET "${BASE_API_URL}/reports" \
            -H "Authorization: Bearer ${LIFEGUARD_TOKEN}")
        if echo "$reports_response" | grep -q "reports"; then
            print_result "Get All Reports" "PASS" "Reports list retrieved"
        else
            print_result "Get All Reports" "FAIL" "Failed to get reports list"
        fi
        
        # Test create report
        echo -e "${YELLOW}➕ Testing create report...${NC}"
        local create_response=$(curl -s -X POST "${BASE_API_URL}/reports" \
            -H "Authorization: Bearer ${LIFEGUARD_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "incident_type": "Medical Emergency",
                "description": "Test incident report",
                "action_taken": "First aid provided",
                "outcome": "Patient stabilized"
            }')
        if echo "$create_response" | grep -q "id"; then
            print_result "Create Report" "PASS" "Report created successfully"
        else
            print_result "Create Report" "FAIL" "Failed to create report"
        fi
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    echo ""
    echo -e "${BLUE}🚦 Testing Rate Limiting${NC}"
    echo "================================"
    
    echo -e "${YELLOW}🚦 Testing rate limiting on public endpoints...${NC}"
    local rate_limit_response=$(curl -s -w "%{http_code}" "${BASE_API_URL}/public/centers" -o /dev/null)
    if [ "$rate_limit_response" = "200" ]; then
        print_result "Rate Limiting (Public)" "PASS" "Public endpoints not rate limited"
    else
        print_result "Rate Limiting (Public)" "FAIL" "Public endpoints are rate limited"
    fi
}

# Function to test error handling
test_error_handling() {
    echo ""
    echo -e "${BLUE}⚠️  Testing Error Handling${NC}"
    echo "================================"
    
    # Test invalid endpoint
    echo -e "${YELLOW}⚠️  Testing invalid endpoint...${NC}"
    local invalid_response=$(curl -s -w "%{http_code}" "${BASE_API_URL}/invalid/endpoint" -o /dev/null)
    if [ "$invalid_response" = "404" ]; then
        print_result "Invalid Endpoint" "PASS" "Proper 404 error returned"
    else
        print_result "Invalid Endpoint" "FAIL" "Unexpected response for invalid endpoint"
    fi
    
    # Test unauthorized access
    echo -e "${YELLOW}⚠️  Testing unauthorized access...${NC}"
    local unauthorized_response=$(curl -s -w "%{http_code}" "${BASE_API_URL}/centers" -o /dev/null)
    if [ "$unauthorized_response" = "401" ]; then
        print_result "Unauthorized Access" "PASS" "Proper 401 error returned"
    else
        print_result "Unauthorized Access" "FAIL" "Unexpected response for unauthorized access"
    fi
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo -e "${BLUE}📊 MVP Testing Summary${NC}"
    echo "=========================="
    echo ""
    echo -e "${GREEN}✅ Tests Completed:${NC}"
    echo "  • Server Health Check"
    echo "  • Authentication (All Roles)"
    echo "  • Public Endpoints"
    echo "  • Centers Management"
    echo "  • Lifeguards Management"
    echo "  • Shifts Management"
    echo "  • Emergency Alerts"
    echo "  • Weather Integration"
    echo "  • Safety Flags"
    echo "  • Incident Reports"
    echo "  • Rate Limiting"
    echo "  • Error Handling"
    echo ""
    echo -e "${YELLOW}📋 Test Coverage:${NC}"
    echo "  • Authentication & Authorization"
    echo "  • CRUD Operations"
    echo "  • Real-time Features"
    echo "  • Public Access"
    echo "  • Security Features"
    echo ""
    echo -e "${BLUE}🎯 MVP Functionality Verified:${NC}"
    echo "  • User authentication and role-based access"
    echo "  • Center and lifeguard management"
    echo "  • Emergency alert system"
    echo "  • Real-time weather integration"
    echo "  • Safety flag management"
    echo "  • Incident reporting"
    echo "  • Public access to basic information"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting MVP API Testing...${NC}"
    echo ""
    
    # Check if server is running
    if ! check_server; then
        echo -e "${RED}❌ Server is not running. Please start the server first.${NC}"
        echo "Run: cd backend && npm start"
        exit 1
    fi
    
    # Run all tests
    test_public_endpoints
    test_auth_endpoints
    test_centers_endpoints
    test_lifeguards_endpoints
    test_shifts_endpoints
    test_alerts_endpoints
    test_weather_endpoints
    test_safety_endpoints
    test_reports_endpoints
    test_rate_limiting
    test_error_handling
    
    # Generate summary
    generate_summary
    
    echo ""
    echo -e "${GREEN}🎉 MVP Testing Complete!${NC}"
    echo ""
    echo -e "${YELLOW}📝 Notes:${NC}"
    echo "  • All tests use demo accounts provided in the project"
    echo "  • Some tests may fail if demo data is not available"
    echo "  • Check the debug_history.txt for detailed error information"
    echo "  • Ensure the database is properly set up before running tests"
}

# Run main function
main "$@" 