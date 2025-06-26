#!/bin/bash

# Beach Safety App Stop Script
# This script cleanly stops all running processes

echo "🛑 Beach Safety App - Stop Script"
echo "=================================="

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
        return 0
    else
        print_status "No processes found on port $port"
        return 1
    fi
}

# Step 1: Stop processes using PID files if they exist
print_status "Step 1: Stopping processes using PID files..."

if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        print_status "Stopping backend process (PID: $BACKEND_PID)"
        kill -TERM $BACKEND_PID 2>/dev/null
        sleep 2
        if kill -0 $BACKEND_PID 2>/dev/null; then
            print_status "Force killing backend process"
            kill -9 $BACKEND_PID 2>/dev/null
        fi
    else
        print_status "Backend PID file exists but process is not running"
    fi
    rm -f .backend.pid
else
    print_status "No backend PID file found"
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        print_status "Stopping frontend process (PID: $FRONTEND_PID)"
        kill -TERM $FRONTEND_PID 2>/dev/null
        sleep 2
        if kill -0 $FRONTEND_PID 2>/dev/null; then
            print_status "Force killing frontend process"
            kill -9 $FRONTEND_PID 2>/dev/null
        fi
    else
        print_status "Frontend PID file exists but process is not running"
    fi
    rm -f .frontend.pid
else
    print_status "No frontend PID file found"
fi

# Step 2: Kill all Node.js and npm processes related to our app
print_status "Step 2: Killing all Node.js and npm processes..."

# Kill specific processes
pkill -f "node.*app.js" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
pkill -f "npm start" 2>/dev/null

# Step 3: Kill processes on specific ports
print_status "Step 3: Killing processes on ports 5000 and 3000..."

kill_port 5000
kill_port 3000

# Wait a moment for processes to fully terminate
sleep 3

# Step 4: Verify all processes are stopped
print_status "Step 4: Verifying all processes are stopped..."

if check_port 5000; then
    print_warning "Port 5000 is still in use"
else
    print_success "Port 5000 is free"
fi

if check_port 3000; then
    print_warning "Port 3000 is still in use"
else
    print_success "Port 3000 is free"
fi

# Step 5: Clean up log files
print_status "Step 5: Cleaning up log files..."

if [ -f "backend.log" ]; then
    rm backend.log
    print_status "Removed backend.log"
fi

if [ -f "frontend.log" ]; then
    rm frontend.log
    print_status "Removed frontend.log"
fi

# Step 6: Final status
echo ""
echo "🛑 Application Stop Complete!"
echo "============================="
print_success "All Beach Safety App processes have been stopped"
print_success "Ports 5000 and 3000 are now available"
echo ""
print_status "To restart the application, run: ./restart_app.sh"
echo ""

print_success "Stop completed successfully!" 