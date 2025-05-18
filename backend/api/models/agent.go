package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite" // Use SQLite for simplicity; replace with PostgreSQL/MySQL in production
	"gorm.io/gorm"
)

// Agent represents the data structure for an AI agent with model metadata and status
type Agent struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"not null;unique" json:"name" binding:"required,min=2,max=100"`
	Description   string    `gorm:"type:text" json:"description"`
	ModelName     string    `gorm:"not null" json:"model_name" binding:"required"` // e.g., "gpt-3.5-turbo", "llama-2"
	ModelVersion  string    `gorm:"not null" json:"model_version" binding:"required"`
	Metadata      string    `gorm:"type:text" json:"metadata"` // JSON string for model-specific metadata (e.g., hyperparameters)
	Status        string    `gorm:"not null;default:'inactive'" json:"status" binding:"oneof=active inactive training error"` // Agent operational status
	CreatedAt     time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	LastActive    time.Time `json:"last_active"`
	OwnerID       uint      `gorm:"not null" json:"owner_id" binding:"required"` // Links to user who owns the agent
	TrainingData  string    `gorm:"type:text" json:"training_data"`             // Path or reference to training dataset
	Performance   float64   `json:"performance"`                                // Metric like accuracy or loss
	DeploymentURL string    `json:"deployment_url"`                             // URL or endpoint where agent is deployed
}

// AgentRequest represents the input structure for creating/updating an agent
type AgentRequest struct {
	Name          string  `json:"name" binding:"required,min=2,max=100"`
	Description   string  `json:"description"`
	ModelName     string  `json:"model_name" binding:"required"`
	ModelVersion  string  `json:"model_version" binding:"required"`
	Metadata      string  `json:"metadata"`
	Status        string  `json:"status" binding:"oneof=active inactive training error"`
	OwnerID       uint    `json:"owner_id" binding:"required"`
	TrainingData  string  `json:"training_data"`
	Performance   float64 `json:"performance"`
	DeploymentURL string  `json:"deployment_url"`
}

// AgentService handles business logic for agent operations
type AgentService struct {
	DB       *gorm.DB
	Logger   *zap.Logger
	Validate *validator.Validate
}

// NewAgentService initializes the agent service with dependencies
func NewAgentService(db *gorm.DB, logger *zap.Logger) *AgentService {
	return &AgentService{
		DB:       db,
		Logger:   logger,
		Validate: validator.New(),
	}
}

// CreateAgent creates a new agent in the database
func (s *AgentService) CreateAgent(agentReq *AgentRequest) (*Agent, error) {
	// Validate input
	if err := s.Validate.Struct(agentReq); err != nil {
		s.Logger.Error("Validation failed for agent creation", zap.Error(err))
		return nil, fmt.Errorf("invalid input: %v", err)
	}

	// Convert request to agent model
	agent := &Agent{
		Name:          agentReq.Name,
		Description:   agentReq.Description,
		ModelName:     agentReq.ModelName,
		ModelVersion:  agentReq.ModelVersion,
		Metadata:      agentReq.Metadata,
		Status:        agentReq.Status,
		OwnerID:       agentReq.OwnerID,
		TrainingData:  agentReq.TrainingData,
		Performance:   agentReq.Performance,
		DeploymentURL: agentReq.DeploymentURL,
	}

	// Save to database
	if err := s.DB.Create(agent).Error; err != nil {
		s.Logger.Error("Failed to create agent in database", zap.Error(err))
		return nil, fmt.Errorf("database error: %v", err)
	}

	s.Logger.Info("Agent created successfully", zap.Uint("agent_id", agent.ID))
	return agent, nil
}

// GetAgent retrieves an agent by ID
func (s *AgentService) GetAgent(id uint) (*Agent, error) {
	var agent Agent
	if err := s.DB.First(&agent, id).Error; err != nil {
		s.Logger.Error("Failed to retrieve agent", zap.Uint("id", id), zap.Error(err))
		return nil, fmt.Errorf("agent not found: %v", err)
	}
	return &agent, nil
}

// UpdateAgent updates an existing agent's details
func (s *AgentService) UpdateAgent(id uint, agentReq *AgentRequest) (*Agent, error) {
	// Validate input
	if err := s.Validate.Struct(agentReq); err != nil {
		s.Logger.Error("Validation failed for agent update", zap.Error(err))
		return nil, fmt.Errorf("invalid input: %v", err)
	}

	// Find agent
	var agent Agent
	if err := s.DB.First(&agent, id).Error; err != nil {
		s.Logger.Error("Failed to find agent for update", zap.Uint("id", id), zap.Error(err))
		return nil, fmt.Errorf("agent not found: %v", err)
	}

	// Update fields
	agent.Name = agentReq.Name
	agent.Description = agentReq.Description
	agent.ModelName = agentReq.ModelName
	agent.ModelVersion = agentReq.ModelVersion
	agent.Metadata = agentReq.Metadata
	agent.Status = agentReq.Status
	agent.TrainingData = agentReq.TrainingData
	agent.Performance = agentReq.Performance
	agent.DeploymentURL = agentReq.DeploymentURL
	agent.LastActive = time.Now()

	// Save to database
	if err := s.DB.Save(&agent).Error; err != nil {
		s.Logger.Error("Failed to update agent in database", zap.Uint("id", id), zap.Error(err))
		return nil, fmt.Errorf("database error: %v", err)
	}

	s.Logger.Info("Agent updated successfully", zap.Uint("agent_id", agent.ID))
	return &agent, nil
}

// DeleteAgent removes an agent from the database
func (s *AgentService) DeleteAgent(id uint) error {
	if err := s.DB.Delete(&Agent{}, id).Error; err != nil {
		s.Logger.Error("Failed to delete agent", zap.Uint("id", id), zap.Error(err))
		return fmt.Errorf("database error: %v", err)
	}
	s.Logger.Info("Agent deleted successfully", zap.Uint("agent_id", id))
	return nil
}

// ListAgents retrieves all agents, optionally filtered by owner
func (s *AgentService) ListAgents(ownerID uint) ([]Agent, error) {
	var agents []Agent
	query := s.DB
	if ownerID > 0 {
		query = query.Where("owner_id = ?", ownerID)
	}
	if err := query.Find(&agents).Error; err != nil {
		s.Logger.Error("Failed to list agents", zap.Error(err))
		return nil, fmt.Errorf("database error: %v", err)
	}
	return agents, nil
}

// AgentHandler handles HTTP requests for agent operations
type AgentHandler struct {
	Service *AgentService
}

// NewAgentHandler initializes the agent handler
func NewAgentHandler(service *AgentService) *AgentHandler {
	return &AgentHandler{Service: service}
}

// CreateAgentHandler handles POST requests to create a new agent
func (h *AgentHandler) CreateAgentHandler(c *gin.Context) {
	var req AgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	agent, err := h.Service.CreateAgent(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, agent)
}

// GetAgentHandler handles GET requests to retrieve an agent by ID
func (h *AgentHandler) GetAgentHandler(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	agent, err := h.Service.GetAgent(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// UpdateAgentHandler handles PUT requests to update an agent
func (h *AgentHandler) UpdateAgentHandler(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	var req AgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	agent, err := h.Service.UpdateAgent(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, agent)
}

// DeleteAgentHandler handles DELETE requests to remove an agent
func (h *AgentHandler) DeleteAgentHandler(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid agent ID"})
		return
	}

	if err := h.Service.DeleteAgent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Agent deleted successfully"})
}

// ListAgentsHandler handles GET requests to list all agents or by owner
func (h *AgentHandler) ListAgentsHandler(c *gin.Context) {
	ownerIDParam := c.Query("owner_id")
	var ownerID uint
	if ownerIDParam != "" {
		if _, err := fmt.Sscanf(ownerIDParam, "%d", &ownerID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid owner ID"})
			return
		}
	}

	agents, err := h.Service.ListAgents(ownerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, agents)
}

// SetupRoutes configures the API endpoints for agent management
func (h *AgentHandler) SetupRoutes(router *gin.Engine) {
	agentGroup := router.Group("/api/agents")
	{
		agentGroup.POST("", h.CreateAgentHandler)
		agentGroup.GET("/:id", h.GetAgentHandler)
		agentGroup.PUT("/:id", h.UpdateAgentHandler)
		agentGroup.DELETE("/:id", h.DeleteAgentHandler)
		agentGroup.GET("", h.ListAgentsHandler)
	}
}

// JWT middleware to protect routes (placeholder; assumes user authentication)
func JWTAuthMiddleware(jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization token required"})
			c.Abort()
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})
		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Initialize database (SQLite for demo; replace with PostgreSQL/MySQL in production)
	db, err := gorm.Open(sqlite.Open("agents.db"), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto-migrate the schema
	if err := db.AutoMigrate(&Agent{}); err != nil {
		logger.Fatal("Failed to migrate database schema", zap.Error(err))
	}

	// Initialize services and handlers
	agentService := NewAgentService(db, logger)
	agentHandler := NewAgentHandler(agentService)

	// Initialize Gin router
	router := gin.Default()

	// JWT key (replace with secure key in production, e.g., from env vars)
	jwtKey := []byte("your_secret_key")

	// Apply JWT middleware to protect routes (optional)
	router.Use(JWTAuthMiddleware(jwtKey))

	// Setup agent routes
	agentHandler.SetupRoutes(router)

	// Start server
	port := ":8081"
	logger.Info("Starting agent management server", zap.String("port", port))
	if err := router.Run(port); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
