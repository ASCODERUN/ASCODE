package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
)

// Mock interfaces for authentication service and token handler
type MockAuthService struct {
	ctrl     *gomock.Controller
	recorder *MockAuthServiceMockRecorder
}

type MockAuthServiceMockRecorder struct {
	mock *MockAuthService
}

func NewMockAuthService(ctrl *gomock.Controller) *MockAuthService {
	mock := &MockAuthService{ctrl: ctrl}
	mock.recorder = &MockAuthServiceMockRecorder{mock}
	return mock
}

func (m *MockAuthService) EXPECT() *MockAuthServiceMockRecorder {
	return m.recorder
}

func (m *MockAuthServiceMockRecorder) ValidateCredentials(username, password string) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "ValidateCredentials", username, password)
}

func (m *MockAuthServiceMockRecorder) GenerateToken(username string, role string) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "GenerateToken", username, role)
}

func (m *MockAuthServiceMockRecorder) ValidateToken(token string) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "ValidateToken", token)
}

func (m *MockAuthServiceMockRecorder) CheckRole(token, requiredRole string) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "CheckRole", token, requiredRole)
}

// AuthHandler represents the handler for authentication endpoints
type AuthHandler struct {
	service AuthService
}

type AuthService interface {
	ValidateCredentials(username, password string) (bool, string, error)
	GenerateToken(username string, role string) (string, error)
	ValidateToken(token string) (bool, string, error)
	CheckRole(token, requiredRole string) (bool, error)
}

func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var creds struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	isValid, role, err := h.service.ValidateCredentials(creds.Username, creds.Password)
	if err != nil || !isValid {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	token, err := h.service.GenerateToken(creds.Username, role)
	if err != nil {
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	response := map[string]string{"token": token}
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) ProtectedEndpoint(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	if token == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	isValid, username, err := h.service.ValidateToken(token)
	if err != nil || !isValid {
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	isAuthorized, err := h.service.CheckRole(token, "admin")
	if err != nil || !isAuthorized {
		http.Error(w, "Insufficient permissions", http.StatusForbidden)
		return
	}

	response := map[string]string{"message": "Access granted", "user": username}
	json.NewEncoder(w).Encode(response)
}

// Test suite for authentication and authorization
func TestAuthHandler_Login_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateCredentials("testuser", "testpass").Return(true, "user", nil)
	mockService.EXPECT().GenerateToken("testuser", "user").Return("valid_token", nil)

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/login", handler.Login).Methods("POST")

	payload := map[string]string{"username": "testuser", "password": "testpass"}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var response map[string]string
	json.Unmarshal(rr.Body.Bytes(), &response)
	assert.Equal(t, "valid_token", response["token"])
}

func TestAuthHandler_Login_InvalidCredentials(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateCredentials("testuser", "wrongpass").Return(false, "", nil)

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/login", handler.Login).Methods("POST")

	payload := map[string]string{"username": "testuser", "password": "wrongpass"}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	assert.Contains(t, rr.Body.String(), "Invalid credentials")
}

func TestAuthHandler_Login_InvalidPayload(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/login", handler.Login).Methods("POST")

	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusBadRequest, rr.Code)
	assert.Contains(t, rr.Body.String(), "Invalid request payload")
}

func TestAuthHandler_ProtectedEndpoint_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateToken("valid_token").Return(true, "testuser", nil)
	mockService.EXPECT().CheckRole("valid_token", "admin").Return(true, nil)

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/protected", handler.ProtectedEndpoint).Methods("GET")

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "valid_token")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var response map[string]string
	json.Unmarshal(rr.Body.Bytes(), &response)
	assert.Equal(t, "Access granted", response["message"])
	assert.Equal(t, "testuser", response["user"])
}

func TestAuthHandler_ProtectedEndpoint_MissingToken(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/protected", handler.ProtectedEndpoint).Methods("GET")

	req, _ := http.NewRequest("GET", "/protected", nil)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	assert.Contains(t, rr.Body.String(), "Missing token")
}

func TestAuthHandler_ProtectedEndpoint_InvalidToken(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateToken("invalid_token").Return(false, "", nil)

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/protected", handler.ProtectedEndpoint).Methods("GET")

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "invalid_token")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
	assert.Contains(t, rr.Body.String(), "Invalid token")
}

func TestAuthHandler_ProtectedEndpoint_InsufficientRole(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateToken("valid_token").Return(true, "testuser", nil)
	mockService.EXPECT().CheckRole("valid_token", "admin").Return(false, nil)

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/protected", handler.ProtectedEndpoint).Methods("GET")

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "valid_token")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusForbidden, rr.Code)
	assert.Contains(t, rr.Body.String(), "Insufficient permissions")
}

func TestAuthHandler_Login_Performance(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockAuthService(ctrl)
	mockService.EXPECT().ValidateCredentials(gomock.Any(), gomock.Any()).Return(true, "user", nil).AnyTimes()
	mockService.EXPECT().GenerateToken(gomock.Any(), gomock.Any()).Return("valid_token", nil).AnyTimes()

	handler := NewAuthHandler(mockService)
	router := mux.NewRouter()
	router.HandleFunc("/login", handler.Login).Methods("POST")

	payload := map[string]string{"username": "testuser", "password": "testpass"}
	body, _ := json.Marshal(payload)

	start := time.Now()
	for i := 0; i < 100; i++ {
		req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
	}
	duration := time.Since(start)

	assert.Less(t, duration, 2*time.Second, "Login endpoint performance test exceeded latency threshold")
}
