// analytics.go
// Analytics endpoints for user and agent performance data.
// This module provides RESTful API endpoints for retrieving performance metrics, trends, and reports for users and AI agents.

package main

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// UserAnalytics represents performance metrics for a user.
type UserAnalytics struct {
	UserID            string    `json:"user_id"`
	TotalTransactions int       `json:"total_transactions"`
	TotalSpent        float64   `json:"total_spent"` // Total SOL or token spent
	SuccessRate       float64   `json:"success_rate"` // Percentage of successful transactions
	LastActive        time.Time `json:"last_active"`
	ActivityTrend     []float64 `json:"activity_trend"` // Daily activity (e.g., transactions per day for last 7 days)
}

// AgentAnalytics represents performance metrics for an AI agent.
type AgentAnalytics struct {
	AgentID          string    `json:"agent_id"`
	UserID           string    `json:"user_id"`
	TotalTasks       int       `json:"total_tasks"`        // Total tasks performed by agent
	SuccessRate      float64   `json:"success_rate"`       // Percentage of successful tasks
	AverageLatency   float64   `json:"average_latency"`    // Average response time in seconds
	Uptime           float64   `json:"uptime"`             // Uptime percentage
	PerformanceTrend []float64 `json:"performance_trend"`  // Performance score over last 7 days
	LastUpdated      time.Time `json:"last_updated"`
}

// AnalyticsService handles analytics-related business logic.
type AnalyticsService struct {
	logger *zap.Logger
	store  map[string]UserAnalytics    // In-memory store for user analytics; replace with database in production
	agentStore map[string]AgentAnalytics // In-memory store for agent analytics; replace with database in production
}

// NewAnalyticsService initializes the analytics service.
func NewAnalyticsService(logger *zap.Logger) *AnalyticsService {
	return &AnalyticsService{
		logger:     logger,
		store:      make(map[string]UserAnalytics),
		agentStore: make(map[string]AgentAnalytics),
	}
}

// populateDemoData populates in-memory stores with sample data for demonstration purposes.
func (s *AnalyticsService) populateDemoData(userID string) {
	// Populate user analytics if not exists
	if _, exists := s.store[userID]; !exists {
		s.store[userID] = UserAnalytics{
			UserID:            userID,
			TotalTransactions: 50,
			TotalSpent:        10.5,
			SuccessRate:       95.0,
			LastActive:        time.Now().Add(-1 * time.Hour),
			ActivityTrend:     []float64{5.0, 7.0, 3.0, 8.0, 6.0, 4.0, 9.0}, // Last 7 days
		}
	}

	// Populate agent analytics if not exists (assuming two agents per user for demo)
	agent1ID := userID + "_agent1"
	agent2ID := userID + "_agent2"
	if _, exists := s.agentStore[agent1ID]; !exists {
		s.agentStore[agent1ID] = AgentAnalytics{
			AgentID:          agent1ID,
			UserID:           userID,
			TotalTasks:       100,
			SuccessRate:      98.0,
			AverageLatency:   0.5,
			Uptime:           99.9,
			PerformanceTrend: []float64{90.0, 92.0, 88.0, 95.0, 93.0, 91.0, 96.0}, // Last 7 days
			LastUpdated:      time.Now(),
		}
	}
	if _, exists := s.agentStore[agent2ID]; !exists {
		s.agentStore[agent2ID] = AgentAnalytics{
			AgentID:          agent2ID,
			UserID:           userID,
			TotalTasks:       80,
			SuccessRate:      90.0,
			AverageLatency:   0.8,
			Uptime:           98.5,
			PerformanceTrend: []float64{85.0, 87.0, 83.0, 88.0, 86.0, 89.0, 90.0}, // Last 7 days
			LastUpdated:      time.Now(),
		}
	}
}

// GetUserAnalytics retrieves performance metrics for the authenticated user.
func (s *AnalyticsService) GetUserAnalytics(c *gin.Context) {
	// Extract user ID from JWT context (set by AuthMiddleware)
	userID, exists := c.Get("user_id")
	if !exists {
		s.logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Populate demo data if not exists (remove in production with real data source)
	s.populateDemoData(userID.(string))

	analytics, found := s.store[userID.(string)]
	if !found {
		s.logger.Warn("No analytics data found for user", zap.String("user_id", userID.(string)))
		c.JSON(http.StatusNotFound, gin.H{"error": "No analytics data available"})
		return
	}

	c.JSON(http.StatusOK, analytics)
}

// GetUserActivityTrend retrieves user activity trend over a specified period.
func (s *AnalyticsService) GetUserActivityTrend(c *gin.Context) {
	// Extract user ID from JWT context
	userID, exists := c.Get("user_id")
	if !exists {
		s.logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Get days parameter for trend period (default to 7 days)
	days := 7
	if d := c.Query("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			days = n
		}
	}

	// Populate demo data if not exists (remove in production)
	s.populateDemoData(userID.(string))

	analytics, found := s.store[userID.(string)]
	if !found {
		s.logger.Warn("No analytics data found for user", zap.String("user_id", userID.(string)))
		c.JSON(http.StatusNotFound, gin.H{"error": "No analytics data available"})
		return
	}

	// Adjust trend data based on requested days (demo logic; replace with real data query)
	trend := analytics.ActivityTrend
	if len(trend) > days {
		trend = trend[len(trend)-days:]
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"trend":   trend,
		"days":    days,
	})
}

// GetAgentAnalytics retrieves performance metrics for a specific AI agent.
func (s *AnalyticsService) GetAgentAnalytics(c *gin.Context) {
	// Extract user ID from JWT context
	userID, exists := c.Get("user_id")
	if !exists {
		s.logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	agentID := c.Param("id")
	if agentID == "" {
		s.logger.Error("Agent ID not provided")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent ID required"})
		return
	}

	// Populate demo data if not exists (remove in production)
	s.populateDemoData(userID.(string))

	analytics, found := s.agentStore[agentID]
	if !found {
		s.logger.Warn("No analytics data found for agent", zap.String("agent_id", agentID))
		c.JSON(http.StatusNotFound, gin.H{"error": "No analytics data available for agent"})
		return
	}

	// Ensure user owns the agent
	if analytics.UserID != userID.(string) {
		s.logger.Error("Unauthorized access to agent analytics", zap.String("agent_id", agentID), zap.String("user_id", userID.(string)))
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, analytics)
}

// GetAllAgentAnalytics retrieves performance metrics for all agents owned by the authenticated user.
func (s *AnalyticsService) GetAllAgentAnalytics(c *gin.Context) {
	// Extract user ID from JWT context
	userID, exists := c.Get("user_id")
	if !exists {
		s.logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Populate demo data if not exists (remove in production)
	s.populateDemoData(userID.(string))

	// Filter agents by user ID
	var userAgents []AgentAnalytics
	for _, analytics := range s.agentStore {
		if analytics.UserID == userID.(string) {
			userAgents = append(userAgents, analytics)
		}
	}

	if len(userAgents) == 0 {
		s.logger.Warn("No agent analytics data found for user", zap.String("user_id", userID.(string)))
		c.JSON(http.StatusNotFound, gin.H{"error": "No agent analytics data available"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agents":  userAgents,
		"total":   len(userAgents),
		"user_id": userID,
	})
}

// GetAgentPerformanceTrend retrieves performance trend for a specific agent over a specified period.
func (s *AnalyticsService) GetAgentPerformanceTrend(c *gin.Context) {
	// Extract user ID from JWT context
	userID, exists := c.Get("user_id")
	if !exists {
		s.logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	agentID := c.Param("id")
	if agentID == "" {
		s.logger.Error("Agent ID not provided")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Agent ID required"})
		return
	}

	// Get days parameter for trend period (default to 7 days)
	days := 7
	if d := c.Query("days"); d != "" {
		if n, err := strconv.Atoi(d); err == nil && n > 0 {
			days = n
		}
	}

	// Populate demo data if not exists (remove in production)
	s.populateDemoData(userID.(string))

	analytics, found := s.agentStore[agentID]
	if !found {
		s.logger.Warn("No analytics data found for agent", zap.String("agent_id", agentID))
		c.JSON(http.StatusNotFound, gin.H{"error": "No analytics data available for agent"})
		return
	}

	// Ensure user owns the agent
	if analytics.UserID != userID.(string) {
		s.logger.Error("Unauthorized access to agent analytics", zap.String("agent_id", agentID), zap.String("user_id", userID.(string)))
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Adjust trend data based on requested days (demo logic; replace with real data query)
	trend := analytics.PerformanceTrend
	if len(trend) > days {
		trend = trend[len(trend)-days:]
	}

	c.JSON(http.StatusOK, gin.H{
		"agent_id": agentID,
		"trend":    trend,
		"days":     days,
	})
}

// SetupAnalyticsRoutes configures the analytics-related API endpoints.
func SetupAnalyticsRoutes(router *gin.RouterGroup, service *AnalyticsService) {
	// Protected routes requiring authentication
	analyticsGroup := router.Group("/analytics")
	analyticsGroup.Use(AuthMiddleware()) // Assumes AuthMiddleware is defined elsewhere (e.g., in user.go)
	{
		// User analytics endpoints
		analyticsGroup.GET("/user", service.GetUserAnalytics)
		analyticsGroup.GET("/user/trend", service.GetUserActivityTrend)

		// Agent analytics endpoints
		analyticsGroup.GET("/agent/:id", service.GetAgentAnalytics)
		analyticsGroup.GET("/agents", service.GetAllAgentAnalytics)
		analyticsGroup.GET("/agent/:id/trend", service.GetAgentPerformanceTrend)
	}
}

// Note: The following is a placeholder for integration into main.go or server setup.
// In your main application, initialize the service and attach routes as follows:
/*
func main() {
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    analyticsService := NewAnalyticsService(logger)
    router := gin.Default()
    api := router.Group("/api/v1")
    SetupAnalyticsRoutes(api, analyticsService)

    router.Run(":8080")
}
*/
