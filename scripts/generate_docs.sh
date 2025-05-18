#!/bin/bash

# generate_docs.sh
# Script to generate API documentation from code annotations

# Exit on any error to prevent partial execution
set -e

# Default environment and configuration settings
DEFAULT_ENV="development"
CONFIG_DIR="./config"
LOG_DIR="./logs"
DOCS_OUTPUT_DIR="./docs/api"
TEMP_DIR="./temp"
SUPPORTED_DOC_TOOLS=("jsdoc" "swagger" "doxygen")
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
        log_message "Error: \$1 not found. Ensure the path exists before running documentation generation."
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

# Check for required tools before generating documentation
check_requirements() {
    log_message "Checking for required documentation tools..."
    local doc_tool_found=0
    for tool in "${SUPPORTED_DOC_TOOLS[@]}"; do
        if check_command "$tool"; then
            DOC_TOOL="$tool"
            doc_tool_found=1
            break
        fi
    done

    if [ $doc_tool_found -eq 0 ]; then
        log_message "Error: No supported documentation tool found. Please install one of: ${SUPPORTED_DOC_TOOLS[*]}."
        exit 1
    fi

    for cmd in node npm; do
        if ! check_command "$cmd"; then
            log_message "Warning: $cmd is not installed. Some documentation tools may not work without it."
        fi
    done
    log_message "Required tools check completed. Using $DOC_TOOL for documentation generation."
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
    log_message "Environment set to $NODE_ENV for documentation generation."
}

# Create necessary directories if they don't exist
setup_directories() {
    log_message "Setting up required directories for documentation output and logs..."
    for dir in "$CONFIG_DIR" "$LOG_DIR" "$DOCS_OUTPUT_DIR" "$TEMP_DIR"; do
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

# Install dependencies if node_modules is missing (for tools like JSDoc)
install_dependencies() {
    log_message "Checking for project dependencies..."
    if [ "$DOC_TOOL" == "jsdoc" ] || [ "$DOC_TOOL" == "swagger" ]; then
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
    else
        log_message "Skipping dependency installation for $DOC_TOOL as it does not require npm."
    fi
}

# Generate documentation using the detected tool
generate_documentation() {
    local log_file="$LOG_DIR/docs-generation-$(date '+%Y%m%d-%H%M%S').log"
    log_message "Generating API documentation using $DOC_TOOL..."
    log_message "Logging output to $log_file..."

    case "$DOC_TOOL" in
        "jsdoc")
            log_message "Running JSDoc for documentation generation..."
            if [ -f "jsdoc.conf.json" ]; then
                jsdoc -c jsdoc.conf.json -d "$DOCS_OUTPUT_DIR" > "$log_file" 2>&1
            else
                log_message "Warning: jsdoc.conf.json not found. Using default settings."
                jsdoc ./src -r -d "$DOCS_OUTPUT_DIR" > "$log_file" 2>&1
            fi
            if [ $? -eq 0 ]; then
                log_message "JSDoc documentation generated successfully in $DOCS_OUTPUT_DIR."
                return 0
            else
                log_message "Error: JSDoc documentation generation failed. Check $log_file for details."
                return 1
            fi
            ;;
        "swagger")
            log_message "Running Swagger for documentation generation..."
            if [ -f "swagger.yaml" ] || [ -f "swagger.json" ]; then
                if command -v swagger-cli &> /dev/null; then
                    swagger-cli bundle swagger.yaml -o "$DOCS_OUTPUT_DIR/swagger.json" > "$log_file" 2>&1
                    if [ $? -eq 0 ]; then
                        log_message "Swagger documentation generated successfully in $DOCS_OUTPUT_DIR."
                        return 0
                    else
                        log_message "Error: Swagger documentation generation failed. Check $log_file for details."
                        return 1
                    fi
                else
                    log_message "Error: swagger-cli not installed. Please install it for Swagger documentation."
                    return 1
                fi
            else
                log_message "Error: Swagger configuration file (swagger.yaml or swagger.json) not found."
                return 1
            fi
            ;;
        "doxygen")
            log_message "Running Doxygen for documentation generation..."
            if [ -f "Doxyfile" ]; then
                doxygen Doxyfile > "$log_file" 2>&1
                if [ $? -eq 0 ]; then
                    log_message "Doxygen documentation generated successfully. Check output directory in Doxyfile (default: $DOCS_OUTPUT_DIR)."
                    return 0
                else
                    log_message "Error: Doxygen documentation generation failed. Check $log_file for details."
                    return 1
                fi
            else
                log_message "Error: Doxyfile not found. Ensure Doxygen configuration is set up."
                return 1
            fi
            ;;
        *)
            log_message "Error: Unsupported documentation tool: $DOC_TOOL."
            return 1
            ;;
    esac
}

# Post-process documentation (e.g., copy static files or clean up)
post_process_docs() {
    log_message "Post-processing generated documentation..."
    if [ -d "$DOCS_OUTPUT_DIR" ]; then
        log_message "Documentation output found in $DOCS_OUTPUT_DIR."
        if [ -d "./static-docs" ]; then
            log_message "Copying static documentation assets from ./static-docs to $DOCS_OUTPUT_DIR..."
            cp -r ./static-docs/* "$DOCS_OUTPUT_DIR/" 2>/dev/null || log_message "Warning: Failed to copy static assets."
        fi
        log_message "Cleaning up temporary files in $TEMP_DIR if any..."
        rm -rf "$TEMP_DIR"/* 2>/dev/null || log_message "Warning: Failed to clean up temporary files."
    else
        log_message "Warning: Documentation output directory $DOCS_OUTPUT_DIR not found. Generation may have failed."
    fi
    log_message "Documentation post-processing completed."
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [environment]"
    echo "  environment: Target environment for documentation (development, staging, production). Default: $DEFAULT_ENV"
    echo "Example: \$0 development"
    echo "Note: Ensure required tools (e.g., jsdoc, swagger, doxygen) are installed and configuration files are set up."
}

# Main function to orchestrate the documentation generation process
main() {
    # Check if environment is provided as argument, else use default
    if [ $# -eq 1 ]; then
        ENV="\$1"
    else
        ENV="$DEFAULT_ENV"
    fi

    log_message "Starting API documentation generation setup for $ENV environment..."
    detect_os
    check_requirements
    setup_directories
    load_env_variables
    install_dependencies
    generate_documentation
    post_process_docs
    log_message "Documentation generation process completed successfully!"
    log_message "Next steps:"
    log_message "1. Review detailed logs in $LOG_DIR for generation details."
    log_message "2. Check generated documentation in $DOCS_OUTPUT_DIR."
    log_message "3. Serve the documentation locally or deploy it as needed."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Documentation generation process failed. Check logs above for details."
    exit 1
}

# End of script
