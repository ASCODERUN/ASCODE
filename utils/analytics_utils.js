import logger from './logging.js';
import { handleError } from './error_handling.js'; 

class AnalyticsError extends Error { 
  constructor(message, details = {}) {
    super(message);
    this.name = 'AnalyticsError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const initializeAnalytics = (provider = 'custom', config = {}) => {
  try {
    const analyticsConfig = {
      provider,
      userId: null,
      sessionId: generateSessionId(),
      enabled: process.env.NODE_ENV === 'production' || config.forceEnable || false,
      trackPerformance: config.trackPerformance || true,
      trackBlockchain: config.trackBlockchain || true,
      trackUser: config.trackUser || true,
      endpoint: config.endpoint || '/api/analytics',
      batchSize: config.batchSize || 10,
      flushInterval: config.flushInterval || 5000,
    };

    logger.info('Analytics initialized', { provider, enabled: analyticsConfig.enabled });
    return analyticsConfig;
  } catch (error) {
    throw handleError(new AnalyticsError('Failed to initialize analytics', { error: error.message }), 'AnalyticsInit');
  }
};

function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

const eventsQueue = [];
let flushTimeout = null;

const trackEvent = (analyticsConfig, eventName, properties = {}, category = 'UserAction') => {
  if (!analyticsConfig.enabled) {
    logger.debug('Analytics tracking skipped (disabled)', { eventName });
    return;
  }

  try {
    const eventData = {
      eventName,
      category,
      timestamp: new Date().toISOString(),
      userId: analyticsConfig.userId || 'anonymous',
      sessionId: analyticsConfig.sessionId,
      properties: sanitizeProperties(properties),
      context: getContextData(),
    };

    eventsQueue.push(eventData);
    logger.debug('Event tracked', { eventName, category });

    if (eventsQueue.length >= analyticsConfig.batchSize) {
      flushEvents(analyticsConfig);
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => flushEvents(analyticsConfig), analyticsConfig.flushInterval);
    }
  } catch (error) {
    handleError(new AnalyticsError('Failed to track event', { eventName, error: error.message }), 'TrackEvent');
  }
};

const trackBlockchainEvent = (analyticsConfig, action, details = {}) => {
  if (!analyticsConfig.enabled || !analyticsConfig.trackBlockchain) {
    return;
  }

  const properties = {
    action,
    network: details.network || 'Solana',
    transactionId: details.transactionId || 'N/A',
    status: details.status || 'pending',
    amount: details.amount || 0,
    token: details.token || 'SOL',
    error: details.error || null,
  };

  trackEvent(analyticsConfig, `Blockchain_${action}`, properties, 'Blockchain');
};

const trackPerformance = (analyticsConfig, metricName, duration, details = {}) => {
  if (!analyticsConfig.enabled || !analyticsConfig.trackPerformance) {
    return;
  }

  const properties = {
    duration,
    unit: 'ms',
    metricName,
    details,
  };

  trackEvent(analyticsConfig, `Performance_${metricName}`, properties, 'Performance');
};

const trackPageView = (analyticsConfig, pagePath, referrer = '') => {
  if (!analyticsConfig.enabled) {
    return;
  }

  const properties = {
    path: pagePath,
    referrer,
    userAgent: navigator.userAgent || 'unknown',
  };

  trackEvent(analyticsConfig, 'PageView', properties, 'Navigation');
};

const setUserId = (analyticsConfig, userId) => {
  try {
    analyticsConfig.userId = userId || 'anonymous';
    logger.info('User ID set for analytics', { userId: analyticsConfig.userId });
    trackEvent(analyticsConfig, 'UserIdentified', { userId }, 'User');
  } catch (error) {
    handleError(new AnalyticsError('Failed to set user ID', { error: error.message }), 'SetUserId');
  }
};

function sanitizeProperties(properties) {
  const sanitized = { ...properties };
  const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'privateKey'];

  Object.keys(sanitized).forEach((key) => {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    }
  });

  return sanitized;
}

function getContextData() {
  return {
    app: 'OntoraAI',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    screen: {
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
    },
  };
}

function flushEvents(analyticsConfig) {
  if (eventsQueue.length === 0) {
    return;
  }

  const eventsToSend = [...eventsQueue];
  eventsQueue.length = 0;
  clearTimeout(flushTimeout);
  flushTimeout = null;

  if (analyticsConfig.provider === 'custom') {
    sendEventsToCustomEndpoint(analyticsConfig.endpoint, eventsToSend);
  } else {
    logger.warn('Unsupported analytics provider', { provider: analyticsConfig.provider });
  }
}

function sendEventsToCustomEndpoint(endpoint, events) {
  try {
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ events }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        logger.info('Analytics events sent successfully', { count: events.length });
        return response.json();
      })
      .catch((error) => {
        handleError(
          new AnalyticsError('Failed to send analytics events', { endpoint, error: error.message }),
          'SendEvents'
        );
      });
  } catch (error) {
    handleError(
      new AnalyticsError('Unexpected error sending analytics events', { error: error.message }),
      'SendEvents'
    );
  }
}

export {
  initializeAnalytics,
  trackEvent,
  trackBlockchainEvent,
  trackPerformance,
  trackPageView,
  setUserId,
};
