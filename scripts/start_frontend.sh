#!/bin/bash

# start_frontend.sh
# Start frontend DApp with hot reloading for development

# Exit on any error to prevent partial startup
set -e

# Default environment and configuration settings
DEFAULT_ENV="development"
DEFAULT_PORT=3001
CONFIG_DIR="./config"
LOG_DIR="./logs"
PID_FILE="./frontend.pid"
DEV_SERVER_URL="http://localhost:$DEFAULT_PORT"
MAX_CONNECTION_ATTEMPTS=5
CONNECTION_CHECK_INTERVAL=5

# Utility function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] \$1"
}

# Utility function to check if a command exists
check_command() {
    if command -v "\$1" &> /dev/null; then
        log_message "\$1 is installed. Version: $(\$1 --version || \$1 -v || echo 'unknown')"
        return 0
    else
        log_message "Error: \$1 is not installed. Please install it before proceeding."
        return 1
    fi
}

# Utility function to check if a directory or file exists
check_path() {
    if [ -e "\$1" ]; then
        log_message "\$1 found. Proceeding with setup checks."
        return 0
    else
        log_message "Error: \$1 not found. Ensure the path exists before starting the frontend."
        return 1
    fi
}

# Utility function to detect OS type
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        log_message "Detected OS: Linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        log_message "Detected OS: macOS"
    else
        log_message "Unsupported OS: $OSTYPE. This script supports Linux and macOS only."
        exit 1
    fi
}

# Check for required tools before starting the frontend
check_requirements() {
    log_message "Checking for required frontend tools..."
    for cmd in node npm curl; do
        if ! check_command "$cmd"; then
            log_message "Error: Missing required tool: $cmd. Please install it before proceeding."
            exit 1
        fi
    done
    log_message "All required tools are installed. Proceeding with frontend setup."
}

# Load environment variables from a .env file or system
load_env_variables() {
    log_message "Loading environment variables..."
    ENV_FILE="$CONFIG_DIR/.env.$ENV"
    if [ -f "$ENV_FILE" ]; then
        log_message "Loading environment variables from $ENV_FILE..."
        set -a
        source "$ENV_FILE"
        set +a
    else
        log_message "Warning: Environment file $ENV_FILE not found. Using system environment variables."
    fi

    # Set default values if not provided by environment
    : "${FRONTEND_PORT:=$DEFAULT_PORT}"
    : "${NODE_ENV:=$ENV}"
    export FRONTEND_PORT NODE_ENV
    log_message "Frontend port set to $FRONTEND_PORT."
    log_message "Environment set to $NODE_ENV."
}

# Check if frontend is already running
check_if_running() {
    log_message "Checking if frontend is already running..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            log_message "Error: Frontend is already running with PID $PID. Stop it first or remove $PID_FILE if stale."
            exit 1
        else
            log_message "Warning: Stale PID file found. Removing $PID_FILE."
            rm -f "$PID_FILE"
        fi
    fi
    log_message "No running frontend instance detected. Proceeding with startup."
}

# Create necessary directories if they don't exist
setup_directories() {
    log_message "Setting up required directories..."
    for dir in "$CONFIG_DIR" "$LOG_DIR"; do
        if ! check_path "$dir"; then
            log_message "Creating directory $dir..."
            mkdir -p "$dir"
            if [ $? -ne 0 ]; then
                log_message "Error: Failed to create directory $dir. Check permissions."
                exit 1
            fi
        fi
    done
    log_message "All required directories are set up."
}

# Install frontend dependencies if node_modules is missing
install_dependencies() {
    log_message "Checking for frontend dependencies..."
    if [ ! -d "node_modules" ]; then
        log_message "node_modules directory not found. Installing dependencies..."
        if [ -f "package.json" ]; then
            npm install
            if [ $? -ne 0 ]; then
                log_message "Error: Failed to install dependencies. Check npm logs for details."
                exit 1
            fi
            log_message "Dependencies installed successfully."
        else
            log_message "Error: package.json not found. Ensure you're in the correct directory."
            exit 1
        fi
    else
        log_message "node_modules directory found. Skipping dependency installation."
    fi
}

# Start the frontend development server with hot reloading
start_service() {
    log_message "Starting frontend development server in $NODE_ENV mode on port $FRONTEND_PORT..."
    LOG_FILE="$LOG_DIR/frontend-$(date '+%Y%m%d-%H%M%S').log"
    log_message "Logging output to $LOG_FILE..."

    # Assuming a Node.js-based frontend (React, Vue, Next.js, etc.); adjust based on your stack
    if [ -f "package.json" ]; then
        log_message "Detected Node.js project. Running 'npm run dev' with hot reloading..."
        nohup npm run dev -- --port "$FRONTEND_PORT" > "$LOG_FILE" 2>&1 &
        FRONTEND_PID=$!
        log_message "Frontend started with PID $FRONTEND_PID."
        echo "$FRONTEND_PID" > "$PID_FILE"
    else
        log_message "Error: package.json not found. Ensure you're in the correct directory or adjust the start command."
        exit 1
    fi
}

# Perform connection check on the frontend development server
perform_connection_check() {
    log_message "Performing connection check on frontend at $DEV_SERVER_URL..."
    ATTEMPT=1
    while [ $ATTEMPT -le $MAX_CONNECTION_ATTEMPTS ]; do
        log_message "Connection check attempt $ATTEMPT of $MAX_CONNECTION_ATTEMPTS..."
        if curl -s -f "$DEV_SERVER_URL" > /dev/null; then
            log_message "Connection check successful! Frontend is up and running at $DEV_SERVER_URL."
            return 0
        else
            log_message "Connection check failed. Waiting $CONNECTION_CHECK_INTERVAL seconds before retry..."
            sleep $CONNECTION_CHECK_INTERVAL
            ((ATTEMPT++))
        fi
    done
    log_message "Error: Connection check failed after $MAX_CONNECTION_ATTEMPTS attempts. Frontend may not be running correctly."
    log_message "Check logs at $LOG_FILE for details."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        log_message "Attempting to stop frontend process with PID $PID..."
        kill -9 "$PID" 2>/dev/null || log_message "Warning: Could not stop process $PID. It may already be terminated."
        rm -f "$PID_FILE"
    fi
    exit 1
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [environment]"
    echo "  environment: Target environment for frontend (development, staging, production). Default: $DEFAULT_ENV"
    echo "Example: \$0 development"
    echo "Note: Ensure required tools (e.g., node, npm) are installed and configuration files are set up."
}

# Main function to orchestrate the frontend startup process
main() {
    # Check if environment is provided as argument, else use default
    if [ $# -eq 1 ]; then
        ENV="\$1"
    else
        ENV="$DEFAULT_ENV"
    fi

    log_message "Starting frontend DApp setup for $ENV environment..."
    detect_os
    check_requirements
    setup_directories
    load_env_variables
    check_if_running
    install_dependencies
    start_service
    perform_connection_check
    log_message "Frontend startup process completed successfully!"
    log_message "Next steps:"
    log_message "1. Monitor logs at $LOG_FILE for runtime details."
    log_message "2. Access frontend DApp at $DEV_SERVER_URL."
    log_message "3. Use a stop script or 'kill -9 $(cat $PID_FILE)' to stop the service."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Frontend startup process failed. Check logs above for details."
    exit 1
}

# End of script
