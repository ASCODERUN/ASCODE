package api

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

// Mock interfaces for database and external services
type MockDatabase struct {
	ctrl     *gomock.Controller
	recorder *MockDatabaseMockRecorder
}

type MockDatabaseMockRecorder struct {
	mock *MockDatabase
}

func NewMockDatabase(ctrl *gomock.Controller) *MockDatabase {
	mock := &MockDatabase{ctrl: ctrl}
	mock.recorder = &MockDatabaseMockRecorder{mock}
	return mock
}

func (m *MockDatabase) EXPECT() *MockDatabaseMockRecorder {
	return m.recorder
}

func (m *MockDatabase) GetUser(userID string) (User, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "GetUser", userID)
	ret0, _ := ret[0].(User)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

func (mr *MockDatabaseMockRecorder) GetUser(userID interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "GetUser", reflect.TypeOf((*MockDatabase)(nil).GetUser), userID)
}

func (m *MockDatabase) SaveModel(model Model) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "SaveModel", model)
	ret0, _ := ret[0].(error)
	return ret0
}

func (mr *MockDatabaseMockRecorder) SaveModel(model interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "SaveModel", reflect.TypeOf((*MockDatabase)(nil).SaveModel), model)
}

type MockExternalService struct {
	ctrl     *gomock.Controller
	recorder *MockExternalServiceMockRecorder
}

type MockExternalServiceMockRecorder struct {
	mock *MockExternalService
}

func NewMockExternalService(ctrl *gomock.Controller) *MockExternalService {
	mock := &MockExternalService{ctrl: ctrl}
	mock.recorder = &MockExternalServiceMockRecorder{mock}
	return mock
}

func (m *MockExternalService) EXPECT() *MockExternalServiceMockRecorder {
	return m.recorder
}

func (m *MockExternalService) FetchData(endpoint string) (string, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "FetchData", endpoint)
	ret0, _ := ret[0].(string)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

func (mr *MockExternalServiceMockRecorder) FetchData(endpoint interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "FetchData", reflect.TypeOf((*MockExternalService)(nil).FetchData), endpoint)
}

// Structs for API request/response
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type Model struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type APIHandler struct {
	db             *MockDatabase
	externalClient *MockExternalService
}

// Handler functions
func (h *APIHandler) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["id"]
	user, err := h.db.GetUser(userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	json.NewEncoder(w).Encode(user)
}

func (h *APIHandler) SaveModelHandler(w http.ResponseWriter, r *http.Request) {
	var model Model
	if err := json.NewDecoder(r.Body).Decode(&model); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if err := h.db.SaveModel(model); err != nil {
		http.Error(w, "Failed to save model", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(model)
}

func (h *APIHandler) FetchExternalDataHandler(w http.ResponseWriter, r *http.Request) {
	data, err := h.externalClient.FetchData("test_endpoint")
	if err != nil {
		http.Error(w, "Failed to fetch external data", http.StatusInternalServerError)
		return
	}
	response := map[string]string{"data": data}
	json.NewEncoder(w).Encode(response)
}

// Test suite
func TestAPIHandlers(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockDB := NewMockDatabase(ctrl)
	mockExternal := NewMockExternalService(ctrl)
	handler := &APIHandler{db: mockDB, externalClient: mockExternal}

	router := mux.NewRouter()
	router.HandleFunc("/user/{id}", handler.GetUserHandler).Methods("GET")
	router.HandleFunc("/model", handler.SaveModelHandler).Methods("POST")
	router.HandleFunc("/external", handler.FetchExternalDataHandler).Methods("GET")

	t.Run("TestGetUser_Success", func(t *testing.T) {
		expectedUser := User{ID: "123", Username: "testuser", Email: "test@example.com"}
		mockDB.EXPECT().GetUser("123").Return(expectedUser, nil)

		req, err := http.NewRequest("GET", "/user/123", nil)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var responseUser User
		err = json.NewDecoder(rr.Body).Decode(&responseUser)
		assert.NoError(t, err)
		assert.Equal(t, expectedUser, responseUser)
	})

	t.Run("TestGetUser_NotFound", func(t *testing.T) {
		mockDB.EXPECT().GetUser("999").Return(User{}, assert.AnError)

		req, err := http.NewRequest("GET", "/user/999", nil)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		assert.Contains(t, rr.Body.String(), "User not found")
	})

	t.Run("TestSaveModel_Success", func(t *testing.T) {
		model := Model{ID: "model1", Name: "TestModel", CreatedAt: time.Now()}
		mockDB.EXPECT().SaveModel(model).Return(nil)

		body, err := json.Marshal(model)
		assert.NoError(t, err)

		req, err := http.NewRequest("POST", "/model", bytes.NewBuffer(body))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusCreated, rr.Code)
		var responseModel Model
		err = json.NewDecoder(rr.Body).Decode(&responseModel)
		assert.NoError(t, err)
		assert.Equal(t, model.ID, responseModel.ID)
		assert.Equal(t, model.Name, responseModel.Name)
	})

	t.Run("TestSaveModel_InvalidBody", func(t *testing.T) {
		req, err := http.NewRequest("POST", "/model", bytes.NewBuffer([]byte("invalid json")))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Contains(t, rr.Body.String(), "Invalid request body")
	})

	t.Run("TestSaveModel_DatabaseError", func(t *testing.T) {
		model := Model{ID: "model2", Name: "FailedModel", CreatedAt: time.Now()}
		mockDB.EXPECT().SaveModel(model).Return(assert.AnError)

		body, err := json.Marshal(model)
		assert.NoError(t, err)

		req, err := http.NewRequest("POST", "/model", bytes.NewBuffer(body))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Contains(t, rr.Body.String(), "Failed to save model")
	})

	t.Run("TestFetchExternalData_Success", func(t *testing.T) {
		expectedData := "external data response"
		mockExternal.EXPECT().FetchData("test_endpoint").Return(expectedData, nil)

		req, err := http.NewRequest("GET", "/external", nil)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var response map[string]string
		err = json.NewDecoder(rr.Body).Decode(&response)
		assert.NoError(t, err)
		assert.Equal(t, expectedData, response["data"])
	})

	t.Run("TestFetchExternalData_Error", func(t *testing.T) {
		mockExternal.EXPECT().FetchData("test_endpoint").Return("", assert.AnError)

		req, err := http.NewRequest("GET", "/external", nil)
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Contains(t, rr.Body.String(), "Failed to fetch external data")
	})

	t.Run("TestGetUser_Latency", func(t *testing.T) {
		expectedUser := User{ID: "123", Username: "testuser", Email: "test@example.com"}
		mockDB.EXPECT().GetUser("123").Return(expectedUser, nil)

		req, err := http.NewRequest("GET", "/user/123", nil)
		assert.NoError(t, err)

		startTime := time.Now()
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		latency := time.Since(startTime)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Less(t, latency, 100*time.Millisecond)
	})

	t.Run("TestSaveModel_Latency", func(t *testing.T) {
		model := Model{ID: "model3", Name: "LatencyModel", CreatedAt: time.Now()}
		mockDB.EXPECT().SaveModel(model).Return(nil)

		body, err := json.Marshal(model)
		assert.NoError(t, err)

		req, err := http.NewRequest("POST", "/model", bytes.NewBuffer(body))
		assert.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")

		startTime := time.Now()
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		latency := time.Since(startTime)

		assert.Equal(t, http.StatusCreated, rr.Code)
		assert.Less(t, latency, 100*time.Millisecond)
	})

	t.Run("TestFetchExternalData_Latency", func(t *testing.T) {
		expectedData := "external data response"
		mockExternal.EXPECT().FetchData("test_endpoint").Return(expectedData, nil)

		req, err := http.NewRequest("GET", "/external", nil)
		assert.NoError(t, err)

		startTime := time.Now()
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		latency := time.Since(startTime)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Less(t, latency, 100*time.Millisecond)
	})
}

// Benchmark tests for performance
func BenchmarkGetUserHandler(b *testing.B) {
	ctrl := gomock.NewController(b)
	defer ctrl.Finish()

	mockDB := NewMockDatabase(ctrl)
	mockExternal := NewMockExternalService(ctrl)
	handler := &APIHandler{db: mockDB, externalClient: mockExternal}

	router := mux.NewRouter()
	router.HandleFunc("/user/{id}", handler.GetUserHandler).Methods("GET")

	expectedUser := User{ID: "123", Username: "testuser", Email: "test@example.com"}
	mockDB.EXPECT().GetUser("123").Return(expectedUser, nil).Times(b.N)

	req, _ := http.NewRequest("GET", "/user/123", nil)
	rr := httptest.NewRecorder()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.ServeHTTP(rr, req)
	}
}

func BenchmarkSaveModelHandler(b *testing.B) {
	ctrl := gomock.NewController(b)
	defer ctrl.Finish()

	mockDB := NewMockDatabase(ctrl)
	mockExternal := NewMockExternalService(ctrl)
	handler := &APIHandler{db: mockDB, externalClient: mockExternal}

	router := mux.NewRouter()
	router.HandleFunc("/model", handler.SaveModelHandler).Methods("POST")

	model := Model{ID: "model1", Name: "TestModel", CreatedAt: time.Now()}
	mockDB.EXPECT().SaveModel(model).Return(nil).Times(b.N)

	body, _ := json.Marshal(model)
	req, _ := http.NewRequest("POST", "/model", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.ServeHTTP(rr, req)
	}
}
