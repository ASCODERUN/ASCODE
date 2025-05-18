package config

import (
    "encoding/json"
    "log"
    "os"
    "strings"
    "time"

    "github.com/bradfitz/gomemcache/memcache"
)

// MemcachedConfig holds the configuration for Memcached connection.
type MemcachedConfig struct {
    Servers       []string // List of Memcached server addresses (e.g., "localhost:11211")
    Timeout       time.Duration
    DefaultExpiry time.Duration // Default TTL for cached items
    Client        *memcache.Client
}

// DefaultMemcachedConfig provides default values for Memcached configuration.
func DefaultMemcachedConfig() *MemcachedConfig {
    return &MemcachedConfig{
        Servers:       []string{"localhost:11211"},
        Timeout:       1 * time.Second,
        DefaultExpiry: 1 * time.Hour,
    }
}

// InitMemcached initializes a Memcached client with configuration from environment variables or defaults.
func InitMemcached() (*MemcachedConfig, error) {
    config := DefaultMemcachedConfig()

    // Override servers from environment variable if provided
    if serversEnv := os.Getenv("MEMCACHED_SERVERS"); serversEnv != "" {
        config.Servers = strings.Split(serversEnv, ",")
    }

    // Override timeout from environment variable if provided
    if timeoutEnv := os.Getenv("MEMCACHED_TIMEOUT_SECONDS"); timeoutEnv != "" {
        if timeout, err := time.ParseDuration(timeoutEnv + "s"); err == nil {
            config.Timeout = timeout
        } else {
            log.Printf("Invalid MEMCACHED_TIMEOUT_SECONDS value, using default: %v", err)
        }
    }

    // Override default expiry from environment variable if provided
    if expiryEnv := os.Getenv("MEMCACHED_DEFAULT_EXPIRY_SECONDS"); expiryEnv != "" {
        if expiry, err := time.ParseDuration(expiryEnv + "s"); err == nil {
            config.DefaultExpiry = expiry
        } else {
            log.Printf("Invalid MEMCACHED_DEFAULT_EXPIRY_SECONDS value, using default: %v", err)
        }
    }

    // Initialize Memcached client
    config.Client = memcache.New(config.Servers...)
    config.Client.Timeout = config.Timeout

    // Test connection to Memcached servers
    err := config.Client.Ping()
    if err != nil {
        log.Printf("Failed to connect to Memcached: %v", err)
        return nil, err
    }

    log.Println("Successfully connected to Memcached")
    return config, nil
}

// SetCache stores a value in Memcached with a specified key and optional expiration time.
func (mc *MemcachedConfig) SetCache(key string, value interface{}, expiration time.Duration) error {
    // Serialize the value to JSON
    data, err := json.Marshal(value)
    if err != nil {
        log.Printf("Failed to serialize value for key %s: %v", key, err)
        return err
    }

    // Set expiration in seconds (Memcached requires int32 for expiration)
    expirySeconds := int32(expiration.Seconds())
    if expirySeconds == 0 {
        expirySeconds = int32(mc.DefaultExpiry.Seconds())
    }

    // Create Memcached item
    item := &memcache.Item{
        Key:        key,
        Value:      data,
        Expiration: expirySeconds,
    }

    // Store in Memcached
    err = mc.Client.Set(item)
    if err != nil {
        log.Printf("Failed to set cache for key %s: %v", key, err)
        return err
    }

    log.Printf("Successfully cached data for key %s", key)
    return nil
}

// GetCache retrieves a value from Memcached by key and deserializes it into the provided target.
func (mc *MemcachedConfig) GetCache(key string, target interface{}) (bool, error) {
    // Get item from Memcached
    item, err := mc.Client.Get(key)
    if err == memcache.ErrCacheMiss {
        log.Printf("Cache miss for key %s", key)
        return false, nil
    }
    if err != nil {
        log.Printf("Failed to get cache for key %s: %v", key, err)
        return false, err
    }

    // Deserialize the value from JSON
    err = json.Unmarshal(item.Value, target)
    if err != nil {
        log.Printf("Failed to deserialize value for key %s: %v", key, err)
        return false, err
    }

    log.Printf("Cache hit for key %s", key)
    return true, nil
}

// DeleteCache removes a specific key from Memcached.
func (mc *MemcachedConfig) DeleteCache(key string) error {
    err := mc.Client.Delete(key)
    if err == memcache.ErrCacheMiss {
        log.Printf("Key %s not found in cache for deletion", key)
        return nil
    }
    if err != nil {
        log.Printf("Failed to delete cache for key %s: %v", key, err)
        return err
    }

    log.Printf("Successfully deleted cache for key %s", key)
    return nil
}

// FlushCache clears all data in Memcached (use with caution in production).
func (mc *MemcachedConfig) FlushCache() error {
    err := mc.Client.FlushAll()
    if err != nil {
        log.Printf("Failed to flush Memcached: %v", err)
        return err
    }

    log.Println("Successfully flushed all data from Memcached")
    return nil
}

// SetCachedAPIResponse caches an API response with a specific key and expiration time.
func (mc *MemcachedConfig) SetCachedAPIResponse(endpoint string, params string, response interface{}, expiration time.Duration) error {
    cacheKey := "api:" + endpoint + ":" + params
    return mc.SetCache(cacheKey, response, expiration)
}

// GetCachedAPIResponse retrieves a cached API response by endpoint and parameters.
func (mc *MemcachedConfig) GetCachedAPIResponse(endpoint string, params string, target interface{}) (bool, error) {
    cacheKey := "api:" + endpoint + ":" + params
    return mc.GetCache(cacheKey, target)
}

// SetCachedBlockchainData caches blockchain data with a specific key and expiration time.
func (mc *MemcachedConfig) SetCachedBlockchainData(dataType string, identifier string, data interface{}, expiration time.Duration) error {
    cacheKey := "blockchain:" + dataType + ":" + identifier
    return mc.SetCache(cacheKey, data, expiration)
}

// GetCachedBlockchainData retrieves cached blockchain data by type and identifier.
func (mc *MemcachedConfig) GetCachedBlockchainData(dataType string, identifier string, target interface{}) (bool, error) {
    cacheKey := "blockchain:" + dataType + ":" + identifier
    return mc.GetCache(cacheKey, target)
}
