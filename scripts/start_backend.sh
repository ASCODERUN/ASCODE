#!/bin/bash

# start_backend.sh
# Start backend services with environment variables and health checks

# Exit on any error to prevent partial startup
set -e

# Default environment and configuration settings
DEFAULT_ENV="development"
DEFAULT_PORT=3000
CONFIG_DIR="./config"
LOG_DIR="./logs"
PID_FILE="./backend.pid"
HEALTH_CHECK_URL="http://localhost:$DEFAULT_PORT/health"
MAX_HEALTH_CHECK_ATTEMPTS=5
HEALTH_CHECK_INTERVAL=5

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
        log_message "Error: \$1 not found. Ensure the path exists before starting the backend."
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

# Check for required tools before starting the backend
check_requirements() {
    log_message "Checking for required backend tools..."
    for cmd in node npm curl; do
        if ! check_command "$cmd"; then
            log_message "Error: Missing required tool: $cmd. Please install it before proceeding."
            exit 1
        fi
    done
    log_message "All required tools are installed. Proceeding with backend setup."
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
    : "${BACKEND_PORT:=$DEFAULT_PORT}"
    : "${NODE_ENV:=$ENV}"
    export BACKEND_PORT NODE_ENV
    log_message "Backend port set to $BACKEND_PORT."
    log_message "Environment set to $NODE_ENV."
}

# Check if backend is already running
check_if_running() {
    log_message "Checking if backend is already running..."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            log_message "Error: Backend is already running with PID $PID. Stop it first or remove $PID_FILE if stale."
            exit 1
        else
            log_message "Warning: Stale PID file found. Removing $PID_FILE."
            rm -f "$PID_FILE"
        fi
    fi
    log_message "No running backend instance detected. Proceeding with startup."
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

# Start the backend service
start_service() {
    log_message "Starting backend service in $NODE_ENV mode on port $BACKEND_PORT..."
    LOG_FILE="$LOG_DIR/backend-$(date '+%Y%m%d-%H%M%S').log"
    log_message "Logging output to $LOG_FILE..."

    # Assuming a Node.js backend; adjust this command based on your backend tech stack
    if [ -f "package.json" ]; then
        log_message "Detected Node.js project. Running 'npm start'..."
        nohup npm start -- --port "$BACKEND_PORT" > "$LOG_FILE" 2>&1 &
        BACKEND_PID=$!
        log_message "Backend started with PID $BACKEND_PID."
        echo "$BACKEND_PID" > "$PID_FILE"
    else
        log_message "Error: package.json not found. Ensure you're in the correct directory or adjust the start command."
        exit 1
    fi
}

# Perform health check on the backend service
perform_health_check() {
    log_message "Performing health check on backend at $HEALTH_CHECK_URL..."
    ATTEMPT=1
    while [ $ATTEMPT -le $MAX_HEALTH_CHECK_ATTEMPTS ]; do
        log_message "Health check attempt $ATTEMPT of $MAX_HEALTH_CHECK_ATTEMPTS..."
        if curl -s -f "$HEALTH_CHECK_URL" > /dev/null; then
            log_message "Health check successful! Backend is up and running at $HEALTH_CHECK_URL."
            return 0
        else
            log_message "Health check failed. Waiting $HEALTH_CHECK_INTERVAL seconds before retry..."
            sleep $HEALTH_CHECK_INTERVAL
            ((ATTEMPT++))
        fi
    done
    log_message "Error: Health check failed after $MAX_HEALTH_CHECK_ATTEMPTS attempts. Backend may not be running correctly."
    log_message "Check logs at $LOG_FILE for details."
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        log_message "Attempting to stop backend process with PID $PID..."
        kill -9 "$PID" 2>/dev/null || log_message "Warning: Could not stop process $PID. It may already be terminated."
        rm -f "$PID_FILE"
    fi
    exit 1
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [environment]"
    echo "  environment: Target environment for backend (development, staging, production). Default: $DEFAULT_ENV"
    echo "Example: \$0 development"
    echo "Note: Ensure required tools (e.g., node, npm) are installed and configuration files are set up."
}

# Main function to orchestrate the backend startup process
main() {
    # Check if environment is provided as argument, else use default
    if [ $# -eq 1 ]; then
        ENV="\$1"
    else
        ENV="$DEFAULT_ENV"
    fi

    log_message "Starting backend service setup for $ENV environment..."
    detect_os
    check_requirements
    setup_directories
    load_env_variables
    check_if_running
    start_service
    perform_health_check
    log_message "Backend startup process completed successfully!"
    log_message "Next steps:"
    log_message "1. Monitor logs at $LOG_FILE for runtime details."
    log_message "2. Access backend APIs at http://localhost:$BACKEND_PORT."
    log_message "3. Use a stop script or 'kill -9 $(cat $PID_FILE)' to stop the service."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Backend startup process failed. Check logs above for details."
    exit 1
}

# End of script
