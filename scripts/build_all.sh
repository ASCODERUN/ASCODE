#!/bin/bash

# build_all.sh
# Build script for all components including smart contracts, backend, and frontend

# Exit on any error to prevent partial builds
set -e

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

# Utility function to check if a directory exists
check_directory() {
    if [ -d "\$1" ]; then
        log_message "Directory \$1 found. Proceeding with build for this component."
        return 0
    else
        log_message "Warning: Directory \$1 not found. Skipping build for this component."
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

# Check for required tools before starting the build process
check_requirements() {
    log_message "Checking for required build tools..."
    for cmd in node npm cargo rustc solana anchor; do
        if ! check_command "$cmd"; then
            log_message "Error: Missing required tool: $cmd. Run setup_env.sh or install manually."
            exit 1
        fi
    done
    log_message "All required tools are installed. Proceeding with build."
}

# Build Solana smart contracts using Anchor (assumes Anchor project structure)
build_contracts() {
    log_message "Building Solana smart contracts..."
    CONTRACTS_DIR="./contracts"
    if check_directory "$CONTRACTS_DIR"; then
        cd "$CONTRACTS_DIR"
        if [ -f "Anchor.toml" ]; then
            log_message "Anchor project detected. Running anchor build..."
            anchor build
            log_message "Smart contracts built successfully. Artifacts in target/ directory."
        else
            log_message "Warning: No Anchor.toml found in $CONTRACTS_DIR. Skipping Anchor build."
            log_message "Running cargo build for potential Rust-only contracts..."
            if [ -f "Cargo.toml" ]; then
                cargo build --release
                log_message "Rust contracts built successfully. Artifacts in target/release/ directory."
            else
                log_message "Error: No build configuration found in $CONTRACTS_DIR. Skipping."
            fi
        fi
        cd ..
    else
        log_message "No contracts directory found. Skipping smart contract build."
    fi
}

# Build backend services (assumes Node.js-based backend)
build_backend() {
    log_message "Building backend services..."
    BACKEND_DIR="./backend"
    if check_directory "$BACKEND_DIR"; then
        cd "$BACKEND_DIR"
        if [ -f "package.json" ]; then
            log_message "Node.js backend project detected. Installing dependencies..."
            npm install
            log_message "Running backend build (if applicable)..."
            if npm run build; then
                log_message "Backend built successfully."
            else
                log_message "Warning: No build script found or build failed. Assuming no build step required."
            fi
        else
            log_message "Warning: No package.json found in $BACKEND_DIR. Skipping backend build."
        fi
        cd ..
    else
        log_message "No backend directory found. Skipping backend build."
    fi
}

# Build frontend application (assumes Node.js-based frontend with React, Vue, etc.)
build_frontend() {
    log_message "Building frontend application..."
    FRONTEND_DIR="./frontend"
    if check_directory "$FRONTEND_DIR"; then
        cd "$FRONTEND_DIR"
        if [ -f "package.json" ]; then
            log_message "Node.js frontend project detected. Installing dependencies..."
            npm install
            log_message "Running frontend build..."
            if npm run build; then
                log_message "Frontend built successfully. Artifacts likely in dist/ or build/ directory."
            else
                log_message "Error: Frontend build failed. Check errors above for details."
                exit 1
            fi
        else
            log_message "Warning: No package.json found in $FRONTEND_DIR. Skipping frontend build."
        fi
        cd ..
    else
        log_message "No frontend directory found. Skipping frontend build."
    fi
}

# Verify build artifacts and provide summary
verify_builds() {
    log_message "Verifying build artifacts..."
    echo "----------------------------------------"
    echo "Build Summary:"
    echo "----------------------------------------"
    if [ -d "./contracts/target" ]; then
        echo "Smart Contracts: Built (Artifacts in ./contracts/target/)"
    else
        echo "Smart Contracts: Not built or directory not found"
    fi
    if [ -d "./backend/dist" ] || [ -d "./backend/build" ]; then
        echo "Backend: Built (Artifacts in ./backend/dist/ or ./backend/build/)"
    else
        echo "Backend: Not built or directory not found"
    fi
    if [ -d "./frontend/dist" ] || [ -d "./frontend/build" ]; then
        echo "Frontend: Built (Artifacts in ./frontend/dist/ or ./frontend/build/)"
    else
        echo "Frontend: Not built or directory not found"
    fi
    echo "----------------------------------------"
    log_message "Build verification complete. Check summary above for status."
}

# Main function to orchestrate the build process
main() {
    log_message "Starting build process for all components..."
    detect_os
    check_requirements
    build_contracts
    build_backend
    build_frontend
    verify_builds
    log_message "Build process completed successfully!"
    log_message "Next steps:"
    log_message "1. Check build summary above for artifact locations."
    log_message "2. Deploy smart contracts using 'anchor deploy' or similar if needed."
    log_message "3. Start backend with 'npm start' in backend directory if applicable."
    log_message "4. Serve frontend build output for testing if applicable."
}

# Execute main function with error handling
main || {
    log_message "Error: Build process failed. Check logs above for details."
    exit 1
}

# End of script
