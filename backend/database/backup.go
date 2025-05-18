package backup

import (
    "archive/tar"
    "compress/gzip"
    "fmt"
    "io"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "sort"
    "strings"
    "sync"
    "time"

    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/s3/s3manager"
    "github.com/joho/godotenv"
)

// BackupConfig holds the configuration parameters for database backups
type BackupConfig struct {
    DBHost          string
    DBPort          string
    DBUser          string
    DBPassword      string
    DBName          string
    BackupDir       string
    RetentionDays   int
    BackupInterval  time.Duration
    EnableS3Upload  bool
    S3Bucket        string
    S3Region        string
    S3AccessKey     string
    S3SecretKey     string
    S3Endpoint      string // Optional for custom S3-compatible storage
}

// BackupManager manages the backup process and scheduling
type BackupManager struct {
    Config      *BackupConfig
    StopChan    chan struct{}
    wg          sync.WaitGroup
    s3Uploader  *s3manager.Uploader
}

// NewBackupConfig creates a new BackupConfig with values from environment variables
func NewBackupConfig() (*BackupConfig, error) {
    // Load environment variables from .env file if available
    err := godotenv.Load()
    if err != nil {
        log.Printf("Warning: Could not load .env file, falling back to system environment variables: %v", err)
    }

    // Retrieve environment variables with fallback defaults
    dbHost := getEnv("DB_HOST", "localhost")
    dbPort := getEnv("DB_PORT", "5432")
    dbUser := getEnv("DB_USER", "postgres")
    dbPassword := getEnv("DB_PASSWORD", "")
    dbName := getEnv("DB_NAME", "ontora_ai")
    backupDir := getEnv("BACKUP_DIR", "./backups")
    retentionDays := 7 // Default to 7 days
    backupInterval := 24 * time.Hour // Default to daily backups
    enableS3Upload := getEnv("ENABLE_S3_UPLOAD", "false") == "true"
    s3Bucket := getEnv("S3_BUCKET", "")
    s3Region := getEnv("S3_REGION", "us-east-1")
    s3AccessKey := getEnv("S3_ACCESS_KEY", "")
    s3SecretKey := getEnv("S3_SECRET_KEY", "")
    s3Endpoint := getEnv("S3_ENDPOINT", "")

    return &BackupConfig{
        DBHost:          dbHost,
        DBPort:          dbPort,
        DBUser:          dbUser,
        DBPassword:      dbPassword,
        DBName:          dbName,
        BackupDir:       backupDir,
        RetentionDays:   retentionDays,
        BackupInterval:  backupInterval,
        EnableS3Upload:  enableS3Upload,
        S3Bucket:        s3Bucket,
        S3Region:        s3Region,
        S3AccessKey:     s3AccessKey,
        S3SecretKey:     s3SecretKey,
        S3Endpoint:      s3Endpoint,
    }, nil
}

// getEnv retrieves an environment variable or returns a fallback value if not set
func getEnv(key, fallback string) string {
    if value, exists := os.LookupEnv(key); exists {
        return value
    }
    return fallback
}

// NewBackupManager creates a new BackupManager instance
func NewBackupManager(config *BackupConfig) (*BackupManager, error) {
    manager := &BackupManager{
        Config:   config,
        StopChan: make(chan struct{}),
    }

    // Ensure backup directory exists
    if err := os.MkdirAll(config.BackupDir, 0755); err != nil {
        return nil, fmt.Errorf("failed to create backup directory %s: %v", config.BackupDir, err)
    }

    // Initialize S3 uploader if enabled
    if config.EnableS3Upload {
        sess, err := session.NewSession(&aws.Config{
            Region:      aws.String(config.S3Region),
            Credentials: credentials.NewStaticCredentials(config.S3AccessKey, config.S3SecretKey, ""),
            Endpoint:    aws.String(config.S3Endpoint),
        })
        if err != nil {
            return nil, fmt.Errorf("failed to create AWS session for S3 upload: %v", err)
        }
        manager.s3Uploader = s3manager.NewUploader(sess)
    }

    return manager, nil
}

// Start begins the automated backup process with scheduling
func (bm *BackupManager) Start() {
    log.Printf("Starting automated database backup process with interval %v", bm.Config.BackupInterval)
    bm.wg.Add(1)
    go bm.runBackupLoop()
}

// Stop halts the backup process
func (bm *BackupManager) Stop() {
    log.Println("Stopping automated database backup process")
    close(bm.StopChan)
    bm.wg.Wait()
}

// runBackupLoop runs the backup process on a schedule
func (bm *BackupManager) runBackupLoop() {
    defer bm.wg.Done()
    ticker := time.NewTicker(bm.Config.BackupInterval)
    defer ticker.Stop()

    // Perform an initial backup immediately
    if err := bm.PerformBackup(); err != nil {
        log.Printf("Initial backup failed: %v", err)
    }

    for {
        select {
        case <-bm.StopChan:
            log.Println("Backup loop stopped")
            return
        case <-ticker.C:
            if err := bm.PerformBackup(); err != nil {
                log.Printf("Scheduled backup failed: %v", err)
            }
        }
    }
}

// PerformBackup executes a single backup operation
func (bm *BackupManager) PerformBackup() error {
    log.Println("Starting database backup process")
    timestamp := time.Now().Format("2006-01-02_15-04-05")
    backupFileName := fmt.Sprintf("%s_backup_%s.sql", bm.Config.DBName, timestamp)
    backupFilePath := filepath.Join(bm.Config.BackupDir, backupFileName)
    compressedFileName := fmt.Sprintf("%s.tar.gz", backupFileName)
    compressedFilePath := filepath.Join(bm.Config.BackupDir, compressedFileName)

    // Step 1: Create backup using pg_dump
    if err := bm.createBackupFile(backupFilePath); err != nil {
        return fmt.Errorf("failed to create backup file: %v", err)
    }
    defer os.Remove(backupFilePath) // Clean up uncompressed file after compression

    // Step 2: Compress the backup file
    if err := bm.compressBackupFile(backupFilePath, compressedFilePath); err != nil {
        return fmt.Errorf("failed to compress backup file: %v", err)
    }

    // Step 3: Upload to S3 if enabled
    if bm.Config.EnableS3Upload {
        if err := bm.uploadToS3(compressedFilePath, compressedFileName); err != nil {
            log.Printf("Warning: Failed to upload backup to S3, keeping local copy: %v", err)
        } else {
            log.Printf("Backup successfully uploaded to S3: %s", compressedFileName)
        }
    }

    // Step 4: Clean up old backups
    if err := bm.cleanupOldBackups(); err != nil {
        log.Printf("Warning: Failed to clean up old backups: %v", err)
    }

    log.Printf("Database backup completed successfully: %s", compressedFileName)
    return nil
}

// createBackupFile uses pg_dump to create a database backup file
func (bm *BackupManager) createBackupFile(backupFilePath string) error {
    // Build pg_dump command
    cmdArgs := []string{
        "-h", bm.Config.DBHost,
        "-p", bm.Config.DBPort,
        "-U", bm.Config.DBUser,
        "-d", bm.Config.DBName,
        "-f", backupFilePath,
    }

    // Set password environment variable to avoid prompt
    env := os.Environ()
    env = append(env, fmt.Sprintf("PGPASSWORD=%s", bm.Config.DBPassword))

    // Execute pg_dump command
    cmd := exec.Command("pg_dump", cmdArgs...)
    cmd.Env = env
    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("pg_dump failed: %v, output: %s", err, string(output))
    }

    log.Printf("Backup file created: %s", backupFilePath)
    return nil
}

// compressBackupFile compresses the backup file using tar and gzip
func (bm *BackupManager) compressBackupFile(inputPath, outputPath string) error {
    // Create output file for compressed data
    outputFile, err := os.Create(outputPath)
    if err != nil {
        return fmt.Errorf("failed to create compressed file %s: %v", outputPath, err)
    }
    defer outputFile.Close()

    // Create gzip writer
    gzWriter := gzip.NewWriter(outputFile)
    defer gzWriter.Close()

    // Create tar writer
    tarWriter := tar.NewWriter(gzWriter)
    defer tarWriter.Close()

    // Open the input file to compress
    inputFile, err := os.Open(inputPath)
    if err != nil {
        return fmt.Errorf("failed to open backup file %s for compression: %v", inputPath, err)
    }
    defer inputFile.Close()

    // Get file info for tar header
    fileInfo, err := inputFile.Stat()
    if err != nil {
        return fmt.Errorf("failed to get file info for %s: %v", inputPath, err)
    }

    // Create tar header
    header := &tar.Header{
        Name:    filepath.Base(inputPath),
        Size:    fileInfo.Size(),
        Mode:    int64(fileInfo.Mode()),
        ModTime: fileInfo.ModTime(),
    }

    // Write tar header
    if err := tarWriter.WriteHeader(header); err != nil {
        return fmt.Errorf("failed to write tar header for %s: %v", inputPath, err)
    }

    // Copy file content to tar
    if _, err := io.Copy(tarWriter, inputFile); err != nil {
        return fmt.Errorf("failed to write file content to tar for %s: %v", inputPath, err)
    }

    log.Printf("Backup file compressed: %s", outputPath)
    return nil
}

// uploadToS3 uploads the backup file to AWS S3 or compatible storage
func (bm *BackupManager) uploadToS3(filePath, fileName string) error {
    if bm.s3Uploader == nil {
        return fmt.Errorf("S3 uploader not initialized")
    }

    file, err := os.Open(filePath)
    if err != nil {
        return fmt.Errorf("failed to open backup file for S3 upload %s: %v", filePath, err)
    }
    defer file.Close()

    s3Key := fmt.Sprintf("backups/%s", fileName)
    _, err = bm.s3Uploader.Upload(&s3manager.UploadInput{
        Bucket: aws.String(bm.Config.S3Bucket),
        Key:    aws.String(s3Key),
        Body:   file,
    })
    if err != nil {
        return fmt.Errorf("failed to upload backup to S3 bucket %s: %v", bm.Config.S3Bucket, err)
    }

    log.Printf("Successfully uploaded backup to S3: %s/%s", bm.Config.S3Bucket, s3Key)
    return nil
}

// cleanupOldBackups removes old backup files based on retention policy
func (bm *BackupManager) cleanupOldBackups() error {
    files, err := os.ReadDir(bm.Config.BackupDir)
    if err != nil {
        return fmt.Errorf("failed to read backup directory %s: %v", bm.Config.BackupDir, err)
    }

    // Filter backup files and sort by modification time (oldest first)
    var backupFiles []os.DirEntry
    for _, file := range files {
        if !file.IsDir() && strings.HasSuffix(file.Name(), ".tar.gz") {
            backupFiles = append(backupFiles, file)
        }
    }

    if len(backupFiles) <= bm.Config.RetentionDays {
        log.Printf("No old backups to clean up, total files: %d, retention days: %d", len(backupFiles), bm.Config.RetentionDays)
        return nil
    }

    // Sort files by modification time (oldest first)
    sort.Slice(backupFiles, func(i, j int) bool {
        infoI, _ := backupFiles[i].Info()
        infoJ, _ := backupFiles[j].Info()
        return infoI.ModTime().Before(infoJ.ModTime())
    })

    // Delete oldest files beyond retention count
    for i := 0; i < len(backupFiles)-bm.Config.RetentionDays; i++ {
        filePath := filepath.Join(bm.Config.BackupDir, backupFiles[i].Name())
        if err := os.Remove(filePath); err != nil {
            log.Printf("Warning: Failed to delete old backup file %s: %v", filePath, err)
        } else {
            log.Printf("Deleted old backup file: %s", filePath)
        }
    }

    return nil
}
