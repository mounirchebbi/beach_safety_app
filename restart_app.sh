#!/bin/bash

# Beach Safety App Restart Script
# This script cleanly stops all running processes and restarts the application

echo "🏖️  Beach Safety App - Restart Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill processes by port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        print_status "Killing processes on port $port (PIDs: $pids)"
        kill -9 $pids 2>/dev/null
        sleep 2
    fi
}

# Function to wait for server to be ready
wait_for_server() {
    local url=$1
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for server at $url to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            print_success "Server at $url is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Server at $url failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Step 1: Stop all existing processes
print_status "Step 1: Stopping all existing processes..."

# Kill all Node.js and npm processes related to our app
print_status "Killing Node.js and npm processes..."
pkill -f "node.*app.js" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "npm start" 2>/dev/null

# Kill processes on specific ports
print_status "Killing processes on ports 5000 and 3000..."
kill_port 5000
kill_port 3000

# Wait a moment for processes to fully terminate
sleep 3

# Step 2: Verify ports are free
print_status "Step 2: Verifying ports are free..."

if check_port 5000; then
    print_error "Port 5000 is still in use"
    exit 1
else
    print_success "Port 5000 is free"
fi

if check_port 3000; then
    print_error "Port 3000 is still in use"
    exit 1
else
    print_success "Port 3000 is free"
fi

# Step 3: Start Backend Server
print_status "Step 3: Starting Backend Server..."

cd backend
if [ ! -f "package.json" ]; then
    print_error "Backend package.json not found. Are you in the correct directory?"
    exit 1
fi

# Start backend in background
print_status "Starting backend server on port 5000..."
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 5

# Check if backend started successfully
if ! check_port 5000; then
    print_error "Backend failed to start on port 5000"
    print_status "Backend logs:"
    cat ../backend.log
    exit 1
fi

print_success "Backend server started successfully (PID: $BACKEND_PID)"

# Step 4: Start Frontend Server
print_status "Step 4: Starting Frontend Server..."

cd ../frontend
if [ ! -f "package.json" ]; then
    print_error "Frontend package.json not found. Are you in the correct directory?"
    exit 1
fi

# Start frontend in background
print_status "Starting frontend server on port 3000..."
npm start > ../frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 10

# Check if frontend started successfully
if ! check_port 3000; then
    print_error "Frontend failed to start on port 3000"
    print_status "Frontend logs:"
    cat ../frontend.log
    exit 1
fi

print_success "Frontend server started successfully (PID: $FRONTEND_PID)"

# Step 5: Verify both servers are responding
print_status "Step 5: Verifying servers are responding..."

# Test backend API
print_status "Testing backend API..."
if curl -s http://localhost:5000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"test","password":"test"}' >/dev/null 2>&1; then
    print_success "Backend API is responding"
else
    print_warning "Backend API test failed (this might be normal for invalid credentials)"
fi

# Test frontend
print_status "Testing frontend..."
if curl -s http://localhost:3000 | grep -q "html" 2>/dev/null; then
    print_success "Frontend is responding"
else
    print_warning "Frontend test failed"
fi

# Step 6: Display final status
echo ""
echo "🎉 Application Restart Complete!"
echo "================================"
print_success "Backend: http://localhost:5000 (PID: $BACKEND_PID)"
print_success "Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
print_status "Demo Credentials:"
echo "  System Admin: demo.admin@beachsafety.com / DemoAdmin123!"
echo "  Center Admin: demo.center@beachsafety.com / DemoCenter123!"
echo "  Lifeguard: demo.lifeguard@beachsafety.com / DemoLifeguard123!"
echo ""
print_status "Log files:"
echo "  Backend: ./backend.log"
echo "  Frontend: ./frontend.log"
echo ""
print_status "To stop the application, run: ./stop_app.sh"
echo ""

# Save PIDs to file for easy stopping
echo "$BACKEND_PID" > .backend.pid
echo "$FRONTEND_PID" > .frontend.pid

print_success "Restart completed successfully!" 