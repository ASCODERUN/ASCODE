#!/bin/bash 

# deploy_contract.sh
# Deploy Solana smart contract to a specified network with detailed logging

# Exit on any error to prevent partial deployments
set -e

# Default network to deploy to if not specified
DEFAULT_NETWORK="devnet"

# Default directory for contract artifacts
CONTRACTS_DIR="./contracts"
ARTIFACTS_DIR="$CONTRACTS_DIR/target/deploy"

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
        log_message "\$1 found. Proceeding with deployment checks."
        return 0
    else
        log_message "Error: \$1 not found. Ensure build step is complete before deployment."
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

# Check for required tools before starting the deployment process
check_requirements() {
    log_message "Checking for required deployment tools..."
    for cmd in solana anchor; do
        if ! check_command "$cmd"; then
            log_message "Error: Missing required tool: $cmd. Run setup_env.sh or install manually."
            exit 1
        fi
    done
    log_message "All required tools are installed. Proceeding with deployment setup."
}

# Check Solana configuration and network connectivity
check_solana_config() {
    log_message "Checking Solana CLI configuration..."
    if solana config get &> /dev/null; then
        CURRENT_NETWORK=$(solana config get | grep "RPC URL" | awk '{print \$3}' | grep -oE 'devnet|testnet|mainnet' || echo 'unknown')
        log_message "Current Solana network: $CURRENT_NETWORK"
    else
        log_message "Error: Solana CLI not configured. Run 'solana config set' to configure network and keypair."
        exit 1
    fi

    log_message "Checking Solana keypair..."
    if [ -z "$(solana config get | grep 'Keypair Path')" ]; then
        log_message "Error: No keypair configured for Solana CLI. Set a keypair with 'solana config set --keypair'."
        exit 1
    else
        KEYPAIR_PATH=$(solana config get | grep 'Keypair Path' | awk '{print \$3}')
        log_message "Keypair path: $KEYPAIR_PATH"
        if [ ! -f "$KEYPAIR_PATH" ]; then
            log_message "Error: Keypair file not found at $KEYPAIR_PATH. Ensure the file exists."
            exit 1
        fi
    fi

    log_message "Checking network connectivity for Solana $NETWORK..."
    if solana cluster-version &> /dev/null; then
        log_message "Successfully connected to Solana $NETWORK cluster."
    else
        log_message "Error: Failed to connect to Solana $NETWORK cluster. Check network or RPC URL."
        exit 1
    fi
}

# Set Solana network for deployment
set_network() {
    log_message "Setting Solana network to $NETWORK..."
    case "$NETWORK" in
        "devnet")
            solana config set --url https://api.devnet.solana.com
            ;;
        "testnet")
            solana config set --url https://api.testnet.solana.com
            ;;
        "mainnet")
            solana config set --url https://api.mainnet-beta.solana.com
            ;;
        *)
            log_message "Error: Unsupported network: $NETWORK. Use devnet, testnet, or mainnet."
            exit 1
            ;;
    esac
    log_message "Solana network set to $NETWORK."
}

# Check for contract artifacts before deployment
check_artifacts() {
    log_message "Checking for contract build artifacts..."
    if check_path "$ARTIFACTS_DIR"; then
        if ls "$ARTIFACTS_DIR"/*.so &> /dev/null; then
            log_message "Contract binary (.so) files found in $ARTIFACTS_DIR."
            if [ -f "$CONTRACTS_DIR/Anchor.toml" ]; then
                log_message "Anchor project detected. Will use 'anchor deploy' for deployment."
                DEPLOY_METHOD="anchor"
            else
                log_message "No Anchor.toml found. Will use 'solana program deploy' for deployment."
                DEPLOY_METHOD="solana"
            fi
        else
            log_message "Error: No contract binary (.so) files found in $ARTIFACTS_DIR. Run build script first."
            exit 1
        fi
    else
        log_message "Error: Artifacts directory $ARTIFACTS_DIR not found. Run build script first."
        exit 1
    fi
}

# Deploy using Anchor framework
deploy_with_anchor() {
    log_message "Deploying contract using Anchor to $NETWORK..."
    cd "$CONTRACTS_DIR"
    if anchor deploy --provider.cluster "$NETWORK"; then
        log_message "Contract deployed successfully using Anchor to $NETWORK."
        PROGRAM_ID=$(anchor keys list | grep 'Program Id' | awk '{print \$3}' || echo 'unknown')
        log_message "Deployed Program ID: $PROGRAM_ID"
        log_message "Saving deployment details to deploy_log.txt..."
        echo "Deployment to $NETWORK at $(date '+%Y-%m-%d %H:%M:%S')" >> deploy_log.txt
        echo "Program ID: $PROGRAM_ID" >> deploy_log.txt
        echo "----------------------------------------" >> deploy_log.txt
    else
        log_message "Error: Anchor deployment failed. Check logs above for details."
        exit 1
    fi
    cd ..
}

# Deploy using Solana CLI (fallback for non-Anchor projects)
deploy_with_solana() {
    log_message "Deploying contract using Solana CLI to $NETWORK..."
    CONTRACT_BINARY=$(ls "$ARTIFACTS_DIR"/*.so | head -1)
    if [ -z "$CONTRACT_BINARY" ]; then
        log_message "Error: No contract binary found in $ARTIFACTS_DIR."
        exit 1
    fi
    log_message "Deploying binary: $CONTRACT_BINARY"
    if solana program deploy "$CONTRACT_BINARY"; then
        log_message "Contract deployed successfully using Solana CLI to $NETWORK."
        PROGRAM_ID=$(solana program show --programs | grep "$CONTRACT_BINARY" | awk '{print \$1}' || echo 'unknown')
        log_message "Deployed Program ID: $PROGRAM_ID"
        log_message "Saving deployment details to deploy_log.txt..."
        echo "Deployment to $NETWORK at $(date '+%Y-%m-%d %H:%M:%S')" >> "$CONTRACTS_DIR/deploy_log.txt"
        echo "Program ID: $PROGRAM_ID" >> "$CONTRACTS_DIR/deploy_log.txt"
        echo "Binary: $CONTRACT_BINARY" >> "$CONTRACTS_DIR/deploy_log.txt"
        echo "----------------------------------------" >> "$CONTRACTS_DIR/deploy_log.txt"
    else
        log_message "Error: Solana CLI deployment failed. Check logs above for details."
        exit 1
    fi
}

# Main deployment function
deploy_contract() {
    if [ "$DEPLOY_METHOD" == "anchor" ]; then
        deploy_with_anchor
    else
        deploy_with_solana
    fi
}

# Verify deployment by checking program details (if applicable)
verify_deployment() {
    log_message "Verifying deployment on $NETWORK..."
    if [ -n "$PROGRAM_ID" ] && [ "$PROGRAM_ID" != "unknown" ]; then
        if solana program show "$PROGRAM_ID" &> /dev/null; then
            log_message "Verification successful. Program $PROGRAM_ID is live on $NETWORK."
            solana program show "$PROGRAM_ID"
        else
            log_message "Warning: Could not verify program $PROGRAM_ID. Check manually with 'solana program show'."
        fi
    else
        log_message "Warning: Program ID not available. Skipping verification step."
    fi
}

# Display usage instructions
usage() {
    echo "Usage: \$0 [network]"
    echo "  network: Target network for deployment (devnet, testnet, mainnet). Default: $DEFAULT_NETWORK"
    echo "Example: \$0 devnet"
    echo "Note: Ensure Solana CLI and Anchor are installed, and contract is built before running this script."
}

# Main function to orchestrate the deployment process
main() {
    # Check if network is provided as argument, else use default
    if [ $# -eq 1 ]; then
        NETWORK="\$1"
    else
        NETWORK="$DEFAULT_NETWORK"
    fi

    log_message "Starting Solana contract deployment process to $NETWORK..."
    detect_os
    check_requirements
    check_solana_config
    set_network
    check_artifacts
    deploy_contract
    verify_deployment
    log_message "Deployment process completed successfully!"
    log_message "Next steps:"
    log_message "1. Check deploy_log.txt in $CONTRACTS_DIR for deployment details."
    log_message "2. Use the Program ID for integration with frontend or backend services."
    log_message "3. Test contract functionality on $NETWORK before further actions."
}

# Execute main function with error handling
if [ $# -gt 1 ]; then
    log_message "Error: Too many arguments provided."
    usage
    exit 1
fi

main "$@" || {
    log_message "Error: Deployment process failed. Check logs above for details."
    exit 1
}

# End of script
