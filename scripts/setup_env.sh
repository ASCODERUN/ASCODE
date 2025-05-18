#!/bin/bash

# setup_env.sh
# Environment setup script for Solana Web3 development (dependencies and tools)

# Exit on any error to prevent partial setups
set -e

# Utility function to log messages with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] \$1"
}

# Utility function to check if a command exists
check_command() {
    if command -v "\$1" &> /dev/null; then
        log_message "\$1 is already installed. Version: $(\$1 --version || \$1 -v || echo 'unknown')"
        return 0
    else
        log_message "\$1 is not installed. Proceeding with installation..."
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

# Install system dependencies based on OS (e.g., build tools, libraries)
install_system_deps() {
    log_message "Installing system dependencies..."
    if [ "$OS" == "linux" ]; then
        # Update package list and install essentials for Ubuntu/Debian
        if command -v apt &> /dev/null; then
            sudo apt update
            sudo apt install -y build-essential curl wget git unzip zip pkg-config libssl-dev
            log_message "System dependencies installed for Linux (Debian/Ubuntu)."
        # For CentOS/RHEL
        elif command -v yum &> /dev/null; then
            sudo yum groupinstall -y "Development Tools"
            sudo yum install -y curl wget git unzip zip openssl-devel
            log_message "System dependencies installed for Linux (CentOS/RHEL)."
        else
            log_message "Unsupported package manager on Linux. Install build tools manually."
            exit 1
        fi
    elif [ "$OS" == "macos" ]; then
        # Install Xcode command line tools if not present
        if ! xcode-select -p &> /dev/null; then
            log_message "Installing Xcode Command Line Tools..."
            xcode-select --install
        else
            log_message "Xcode Command Line Tools already installed."
        fi
        # Install Homebrew if not present
        if ! command -v brew &> /dev/null; then
            log_message "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        else
            log_message "Homebrew already installed."
        fi
        # Install essentials via Homebrew
        brew install curl wget git unzip zip pkg-config openssl
        log_message "System dependencies installed for macOS."
    fi
}

# Install Node.js and npm (required for JavaScript-based Solana interactions)
install_nodejs() {
    log_message "Setting up Node.js and npm..."
    if check_command node; then
        return 0
    fi
    # Use Node Version Manager (nvm) for flexibility
    if ! check_command nvm; then
        log_message "Installing Node Version Manager (nvm)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
        # Load nvm into current shell
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        log_message "nvm installed. Restart terminal or source ~/.bashrc if nvm command is unavailable."
    fi
    # Install latest LTS version of Node.js
    if command -v nvm &> /dev/null; then
        nvm install --lts
        nvm use --lts
        log_message "Node.js and npm installed via nvm."
    else
        log_message "nvm installation failed. Falling back to direct Node.js installation."
        if [ "$OS" == "linux" ]; then
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt install -y nodejs
        elif [ "$OS" == "macos" ]; then
            brew install node
        fi
        log_message "Node.js and npm installed directly."
    fi
    # Verify installation
    node --version
    npm --version
}

# Install Solana CLI tools for blockchain interactions
install_solana_cli() {
    log_message "Setting up Solana CLI..."
    if check_command solana; then
        return 0
    fi
    # Install Solana CLI using the official installer
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.15/install)"
    # Add Solana to PATH if not already added
    if ! command -v solana &> /dev/null; then
        export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
        log_message "Added Solana CLI to PATH. Restart terminal or source ~/.bashrc if solana command is unavailable."
    fi
    # Verify installation
    solana --version
    # Set default cluster to devnet for testing
    solana config set --url https://api.devnet.solana.com
    log_message "Solana CLI installed and configured for devnet."
}

# Install Rust and Cargo (for Solana smart contract development)
install_rust() {
    log_message "Setting up Rust and Cargo..."
    if check_command rustc; then
        return 0
    fi
    # Install Rust using rustup
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # Load Rust environment
    source "$HOME/.cargo/env"
    # Verify installation
    rustc --version
    cargo --version
    # Install Solana-specific Rust tools
    cargo install solana-cli || log_message "Solana CLI already installed via another method."
    cargo install anchor-cli || log_message "Anchor CLI installation skipped (optional for Solana development)."
    log_message "Rust, Cargo, and Solana development tools installed."
}

# Install project-specific npm dependencies (assumes a package.json in the project root)
install_npm_deps() {
    log_message "Installing project-specific npm dependencies..."
    if [ -f "package.json" ]; then
        npm install
        log_message "Project dependencies installed via npm."
    else
        log_message "No package.json found in current directory. Skipping npm dependency installation."
        log_message "Ensure you run this script from the project root or initialize a package.json with 'npm init'."
    fi
}

# Create a .env file template for sensitive configurations
setup_env_file() {
    log_message "Setting up environment file template (.env)..."
    if [ -f ".env" ]; then
        log_message ".env file already exists. Skipping creation to avoid overwriting."
        return 0
    fi
    # Create a basic .env template for Solana projects
    cat << EOF > .env
# Environment variables for Solana Web3 project
SOLANA_PRIVATE_KEY=your_base58_encoded_private_key_here
SOLANA_CLUSTER=devnet
NODE_ENV=development
# Add other project-specific variables below
EOF
    log_message ".env file created. Edit it to add your Solana private key and other configurations."
    log_message "WARNING: Never commit .env to version control. Add it to .gitignore."
}

# Verify all installations and provide summary
verify_setup() {
    log_message "Verifying environment setup..."
    echo "----------------------------------------"
    echo "Environment Setup Summary:"
    echo "----------------------------------------"
    for cmd in node npm solana rustc cargo; do
        if command -v "$cmd" &> /dev/null; then
            echo "$cmd: Installed ($($cmd --version || $cmd -v || echo 'version unknown'))"
        else
            echo "$cmd: NOT INSTALLED (Please install manually if required)"
        fi
    done
    echo "----------------------------------------"
    log_message "Setup verification complete. Check summary above for any missing tools."
}

# Main function to orchestrate the setup process
main() {
    log_message "Starting environment setup for Solana Web3 development..."
    detect_os
    install_system_deps
    install_nodejs
    install_solana_cli
    install_rust
    install_npm_deps
    setup_env_file
    verify_setup
    log_message "Environment setup completed successfully!"
    log_message "Next steps:"
    log_message "1. Edit .env to set your Solana private key (SOLANA_PRIVATE_KEY)."
    log_message "2. Restart terminal or source ~/.bashrc to ensure all tools are in PATH."
    log_message "3. Run 'solana-keygen new' to generate a new keypair if needed."
    log_message "4. Test Solana CLI with 'solana config get' to confirm cluster settings."
}

# Execute main function with error handling
main || {
    log_message "Error: Environment setup failed. Check logs above for details."
    exit 1
}

# End of script
