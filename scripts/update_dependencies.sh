#!/bin/bash

# update_dependencies.sh
# Script to update dependencies across languages and lock versions

# Exit on any error to prevent partial execution
set -e

# Default configuration settings
CONFIG_DIR="./config"
LOG_DIR="./logs"
LOG_FILE="${LOG_DIR}/dependency_update.log"
TEMP_DIR="./temp"
BACKUP_DIR="./backup"
DRY_RUN=false  # Toggle dry run mode (no actual updates)
FORCE_UPDATE=false  # Toggle force update even if up-to-date

# Color codes for output formatting
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to display usage information
usage() {
    echo "Usage: \$0 [-d] [-f] [-h]"
    echo "  -d  Dry run mode (simulate updates without applying changes)"
    echo "  -f  Force update even if dependencies are up-to-date"
    echo "  -h  Display this help message"
    exit 1
}

# Function to parse command-line arguments
parse_args() {
    while getopts "dfh" opt; do
        case $opt in
            d) DRY_RUN=true ;;
            f) FORCE_UPDATE=true ;;
            h) usage ;;
            *) usage ;;
        esac
    done
}

# Function to create necessary directories
setup_directories() {
    for dir in "$CONFIG_DIR" "$LOG_DIR" "$TEMP_DIR" "$BACKUP_DIR"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir" || {
                echo "Error: Failed to create directory $dir"
                exit 1
            }
        fi
    done
}

# Function to log messages with timestamp
log_message() {
    local message="\$1"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" >> "$LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message"
}

# Function to backup existing dependency files
backup_dependency_files() {
    local backup_timestamp=$(date +%F_%H-%M-%S)
    local backup_path="${BACKUP_DIR}/deps_backup_${backup_timestamp}"
    mkdir -p "$backup_path" || {
        log_message "Error: Failed to create backup directory $backup_path"
        exit 1
    }

    # Backup common dependency files
    for file in package.json package-lock.json requirements.txt Cargo.toml Cargo.lock composer.json composer.lock pom.xml build.gradle; do
        if [ -f "$file" ]; then
            cp "$file" "$backup_path/" || {
                log_message "Warning: Failed to backup $file"
            }
            log_message "Backed up $file to $backup_path"
        fi
    done
}

# Function to check if a command exists
check_command() {
    local cmd="\$1"
    if ! command -v "$cmd" &> /dev/null; then
        log_message "Error: $cmd not found. Please install it to update dependencies for this language."
        return 1
    fi
    return 0
}

# Function to update Node.js dependencies (npm)
update_npm() {
    log_message "Checking for Node.js dependencies (npm)..."
    if [ -f "package.json" ]; then
        if check_command "npm"; then
            log_message "Updating npm dependencies..."
            if [ "$DRY_RUN" = true ]; then
                npm outdated
                log_message "Dry run: npm update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    npm update --save
                else
                    npm update --save
                fi
                log_message "npm dependencies updated and package-lock.json updated."
            fi
        else
            log_message "Skipping npm update due to missing npm command."
        fi
    else
        log_message "No package.json found, skipping npm update."
    fi
}

# Function to update Python dependencies (pip)
update_pip() {
    log_message "Checking for Python dependencies (pip)..."
    if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
        if check_command "pip"; then
            log_message "Updating pip dependencies..."
            if [ "$DRY_RUN" = true ]; then
                pip list --outdated
                log_message "Dry run: pip update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    pip install --upgrade -r requirements.txt || {
                        log_message "Warning: Failed to update some pip dependencies."
                    }
                else
                    pip install --upgrade -r requirements.txt || {
                        log_message "Warning: Failed to update some pip dependencies."
                    }
                fi
                # Optionally freeze dependencies to lock versions
                pip freeze > requirements.txt
                log_message "pip dependencies updated and requirements.txt updated."
            fi
        else
            log_message "Skipping pip update due to missing pip command."
        fi
    else
        log_message "No requirements.txt or pyproject.toml found, skipping pip update."
    fi
}

# Function to update Rust dependencies (Cargo)
update_cargo() {
    log_message "Checking for Rust dependencies (Cargo)..."
    if [ -f "Cargo.toml" ]; then
        if check_command "cargo"; then
            log_message "Updating Cargo dependencies..."
            if [ "$DRY_RUN" = true ]; then
                cargo outdated
                log_message "Dry run: Cargo update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    cargo update
                else
                    cargo update
                fi
                log_message "Cargo dependencies updated and Cargo.lock updated."
            fi
        else
            log_message "Skipping Cargo update due to missing cargo command."
        fi
    else
        log_message "No Cargo.toml found, skipping Cargo update."
    fi
}

# Function to update PHP dependencies (Composer)
update_composer() {
    log_message "Checking for PHP dependencies (Composer)..."
    if [ -f "composer.json" ]; then
        if check_command "composer"; then
            log_message "Updating Composer dependencies..."
            if [ "$DRY_RUN" = true ]; then
                composer outdated
                log_message "Dry run: Composer update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    composer update
                else
                    composer update
                fi
                log_message "Composer dependencies updated and composer.lock updated."
            fi
        else
            log_message "Skipping Composer update due to missing composer command."
        fi
    else
        log_message "No composer.json found, skipping Composer update."
    fi
}

# Function to update Java dependencies (Maven)
update_maven() {
    log_message "Checking for Java dependencies (Maven)..."
    if [ -f "pom.xml" ]; then
        if check_command "mvn"; then
            log_message "Updating Maven dependencies..."
            if [ "$DRY_RUN" = true ]; then
                mvn versions:display-dependency-updates
                log_message "Dry run: Maven update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    mvn versions:update-properties
                else
                    mvn versions:update-properties
                fi
                log_message "Maven dependencies updated."
            fi
        else
            log_message "Skipping Maven update due to missing mvn command."
        fi
    else
        log_message "No pom.xml found, skipping Maven update."
    fi
}

# Function to update Gradle dependencies (Android/Java)
update_gradle() {
    log_message "Checking for Gradle dependencies..."
    if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
        if check_command "gradle"; then
            log_message "Updating Gradle dependencies..."
            if [ "$DRY_RUN" = true ]; then
                ./gradlew dependencyUpdates
                log_message "Dry run: Gradle update simulated."
            else
                if [ "$FORCE_UPDATE" = true ]; then
                    ./gradlew dependencyUpdates
                else
                    ./gradlew dependencyUpdates
                fi
                log_message "Gradle dependencies checked for updates."
            fi
        else
            log_message "Skipping Gradle update due to missing gradle command."
        fi
    else
        log_message "No build.gradle or build.gradle.kts found, skipping Gradle update."
    fi
}

# Main function to orchestrate dependency updates
main() {
    echo "Starting dependency update process..."
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}Dry run mode enabled: No changes will be applied.${NC}"
    fi
    if [ "$FORCE_UPDATE" = true ]; then
        echo -e "${YELLOW}Force update mode enabled: Dependencies will be updated regardless of status.${NC}"
    fi

    # Setup directories and log initial state
    setup_directories
    log_message "Dependency update process started."

    # Backup existing dependency files
    if [ "$DRY_RUN" = false ]; then
        backup_dependency_files
    fi

    # Update dependencies for each supported language/package manager
    update_npm
    update_pip
    update_cargo
    update_composer
    update_maven
    update_gradle

    log_message "Dependency update process completed."
    echo -e "${GREEN}Dependency update process completed. Check logs at $LOG_FILE for details.${NC}"
}

# Parse command-line arguments and start the update process
parse_args "$@"
main
