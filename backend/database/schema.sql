-- Enable UUID extension for generating unique identifiers (PostgreSQL specific)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table to store user information, including Web3 wallet details
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    wallet_address VARCHAR(100) UNIQUE NOT NULL, -- Solana wallet address
    hashed_password VARCHAR(255), -- Optional for additional auth if needed
    preferences JSONB DEFAULT '{}'::jsonb, -- User-specific settings or habits
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_username CHECK (username ~* '^[A-Za-z0-9_-]{3,50}$')
);

-- Index on wallet_address for fast lookups (common in Web3 auth)
CREATE INDEX idx_users_wallet_address ON users (wallet_address);
-- Index on email for login and search operations
CREATE INDEX idx_users_email ON users (email);
-- Index on is_active for filtering active users
CREATE INDEX idx_users_is_active ON users (is_active);

-- Agents table to store AI agent metadata and status, linked to users
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    model_version VARCHAR(50) NOT NULL, -- Version of the AI model
    status VARCHAR(20) NOT NULL DEFAULT 'inactive', -- e.g., inactive, training, active, error
    metadata JSONB DEFAULT '{}'::jsonb, -- Custom AI model parameters or evolution data
    evolution_chapter INTEGER DEFAULT 1 NOT NULL, -- Tracks story/evolution chapter
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT valid_status CHECK (status IN ('inactive', 'training', 'active', 'error', 'deployed')),
    CONSTRAINT valid_name CHECK (name ~* '^[A-Za-z0-9_-]{1,100}$'),
    CONSTRAINT valid_evolution_chapter CHECK (evolution_chapter >= 1)
);

-- Index on user_id for fast lookups of agents per user
CREATE INDEX idx_agents_user_id ON agents (user_id);
-- Index on status for filtering agents by state
CREATE INDEX idx_agents_status ON agents (status);
-- Index on last_active_at for monitoring agent activity
CREATE INDEX idx_agents_last_active_at ON agents (last_active_at);

-- Transactions table to store on-chain records related to agent operations or payments
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    agent_id INTEGER,
    tx_hash VARCHAR(100) UNIQUE NOT NULL, -- Solana transaction hash
    amount BIGINT NOT NULL DEFAULT 0, -- Transaction amount in smallest unit (e.g., lamports for SOL)
    currency VARCHAR(10) NOT NULL DEFAULT 'SOL', -- Currency type, default to Solana's SOL
    type VARCHAR(20) NOT NULL, -- e.g., deployment, training, payment, refund
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- e.g., pending, confirmed, failed
    block_number BIGINT, -- Block number on Solana blockchain
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional transaction details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    CONSTRAINT valid_type CHECK (type IN ('deployment', 'training', 'payment', 'refund', 'other')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
    CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- Index on user_id for fast lookups of transactions per user
CREATE INDEX idx_transactions_user_id ON transactions (user_id);
-- Index on agent_id for linking transactions to agents
CREATE INDEX idx_transactions_agent_id ON transactions (agent_id);
-- Index on tx_hash for unique transaction lookups
CREATE INDEX idx_transactions_tx_hash ON transactions (tx_hash);
-- Index on status for filtering by transaction status
CREATE INDEX idx_transactions_status ON transactions (status);
-- Index on created_at for time-based queries
CREATE INDEX idx_transactions_created_at ON transactions (created_at);

-- Analytics table to store usage and performance metrics for users and agents
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    agent_id INTEGER,
    event_type VARCHAR(50) NOT NULL, -- e.g., login, agent_training, agent_deployment, error
    event_data JSONB DEFAULT '{}'::jsonb, -- Detailed metrics or event-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    CONSTRAINT valid_event_type CHECK (event_type ~* '^[A-Za-z0-9_-]{1,50}$')
);

-- Index on user_id for fast analytics per user
CREATE INDEX idx_analytics_user_id ON analytics (user_id);
-- Index on agent_id for analytics per agent
CREATE INDEX idx_analytics_agent_id ON analytics (agent_id);
-- Index on event_type for filtering by event type
CREATE INDEX idx_analytics_event_type ON analytics (event_type);
-- Index on created_at for time-based analytics queries
CREATE INDEX idx_analytics_created_at ON analytics (created_at);

-- Function to update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update the updated_at field on row updates for relevant tables
CREATE TRIGGER update_users_timestamp
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_agents_timestamp
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_transactions_timestamp
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
