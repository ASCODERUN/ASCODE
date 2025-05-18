package db

import (
    "database/sql"
    "fmt"
    "log"
    "os"
    "sync"
    "time"

    _ "github.com/lib/pq"
    "github.com/joho/godotenv"
)

// DBConfig holds the configuration parameters for the database connection
type DBConfig struct {
    Host            string
    Port            string
    User            string
    Password        string
    DBName          string
    SSLMode         string
    MaxOpenConns    int
    MaxIdleConns    int
    ConnMaxLifetime time.Duration
}

// DBWrapper holds the database connection and synchronization primitives
type DBWrapper struct {
    DB     *sql.DB
    Config *DBConfig
    once   sync.Once
}

// Global instance of DBWrapper for singleton pattern
var dbInstance *DBWrapper
var dbMutex sync.Mutex

// NewDBConfig creates a new DBConfig with values from environment variables
func NewDBConfig() (*DBConfig, error) {
    // Load environment variables from .env file if available
    err := godotenv.Load()
    if err != nil {
        log.Printf("Warning: Could not load .env file, falling back to system environment variables: %v", err)
    }

    // Retrieve environment variables with fallback defaults
    host := getEnv("DB_HOST", "localhost")
    port := getEnv("DB_PORT", "5432")
    user := getEnv("DB_USER", "postgres")
    password := getEnv("DB_PASSWORD", "")
    dbName := getEnv("DB_NAME", "ontora_ai")
    sslMode := getEnv("DB_SSLMODE", "disable")

    // Default connection pooling settings
    maxOpenConns := 25
    maxIdleConns := 25
    connMaxLifetime := 5 * time.Minute

    return &DBConfig{
        Host:            host,
        Port:            port,
        User:            user,
        Password:        password,
        DBName:          dbName,
        SSLMode:         sslMode,
        MaxOpenConns:    maxOpenConns,
        MaxIdleConns:    maxIdleConns,
        ConnMaxLifetime: connMaxLifetime,
    }, nil
}

// getEnv retrieves an environment variable or returns a fallback value if not set
func getEnv(key, fallback string) string {
    if value, exists := os.LookupEnv(key); exists {
        return value
    }
    return fallback
}

// GetDB returns the singleton instance of the database connection
func GetDB() (*sql.DB, error) {
    dbMutex.Lock()
    defer dbMutex.Unlock()

    if dbInstance == nil {
        dbInstance = &DBWrapper{}
        err := dbInstance.initialize()
        if err != nil {
            dbInstance = nil
            return nil, fmt.Errorf("failed to initialize database connection: %v", err)
        }
    }
    return dbInstance.DB, nil
}

// initialize sets up the database connection with pooling configuration
func (wrapper *DBWrapper) initialize() error {
    var initErr error
    wrapper.once.Do(func() {
        // Load configuration
        config, err := NewDBConfig()
        if err != nil {
            initErr = fmt.Errorf("failed to load database configuration: %v", err)
            return
        }
        wrapper.Config = config

        // Build connection string
        connStr := fmt.Sprintf(
            "host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
            config.Host, config.Port, config.User, config.Password, config.DBName, config.SSLMode,
        )

        // Open database connection
        db, err := sql.Open("postgres", connStr)
        if err != nil {
            initErr = fmt.Errorf("failed to open database connection: %v", err)
            return
        }

        // Test the connection
        err = db.Ping()
        if err != nil {
            db.Close()
            initErr = fmt.Errorf("failed to ping database: %v", err)
            return
        }

        // Configure connection pooling
        db.SetMaxOpenConns(config.MaxOpenConns)
        db.SetMaxIdleConns(config.MaxIdleConns)
        db.SetConnMaxLifetime(config.ConnMaxLifetime)

        wrapper.DB = db
        log.Println("Database connection established successfully with pooling configured")
    })

    return initErr
}

// CloseDB closes the database connection pool
func CloseDB() error {
    dbMutex.Lock()
    defer dbMutex.Unlock()

    if dbInstance != nil && dbInstance.DB != nil {
        err := dbInstance.DB.Close()
        if err != nil {
            log.Printf("Error closing database connection: %v", err)
            return fmt.Errorf("failed to close database connection: %v", err)
        }
        log.Println("Database connection closed successfully")
        dbInstance = nil
    }
    return nil
}

// GetStats returns the current database connection pool statistics for monitoring
func GetStats() (sql.DBStats, error) {
    db, err := GetDB()
    if err != nil {
        return sql.DBStats{}, fmt.Errorf("failed to get database instance for stats: %v", err)
    }
    return db.Stats(), nil
}
