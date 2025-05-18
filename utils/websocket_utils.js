import logger from './logging.js';
import { handleError } from './error_handling.js';

class WebSocketError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'WebSocketError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

const defaultConfig = {
  url: process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8080',
  reconnectInterval: 5000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  timeout: 10000,
  autoReconnect: true,
};

let wsInstance = null;
let reconnectAttempts = 0;
let heartbeatTimer = null;
let reconnectTimer = null;
let pendingMessages = [];
let isConnecting = false;

const initializeWebSocket = (config = {}, onMessageCallback, onOpenCallback, onCloseCallback, onErrorCallback) => {
  try {
    const wsConfig = { ...defaultConfig, ...config };
    logger.info('Initializing WebSocket connection', { url: wsConfig.url });

    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      logger.warn('WebSocket already connected', { url: wsConfig.url });
      return wsInstance;
    }

    if (isConnecting) {
      logger.debug('WebSocket connection already in progress', { url: wsConfig.url });
      return wsInstance;
    }

    isConnecting = true;
    wsInstance = new WebSocket(wsConfig.url);

    wsInstance.onopen = (event) => {
      logger.info('WebSocket connection established', { url: wsConfig.url });
      isConnecting = false;
      reconnectAttempts = 0;
      startHeartbeat(wsConfig, wsInstance);
      flushPendingMessages(wsInstance);
      if (onOpenCallback) onOpenCallback(event);
    };

    wsInstance.onmessage = (event) => {
      try {
        const data = parseMessageData(event.data);
        logger.debug('WebSocket message received', { data });
        if (onMessageCallback) onMessageCallback(data, event);
      } catch (error) {
        handleError(
          new WebSocketError('Failed to process WebSocket message', { error: error.message }),
          'WebSocketMessage'
        );
      }
    };

    wsInstance.onclose = (event) => {
      logger.warn('WebSocket connection closed', { code: event.code, reason: event.reason });
      isConnecting = false;
      clearHeartbeat();
      if (wsConfig.autoReconnect && reconnectAttempts < wsConfig.maxReconnectAttempts) {
        scheduleReconnect(wsConfig, onMessageCallback, onOpenCallback, onCloseCallback, onErrorCallback);
      } else {
        logger.error('WebSocket reconnection limit reached or autoReconnect disabled', {
          attempts: reconnectAttempts,
        });
        if (onCloseCallback) onCloseCallback(event);
      }
    };

    wsInstance.onerror = (error) => {
      logger.error('WebSocket error occurred', { error: error.message || 'Unknown error' });
      isConnecting = false;
      if (onErrorCallback) onErrorCallback(error);
      handleError(new WebSocketError('WebSocket connection error', { error: error.message }), 'WebSocketError');
    };

    return wsInstance;
  } catch (error) {
    isConnecting = false;
    throw handleError(
      new WebSocketError('Failed to initialize WebSocket', { error: error.message }),
      'WebSocketInit'
    );
  }
};

function parseMessageData(data) {
  try {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    return data;
  } catch (error) {
    logger.warn('Failed to parse WebSocket message as JSON, returning raw data', { data });
    return data;
  }
}

function startHeartbeat(config, ws) {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
        logger.debug('Heartbeat sent');
      } catch (error) {
        logger.error('Failed to send heartbeat', { error: error.message });
      }
    } else {
      logger.warn('Heartbeat skipped, WebSocket not open', { state: ws.readyState });
      clearHeartbeat();
    }
  }, config.heartbeatInterval);
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function scheduleReconnect(config, onMessage, onOpen, onClose, onError) {
  if (reconnectTimer) {
    return;
  }

  reconnectAttempts += 1;
  const delay = config.reconnectInterval * Math.min(reconnectAttempts, 3);
  logger.info('Scheduling WebSocket reconnection', { attempt: reconnectAttempts, delay });

  reconnectTimer = setTimeout(() => {
    logger.debug('Attempting WebSocket reconnection', { attempt: reconnectAttempts });
    reconnectTimer = null;
    initializeWebSocket(config, onMessage, onOpen, onClose, onError);
  }, delay);
}

function sendMessage(message, priority = false) {
  try {
    if (!wsInstance) {
      throw new WebSocketError('WebSocket not initialized');
    }

    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    if (wsInstance.readyState === WebSocket.OPEN) {
      wsInstance.send(messageStr);
      logger.debug('WebSocket message sent', { message: messageStr });
    } else {
      logger.warn('WebSocket not open, queuing message', { state: wsInstance.readyState });
      if (priority) {
        pendingMessages.unshift(messageStr);
      } else {
        pendingMessages.push(messageStr);
      }
    }
  } catch (error) {
    handleError(
      new WebSocketError('Failed to send WebSocket message', { error: error.message }),
      'WebSocketSend'
    );
  }
}

function flushPendingMessages(ws) {
  if (pendingMessages.length === 0) {
    return;
  }

  logger.info('Flushing pending messages', { count: pendingMessages.length });
  while (pendingMessages.length > 0 && ws.readyState === WebSocket.OPEN) {
    const message = pendingMessages.shift();
    try {
      ws.send(message);
      logger.debug('Pending message sent', { message });
    } catch (error) {
      logger.error('Failed to send pending message', { error: error.message });
      pendingMessages.unshift(message);
      break;
    }
  }
}

function closeWebSocket() {
  try {
    if (wsInstance) {
      logger.info('Closing WebSocket connection');
      clearHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      wsInstance.close();
      wsInstance = null;
      reconnectAttempts = 0;
      isConnecting = false;
    } else {
      logger.warn('No active WebSocket to close');
    }
  } catch (error) {
    handleError(
      new WebSocketError('Failed to close WebSocket', { error: error.message }),
      'WebSocketClose'
    );
  }
}

function getWebSocketState() {
  return wsInstance ? wsInstance.readyState : WebSocket.CLOSED;
}

function subscribeToTopic(topic) {
  sendMessage({ type: 'subscribe', topic }, true);
  logger.info('Subscribed to topic', { topic });
}

function unsubscribeFromTopic(topic) {
  sendMessage({ type: 'unsubscribe', topic }, true);
  logger.info('Unsubscribed from topic', { topic });
}

export {
  initializeWebSocket,
  sendMessage,
  closeWebSocket,
  getWebSocketState,
  subscribeToTopic,
  unsubscribeFromTopic,
};
