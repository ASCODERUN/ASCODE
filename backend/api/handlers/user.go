// user.go
// User management endpoints for registration, login, and profile updates.
// This module provides RESTful API endpoints for handling user-related operations.
// It includes basic security measures like password hashing and JWT for authentication.

package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// User represents the structure of a user entity.
type User struct {
	ID       string    `json:"id"`
	Username string    `json:"username" binding:"required"`
	Email    string    `json:"email" binding:"required,email"`
	Password string    `json:"password" binding:"required"`
	Created  time.Time `json:"created"`
	Updated  time.Time `json:"updated"`
}

// UserProfile represents the structure for user profile updates.
type UserProfile struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
}

// LoginRequest represents the structure for login requests.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// UserStore is a simple in-memory store for users (replace with database in production).
var UserStore = make(map[string]User)

// JWTConfig holds configuration for JWT token generation.
var JWTConfig = struct {
	SecretKey string
	Expiry    time.Duration
}{
	SecretKey: "your-secure-secret-key-here", // Replace with environment variable in production
	Expiry:    24 * time.Hour,
}

// RegisterHandler handles user registration.
func RegisterHandler(c *gin.Context) {
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		logger.Error("Invalid input for registration", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid input data",
			"details": err.Error(),
		})
		return
	}

	// Check if email already exists
	for _, u := range UserStore {
		if strings.EqualFold(u.Email, user.Email) {
			logger.Warn("Registration failed: email already exists", zap.String("email", user.Email))
			c.JSON(http.StatusConflict, gin.H{
				"error": "Email already registered",
			})
			return
		}
	}

	// Generate a unique ID (simplified; use UUID in production)
	idBytes := make([]byte, 16)
	_, err := rand.Read(idBytes)
	if err != nil {
		logger.Error("Failed to generate user ID", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate user ID",
		})
		return
	}
	user.ID = base64.StdEncoding.EncodeToString(idBytes)
	user.Created = time.Now()
	user.Updated = time.Now()

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to process password",
		})
		return
	}
	user.Password = string(hashedPassword)

	// Store the user
	UserStore[user.ID] = user
	logger.Info("User registered successfully", zap.String("user_id", user.ID), zap.String("email", user.Email))

	// Return success response without password
	response := gin.H{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
		"created":  user.Created,
	}
	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"data":    response,
	})
}

// LoginHandler handles user login and issues a JWT token.
func LoginHandler(c *gin.Context) {
	var loginReq LoginRequest
	if err := c.ShouldBindJSON(&loginReq); err != nil {
		logger.Error("Invalid input for login", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid input data",
			"details": err.Error(),
		})
		return
	}

	// Find user by email
	var foundUser User
	userExists := false
	for _, u := range UserStore {
		if strings.EqualFold(u.Email, loginReq.Email) {
			foundUser = u
			userExists = true
			break
		}
	}

	if !userExists {
		logger.Warn("Login failed: user not found", zap.String("email", loginReq.Email))
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// Verify password
	err := bcrypt.CompareHashAndPassword([]byte(foundUser.Password), []byte(loginReq.Password))
	if err != nil {
		logger.Warn("Login failed: incorrect password", zap.String("email", loginReq.Email))
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// Generate JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": foundUser.ID,
		"email":   foundUser.Email,
		"exp":     time.Now().Add(JWTConfig.Expiry).Unix(),
		"iat":     time.Now().Unix(),
	})

	tokenString, err := token.SignedString([]byte(JWTConfig.SecretKey))
	if err != nil {
		logger.Error("Failed to generate JWT token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate authentication token",
		})
		return
	}

	logger.Info("User logged in successfully", zap.String("user_id", foundUser.ID), zap.String("email", foundUser.Email))
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"token":   tokenString,
		"user": gin.H{
			"id":       foundUser.ID,
			"username": foundUser.Username,
			"email":    foundUser.Email,
		},
	})
}

// UpdateProfileHandler handles updates to user profile information.
func UpdateProfileHandler(c *gin.Context) {
	userID := c.GetString("user_id") // Assumes user_id is set by AuthMiddleware
	if userID == "" {
		logger.Error("No user ID found in context for profile update")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized access",
		})
		return
	}

	var profile UserProfile
	if err := c.ShouldBindJSON(&profile); err != nil {
		logger.Error("Invalid input for profile update", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid input data",
			"details": err.Error(),
		})
		return
	}

	// Retrieve user from store
	user, exists := UserStore[userID]
	if !exists {
		logger.Warn("User not found for profile update", zap.String("user_id", userID))
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	// Check if email is already taken by another user
	for id, u := range UserStore {
		if id != userID && strings.EqualFold(u.Email, profile.Email) {
			logger.Warn("Profile update failed: email already exists", zap.String("email", profile.Email))
			c.JSON(http.StatusConflict, gin.H{
				"error": "Email already in use by another account",
			})
			return
		}
	}

	// Update user data
	user.Username = profile.Username
	user.Email = profile.Email
	user.Updated = time.Now()
	UserStore[userID] = user

	logger.Info("User profile updated successfully", zap.String("user_id", userID))
	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"data": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"updated":  user.Updated,
		},
	})
}

// AuthMiddleware verifies JWT tokens and sets user context.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.Warn("Authorization header missing")
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Authorization header required",
			})
			c.Abort()
			return
		}

		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			logger.Warn("Invalid Authorization header format")
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token format",
			})
			c.Abort()
			return
		}

		token, err := jwt.Parse(bearerToken[1], func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(JWTConfig.SecretKey), nil
		})

		if err != nil || !token.Valid {
			logger.Warn("Invalid or expired token", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			logger.Error("Failed to parse token claims")
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token claims",
			})
			c.Abort()
			return
		}

		userID, ok := claims["user_id"].(string)
		if !ok {
			logger.Error("User ID not found in token claims")
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid token data",
			})
			c.Abort()
			return
		}

		// Set user ID in context for downstream handlers
		c.Set("user_id", userID)
		c.Next()
	}
}

// SetupUserRoutes configures the user management endpoints.
func SetupUserRoutes(router *gin.Engine) {
	userGroup := router.Group("/api/users")
	{
		userGroup.POST("/register", RegisterHandler)
		userGroup.POST("/login", LoginHandler)
		userGroup.PUT("/profile", AuthMiddleware(), UpdateProfileHandler)
	}
	logger.Info("User management routes setup completed")
}
