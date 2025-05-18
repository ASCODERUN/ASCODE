package logger

import (
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Global logger instance
var Logger *zap.Logger

// Log file path for persistent storage
const logFilePath = "app.log"

// init initializes the global logger based on environment
func init() {
	var err error
	env := os.Getenv("APP_ENV")
	if env == "production" {
		Logger, err = configureProductionLogger()
	} else {
		Logger, err = configureDevelopmentLogger()
	}

	if err != nil {
		panic(fmt.Sprintf("Failed to initialize logger: %v", err))
	}

	// Ensure logger is properly closed on program exit
	defer Logger.Sync()
}

// configureDevelopmentLogger sets up a logger for development with pretty-printed output
func configureDevelopmentLogger() (*zap.Logger, error) {
	// Console output with development config
	config := zap.NewDevelopmentConfig()
	config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	// Build logger for development
	logger, err := config.Build()
	if err != nil {
		return nil, fmt.Errorf("failed to build development logger: %v", err)
	}

	return logger, nil
}

// configureProductionLogger sets up a logger for production with JSON output and file logging
func configureProductionLogger() (*zap.Logger, error) {
	// Define log level
	logLevel := zapcore.InfoLevel
	if lvl := os.Getenv("LOG_LEVEL"); lvl != "" {
		var level zapcore.Level
		if err := level.UnmarshalText([]byte(lvl)); err == nil {
			logLevel = level
		}
	}

	// Create file output for logs
	file, err := os.OpenFile(logFilePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to open log file: %v", err)
	}

	// Configure encoder for JSON format
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	// Create write syncers for console and file output
	consoleSyncer := zapcore.AddSync(os.Stdout)
	fileSyncer := zapcore.AddSync(file)

	// Combine console and file output
	core := zapcore.NewTee(
		zapcore.NewCore(
			zapcore.NewJSONEncoder(encoderConfig),
			consoleSyncer,
			logLevel,
		),
		zapcore.NewCore(
			zapcore.NewJSONEncoder(encoderConfig),
			fileSyncer,
			logLevel,
		),
	)

	// Build logger with caller and stacktrace for errors
	logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	return logger, nil
}

// LoggerMiddleware is a Gin middleware for logging HTTP requests
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Record start time to calculate latency
		startTime := time.Now()

		// Get client IP address
		clientIP := c.ClientIP()

		// Get request method and path
		method := c.Request.Method
		path := c.Request.URL.Path

		// Process the request
		c.Next()

		// Calculate latency
		latency := time.Since(startTime)

		// Get response status code
		statusCode := c.Writer.Status()

		// Log request details
		Logger.Info("HTTP Request",
			zap.String("method", method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Duration("latency", latency),
			zap.String("client_ip", clientIP),
			zap.String("user_agent", c.Request.UserAgent()),
		)

		// Log errors if any
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				Logger.Error("Request Error",
					zap.String("method", method),
					zap.String("path", path),
					zap.Int("status", statusCode),
					zap.String("error", err.Error()),
					zap.String("client_ip", clientIP),
				)
			}
		}
	}
}

// CustomLogger returns a custom logger instance with additional fields
func CustomLogger(fields ...zap.Field) *zap.Logger {
	return Logger.With(fields...)
}

// Shutdown flushes any buffered logs and closes the logger
func Shutdown() {
	if err := Logger.Sync(); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to sync logger: %v\n", err)
	}
}
