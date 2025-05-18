import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import config from './config.js';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'grey',
};

winston.addColors(logColors);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.simple(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return stack ? `${timestamp} ${level}: ${message}\n${stack}` : `${timestamp} ${level}: ${message}`;
  })
);

const fileTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: config.logging.level,
  format: logFormat,
});

const errorFileTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: logFormat,
});

const consoleTransport = new winston.transports.Console({
  level: config.logging.level,
  format: consoleFormat,
  handleExceptions: true,
  handleRejections: true,
});

const transports = config.logging.enabled
  ? [fileTransport, errorFileTransport, consoleTransport]
  : [consoleTransport];

const logger = winston.createLogger({
  level: config.logging.level,
  levels: logLevels,
  format: logFormat,
  transports: transports,
  exitOnError: false,
});

const logContext = (context) => {
  return {
    log: (level, message, meta = {}) => logger.log(level, `[${context}] ${message}`, meta),
    error: (message, meta = {}) => logger.error(`[${context}] ${message}`, meta),
    warn: (message, meta = {}) => logger.warn(`[${context}] ${message}`, meta),
    info: (message, meta = {}) => logger.info(`[${context}] ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`[${context}] ${message}`, meta),
    verbose: (message, meta = {}) => logger.verbose(`[${context}] ${message}`, meta),
    http: (message, meta = {}) => logger.http(`[${context}] ${message}`, meta),
  };
};

export default logger;
export { logContext };
