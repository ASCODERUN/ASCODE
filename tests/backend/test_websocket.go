package websocket

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
)

// Mock interfaces for WebSocket service
type MockWebSocketService struct {
	ctrl     *gomock.Controller
	recorder *MockWebSocketServiceMockRecorder
}

type MockWebSocketServiceMockRecorder struct {
	mock *MockWebSocketService
}

func NewMockWebSocketService(ctrl *gomock.Controller) *MockWebSocketService {
	mock := &MockWebSocketService{ctrl: ctrl}
	mock.recorder = &MockWebSocketServiceMockRecorder{mock}
	return mock
}

func (m *MockWebSocketService) EXPECT() *MockWebSocketServiceMockRecorder {
	return m.recorder
}

func (m *MockWebSocketServiceMockRecorder) HandleMessage(clientID string, message []byte) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "HandleMessage", clientID, message)
}

func (m *MockWebSocketServiceMockRecorder) BroadcastMessage(message []byte) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "BroadcastMessage", message)
}

// WebSocketHandler represents the handler for WebSocket connections
type WebSocketHandler struct {
	service WebSocketService
	clients map[string]*websocket.Conn
	mu      sync.Mutex
}

type WebSocketService interface {
	HandleMessage(clientID string, message []byte) error
	BroadcastMessage(message []byte) error
}

func NewWebSocketHandler(service WebSocketService) *WebSocketHandler {
	return &WebSocketHandler{
		service: service,
		clients: make(map[string]*websocket.Conn),
	}
}

func (h *WebSocketHandler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Failed to upgrade connection", http.StatusInternalServerError)
		return
	}

	clientID := r.URL.Query().Get("client_id")
	if clientID == "" {
		conn.Close()
		return
	}

	h.mu.Lock()
	h.clients[clientID] = conn
	h.mu.Unlock()

	defer func() {
		h.mu.Lock()
		delete(h.clients, clientID)
		h.mu.Unlock()
		conn.Close()
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		if err := h.service.HandleMessage(clientID, message); err != nil {
			break
		}
	}
}

func (h *WebSocketHandler) Broadcast(message []byte) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, conn := range h.clients {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			return err
		}
	}
	return nil
}

// Test suite for WebSocket functionality
func TestWebSocketHandler_Connection_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)

	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=test_client"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)
	handler.mu.Lock()
	assert.NotNil(t, handler.clients["test_client"])
	handler.mu.Unlock()
}

func TestWebSocketHandler_Connection_MissingClientID(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)

	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		conn.Close()
	}
	assert.Error(t, err)
}

func TestWebSocketHandler_ReceiveMessage_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	mockService.EXPECT().HandleMessage("test_client", []byte(`{"message":"test"}`)).Return(nil)

	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=test_client"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err)
	defer conn.Close()

	err = conn.WriteMessage(websocket.TextMessage, []byte(`{"message":"test"}`))
	assert.NoError(t, err)

	time.Sleep(100 * time.Millisecond)
}

func TestWebSocketHandler_ReceiveMessage_Error(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	mockService.EXPECT().HandleMessage("test_client", []byte(`{"message":"test"}`)).Return(assert.AnError)

	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=test_client"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err)
	defer conn.Close()

	err = conn.WriteMessage(websocket.TextMessage, []byte(`{"message":"test"}`))
	assert.NoError(t, err)

	time.Sleep(100 * time.Millisecond)
	handler.mu.Lock()
	assert.Nil(t, handler.clients["test_client"])
	handler.mu.Unlock()
}

func TestWebSocketHandler_Broadcast_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=test_client"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err)
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)
	err = handler.Broadcast([]byte(`{"broadcast":"test"}`))
	assert.NoError(t, err)

	_, data, err := conn.ReadMessage()
	assert.NoError(t, err)
	assert.Equal(t, []byte(`{"broadcast":"test"}`), data)
}

func TestWebSocketHandler_ConcurrentConnections(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	clientCount := 5
	conns := make([]*websocket.Conn, clientCount)
	for i := 0; i < clientCount; i++ {
		wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=client_" + string(rune('0'+i))
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		conns[i] = conn
	}

	time.Sleep(100 * time.Millisecond)
	handler.mu.Lock()
	assert.Equal(t, clientCount, len(handler.clients))
	handler.mu.Unlock()

	for _, conn := range conns {
		conn.Close()
	}
}

func TestWebSocketHandler_PerformanceUnderLoad(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	mockService.EXPECT().HandleMessage(gomock.Any(), gomock.Any()).Return(nil).AnyTimes()

	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	clientCount := 10
	messageCount := 100
	conns := make([]*websocket.Conn, clientCount)

	for i := 0; i < clientCount; i++ {
		wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=client_" + string(rune('0'+i))
		conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
		assert.NoError(t, err)
		conns[i] = conn
	}

	start := time.Now()
	for i := 0; i < messageCount; i++ {
		for _, conn := range conns {
			err := conn.WriteMessage(websocket.TextMessage, []byte(`{"load_test":"message"}`))
			assert.NoError(t, err)
		}
	}
	duration := time.Since(start)

	assert.Less(t, duration, 5*time.Second, "WebSocket performance test exceeded latency threshold")

	for _, conn := range conns {
		conn.Close()
	}
}

func TestWebSocketHandler_ClientDisconnect(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)
	server := httptest.NewServer(http.HandlerFunc(handler.HandleConnection))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "?client_id=test_client"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	assert.NoError(t, err)

	time.Sleep(100 * time.Millisecond)
	handler.mu.Lock()
	assert.NotNil(t, handler.clients["test_client"])
	handler.mu.Unlock()

	conn.Close()
	time.Sleep(100 * time.Millisecond)
	handler.mu.Lock()
	assert.Nil(t, handler.clients["test_client"])
	handler.mu.Unlock()
}

func TestWebSocketHandler_BroadcastWithNoClients(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockService := NewMockWebSocketService(ctrl)
	handler := NewWebSocketHandler(mockService)

	err := handler.Broadcast([]byte(`{"broadcast":"test"}`))
	assert.NoError(t, err)
}
