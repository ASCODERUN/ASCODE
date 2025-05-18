package main

import (
    "encoding/json"
    "log"
    "net/http"
    "os"
    "sync"
    "time"

    "github.com/gorilla/websocket"
)

// MessageType defines the type of message being sent over WebSocket.
type MessageType string

const (
    AgentStatusUpdate  MessageType = "agent_status"
    TransactionUpdate  MessageType = "transaction_update"
    HeartbeatPing      MessageType = "ping"
    HeartbeatPong      MessageType = "pong"
)

// Message represents the structure of a WebSocket message.
type Message struct {
    Type    MessageType `json:"type"`
    Payload interface{} `json:"payload"`
}

// AgentStatusPayload defines the payload for agent status updates.
type AgentStatusPayload struct {
    AgentID     string    `json:"agent_id"`
    Status      string    `json:"status"`
    LastUpdated time.Time `json:"last_updated"`
    Details     string    `json:"details"`
}

// TransactionPayload defines the payload for transaction updates.
type TransactionPayload struct {
    TxID        string    `json:"tx_id"`
    Status      string    `json:"status"`
    Timestamp   time.Time `json:"timestamp"`
    Amount      string    `json:"amount"`
    Blockchain  string    `json:"blockchain"`
    FromAddress string    `json:"from_address"`
    ToAddress   string    `json:"to_address"`
}

// Client represents a connected WebSocket client.
type Client struct {
    Conn       *websocket.Conn
    Send       chan Message
    Topics     map[string]bool // Topics or channels the client is subscribed to (e.g., agent_id or tx_id)
    LastActive time.Time
}

// WebSocketServer manages WebSocket connections and message broadcasting.
type WebSocketServer struct {
    Clients    map[*Client]bool
    Broadcast  chan Message
    Register   chan *Client
    Unregister chan *Client
    Mutex      sync.RWMutex
    Upgrader   websocket.Upgrader
}

// NewWebSocketServer creates a new WebSocket server instance.
func NewWebSocketServer() *WebSocketServer {
    return &WebSocketServer{
        Clients:    make(map[*Client]bool),
        Broadcast:  make(chan Message),
        Register:   make(chan *Client),
        Unregister: make(chan *Client),
        Upgrader: websocket.Upgrader{
            ReadBufferSize:  1024,
            WriteBufferSize: 1024,
            CheckOrigin: func(r *http.Request) bool {
                return true // Allow all origins for simplicity; restrict in production
            },
        },
    }
}

// Start runs the WebSocket server event loop for managing clients and messages.
func (s *WebSocketServer) Start() {
    for {
        select {
        case client := <-s.Register:
            s.Mutex.Lock()
            s.Clients[client] = true
            s.Mutex.Unlock()
            log.Printf("New client connected. Total clients: %d", len(s.Clients))

        case client := <-s.Unregister:
            s.Mutex.Lock()
            if _, ok := s.Clients[client]; ok {
                close(client.Send)
                delete(s.Clients, client)
            }
            s.Mutex.Unlock()
            log.Printf("Client disconnected. Total clients: %d", len(s.Clients))

        case message := <-s.Broadcast:
            s.Mutex.RLock()
            for client := range s.Clients {
                // Optionally filter based on topics if payload contains relevant ID
                shouldSend := true
                if message.Type == AgentStatusUpdate {
                    if payload, ok := message.Payload.(AgentStatusPayload); ok {
                        if len(client.Topics) > 0 {
                            shouldSend = client.Topics[payload.AgentID]
                        }
                    }
                } else if message.Type == TransactionUpdate {
                    if payload, ok := message.Payload.(TransactionPayload); ok {
                        if len(client.Topics) > 0 {
                            shouldSend = client.Topics[payload.TxID]
                        }
                    }
                }

                if shouldSend {
                    select {
                    case client.Send <- message:
                    default:
                        log.Printf("Client send channel full, skipping message for client")
                    }
                }
            }
            s.Mutex.RUnlock()
        }
    }
}

// HandleConnections handles incoming WebSocket connection requests.
func (s *WebSocketServer) HandleConnections(w http.ResponseWriter, r *http.Request) {
    // Basic authentication check (placeholder; integrate with real auth system)
    token := r.URL.Query().Get("token")
    if token == "" || !validateToken(token) {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    // Upgrade HTTP connection to WebSocket
    ws, err := s.Upgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("Failed to upgrade connection to WebSocket: %v", err)
        http.Error(w, "Failed to upgrade connection", http.StatusInternalServerError)
        return
    }

    // Create a new client
    client := &Client{
        Conn:       ws,
        Send:       make(chan Message, 256),
        Topics:     make(map[string]bool),
        LastActive: time.Now(),
    }

    // Register the client
    s.Register <- client

    // Start client read and write goroutines
    go s.writePump(client)
    go s.readPump(client)
}

// writePump handles sending messages to the client.
func (s *WebSocketServer) writePump(client *Client) {
    defer func() {
        client.Conn.Close()
        s.Unregister <- client
    }()

    for {
        select {
        case message, ok := <-client.Send:
            if !ok {
                client.Conn.WriteMessage(websocket.CloseMessage, []byte{})
                return
            }

            jsonData, err := json.Marshal(message)
            if err != nil {
                log.Printf("Failed to marshal message: %v", err)
                continue
            }

            if err := client.Conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
                log.Printf("Failed to write message to client: %v", err)
                return
            }
            client.LastActive = time.Now()
        }
    }
}

// readPump handles reading messages from the client.
func (s *WebSocketServer) readPump(client *Client) {
    defer func() {
        client.Conn.Close()
        s.Unregister <- client
    }()

    // Set read deadline and pong handler for heartbeat
    client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
    client.Conn.SetPongHandler(func(string) error {
        client.LastActive = time.Now()
        client.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
        return nil
    })

    for {
        _, message, err := client.Conn.ReadMessage()
        if err != nil {
            log.Printf("Failed to read message from client: %v", err)
            break
        }

        client.LastActive = time.Now()

        // Handle incoming messages (e.g., subscription to topics)
        var msg Message
        if err := json.Unmarshal(message, &msg); err != nil {
            log.Printf("Failed to unmarshal client message: %v", err)
            continue
        }

        if msg.Type == "subscribe" {
            if topic, ok := msg.Payload.(string); ok {
                client.Topics[topic] = true
                log.Printf("Client subscribed to topic: %s", topic)
            }
        } else if msg.Type == "unsubscribe" {
            if topic, ok := msg.Payload.(string); ok {
                delete(client.Topics, topic)
                log.Printf("Client unsubscribed from topic: %s", topic)
            }
        }
    }
}

// SendAgentStatusUpdate broadcasts an agent status update to connected clients.
func (s *WebSocketServer) SendAgentStatusUpdate(agentID, status, details string) {
    payload := AgentStatusPayload{
        AgentID:     agentID,
        Status:      status,
        LastUpdated: time.Now(),
        Details:     details,
    }
    message := Message{
        Type:    AgentStatusUpdate,
        Payload: payload,
    }
    s.Broadcast <- message
    log.Printf("Broadcasted agent status update for agent %s with status %s", agentID, status)
}

// SendTransactionUpdate broadcasts a transaction update to connected clients.
func (s *WebSocketServer) SendTransactionUpdate(txID, status, amount, blockchain, fromAddr, toAddr string) {
    payload := TransactionPayload{
        TxID:        txID,
        Status:      status,
        Timestamp:   time.Now(),
        Amount:      amount,
        Blockchain:  blockchain,
        FromAddress: fromAddr,
        ToAddress:   toAddr,
    }
    message := Message{
        Type:    TransactionUpdate,
        Payload: payload,
    }
    s.Broadcast <- message
    log.Printf("Broadcasted transaction update for tx %s with status %s", txID, status)
}

// Heartbeat runs a periodic check to send ping messages and close inactive connections.
func (s *WebSocketServer) Heartbeat() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()

    for range ticker.C {
        s.Mutex.RLock()
        for client := range s.Clients {
            if time.Since(client.LastActive) > 60*time.Second {
                log.Printf("Client inactive for too long, closing connection")
                s.Unregister <- client
                client.Conn.Close()
                continue
            }

            err := client.Conn.WriteMessage(websocket.PingMessage, nil)
            if err != nil {
                log.Printf("Failed to send ping to client: %v", err)
                s.Unregister <- client
                client.Conn.Close()
            }
        }
        s.Mutex.RUnlock()
    }
}

// validateToken is a placeholder for token validation logic.
func validateToken(token string) bool {
    // Replace with actual token validation logic (e.g., JWT verification)
    return token == "valid-token" // Dummy check for demonstration
}

func main() {
    // Get server port from environment variable or use default
    port := os.Getenv("WS_PORT")
    if port == "" {
        port = "8080"
    }

    // Initialize WebSocket server
    server := NewWebSocketServer()

    // Start the server event loop in a goroutine
    go server.Start()

    // Start heartbeat mechanism in a goroutine
    go server.Heartbeat()

    // Set up HTTP handler for WebSocket connections
    http.HandleFunc("/ws", server.HandleConnections)

    // Optional: Add a simple health check endpoint
    http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("WebSocket server is running"))
    })

    // Simulate sending updates (for testing purposes)
    go func() {
        time.Sleep(10 * time.Second)
        for i := 0; i < 5; i++ {
            server.SendAgentStatusUpdate("agent-123", "active", "Agent is processing data")
            server.SendTransactionUpdate("tx-456", "confirmed", "0.5 SOL", "Solana", "addr1", "addr2")
            time.Sleep(5 * time.Second)
        }
    }()

    // Start HTTP server
    log.Printf("Starting WebSocket server on port %s", port)
    err := http.ListenAndServe(":"+port, nil)
    if err != nil {
        log.Fatalf("Failed to start server: %v", err)
    }
}
