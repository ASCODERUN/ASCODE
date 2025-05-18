package ratelimit

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiterConfig holds configuration for rate limiting
type RateLimiterConfig struct {
	RequestsPerSecond float64 // Requests per second allowed
	BurstSize         int     // Maximum burst of requests allowed
	ExpirationTime    time.Duration // Time after which inactive limiters are removed
}

// RateLimiterStore manages rate limiters for different clients
type RateLimiterStore struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	config   RateLimiterConfig
}

// Global rate limiter store instance
var limiterStore *RateLimiterStore

// init initializes the global rate limiter store with default or environment-based configuration
func init() {
	// Default configuration
	rps := 10.0 // 10 requests per second
	burst := 20 // Burst size of 20 requests
	expiration := time.Minute * 10 // Remove inactive limiters after 10 minutes

	// Override with environment variables if set
	if rpsEnv := os.Getenv("RATE_LIMIT_RPS"); rpsEnv != "" {
		if val, err := strconv.ParseFloat(rpsEnv, 64); err == nil && val > 0 {
			rps = val
		}
	}
	if burstEnv := os.Getenv("RATE_LIMIT_BURST"); burstEnv != "" {
		if val, err := strconv.Atoi(burstEnv); err == nil && val > 0 {
			burst = val
		}
	}

	// Initialize store with configuration
	limiterStore = &RateLimiterStore{
		limiters: make(map[string]*rate.Limiter),
		config: RateLimiterConfig{
			RequestsPerSecond: rps,
			BurstSize:         burst,
			ExpirationTime:    expiration,
		},
	}

	// Start background cleanup routine to remove expired limiters
	go limiterStore.cleanupRoutine()
}

// getLimiter retrieves or creates a rate limiter for a specific client identifier
func (store *RateLimiterStore) getLimiter(clientID string) *rate.Limiter {
	store.mu.Lock()
	defer store.mu.Unlock()

	limiter, exists := store.limiters[clientID]
	if !exists {
		// Create a new limiter for this client
		limiter = rate.NewLimiter(rate.Limit(store.config.RequestsPerSecond), store.config.BurstSize)
		store.limiters[clientID] = limiter
	}
	return limiter
}

// cleanupRoutine periodically removes inactive rate limiters to prevent memory leaks
func (store *RateLimiterStore) cleanupRoutine() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		store.mu.Lock()
		for clientID, limiter := range store.limiters {
			// Check if the limiter has been inactive for longer than expiration time
			if time.Since(limiter.LastEvent()) > store.config.ExpirationTime {
				delete(store.limiters, clientID)
			}
		}
		store.mu.Unlock()
	}
}

// RateLimitMiddleware is a Gin middleware for enforcing rate limiting per client
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Use client IP as the identifier (can be replaced with user token if authenticated)
		clientID := c.ClientIP()

		// Optionally, if integrated with auth, use user ID or token from context
		// if userID, exists := c.Get("user_id"); exists {
		//     clientID = fmt.Sprintf("user:%v", userID)
		// }

		// Get or create rate limiter for this client
		limiter := limiterStore.getLimiter(clientID)

		// Create a context for rate limiting
		ctx := c.Request.Context()
		if ctx == nil {
			ctx = context.Background()
		}

		// Check if request is allowed within rate limit
		reservation := limiter.Reserve()
		if !reservation.OK() {
			// Rate limit exceeded
			retryAfter := reservation.Delay()
			c.Header("Retry-After", strconv.FormatInt(int64(retryAfter.Seconds()), 10))
			c.Header("X-Rate-Limit-Limit", strconv.FormatFloat(limiterStore.config.RequestsPerSecond, 'f', 2, 64))
			c.Header("X-Rate-Limit-Remaining", "0")
			c.Header("X-Rate-Limit-Reset", strconv.FormatInt(time.Now().Add(retryAfter).Unix(), 10))

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "Rate limit exceeded",
				"message": fmt.Sprintf("Please try again after %v", retryAfter),
			})
			c.Abort()
			return
		}

		// Set rate limit headers for client feedback
		tokens := limiter.Tokens()
		resetTime := time.Now().Add(reservation.DelayFrom(time.Now()))
		c.Header("X-Rate-Limit-Limit", strconv.FormatFloat(limiterStore.config.RequestsPerSecond, 'f', 2, 64))
		c.Header("X-Rate-Limit-Remaining", strconv.FormatFloat(tokens, 'f', 2, 64))
		c.Header("X-Rate-Limit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		// Allow the request to proceed
		c.Next()

		// If the request was canceled or failed, cancel the reservation
		if c.IsAborted() || c.Writer.Status() >= 400 {
			reservation.Cancel()
		}
	}
}

// GetRateLimiterConfig returns the current rate limiter configuration
func GetRateLimiterConfig() RateLimiterConfig {
	return limiterStore.config
}

// UpdateRateLimiterConfig updates the rate limiter configuration dynamically
func UpdateRateLimiterConfig(rps float64, burst int, expiration time.Duration) {
	limiterStore.mu.Lock()
	defer limiterStore.mu.Unlock()

	if rps > 0 {
		limiterStore.config.RequestsPerSecond = rps
	}
	if burst > 0 {
		limiterStore.config.BurstSize = burst
	}
	if expiration > 0 {
		limiterStore.config.ExpirationTime = expiration
	}
}
