import time
import requests
import threading
import logging
from prometheus_client import start_http_server, Counter, Histogram, Gauge
from typing import Dict, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("api_monitoring.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Define Prometheus metrics
api_uptime_status = Gauge('api_uptime_status', 'API uptime status (1 for up, 0 for down)', ['endpoint'])
api_request_latency = Histogram('api_request_latency_seconds', 'API request latency in seconds', ['endpoint'])
api_request_total = Counter('api_request_total', 'Total number of API requests', ['endpoint'])
api_request_errors = Counter('api_request_errors_total', 'Total number of failed API requests', ['endpoint'])

class APIMonitor:
    def __init__(self, config: Dict[str, any]):
        """
        Initialize the API monitor with configuration.
        
        Args:
            config (Dict[str, any]): Configuration dictionary with API endpoints and settings.
        """
        self.endpoints = config.get('endpoints', [])
        self.check_interval = config.get('check_interval', 60)  # Default to 60 seconds
        self.timeout = config.get('timeout', 5)  # Default timeout of 5 seconds
        self.is_running = False
        self.thread = None
        logger.info("API Monitor initialized with endpoints: %s", self.endpoints)

    def check_endpoint(self, endpoint: str) -> Dict[str, any]:
        """
        Check the health of a specific API endpoint.
        
        Args:
            endpoint (str): The API endpoint URL to check.
            
        Returns:
            Dict[str, any]: Result of the health check including status and latency.
        """
        start_time = time.time()
        try:
            response = requests.get(endpoint, timeout=self.timeout)
            latency = time.time() - start_time
            status_code = response.status_code
            is_up = status_code == 200
            
            # Update Prometheus metrics
            api_uptime_status.labels(endpoint=endpoint).set(1 if is_up else 0)
            api_request_latency.labels(endpoint=endpoint).observe(latency)
            api_request_total.labels(endpoint=endpoint).inc()
            
            if not is_up:
                api_request_errors.labels(endpoint=endpoint).inc()
                
            logger.info("Endpoint %s check: status=%s, latency=%.3f seconds", endpoint, status_code, latency)
            return {"endpoint": endpoint, "status": is_up, "status_code": status_code, "latency": latency}
        except requests.exceptions.RequestException as e:
            latency = time.time() - start_time
            api_uptime_status.labels(endpoint=endpoint).set(0)
            api_request_latency.labels(endpoint=endpoint).observe(latency)
            api_request_total.labels(endpoint=endpoint).inc()
            api_request_errors.labels(endpoint=endpoint).inc()
            logger.error("Endpoint %s check failed: %s", endpoint, str(e))
            return {"endpoint": endpoint, "status": False, "status_code": None, "latency": latency, "error": str(e)}

    def monitor(self):
        """
        Continuously monitor all configured endpoints in a loop until stopped.
        """
        while self.is_running:
            for endpoint in self.endpoints:
                result = self.check_endpoint(endpoint)
                logger.debug("Monitoring result for %s: %s", endpoint, result)
            time.sleep(self.check_interval)

    def start(self):
        """
        Start the monitoring process in a separate thread.
        """
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self.monitor, daemon=True)
            self.thread.start()
            logger.info("API monitoring started with interval of %d seconds", self.check_interval)
        else:
            logger.warning("API monitoring is already running")

    def stop(self):
        """
        Stop the monitoring process.
        """
        if self.is_running:
            self.is_running = False
            if self.thread:
                self.thread.join()
            logger.info("API monitoring stopped")
        else:
            logger.warning("API monitoring is not running")

def start_metrics_server(port: int = 8001):
    """
    Start the Prometheus metrics HTTP server.
    
    Args:
        port (int): Port to expose Prometheus metrics on. Defaults to 8001.
    """
    try:
        start_http_server(port)
        logger.info("Prometheus metrics server started on port %d", port)
    except Exception as e:
        logger.error("Failed to start Prometheus metrics server: %s", str(e))

if __name__ == "__main__":
    # Example configuration
    monitor_config = {
        "endpoints": [
            "http://localhost:8000/health",
            "http://localhost:8000/predict"
        ],
        "check_interval": 30,  # Check every 30 seconds
        "timeout": 5
    }
    
    # Start Prometheus metrics server
    start_metrics_server(port=8001)
    
    # Initialize and start API monitor
    monitor = APIMonitor(monitor_config)
    monitor.start()
    
    try:
        # Keep the main thread running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down API monitor...")
        monitor.stop()
