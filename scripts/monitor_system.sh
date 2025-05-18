#!/bin/bash

# monitor_system.sh
# Script to monitor system health, CPU, and memory usage

# Exit on any error to prevent partial execution
set -e

# Default configuration settings
CONFIG_DIR="./config"
LOG_DIR="./logs"
ALERT_LOG="${LOG_DIR}/alerts.log"
STATS_LOG="${LOG_DIR}/stats.log"
TEMP_DIR="./temp"
CPU_THRESHOLD=80  # CPU usage percentage threshold for alerts
MEMORY_THRESHOLD=80  # Memory usage percentage threshold for alerts
CHECK_INTERVAL=60  # Time in seconds between checks
MAX_LOG_SIZE=10485760  # Max log size in bytes (10MB)
EMAIL_ALERTS=false  # Toggle email alerts (requires mailutils or similar)
EMAIL_RECIPIENT=""  # Email address for alerts (set via env or config)
SLACK_WEBHOOK_URL=""  # Slack webhook URL for alerts (set via env or config)

# Color codes for output formatting
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to display usage information
usage() {
    echo "Usage: \$0 [-i interval] [-c cpu_threshold] [-m memory_threshold] [-e email] [-s slack_webhook]"
    echo "  -i  Interval between checks in seconds (default: $CHECK_INTERVAL)"
    echo "  -c  CPU usage threshold percentage for alerts (default: $CPU_THRESHOLD)"
    echo "  -m  Memory usage threshold percentage for alerts (default: $MEMORY_THRESHOLD)"
    echo "  -e  Email recipient for alerts (enables email alerts)"
    echo "  -s  Slack webhook URL for alerts (enables Slack alerts)"
    echo "  -h  Display this help message"
    exit 1
}

# Function to parse command-line arguments
parse_args() {
    while getopts "i:c:m:e:s:h" opt; do
        case $opt in
            i) CHECK_INTERVAL="$OPTARG" ;;
            c) CPU_THRESHOLD="$OPTARG" ;;
            m) MEMORY_THRESHOLD="$OPTARG" ;;
            e) EMAIL_ALERTS=true; EMAIL_RECIPIENT="$OPTARG" ;;
            s) SLACK_WEBHOOK_URL="$OPTARG" ;;
            h) usage ;;
            *) usage ;;
        esac
    done
}

# Function to create necessary directories
setup_directories() {
    for dir in "$CONFIG_DIR" "$LOG_DIR" "$TEMP_DIR"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir" || {
                echo "Error: Failed to create directory $dir"
                exit 1
            }
        fi
    done
}

# Function to rotate logs if they exceed max size
rotate_logs() {
    for log in "$ALERT_LOG" "$STATS_LOG"; do
        if [ -f "$log" ] && [ "$(stat -f %z "$log" 2>/dev/null || stat -c %s "$log" 2>/dev/null)" -gt "$MAX_LOG_SIZE" ]; then
            mv "$log" "${log}.$(date +%F_%H-%M-%S).bak" || {
                echo "Warning: Failed to rotate log $log"
            }
            touch "$log" || {
                echo "Warning: Failed to create new log file $log"
            }
        fi
    done
}

# Function to log messages with timestamp
log_message() {
    local log_file="\$1"
    local message="\$2"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message" >> "$log_file"
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $message"
}

# Function to send email alert (if configured)
send_email_alert() {
    local subject="\$1"
    local message="\$2"
    if [ "$EMAIL_ALERTS" = true ] && [ -n "$EMAIL_RECIPIENT" ]; then
        if command -v mail >/dev/null 2>&1; then
            echo "$message" | mail -s "$subject" "$EMAIL_RECIPIENT" || {
                log_message "$ALERT_LOG" "Warning: Failed to send email alert to $EMAIL_RECIPIENT"
            }
        else
            log_message "$ALERT_LOG" "Warning: 'mail' command not found, email alerts disabled"
        fi
    fi
}

# Function to send Slack alert (if configured)
send_slack_alert() {
    local message="\$1"
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST -H 'Content-type: application/json' --data "{\"text\":\"$message\"}" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || {
            log_message "$ALERT_LOG" "Warning: Failed to send Slack alert"
        }
    fi
}

# Function to get CPU usage percentage
get_cpu_usage() {
    if command -v top >/dev/null 2>&1; then
        # Works on most Linux and macOS systems
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print \$2 + \$4}' | cut -d. -f1)
        echo "$cpu_usage"
    elif command -v mpstat >/dev/null 2>&1; then
        cpu_usage=$(mpstat 1 1 | grep "Average" | awk '{print 100 - $NF}' | cut -d. -f1)
        echo "$cpu_usage"
    else
        echo "Error: No suitable command found to check CPU usage (top or mpstat required)"
        exit 1
    fi
}

# Function to get memory usage percentage
get_memory_usage() {
    if command -v free >/dev/null 2>&1; then
        # Works on Linux
        mem_usage=$(free | grep Mem | awk '{print \$3/\$2 * 100.0}' | cut -d. -f1)
        echo "$mem_usage"
    elif command -v vm_stat >/dev/null 2>&1; then
        # Works on macOS
        total_mem=$(sysctl -n hw.memsize)
        used_mem=$(vm_stat | grep "Pages active" | awk '{print \$3}' | sed 's/\.//')
        page_size=$(vm_stat | grep "page size" | awk '{print \$5}' | sed 's/\.//')
        used_mem_bytes=$((used_mem * page_size))
        mem_usage=$((used_mem_bytes * 100 / total_mem))
        echo "$mem_usage"
    else
        echo "Error: No suitable command found to check memory usage (free or vm_stat required)"
        exit 1
    fi
}

# Function to check disk usage percentage
get_disk_usage() {
    disk_usage=$(df -h / | grep '/' | awk '{print \$5}' | sed 's/%//')
    echo "$disk_usage"
}

# Function to check system uptime
get_uptime() {
    uptime_output=$(uptime | awk '{print \$3 " " \$4 " " \$5}' | sed 's/,//')
    echo "$uptime_output"
}

# Function to monitor system metrics and trigger alerts
monitor_system() {
    local cpu_usage=$(get_cpu_usage)
    local mem_usage=$(get_memory_usage)
    local disk_usage=$(get_disk_usage)
    local uptime=$(get_uptime)

    # Log system stats
    log_message "$STATS_LOG" "CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%, Uptime: $uptime"

    # Check CPU threshold
    if [ "$cpu_usage" -ge "$CPU_THRESHOLD" ]; then
        alert_msg="ALERT: High CPU usage detected: ${cpu_usage}% (Threshold: ${CPU_THRESHOLD}%)"
        log_message "$ALERT_LOG" "$alert_msg"
        echo -e "${RED}$alert_msg${NC}"
        send_email_alert "High CPU Usage Alert" "$alert_msg"
        send_slack_alert "$alert_msg"
    fi

    # Check Memory threshold
    if [ "$mem_usage" -ge "$MEMORY_THRESHOLD" ]; then
        alert_msg="ALERT: High Memory usage detected: ${mem_usage}% (Threshold: ${MEMORY_THRESHOLD}%)"
        log_message "$ALERT_LOG" "$alert_msg"
        echo -e "${RED}$alert_msg${NC}"
        send_email_alert "High Memory Usage Alert" "$alert_msg"
        send_slack_alert "$alert_msg"
    fi

    # Normal status message if no alerts
    if [ "$cpu_usage" -lt "$CPU_THRESHOLD" ] && [ "$mem_usage" -lt "$MEMORY_THRESHOLD" ]; then
        echo -e "${GREEN}System is healthy - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Disk: ${disk_usage}%${NC}"
    fi
}

# Main function to run the monitoring loop
main() {
    echo "Starting system monitoring..."
    echo "CPU Threshold: ${CPU_THRESHOLD}%"
    echo "Memory Threshold: ${MEMORY_THRESHOLD}%"
    echo "Check Interval: ${CHECK_INTERVAL} seconds"
    if [ "$EMAIL_ALERTS" = true ]; then
        echo "Email Alerts: Enabled (Recipient: $EMAIL_RECIPIENT)"
    else
        echo "Email Alerts: Disabled"
    fi
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        echo "Slack Alerts: Enabled"
    else
        echo "Slack Alerts: Disabled"
    fi

    # Setup directories and initial log rotation
    setup_directories
    rotate_logs

    # Trap Ctrl+C to exit gracefully
    trap 'echo -e "\nMonitoring stopped by user"; exit 0' INT

    # Infinite loop to monitor system at specified intervals
    while true; do
        monitor_system
        sleep "$CHECK_INTERVAL"
        rotate_logs
    done
}

# Parse command-line arguments and start monitoring
parse_args "$@"
main
