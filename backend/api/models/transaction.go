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
	"gorm.io/driver/sqlite" // Use SQLite for simplicity; replace with PostgreSQL or MySQL in production
	"gorm.io/gorm"
)

// Transaction represents an on-chain transaction record with relevant metadata.
type Transaction struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	TransactionHash string    `gorm:"unique;not null" json:"transaction_hash" binding:"required"`
	SenderAddress   string    `gorm:"not null" json:"sender_address" binding:"required"`
	RecipientAddress string   `gorm:"not null" json:"recipient_address" binding:"required"`
	Amount          float64   `gorm:"not null" json:"amount" binding:"required,gt=0"`
	Currency        string    `gorm:"not null;default:ETH" json:"currency" binding:"required"`
	Status          string    `gorm:"not null;default:pending" json:"status" binding:"required,oneof=pending confirmed failed"`
	BlockNumber     uint64    `json:"block_number"`
	GasUsed         uint64    `json:"gas_used"`
	GasPrice        float64   `json:"gas_price"`
	ChainID         uint64    `gorm:"not null" json:"chain_id" binding:"required"`
	Metadata        string    `json:"metadata"` // JSON string for additional transaction data
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`
	UserID          uint      `gorm:"not null" json:"user_id" binding:"required"` // Links to the user who initiated the transaction
}

// TransactionService handles business logic for transaction operations.
type TransactionService struct {
	DB       *gorm.DB
	Logger   *zap.Logger
	Validate *validator.Validate
}

// NewTransactionService initializes a new transaction service with dependencies.
func NewTransactionService(db *gorm.DB, logger *zap.Logger) *TransactionService {
	return &TransactionService{
		DB:       db,
		Logger:   logger,
		Validate: validator.New(),
	}
}

// CreateTransaction creates a new transaction record in the database.
func (s *TransactionService) CreateTransaction(tx *Transaction) error {
	if err := s.Validate.Struct(tx); err != nil {
		s.Logger.Error("Validation failed for transaction creation", zap.Error(err))
		return fmt.Errorf("validation failed: %v", err)
	}

	if result := s.DB.Create(tx); result.Error != nil {
		s.Logger.Error("Failed to create transaction", zap.Error(result.Error))
		return fmt.Errorf("failed to create transaction: %v", result.Error)
	}

	s.Logger.Info("Transaction created successfully", zap.Uint("id", tx.ID))
	return nil
}

// GetTransaction retrieves a transaction by its ID.
func (s *TransactionService) GetTransaction(id uint) (*Transaction, error) {
	var tx Transaction
	if result := s.DB.First(&tx, id); result.Error != nil {
		s.Logger.Error("Failed to retrieve transaction", zap.Uint("id", id), zap.Error(result.Error))
		return nil, fmt.Errorf("transaction not found: %v", result.Error)
	}
	return &tx, nil
}

// UpdateTransactionStatus updates the status of a transaction.
func (s *TransactionService) UpdateTransactionStatus(id uint, status string) error {
	var tx Transaction
	if result := s.DB.First(&tx, id); result.Error != nil {
		s.Logger.Error("Failed to find transaction for status update", zap.Uint("id", id), zap.Error(result.Error))
		return fmt.Errorf("transaction not found: %v", result.Error)
	}

	// Validate status
	if status != "pending" && status != "confirmed" && status != "failed" {
		err := fmt.Errorf("invalid status: %s", status)
		s.Logger.Error("Invalid status provided", zap.String("status", status))
		return err
	}

	tx.Status = status
	tx.UpdatedAt = time.Now()
	if result := s.DB.Save(&tx); result.Error != nil {
		s.Logger.Error("Failed to update transaction status", zap.Uint("id", id), zap.Error(result.Error))
		return fmt.Errorf("failed to update transaction status: %v", result.Error)
	}

	s.Logger.Info("Transaction status updated", zap.Uint("id", id), zap.String("status", status))
	return nil
}

// ListTransactionsByUser retrieves all transactions for a specific user.
func (s *TransactionService) ListTransactionsByUser(userID uint) ([]Transaction, error) {
	var transactions []Transaction
	if result := s.DB.Where("user_id = ?", userID).Find(&transactions); result.Error != nil {
		s.Logger.Error("Failed to list transactions for user", zap.Uint("user_id", userID), zap.Error(result.Error))
		return nil, fmt.Errorf("failed to list transactions: %v", result.Error)
	}
	return transactions, nil
}

// TransactionHandler handles HTTP requests for transaction operations.
type TransactionHandler struct {
	Service *TransactionService
	Logger  *zap.Logger
}

// NewTransactionHandler initializes a new transaction handler.
func NewTransactionHandler(service *TransactionService, logger *zap.Logger) *TransactionHandler {
	return &TransactionHandler{
		Service: service,
		Logger:  logger,
	}
}

// CreateTransactionHandler handles the creation of a new transaction.
func (h *TransactionHandler) CreateTransactionHandler(c *gin.Context) {
	var tx Transaction
	if err := c.ShouldBindJSON(&tx); err != nil {
		h.Logger.Error("Failed to bind transaction data", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request data"})
		return
	}

	// Extract user ID from JWT token (assuming middleware sets it in context)
	userID, exists := c.Get("user_id")
	if !exists {
		h.Logger.Error("User ID not found in context")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	tx.UserID = userID.(uint)
	if err := h.Service.CreateTransaction(&tx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tx)
}

// GetTransactionHandler retrieves a transaction by ID.
func (h *TransactionHandler) GetTransactionHandler(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		h.Logger.Error("Invalid transaction ID format", zap.String("id", idParam), zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction ID"})
		return
	}

	tx, err := h.Service.GetTransaction(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Ensure the user owns the transaction (basic access control)
	userID, exists := c.Get("user_id")
	if !exists || tx.UserID != userID.(uint) {
		h.Logger.Error("Unauthorized access to transaction", zap.Uint("transaction_id", id))
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	c.JSON(http.StatusOK, tx)
}

// UpdateTransactionStatusHandler updates the status of a transaction.
func (h *TransactionHandler) UpdateTransactionStatusHandler(c *gin.Context) {
	idParam := c.Param("id")
	var id uint
	if _, err := fmt.Sscanf(idParam, "%d", &id); err != nil {
		h.Logger.Error("Invalid transaction ID format", zap.String("id", idParam), zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid transaction ID"})
		return
	}

	var request struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		h.Logger.Error("Failed to bind status update data", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request data"})
		return
	}

	// Ensure the user owns the transaction (basic access control)
	tx, err := h.Service.GetTransaction(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	userID, exists := c.Get("user_id")
	if !exists || tx.UserID != userID.(uint) {
		h.Logger.Error("Unauthorized access to transaction for status update", zap.Uint("transaction_id", id))
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	if err := h.Service.UpdateTransactionStatus(id, request.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "transaction status updated", "status": request.Status})
}

// ListTransactionsByUserHandler lists all transactions for the authenticated user.
func (h *TransactionHandler) ListTransactionsByUserHandler(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		h.Logger.Error("User ID not found in context for listing transactions")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	transactions, err := h.Service.ListTransactionsByUser(userID.(uint))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

// SetupRoutes configures the transaction-related API endpoints.
func (h *TransactionHandler) SetupRoutes(router *gin.RouterGroup) {
	transactions := router.Group("/transactions")
	{
		transactions.POST("", h.CreateTransactionHandler)
		transactions.GET("/:id", h.GetTransactionHandler)
		transactions.PUT("/:id/status", h.UpdateTransactionStatusHandler)
		transactions.GET("/user", h.ListTransactionsByUserHandler)
	}
}

// JWT middleware to authenticate requests (placeholder implementation)
func JWTAuthMiddleware(jwtKey []byte) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization token"})
			c.Abort()
			return
		}

		claims := &jwt.StandardClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Set user_id in context (in production, extract from claims)
		c.Set("user_id", uint(1)) // Hardcoded for demo; replace with claims.Subject or similar
		c.Next()
	}
}

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Initialize database (using SQLite for simplicity)
	db, err := gorm.Open(sqlite.Open("transactions.db"), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer func() {
		if dbInstance, _ := db.DB(); dbInstance != nil {
			_ = dbInstance.Close()
		}
	}()

	// Auto-migrate the Transaction model
	if err := db.AutoMigrate(&Transaction{}); err != nil {
		logger.Fatal("Failed to migrate database schema", zap.Error(err))
	}

	// Initialize services and handlers
	transactionService := NewTransactionService(db, logger)
	transactionHandler := NewTransactionHandler(transactionService, logger)

	// Initialize Gin router
	router := gin.Default()

	// JWT key (replace with secure key in production)
	jwtKey := []byte("my_secret_key")

	// Setup middleware
	router.Use(JWTAuthMiddleware(jwtKey))

	// Setup API routes
	api := router.Group("/api")
	transactionHandler.SetupRoutes(api)

	// Start server
	if err := router.Run(":8080"); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
