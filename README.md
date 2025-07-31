# Mubbit AI

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Web3-green.svg)](https://solana.com/)
[![Status](https://img.shields.io/badge/Status-In%20Development-orange.svg)]()
[![GitHub Issues](https://img.shields.io/github/issues/yourusername/ontora-ai.svg)](https://github.com/yourusername/ontora-ai/issues)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/ontora-ai.svg)](https://github.com/yourusername/ontora-ai/stargazers)

**Mubbit AI** Swarm Agents is an innovative Web3-native decentralized AI swarm network designed to provide efficient and autonomous intelligent decision-making support for users in DeFi, NFT, and DAO sectors through smart contract-driven AI agent collaboration. The platform leverages blockchain technology to ensure data transparency and privacy security, with multiple AI agents working together in a swarm intelligence model to rapidly adapt to complex market environments and handle diverse tasks, from trading optimization to investment analysis. Users can submit task requests via a simple interface, and the system automatically assigns them to the most suitable AI swarm, with results verified on a decentralized network to guarantee accuracy and immutability. Additionally, the platform incentivizes community nodes to contribute computing power through the MUB Token reward mechanism while continuously optimizing AI algorithms to enhance task efficiency. Mubbit AI Swarm Agents not only eliminates trust issues associated with traditional centralized AI but also creates a secure, open, and efficient intelligent service platform for users and developers within the Web3 ecosystem.

[![Website](https://img.shields.io/badge/Website-Visit-blue?logo=google-chrome)](https://mubbitai.com/)
[![Twitter](https://img.shields.io/badge/Twitter-Follow-blue?logo=twitter)](https://x.com/MubbitHub)
[![Twitter](https://img.shields.io/badge/Twitter-Follow-blue?logo=twitter)](https://x.com/BrennanUMNCT)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Follow-blue?logo=linkedin)](https://www.linkedin.com/in/rileybrennan/)

```                                                                                                                                                      
      ___           ___           ___           ___                       ___                    ___           ___           ___     
     /\__\         /\__\         /\  \         /\  \          ___        /\  \                  /\__\         /\__\         /\  \    
    /::|  |       /:/  /        /::\  \       /::\  \        /\  \       \:\  \                /:/  /        /:/  /        /::\  \   
   /:|:|  |      /:/  /        /:/\:\  \     /:/\:\  \       \:\  \       \:\  \              /:/__/        /:/  /        /:/\:\  \  
  /:/|:|__|__   /:/  /  ___   /::\~\:\__\   /::\~\:\__\      /::\__\      /::\  \            /::\  \ ___   /:/  /  ___   /::\~\:\__\ 
 /:/ |::::\__\ /:/__/  /\__\ /:/\:\ \:|__| /:/\:\ \:|__|  __/:/\/__/     /:/\:\__\          /:/\:\  /\__\ /:/__/  /\__\ /:/\:\ \:|__|
 \/__/~~/:/  / \:\  \ /:/  / \:\~\:\/:/  / \:\~\:\/:/  / /\/:/  /       /:/  \/__/          \/__\:\/:/  / \:\  \ /:/  / \:\~\:\/:/  /
       /:/  /   \:\  /:/  /   \:\ \::/  /   \:\ \::/  /  \::/__/       /:/  /                    \::/  /   \:\  /:/  /   \:\ \::/  / 
      /:/  /     \:\/:/  /     \:\/:/  /     \:\/:/  /    \:\__\       \/__/                     /:/  /     \:\/:/  /     \:\/:/  /  
     /:/  /       \::/  /       \::/__/       \::/__/      \/__/                                /:/  /       \::/  /       \::/__/   
     \/__/         \/__/         ~~            ~~                                               \/__/         \/__/         ~~       

```


## Table of Contents

- [Key Features](#key-features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Build and Deploy](#build-and-deploy)
- [Usage](#usage)
  - [Running the Application](#running-the-application)
  - [Creating and Managing AI Agents](#creating-and-managing-ai-agents)
  - [Interacting with the Marketplace](#interacting-with-the-marketplace)
  - [Participating in Governance](#participating-in-governance)
- [Testing](#testing)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [License](#license)
- [Contact](#contact)
- [Acknowledgments](#acknowledgments)

## Key Features

- **Autonomous AI Swarms**: Deploy and manage AI agents locally with user-specific tuning.
- **Behavioral Evolution**: AI agents evolve randomly based on user interactions, creating unique narrative chapters.
- **Solana Integration**: Built on Solana for fast, low-cost transactions and decentralized operations.
- **Web3 Applications**: Support for DeFi, NFT marketplaces, governance, and custom dApps.
- **Local Deployment**: Ensures privacy and control by running AI models on user devices.
- **Community Governance**: Decentralized decision-making with token-based voting mechanisms.
- **Marketplace for AI Agents**: Trade, share, or monetize evolved AI agents and their unique behaviors.

## Architecture

Mubbit AI follows a modular architecture to ensure scalability and maintainability:
- **Frontend**: User interface for interacting with AI agents, marketplace, and governance (React.js).
- **Backend**: API services for handling requests, data storage, and Solana blockchain interactions (Node.js/Express).
- **AI Module**: Local deployment of AI models with training and evolution logic (Python/TensorFlow or PyTorch).
- **Blockchain Layer**: Smart contracts on Solana for governance, marketplace transactions, and tokenomics (Rust/Anchor).
- **Database**: Decentralized or hybrid storage for AI metadata and user data (IPFS or PostgreSQL).
- **Wallet Integration**: Support for Solana-compatible wallets like Phantom and Solflare.

## Getting Started

- Follow these detailed steps to set up and run Mubbit AI on your local machine or deploy it to a server for production use.

### Prerequisites

Ensure you have the following tools and dependencies installed before proceeding:

- Node.js (v16.14.0 or higher) and npm (v7.0.0 or higher) for backend and frontend development.
- Rust (v1.60.0 or higher) and Cargo for Solana smart contract compilation.
- Solana CLI (v1.14.0 or higher) for blockchain interactions and contract deployment.
- Anchor CLI (v0.25.0 or higher) for streamlined Solana smart contract development and testing.
- Git (v2.30.0 or higher) for version control and repository management.
- Docker (v20.10 or higher, optional) for containerized deployment and consistent environments.
- A Solana Wallet such as Phantom, Sollet, or Solflare for testing transactions on devnet or testnet.
- Python (v3.8 or higher, optional) for certain AI model dependencies or scripts.
- Hardware Requirements: Minimum 8GB RAM, 4-core CPU, and 20GB free disk space for local development and AI model training.

### Installation

1. Clone the repository:
- Clone the Hexiem AI repository to your local machine and navigate to the project directory.
```bash
git clone https://github.com/yourusername/Mubbit-ai.git
cd Mubbit-ai
```

2. Install Dependencies:
- Run the provided script to install dependencies for all components (backend, frontend, contracts, and AI modules).
```
./update_dependencies.sh
```
- This script handles installation of npm packages, Rust crates, and any additional libraries required for AI model training.

3. Verify Installation:
- Check that all tools are correctly installed by running:
```
solana --version
anchor --version
node --version
npm --version
```

## Configuration

### Mubbit AI relies on JSON configuration files to manage settings for different environments and components. These files are located in the configs/ directory. Review and modify them as needed for your setup:

- dev.json: Development environment settings with verbose logging and debug mode enabled for easier troubleshooting.
- prod.json: Production environment settings optimized for performance and security, with minimal logging.
- test.json: Testing environment settings with mock services and isolated data to prevent interference with live systems.
- solana_config.json: Solana network configurations, including RPC endpoints and WebSocket URLs for mainnet, testnet, and devnet.
- ai_config.json: AI model settings, including hyperparameters (learning rate, batch size), training schedules, and evolution parameters.
- backend_config.json: Backend API settings, such as port number, database connection strings, and cache configurations.
- frontend_config.json: Frontend DApp settings, including API endpoints, supported wallet providers, and theme options.
- governance_config.json: Governance parameters, such as voting thresholds, proposal submission costs, and quorum requirements.
- marketplace_config.json: Marketplace settings, including transaction fees, listing rules, and supported asset categories.

**Important Security Note**: Do not hardcode sensitive information (e.g., API keys, private keys, database credentials) in configuration files. Use environment variables or a .env file for such data. Example:
```
export DATABASE_URL="postgresql://user:password@localhost:5432/Mubbit_db"
export SOLANA_PRIVATE_KEY="your_private_key_here"
```

**To load environment variables, create a .env file in the root directory or use a tool like dotenv. Refer to the .env.example file for required variables.**

### Build and Deploy
#### 1. Build All Components:
Compile smart contracts, build backend services, and bundle frontend assets using the all-in-one build script.
```
./build_all.sh
```
This script ensures that Rust contracts are compiled to WebAssembly, Node.js backend code is transpiled, and React frontend is bundled for deployment.

#### 2. Deploy Solana Smart Contracts:
Deploy the compiled smart contracts to the desired Solana network (e.g., devnet for testing).
```
./deploy_contract.sh devnet
```
Ensure your Solana wallet is funded with SOL for deployment fees (use solana airdrop 2 on devnet for test funds). The script outputs contract addresses; save these for configuration in solana_config.json.

#### 3. Start Backend Services:
Launch the backend API server to handle off-chain requests and blockchain interactions.
```
./start_backend.sh
```
By default, the backend runs on port 3000 (configurable in backend_config.json). Verify it is running by accessing http://localhost:3000/health for a status check.

#### 4. Start Frontend DApp:
Launch the frontend decentralized application with hot reloading for development.
```
./start_frontend.sh
```
The DApp runs on port 8080 by default (configurable in frontend_config.json). Open http://localhost:8080 in a supported browser to interact with the platform.

#### 5. Optional: Containerized Deployment with Docker:
For consistent environments or production deployment, use Docker to containerize the application.
```
docker-compose up --build
```
Ensure docker-compose.yml is configured with the appropriate environment variables and volume mounts.


## Usage
### Running the Application

- Backend API: Runs on the port specified in backend_config.json (default: 3000). Access endpoints at http://localhost:3000. Refer to the API documentation in /docs/api for available endpoints and request formats.
- Frontend DApp: Runs on the port specified in frontend_config.json (default: 8080). Open http://localhost:8080 in your browser to access the user interface. Connect a Solana wallet (e.g., Phantom) to interact with the blockchain.
- AI Agents: Deploy and train AI models locally by following the detailed guide in /ai/README.md. This includes setting up the environment for machine learning libraries (e.g., TensorFlow, PyTorch) and running training scripts.

### Creating and Managing AI Agents

1. Initialize an AI Agent:
Use the frontend DApp to create a new AI agent by navigating to the “Create Agent” section. Specify initial parameters such as purpose (e.g., trading, governance) and behavioral traits.
2. Local Deployment:
Download the AI model template from the platform and deploy it locally using the instructions in /ai/deployment.md. Ensure your device meets the hardware requirements for training.
3. Training and Evolution:
Train the AI agent with user-specific data or interactions. The model evolves based on hyperparameters defined in ai_config.json, creating unique story chapters viewable in the DApp.
4. Sync with Blockchain:
Periodically sync the AI agent’s metadata (e.g., evolution state, story progress) to the Solana blockchain via the DApp to ensure persistence and verifiability.

### Interacting with the Marketplace

1. Listing an Asset:
Use the “Marketplace” section of the DApp to list AI agents, services, or digital assets for sale. Configure pricing and terms as per marketplace_config.json rules.
2. Purchasing Assets:
Browse available listings, connect your Solana wallet, and complete transactions using SOL or supported tokens. Fees are automatically deducted based on configured rates.
3. Managing Listings:
Update or delist your assets through the DApp interface. Transaction history and ownership records are stored on-chain for transparency.


### Participating in Governance

1. Submit a Proposal:
Navigate to the “Governance” section in the DApp to submit proposals for platform changes (e.g., fee adjustments, feature additions). Pay the proposal cost as defined in governance_config.json.
2. Vote on Proposals:
Review active proposals and cast votes using your governance tokens or staked SOL. Voting power and thresholds are configurable parameters.
3. Monitor Outcomes:
Track proposal status and outcomes on-chain via the DApp or Solana explorers like Solscan or Solana Beach.

### Testing
Run comprehensive test suites across all components (smart contracts, backend, frontend, AI models) with coverage reporting:
```
./run_tests.sh
```
- Smart Contract Tests: Use Anchor’s testing framework to simulate blockchain interactions.
- Backend Tests: Use Jest or Mocha for API endpoint and logic testing.
- Frontend Tests: Use React Testing Library for UI component validation.
- AI Model Tests: Validate model accuracy and evolution logic with predefined datasets.
Test results and coverage reports are saved in /tests/reports for review. For isolated testing, ensure test.json is used as the active configuration.

### Monitoring and Maintenance
- System Health Monitoring:
Monitor CPU, memory, and network usage for backend and local AI training processes.
```
./monitor_system.sh
```
Logs and metrics are saved to /logs for analysis.

- Database Backup:
Perform regular backups of off-chain databases for disaster recovery.
```
./backup_db.sh
```
Backups are stored in /backups with timestamps.

- API Documentation Generation:
Generate up-to-date API documentation from code annotations for developer reference.
```
./generate_docs.sh
```
Documentation is saved in /docs/api and accessible via the backend server if configured.

- Log Rotation and Cleanup:
Automate log rotation and cleanup of temporary files to maintain system performance.
```
./cleanup.sh
```

## Troubleshooting
Encountering issues? Check the following common problems and solutions. For unresolved issues, open a GitHub Issue or join our Discord for support.

#### Solana CLI or Anchor Installation Fails:
- Ensure Rust and Cargo are installed correctly (rustc --version).
- Reinstall Solana CLI with sh -c "$(curl -sSfL https://release.solana.com/stable/install)".
- For Anchor, use --locked flag to avoid dependency mismatches.

#### Smart Contract Deployment Errors:
- Verify your wallet has sufficient SOL for deployment fees (solana balance).
- Check solana_config.json for correct network endpoint.
- Use solana airdrop 2 on devnet for test funds.

#### Backend API Fails to Start:
- Confirm port 3000 (or configured port) is not in use (lsof -i :3000).
- Check logs in /logs/backend.log for specific errors (e.g., database connection issues).
- Ensure environment variables like DATABASE_URL are set.

#### Frontend DApp Not Loading:
- Verify backend API is running and accessible at the configured endpoint.
- Clear browser cache or use incognito mode to avoid stale data.
- Check console errors in browser developer tools for clues.

#### AI Model Training Errors:
- Ensure required libraries (e.g., TensorFlow, PyTorch) are installed (pip list).
- Check hardware compatibility (e.g., GPU support if enabled in ai_config.json).
- Refer to /ai/README.md for environment setup troubleshooting.

#### Network Connectivity Issues:
- Test Solana RPC endpoint connectivity (solana cluster-version).
- Switch to an alternative endpoint in solana_config.json if the default fails.

#### Logs Location: All logs are stored in /logs with timestamps for debugging. Use tail -f /logs/*.log for real-time monitoring.

## Contributing
We warmly welcome contributions from the global community to make Mubbit AI better! Whether you’re a developer, designer, writer, or tester, there are many ways to get involved.

### How to Contribute
1. Fork the Repository:
- Create your own copy of the codebase by forking the repository on GitHub.

2. Create a Feature Branch:
- Work on your changes in a dedicated branch with a descriptive name.
```
git checkout -b feature/your-feature-name
```

3. Make Changes:
- Implement your feature, bug fix, or documentation update. Follow the project’s coding style (refer to /docs/developer-guide.md for guidelines).

4. Commit Changes:
- Write clear, concise commit messages describing your changes.
```
git commit -m "Add feature: your feature description"
```

5. Push to Your Fork:
- Upload your branch to your forked repository.
```
git push origin feature/your-feature-name
```

6. Open a Pull Request:
- Submit a Pull Request (PR) to the main repository’s develop branch (or main if no develop exists). Provide a detailed description of your changes, referencing related issues if applicable.

7. Code Review:
- Address feedback from maintainers during the review process. Make necessary revisions and update your PR.

### Contribution Guidelines

- Coding Standards: Adhere to ESLint rules for JavaScript, Rustfmt for Rust, and ensure all tests pass before submitting a PR.
- Documentation: Update relevant documentation (user guides, API docs) for any new features or changes.
- Testing: Include unit tests or integration tests for new functionality. Ensure existing tests are not broken.
- Commit Messages: Use conventional commits (e.g., feat: add new endpoint, fix: resolve memory leak) for automated changelog generation.
- Scope: Keep PRs focused on a single feature or fix to simplify review.

## Code of Conduct
In the interest of fostering an open and welcoming environment, we expect all contributors to be respectful and considerate of others. By participating in this project, you agree to:

- Be respectful of different viewpoints and experiences.
- Gracefully accept constructive criticism.
- Focus on what is best for the community.
- Show empathy towards other community members.

## License
### This project is licensed under the MIT License, which allows for both commercial and non-commercial use. See the LICENSE file for full details.

## Contact
We’re excited to hear from you! Reach out for questions, suggestions, collaboration opportunities, or support:

- Email: Hi@Mubbitai.com (for formal inquiries or partnerships)
- Twitter: Follow us for updates and announcements at @MubbitHub
- GitHub Issues: Report bugs, request features, or ask questions via GitHub Issues
- Website: Visit https://Mubbitai.com/

## Acknowledgments
The Mubbit AI team extends heartfelt thanks to the following:

- Solana Foundation: For providing a robust, high-performance blockchain infrastructure that powers our platform.
- Web3 and AI Communities: For inspiring innovation and pushing the boundaries of decentralized technology and artificial intelligence.
- Open-Source Contributors: To every developer, tester, and advocate who contributes code, ideas, or feedback to improve Mubbit AI.
- Early Adopters: For believing in our vision and providing invaluable insights during the alpha and beta phases.
- Anchor Framework Team: For simplifying Solana smart contract development with powerful tools and documentation.
- Technology Partners: Libraries and tools like React, Node.js, TensorFlow, and PyTorch that form the backbone of our stack.

