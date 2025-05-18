// user.go
// User data structure and endpoints for managing user information.
// This module defines the User model with fields like wallet address and preferences,
// and provides RESTful API endpoints for user registration, login, and profile management.

package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite" // Use SQLite for demo; replace with your DB driver in production
	"gorm.io/gorm"
)

// User represents the data structure for a user in the system.
// It includes fields relevant to Web3 (wallet address) and user customization (preferences).
type User struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Username      string    `gorm:"unique;not null" json:"username" binding:"required"`
	Email         string    `gorm:"unique;not null" json:"email" binding:"required,email"`
	Password      string    `gorm:"not null" json:"-" binding:"required,min=8"`
	WalletAddress string    `gorm:"unique;not null" json:"wallet_address" binding:"required"`
	Preferences   string    `gorm:"type:text" json:"preferences"` // JSON string for user settings
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// UserPreferences represents the structure for user preferences stored as JSON.
type UserPreferences struct {
	Theme          string `json:"theme"`
	Notifications  bool   `json:"notifications"`
	Language       string `json:"language"`
	Timezone       string `json:"timezone"`
	PrivacyLevel   string `json:"privacy_level"`
	DefaultNetwork string `json:"default_network"` // e.g., Solana, Ethereum
}

// UserLoginRequest represents the payload for user login.
type UserLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UserRegisterRequest represents the payload for user registration.
type UserRegisterRequest struct {
	Username      string `json:"username" binding:"required"`
	Email         string `json:"email" binding:"required,email"`
	Password      string `json:"password" binding:"required,min=8"`
	WalletAddress string `json:"wallet_address" binding:"required"`
	Preferences   string `json:"preferences"`
}

// UserUpdateRequest represents the payload for updating user profile.
type UserUpdateRequest struct {
	Username      string `json:"username"`
	Email         string `json:"email" binding:"email"`
	WalletAddress string `json:"wallet_address"`
	Preferences   string `json "¿preferences"`
}

// Global variables for database and logger.
var (
	db     *gorm.DB
	logger *zap.Logger
	jwtKey = []byte("your_secret_key") // Replace with environment variable in production
)

// init sets up the database connection and logger.
func init() {
	var err error
	// Initialize logger
	logger, err = zap.NewProduction()
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer logger.Sync()

	// Initialize database (using SQLite for demo; replace with your DB in production)
	db, err = gorm.Open(sqlite.Open("test.db"), &gorm.Config{})
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}

	// Auto-migrate the User model to create/update the table
	err = db.AutoMigrate(&User{})
	if err != nil {
		logger.Fatal("Failed to migrate database schema", zap.Error(err))
	}
	logger.Info("Database connection and migration completed")
}

// hashPassword hashes a password using bcrypt.
func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// checkPasswordHash compares a password with its hash.
func checkPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// generateJWT generates a JWT token for a user.
func generateJWT(userID uint, email string) (string, error) {
	claims := &jwt.StandardClaims{
		ExpiresAt: time.Now().Add(time.Hour * 24).Unix(),
		IssuedAt:  time.Now().Unix(),
		Subject:   string(rune(userID)),
		Issuer:    "ontora-ai",
		Audience:  email,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

// AuthMiddleware is a middleware to protect routes with JWT authentication.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := c.GetHeader("Authorization")
		if tokenString == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
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

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		userID := claims["sub"].(string)
		c.Set("user_id", userID)
		c.Next()
	}
}

// RegisterUser handles user registration.
func RegisterUser(c *gin.Context) {
	var req UserRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Invalid registration request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
		return
	}

	// Hash the password
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process registration"})
		return
	}

	// Create new user
	user := User{
		Username:      req.Username,
		Email:         req.Email,
		Password:      hashedPassword,
		WalletAddress: req.WalletAddress,
		Preferences:   req.Preferences,
	}

	// Save to database
	if result := db.Create(&user); result.Error != nil {
		logger.Error("Failed to create user", zap.Error(result.Error))
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists or database error"})
		return
	}

	// Generate JWT token
	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		logger.Error("Failed to generate JWT", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	logger.Info("User registered successfully", zap.String("email", user.Email))
	c.JSON(http.StatusCreated, gin.H{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"wallet_address": user.WalletAddress,
		"token":          token,
	})
}

// LoginUser handles user login and returns a JWT token.
func LoginUser(c *gin.Context) {
	var req UserLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Invalid login request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
		return
	}

	var user User
	if result := db.Where("email = ?", req.Email).First(&user); result.Error != nil {
		logger.Error("User not found", zap.String("email", req.Email))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !checkPasswordHash(req.Password, user.Password) {
		logger.Error("Invalid password", zap.String("email", req.Email))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	token, err := generateJWT(user.ID, user.Email)
	if err != nil {
		logger.Error("Failed to generate JWT", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	logger.Info("User logged in successfully", zap.String("email", user.Email))
	c.JSON(http.StatusOK, gin.H{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"wallet_address": user.WalletAddress,
		"token":          token,
	})
}

// GetUserProfile retrieves the profile of the authenticated user.
func GetUserProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	var user User
	if result := db.First(&user, userID); result.Error != nil {
		logger.Error("User not found", zap.String("user_id", userID))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	logger.Info("User profile retrieved", zap.String("user_id", userID))
	c.JSON(http.StatusOK, gin.H{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"wallet_address": user.WalletAddress,
		"preferences":    user.Preferences,
		"created_at":     user.CreatedAt,
		"updated_at":     user.UpdatedAt,
	})
}

// UpdateUserProfile updates the profile of the authenticated user.
func UpdateUserProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	var req UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("Invalid update request", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input data"})
		return
	}

	var user User
	if result := db.First(&user, userID); result.Error != nil {
		logger.Error("User not found", zap.String("user_id", userID))
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Update fields if provided
	if req.Username != "" {
		user.Username = req.Username
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.WalletAddress != "" {
		user.WalletAddress = req.WalletAddress
	}
	if req.Preferences != "" {
		user.Preferences = req.Preferences
	}

	if result := db.Save(&user); result.Error != nil {
		logger.Error("Failed to update user", zap.Error(result.Error))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	logger.Info("User profile updated", zap.String("user_id", userID))
	c.JSON(http.StatusOK, gin.H{
		"id":             user.ID,
		"username":       user.Username,
		"email":          user.Email,
		"wallet_address": user.WalletAddress,
		"preferences":    user.Preferences,
		"updated_at":     user.UpdatedAt,
	})
}

// SetupUserRoutes configures the user-related API endpoints.
func SetupUserRoutes(router *gin.Engine) {
	userGroup := router.Group("/api/users")
	{
		userGroup.POST("/register", RegisterUser)
		userGroup.POST("/login", LoginUser)

		// Protected routes with authentication middleware
		userGroup.GET("/profile", AuthMiddleware(), GetUserProfile)
		userGroup.PUT("/profile", AuthMiddleware(), UpdateUserProfile)
	}
	logger.Info("User routes setup completed")
}

// main is included for standalone testing; in production, integrate with your main.go.
func main() {
	// Initialize Gin router
	router := gin.Default()

	// Setup user routes
	SetupUserRoutes(router)

	// Start the server
	logger.Info("Starting user service on :8080")
	if err := router.Run(":8080"); err != nil {
		logger.Fatal("Failed to start server", zap.Error(err))
	}
}
