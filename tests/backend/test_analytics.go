package analytics

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

// Mock interfaces for Analytics service
type MockAnalyticsStorage struct {
	ctrl     *gomock.Controller
	recorder *MockAnalyticsStorageMockRecorder
}

type MockAnalyticsStorageMockRecorder struct {
	mock *MockAnalyticsStorage
}

func NewMockAnalyticsStorage(ctrl *gomock.Controller) *MockAnalyticsStorage {
	mock := &MockAnalyticsStorage{ctrl: ctrl}
	mock.recorder = &MockAnalyticsStorageMockRecorder{mock}
	return mock
}

func (m *MockAnalyticsStorage) EXPECT() *MockAnalyticsStorageMockRecorder {
	return m.recorder
}

func (m *MockAnalyticsStorageMockRecorder) SaveEvent(event Event) *gomock.Call {
	return m.mock.ctrl.RecordCall(m.mock, "SaveEvent", event)
}

func (m *MockAnalyticsStorageMockRecorder) GetMetrics(start, end time.Time, eventType string) ([]Metric, error) {
	return m.mock.ctrl.RecordCallWithMethodType(m.mock, "GetMetrics", reflect.TypeOf((*MockAnalyticsStorage)(nil).GetMetrics), start, end, eventType)
}

// Data structures for analytics
type Event struct {
	UserID    string    `json:"user_id"`
	EventType string    `json:"event_type"`
	Timestamp time.Time `json:"timestamp"`
	Data      string    `json:"data"`
}

type Metric struct {
	EventType string `json:"event_type"`
	Count     int    `json:"count"`
	Date      string `json:"date"`
}

type AnalyticsStorage interface {
	SaveEvent(event Event) error
	GetMetrics(start, end time.Time, eventType string) ([]Metric, error)
}

type AnalyticsHandler struct {
	storage AnalyticsStorage
}

func NewAnalyticsHandler(storage AnalyticsStorage) *AnalyticsHandler {
	return &AnalyticsHandler{storage: storage}
}

func (h *AnalyticsHandler) TrackEvent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var event Event
	if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if event.UserID == "" || event.EventType == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	event.Timestamp = time.Now()
	if err := h.storage.SaveEvent(event); err != nil {
		http.Error(w, "Failed to save event", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func (h *AnalyticsHandler) GetMetricsReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	startStr := r.URL.Query().Get("start")
	endStr := r.URL.Query().Get("end")
	eventType := r.URL.Query().Get("event_type")

	start, err := time.Parse("2006-01-02", startStr)
	if err != nil {
		http.Error(w, "Invalid start date", http.StatusBadRequest)
		return
	}

	end, err := time.Parse("2006-01-02", endStr)
	if err != nil {
		http.Error(w, "Invalid end date", http.StatusBadRequest)
		return
	}

	metrics, err := h.storage.GetMetrics(start, end, eventType)
	if err != nil {
		http.Error(w, "Failed to fetch metrics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// Test suite for Analytics functionality
func TestAnalyticsHandler_TrackEvent_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	mockStorage.EXPECT().SaveEvent(gomock.Any()).Return(nil)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	event := Event{
		UserID:    "user123",
		EventType: "login",
		Data:      "test_data",
	}
	body, _ := json.Marshal(event)

	resp, err := http.Post(server.URL, "application/json", strings.NewReader(string(body)))
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestAnalyticsHandler_TrackEvent_InvalidBody(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	resp, err := http.Post(server.URL, "application/json", strings.NewReader("invalid json"))
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAnalyticsHandler_TrackEvent_MissingFields(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	event := Event{
		UserID:    "",
		EventType: "login",
	}
	body, _ := json.Marshal(event)

	resp, err := http.Post(server.URL, "application/json", strings.NewReader(string(body)))
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAnalyticsHandler_TrackEvent_StorageError(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	mockStorage.EXPECT().SaveEvent(gomock.Any()).Return(assert.AnError)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	event := Event{
		UserID:    "user123",
		EventType: "login",
		Data:      "test_data",
	}
	body, _ := json.Marshal(event)

	resp, err := http.Post(server.URL, "application/json", strings.NewReader(string(body)))
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
}

func TestAnalyticsHandler_TrackEvent_WrongMethod(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	resp, err := http.Get(server.URL)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode)
}

func TestAnalyticsHandler_GetMetricsReport_Success(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC)
	metrics := []Metric{
		{EventType: "login", Count: 100, Date: "2023-01-01"},
		{EventType: "login", Count: 150, Date: "2023-01-02"},
	}
	mockStorage.EXPECT().GetMetrics(start, end, "login").Return(metrics, nil)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	url := server.URL + "?start=2023-01-01&end=2023-12-31&event_type=login"
	resp, err := http.Get(url)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result []Metric
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Equal(t, metrics, result)
}

func TestAnalyticsHandler_GetMetricsReport_InvalidStartDate(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	url := server.URL + "?start=invalid&end=2023-12-31&event_type=login"
	resp, err := http.Get(url)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAnalyticsHandler_GetMetricsReport_InvalidEndDate(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	url := server.URL + "?start=2023-01-01&end=invalid&event_type=login"
	resp, err := http.Get(url)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestAnalyticsHandler_GetMetricsReport_StorageError(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC)
	mockStorage.EXPECT().GetMetrics(start, end, "login").Return(nil, assert.AnError)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	url := server.URL + "?start=2023-01-01&end=2023-12-31&event_type=login"
	resp, err := http.Get(url)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
}

func TestAnalyticsHandler_GetMetricsReport_WrongMethod(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	resp, err := http.Post(server.URL, "application/json", nil)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusMethodNotAllowed, resp.StatusCode)
}

func TestAnalyticsHandler_TrackEvent_ConcurrentRequests(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	mockStorage.EXPECT().SaveEvent(gomock.Any()).Return(nil).Times(10)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.TrackEvent))
	defer server.Close()

	event := Event{
		UserID:    "user123",
		EventType: "login",
		Data:      "test_data",
	}
	body, _ := json.Marshal(event)

	var wg sync.WaitGroup
	requestCount := 10
	wg.Add(requestCount)

	for i := 0; i < requestCount; i++ {
		go func() {
			defer wg.Done()
			resp, err := http.Post(server.URL, "application/json", strings.NewReader(string(body)))
			assert.NoError(t, err)
			defer resp.Body.Close()
			assert.Equal(t, http.StatusOK, resp.StatusCode)
		}()
	}

	wg.Wait()
}

func TestAnalyticsHandler_GetMetricsReport_EmptyResult(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockStorage := NewMockAnalyticsStorage(ctrl)
	start := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2023, 12, 31, 0, 0, 0, 0, time.UTC)
	mockStorage.EXPECT().GetMetrics(start, end, "login").Return([]Metric{}, nil)

	handler := NewAnalyticsHandler(mockStorage)
	server := httptest.NewServer(http.HandlerFunc(handler.GetMetricsReport))
	defer server.Close()

	url := server.URL + "?start=2023-01-01&end=2023-12-31&event_type=login"
	resp, err := http.Get(url)
	assert.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var result []Metric
	json.NewDecoder(resp.Body).Decode(&result)
	assert.Empty(t, result)
}
