import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`) });

const getEnvVariable = (key, defaultValue = undefined) => {
  const value = process.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value !== undefined ? value : defaultValue;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return false;
};

const parseNumber = (value, defaultValue = 0) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};

const config = {
  environment: getEnvVariable('NODE_ENV', 'development'),
  app: {
    name: getEnvVariable('APP_NAME', 'Ontora AI'),
    version: getEnvVariable('APP_VERSION', '1.0.0'),
    port: parseNumber(getEnvVariable('PORT', '3000')),
  },
  solana: {
    network: getEnvVariable('SOLANA_NETWORK', 'devnet'),
    rpcEndpoint: getEnvVariable('SOLANA_RPC_ENDPOINT', 'https://api.devnet.solana.com'),
    programId: getEnvVariable('SOLANA_PROGRAM_ID', ''),
    commitment: getEnvVariable('SOLANA_COMMITMENT', 'confirmed'),
  },
  wallet: {
    defaultProvider: getEnvVariable('WALLET_PROVIDER', 'phantom'),
    autoConnect: parseBoolean(getEnvVariable('WALLET_AUTO_CONNECT', 'false')),
  },
  api: {
    baseUrl: getEnvVariable('API_BASE_URL', 'http://localhost:5000/api'),
    timeout: parseNumber(getEnvVariable('API_TIMEOUT', '10000')),
    retries: parseNumber(getEnvVariable('API_RETRIES', '3')),
  },
  ai: {
    modelEndpoint: getEnvVariable('AI_MODEL_ENDPOINT', 'http://localhost:8000/predict'),
    apiKey: getEnvVariable('AI_API_KEY', ''),
    maxRetries: parseNumber(getEnvVariable('AI_MAX_RETRIES', '2')),
  },
  logging: {
    level: getEnvVariable('LOG_LEVEL', 'info'),
    enabled: parseBoolean(getEnvVariable('LOG_ENABLED', 'true')),
  },
  frontend: {
    debug: parseBoolean(getEnvVariable('DEBUG_MODE', 'false')),
    theme: getEnvVariable('THEME', 'dark'),
    refreshInterval: parseNumber(getEnvVariable('REFRESH_INTERVAL', '5000')),
  },
  security: {
    jwtSecret: getEnvVariable('JWT_SECRET', 'default-secret-key-for-development-only'),
    sessionTimeout: parseNumber(getEnvVariable('SESSION_TIMEOUT', '3600')),
    corsOrigins: getEnvVariable('CORS_ORIGINS', 'http://localhost:3000').split(','),
  },
};

const validateConfig = () => {
  try {
    if (!config.solana.rpcEndpoint) {
      throw new Error('Solana RPC endpoint must be defined');
    }
    if (config.environment === 'production' && config.security.jwtSecret === 'default-secret-key-for-development-only') {
      throw new Error('JWT secret must be changed in production environment');
    }
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error.message);
    process.exit(1);
  }
};

validateConfig();

export default config;
