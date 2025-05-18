package auth

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// JWT secret key (replace with environment variable in production)
var jwtSecret = []byte(os.Getenv("JWT_SECRET"))

// Token expiration durations
const (
	AccessTokenExpiry  = time.Minute * 15
	RefreshTokenExpiry = time.Hour * 24 * 7
)

// User represents a user entity for authentication
type User struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Password string `json:"password"` // In production, store hashed passwords
}

// Claims represents the JWT claims structure
type Claims struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	jwt.StandardClaims
}

// TokenResponse represents the response structure for token issuance
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
}

// Mock user store (replace with database in production)
var users = map[string]User{
	"testuser": {ID: 1, Username: "testuser", Password: "testpass"},
}

// Logger instance for authentication-related logs
var logger *zap.Logger

func init() {
	var err error
	logger, err = zap.NewProduction()
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
}

// GenerateTokens creates access and refresh tokens for a user
func GenerateTokens(userID uint, username string) (TokenResponse, error) {
	// Generate access token
	accessClaims := Claims{
		UserID:   userID,
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(AccessTokenExpiry).Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "myapp",
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenStr, err := accessToken.SignedString(jwtSecret)
	if err != nil {
		logger.Error("Failed to sign access token", zap.Error(err))
		return TokenResponse{}, err
	}

	// Generate refresh token
	refreshClaims := Claims{
		UserID:   userID,
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: time.Now().Add(RefreshTokenExpiry).Unix(),
			IssuedAt:  time.Now().Unix(),
			Issuer:    "myapp",
		},
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenStr, err := refreshToken.SignedString(jwtSecret)
	if err != nil {
		logger.Error("Failed to sign refresh token", zap.Error(err))
		return TokenResponse{}, err
	}

	return TokenResponse{
		AccessToken:  accessTokenStr,
		RefreshToken: refreshTokenStr,
		ExpiresIn:    accessClaims.ExpiresAt,
	}, nil
}

// AuthMiddleware is a Gin middleware for JWT authentication
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			logger.Warn("Authorization header missing")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Check if the header contains Bearer token
		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 || bearerToken[0] != "Bearer" {
			logger.Warn("Invalid Authorization header format")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Authorization header format"})
			c.Abort()
			return
		}

		// Parse and validate the token
		tokenStr := bearerToken[1]
		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil {
			logger.Error("Failed to parse token", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if !token.Valid {
			logger.Warn("Invalid token provided")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Attach user claims to context for use in handlers
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Next()
	}
}

// LoginHandler handles user login and issues JWT tokens
func LoginHandler(c *gin.Context) {
	var loginData struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&loginData); err != nil {
		logger.Error("Invalid login request payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Validate user credentials (replace with database check in production)
	user, exists := users[loginData.Username]
	if !exists || user.Password != loginData.Password {
		logger.Warn("Invalid login credentials", zap.String("username", loginData.Username))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate tokens
	tokens, err := GenerateTokens(user.ID, user.Username)
	if err != nil {
		logger.Error("Failed to generate tokens", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
		return
	}

	logger.Info("User logged in successfully", zap.String("username", user.Username))
	c.JSON(http.StatusOK, tokens)
}

// RefreshTokenHandler handles token refresh using a valid refresh token
func RefreshTokenHandler(c *gin.Context) {
	var refreshData struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&refreshData); err != nil {
		logger.Error("Invalid refresh token request payload", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Parse and validate refresh token
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(refreshData.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		logger.Error("Invalid refresh token", zap.Error(err))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	// Check if token is expired
	if time.Unix(claims.ExpiresAt, 0).Before(time.Now()) {
		logger.Warn("Expired refresh token", zap.String("username", claims.Username))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Refresh token expired"})
		return
	}

	// Generate new tokens
	newTokens, err := GenerateTokens(claims.UserID, claims.Username)
	if err != nil {
		logger.Error("Failed to generate new tokens", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new tokens"})
		return
	}

	logger.Info("Tokens refreshed successfully", zap.String("username", claims.Username))
	c.JSON(http.StatusOK, newTokens)
}

// SetupAuthRoutes registers authentication-related routes
func SetupAuthRoutes(router *gin.Engine) {
	authGroup := router.Group("/auth")
	{
		authGroup.POST("/login", LoginHandler)
		authGroup.POST("/refresh", RefreshTokenHandler)
	}
}

// GetUserFromContext retrieves user information from the Gin context
func GetUserFromContext(c *gin.Context) (uint, string) {
	userID, _ := c.Get("user_id")
	username, _ := c.Get("username")
	return userID.(uint), username.(string)
}
