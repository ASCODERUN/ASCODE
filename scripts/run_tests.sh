#!/bin/bash

# run_tests.sh
# Script to run all test suites across components with coverage reporting

# Exit on any error to prevent partial execution
set -e

# Default environment and configuration settings
DEFAULT_ENV="development"
CONFIG_DIR="./config"
LOG_DIR="./logs"
COVERAGE_DIR="./coverage"
TEST_RESULTS_DIR="./test-results"
MAX_CONNECTION_ATTEMPTS=3
CONNECTION_CHECK_INTERVAL=2

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
        log_message "Error: \$1 not found. Ensure the path exists before running tests."
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

# Check for required tools before running tests
check_requirements() {
    log_message "Checking for required testing tools..."
    for cmd in node npm; do
        if ! check_command "$cmd"; then
            log_message "Error: Missing required tool: $cmd. Please install it before proceeding."
            exit 1
        fi
    done
    log_message "All required tools are installed. Proceeding with test setup."
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
    : "${NODE_ENV:=$ENV}"
    export NODE_ENV
    log_message "Environment set to $NODE_ENV for testing."
}

# Create necessary directories if they don't exist
setup_directories() {
    log_message "Setting up required directories for test results and coverage..."
    for dir in "$CONFIG_DIR" "$LOG_DIR" "$COVERAGE_DIR" "$TEST_RESULTS_DIR"; do
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

# Install dependencies if node_modules is missing
install_dependencies() {
    log_message "Checking for project dependencies..."
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

# Run tests for a specific component with coverage
run_component_tests() {
    local component="\$1"
    local test_script="\$2"
    local coverage_flag="\$3"
    local log_file="$LOG_DIR/$component-tests-$(date '+%Y%m%d-%H%M%S').log"

    log_message "Running tests for $component..."
    log_message "Logging output to $log_file..."

    if [ -f "package.json" ]; then
        log_message "Executing test script: npm run $test_script $coverage_flag"
        npm run "$test_script" "$coverage_flag" > "$log_file" 2>&1
        if [ $? -eq 0 ]; then
            log_message "Tests for $component completed successfully. Check $log_file for details."
            return 0
        else
            log_message "Error: Tests for $component failed. Check $log_file for details."
            return 1
        fi
    else
        log_message "Error: package.json not found. Ensure you're in the correct directory."
        return 1
    fi
}

# Run all test suites across components
run_all_tests() {
    log_message "Starting test execution across all components with coverage reporting..."
    local test_failed=0

    # Define components and their test scripts (adjust based on your project structure)
    declare -A components=(
        ["frontend"]="test:frontend -- --coverage"
        ["backend"]="test:backend -- --coverage"
        ["contracts"]="test:contracts -- --coverage"
    )

    for component in "${!components[@]}"; do
        log_message "Processing tests for component: $component"
        if ! run_component_tests "$component" "${components[$component]}" "--coverage"; then
            test_failed=1
            log_message "Warning: Test suite for $component failed. Continuing with remaining components."
        fi
    done

    if [ $test_failed -eq 1 ]; then
        log_message "Error: One or more test suites failed. Check logs in $LOG_DIR for details."
        exit 1
    else
        log_message "All test suites completed successfully across components."
    fi
}

# Aggregate and display coverage results
aggregate_coverage() {
    log_message "Aggregating test coverage results..."
    if [ -d "$COVERAGE_DIR" ]; then
        log_message "Coverage reports generated in $COVERAGE_DIR."
        if [ -f "$COVERAGE_DIR/coverage-summary.json" ]; then
            log_message "Summary of coverage results:"
            if command -v jq &> /dev/null; then
                jq '.' "$COVERAGE_DIR/coverage-summary.json" || log_message "Warning: Failed to display coverage summary with jq."
            else
                log_message "Warning: jq not installed. Skipping detailed coverage summary display."
                log_message "Raw coverage data available in $COVERAGE_DIR."
            fi
        else
            log_message "Warning: Coverage summary file not found in $COVERAGE_DIR."
        fi
    else
        log_message "Warning: Coverage directory $COVERAGE_DIR not found. Coverage may not have been generated."
    fi
    log_message "Test results and logs are available in $TEST_RESULTS_DIR and $LOG_DIR."
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [environment]"
    echo "  environment: Target environment for tests (development, staging, production). Default: $DEFAULT_ENV"
    echo "Example: \$0 development"
    echo "Note: Ensure required tools (e.g., node, npm) are installed and configuration files are set up."
}

# Main function to orchestrate the test execution process
main() {
    # Check if environment is provided as argument, else use default
    if [ $# -eq 1 ]; then
        ENV="\$1"
    else
        ENV="$DEFAULT_ENV"
    fi

    log_message "Starting test execution setup for $ENV environment..."
    detect_os
    check_requirements
    setup_directories
    load_env_variables
    install_dependencies
    run_all_tests
    aggregate_coverage
    log_message "Test execution process completed successfully!"
    log_message "Next steps:"
    log_message "1. Review detailed logs in $LOG_DIR for test execution details."
    log_message "2. Check coverage reports in $COVERAGE_DIR for code coverage metrics."
    log_message "3. View test results in $TEST_RESULTS_DIR if applicable."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Test execution process failed. Check logs above for details."
    exit 1
}

# End of script
