#!/bin/bash

# backup_db.sh
# Script to backup database for disaster recovery with encryption

# Exit on any error to prevent partial execution
set -e

# Default environment and configuration settings
DEFAULT_ENV="development"
CONFIG_DIR="./config"
LOG_DIR="./logs"
BACKUP_DIR="./backups"
TEMP_DIR="./temp"
SUPPORTED_DB_TYPES=("postgresql" "mysql" "mongodb")
MAX_CONNECTION_ATTEMPTS=3
CONNECTION_CHECK_INTERVAL=2
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
BACKUP_FILE_PREFIX="db_backup"
ENCRYPTION_ENABLED=true
COMPRESSION_ENABLED=true

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
        log_message "Error: \$1 not found. Ensure the path exists before running backup."
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

# Check for required tools before starting backup
check_requirements() {
    log_message "Checking for required backup and encryption tools..."
    local tools=("tar" "gzip")
    if [ "$ENCRYPTION_ENABLED" = true ]; then
        tools+=("gpg")
    fi

    for tool in "${tools[@]}"; do
        if ! check_command "$tool"; then
            log_message "Error: Required tool $tool is missing. Backup cannot proceed."
            exit 1
        fi
    done

    # Check database-specific tools
    case "$DB_TYPE" in
        "postgresql")
            if ! check_command "pg_dump"; then
                log_message "Error: pg_dump not found. Required for PostgreSQL backup."
                exit 1
            fi
            ;;
        "mysql")
            if ! check_command "mysqldump"; then
                log_message "Error: mysqldump not found. Required for MySQL backup."
                exit 1
            fi
            ;;
        "mongodb")
            if ! check_command "mongodump"; then
                log_message "Error: mongodump not found. Required for MongoDB backup."
                exit 1
            fi
            ;;
        *)
            log_message "Error: Unsupported database type: $DB_TYPE. Supported types: ${SUPPORTED_DB_TYPES[*]}."
            exit 1
            ;;
    esac
    log_message "Required tools check completed for $DB_TYPE backup."
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
        log_message "Warning: Environment file $ENV_FILE not found. Using system environment variables or prompts."
    fi

    # Set default values or prompt for missing critical variables
    : "${DB_TYPE:=$DEFAULT_DB_TYPE}"
    : "${DB_HOST:=$DEFAULT_DB_HOST}"
    : "${DB_PORT:=$DEFAULT_DB_PORT}"
    : "${DB_NAME:=$DEFAULT_DB_NAME}"
    : "${DB_USER:=$DEFAULT_DB_USER}"
    : "${DB_PASSWORD:=$DEFAULT_DB_PASSWORD}"
    : "${GPG_RECIPIENT:=$DEFAULT_GPG_RECIPIENT}"

    if [ -z "$DB_TYPE" ]; then
        log_message "Error: Database type not specified. Set DB_TYPE in environment or .env file."
        exit 1
    fi

    if [ "$ENCRYPTION_ENABLED" = true ] && [ -z "$GPG_RECIPIENT" ]; then
        log_message "Error: GPG recipient not specified for encryption. Set GPG_RECIPIENT in environment or .env file."
        exit 1
    fi

    log_message "Environment variables loaded for $DB_TYPE backup in $ENV environment."
}

# Create necessary directories if they don't exist
setup_directories() {
    log_message "Setting up required directories for backups and logs..."
    for dir in "$CONFIG_DIR" "$LOG_DIR" "$BACKUP_DIR" "$TEMP_DIR"; do
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

# Test database connection before backup
test_db_connection() {
    log_message "Testing database connection for $DB_TYPE at $DB_HOST:$DB_PORT..."
    local attempt=1
    local success=0

    while [ $attempt -le $MAX_CONNECTION_ATTEMPTS ] && [ $success -eq 0 ]; do
        log_message "Connection attempt $attempt of $MAX_CONNECTION_ATTEMPTS..."
        case "$DB_TYPE" in
            "postgresql")
                PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    success=1
                    log_message "PostgreSQL connection successful."
                fi
                ;;
            "mysql")
                mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    success=1
                    log_message "MySQL connection successful."
                fi
                ;;
            "mongodb")
                mongosh --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --password "$DB_PASSWORD" --eval "db.getSiblingDB('$DB_NAME').stats()" > /dev/null 2>&1
                if [ $? -eq 0 ]; then
                    success=1
                    log_message "MongoDB connection successful."
                fi
                ;;
        esac
        if [ $success -eq 0 ]; then
            log_message "Connection failed. Waiting $CONNECTION_CHECK_INTERVAL seconds before retry..."
            sleep $CONNECTION_CHECK_INTERVAL
            ((attempt++))
        fi
    done

    if [ $success -eq 0 ]; then
        log_message "Error: Failed to connect to $DB_TYPE database after $MAX_CONNECTION_ATTEMPTS attempts."
        exit 1
    fi
}

# Perform database backup based on type
perform_backup() {
    local log_file="$LOG_DIR/db-backup-$TIMESTAMP.log"
    local temp_backup_file="$TEMP_DIR/$BACKUP_FILE_PREFIX-$DB_TYPE-$TIMESTAMP.sql"
    local final_backup_file="$BACKUP_DIR/$BACKUP_FILE_PREFIX-$DB_TYPE-$TIMESTAMP"
    log_message "Starting database backup for $DB_TYPE. Logging output to $log_file..."

    case "$DB_TYPE" in
        "postgresql")
            log_message "Running pg_dump for PostgreSQL backup..."
            PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$temp_backup_file" 2>> "$log_file"
            if [ $? -ne 0 ]; then
                log_message "Error: PostgreSQL backup failed. Check $log_file for details."
                return 1
            fi
            ;;
        "mysql")
            log_message "Running mysqldump for MySQL backup..."
            mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" > "$temp_backup_file" 2>> "$log_file"
            if [ $? -ne 0 ]; then
                log_message "Error: MySQL backup failed. Check $log_file for details."
                return 1
            fi
            ;;
        "mongodb")
            log_message "Running mongodump for MongoDB backup..."
            local temp_mongo_dir="$TEMP_DIR/mongo-dump-$TIMESTAMP"
            mkdir -p "$temp_mongo_dir"
            mongodump --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --password "$DB_PASSWORD" --db "$DB_NAME" --archive="$temp_backup_file" 2>> "$log_file"
            if [ $? -ne 0 ]; then
                log_message "Error: MongoDB backup failed. Check $log_file for details."
                return 1
            fi
            ;;
        *)
            log_message "Error: Unsupported database type: $DB_TYPE."
            return 1
            ;;
    esac

    # Compress backup if enabled
    if [ "$COMPRESSION_ENABLED" = true ]; then
        log_message "Compressing backup file..."
        gzip -c "$temp_backup_file" > "$final_backup_file.tar.gz" 2>> "$log_file"
        if [ $? -ne 0 ]; then
            log_message "Error: Compression failed. Check $log_file for details."
            return 1
        fi
        rm -f "$temp_backup_file" 2>/dev/null
        final_backup_file="$final_backup_file.tar.gz"
    else
        mv "$temp_backup_file" "$final_backup_file" 2>> "$log_file"
    fi

    # Encrypt backup if enabled
    if [ "$ENCRYPTION_ENABLED" = true ]; then
        log_message "Encrypting backup file with GPG for recipient $GPG_RECIPIENT..."
        gpg --recipient "$GPG_RECIPIENT" --encrypt --output "$final_backup_file.gpg" "$final_backup_file" 2>> "$log_file"
        if [ $? -ne 0 ]; then
            log_message "Error: Encryption failed. Check $log_file for details."
            return 1
        fi
        rm -f "$final_backup_file" 2>/dev/null
        final_backup_file="$final_backup_file.gpg"
    fi

    log_message "Backup completed successfully. File: $final_backup_file"
    return 0
}

# Clean up old backups if retention policy is defined
cleanup_old_backups() {
    if [ -n "$BACKUP_RETENTION_DAYS" ] && [ "$BACKUP_RETENTION_DAYS" -gt 0 ]; then
        log_message "Cleaning up backups older than $BACKUP_RETENTION_DAYS days in $BACKUP_DIR..."
        find "$BACKUP_DIR" -type f -name "$BACKUP_FILE_PREFIX-$DB_TYPE-*" -mtime +"$BACKUP_RETENTION_DAYS" -exec rm -f {} \; 2>/dev/null
        if [ $? -eq 0 ]; then
            log_message "Old backups cleanup completed."
        else
            log_message "Warning: Failed to clean up old backups. Check permissions."
        fi
    else
        log_message "Backup retention policy not set. Skipping cleanup of old backups."
    fi
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [environment]"
    echo "  environment: Target environment for backup (development, staging, production). Default: $DEFAULT_ENV"
    echo "Example: \$0 development"
    echo "Note: Ensure required tools (e.g., pg_dump, mysqldump, mongodump, gpg) are installed."
    echo "      Set environment variables or use .env files for database credentials and GPG recipient."
}

# Main function to orchestrate the backup process
main() {
    # Check if environment is provided as argument, else use default
    if [ $# -eq 1 ]; then
        ENV="\$1"
    else
        ENV="$DEFAULT_ENV"
    fi

    log_message "Starting database backup process for $ENV environment..."
    detect_os
    load_env_variables
    check_requirements
    setup_directories
    test_db_connection
    perform_backup
    cleanup_old_backups
    log_message "Database backup process completed successfully!"
    log_message "Next steps:"
    log_message "1. Review detailed logs in $LOG_DIR for backup details."
    log_message "2. Verify backup file in $BACKUP_DIR."
    log_message "3. Store the backup securely or transfer it to offsite storage."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Database backup process failed. Check logs above for details."
    exit 1
}

# End of script
