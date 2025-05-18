// main.go
// Main API server with middleware for logging, security, and metrics.
// This server uses Gin for routing, Zap for logging, and Prometheus for metrics.
// It includes basic endpoints for health checks and a placeholder for AI inference.

package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Metrics for Prometheus
var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests processed, partitioned by status code and method.",
		},
		[]string{"code", "method"},
	)
	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint"},
	)
)

// Logger instance for the application
var logger *zap.Logger

// InitializeLogger sets up a production-ready logger using Zap.
func InitializeLogger() error {
	config := zap.NewProductionConfig()
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	var err error
	logger, err = config.Build()
	if err != nil {
		return fmt.Errorf("failed to initialize logger: %v", err)
	}
	defer logger.Sync()
	logger.Info("Logger initialized successfully")
	return nil
}

// MetricsMiddleware tracks request count and latency for Prometheus.
func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		method := c.Request.Method
		endpoint := c.Request.URL.Path

		c.Next()

		duration := time.Since(start).Seconds()
		statusCode := fmt.Sprintf("%d", c.Writer.Status())

		httpRequestsTotal.WithLabelValues(statusCode, method).Inc()
		httpRequestDuration.WithLabelValues(method, endpoint).Observe(duration)
	}
}

// SecurityMiddleware adds security headers to responses.
func SecurityMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		c.Next()
	}
}

// LoggingMiddleware logs incoming requests and responses using Zap.
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery
		method := c.Request.Method

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()
		clientIP := c.ClientIP()

		logger.Info("HTTP request processed",
			zap.String("method", method),
			zap.String("path", path),
			zap.String("query", query),
			zap.String("client_ip", clientIP),
			zap.Int("status_code", statusCode),
			zap.Duration("latency", latency),
		)
	}
}

// HealthCheckHandler returns the health status of the server.
func HealthCheckHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"message": "API server is up and running",
		"version": "1.0.0",
	})
}

// InferenceHandler is a placeholder for AI model inference endpoint.
func InferenceHandler(c *gin.Context) {
	// Placeholder for AI inference logic
	c.JSON(http.StatusOK, gin.H{
		"message": "AI inference endpoint - implementation pending",
	})
}

// SetupRouter configures the Gin router with middleware and endpoints.
func SetupRouter() *gin.Engine {
	// Set Gin mode to release for production
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()

	// Add recovery middleware to handle panics
	router.Use(gin.Recovery())

	// Add custom middleware
	router.Use(LoggingMiddleware())
	router.Use(SecurityMiddleware())
	router.Use(MetricsMiddleware())

	// Add CORS middleware for cross-origin requests
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	router.Use(cors.New(corsConfig))

	// Define API routes
	api := router.Group("/api")
	{
		api.GET("/health", HealthCheckHandler)
		api.POST("/inference", InferenceHandler)
	}

	// Expose Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	return router
}

// main function to start the server with graceful shutdown.
func main() {
	// Initialize logger
	if err := InitializeLogger(); err != nil {
		fmt.Fprintf(os.Stderr, "Error initializing logger: %v\n", err)
		os.Exit(1)
	}

	// Register Prometheus metrics
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	logger.Info("Prometheus metrics registered")

	// Setup router with middleware and endpoints
	router := SetupRouter()
	logger.Info("Router and middleware setup completed")

	// Create HTTP server
	srv := &http.Server{
		Addr:         ":8080",
		Handler:      router,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start server in a goroutine for graceful shutdown
	go func() {
		logger.Info("Starting API server on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Server failed to start", zap.Error(err))
		}
	}()

	// Setup graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("Received shutdown signal, initiating graceful shutdown...")

	// Create a deadline for shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Shutdown the server
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", zap.Error(err))
	}

	logger.Info("Server shutdown completed")
}
