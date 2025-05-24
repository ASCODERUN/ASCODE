import os 
import logging
from typing import Dict, List, Optional, Union
from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import torch
import torch.nn as nn
import shutil
import json
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("endpoints.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI router
router = APIRouter(
    prefix="/api",
    tags=["ai-tasks"],
    responses={404: {"description": "Not found"}}
)

# OAuth2 scheme for token authentication (assumes server.py or similar setup)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic Models for Request and Response
class PredictionRequest(BaseModel):
    input_data: List[float]  # Input data for prediction
    model_version: Optional[str] = "default"

class PredictionResponse(BaseModel):
    prediction: List[float]
    model_version: str
    timestamp: str

class RetrainingRequest(BaseModel):
    dataset_path: Optional[str] = None  # Path to new training data
    hyperparameters: Optional[Dict[str, Union[int, float, str]]] = None  # Training parameters
    model_version: Optional[str] = "default"

class RetrainingResponse(BaseModel):
    status: str
    message: str
    retraining_id: str
    timestamp: str

class ModelInfo(BaseModel):
    version: str
    path: str
    created_at: str
    status: str

class ModelUploadResponse(BaseModel):
    status: str
    message: str
    version: str
    timestamp: str

# Placeholder for AI Model (replace with actual model loading logic)
class DummyModel(nn.Module):
    def __init__(self):
        super(DummyModel, self).__init__()
        self.fc = nn.Linear(10, 1)  # Dummy model for demonstration

    def forward(self, x):
        return self.fc(x)

# Model storage directory
MODEL_DIR = os.environ.get("MODEL_DIR", "./models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Placeholder for loaded models (in a real app, use a proper model registry)
loaded_models = {}
default_model_version = "default"

try:
    dummy_model = DummyModel()
    dummy_model.eval()
    loaded_models[default_model_version] = dummy_model
    torch.save(dummy_model.state_dict(), os.path.join(MODEL_DIR, f"model_{default_model_version}.pth"))
    logger.info(f"Default dummy model initialized and saved as {default_model_version}")
except Exception as e:
    logger.error(f"Failed to initialize default model: {str(e)}")

# Simulated retraining status storage (replace with database in production)
retraining_tasks = {}

# Dependency for authentication (placeholder, assumes current_user from server.py)
async def get_current_active_user(token: str = Depends(oauth2_scheme)):
    # This is a placeholder; actual implementation should validate the token
    # and return the user object as in server.py
    return {"username": "placeholder_user"}

# Helper Functions
def load_model(version: str) -> Optional[nn.Module]:
    if version in loaded_models:
        return loaded_models[version]
    model_path = os.path.join(MODEL_DIR, f"model_{version}.pth")
    if os.path.exists(model_path):
        try:
            model = DummyModel()
            model.load_state_dict(torch.load(model_path))
            model.eval()
            loaded_models[version] = model
            logger.info(f"Model version {version} loaded from {model_path}")
            return model
        except Exception as e:
            logger.error(f"Failed to load model version {version}: {str(e)}")
            return None
    return None

def save_model(model: nn.Module, version: str):
    try:
        model_path = os.path.join(MODEL_DIR, f"model_{version}.pth")
        torch.save(model.state_dict(), model_path)
        loaded_models[version] = model
        logger.info(f"Model version {version} saved to {model_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to save model version {version}: {str(e)}")
        return False

def simulate_retraining(dataset_path: str, hyperparameters: Dict, version: str) -> str:
    # Placeholder for retraining logic; replace with actual training code
    retraining_id = f"retrain_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    retraining_tasks[retraining_id] = {
        "status": "running",
        "version": version,
        "start_time": datetime.now().isoformat(),
        "dataset_path": dataset_path,
        "hyperparameters": hyperparameters
    }
    logger.info(f"Started retraining task {retraining_id} for model version {version}")
    # Simulate completion (in reality, this would be async or background task)
    retraining_tasks[retraining_id]["status"] = "completed"
    retraining_tasks[retraining_id]["end_time"] = datetime.now().isoformat()
    logger.info(f"Completed retraining task {retraining_id} for model version {version}")
    return retraining_id

# API Endpoints
@router.post("/predict", response_model=PredictionResponse)
async def predict(
    request: PredictionRequest,
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        model_version = request.model_version
        model = load_model(model_version)
        if model is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model version {model_version} not found or failed to load"
            )

        # Validate input data (placeholder logic)
        input_data = request.input_data
        if len(input_data) != 10:  # Dummy check for input size
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Input data must have exactly 10 elements"
            )

        # Run prediction
        input_tensor = torch.tensor(input_data, dtype=torch.float32)
        with torch.no_grad():
            output = model(input_tensor)
            prediction = output.tolist()

        logger.info(f"Prediction completed for user {current_user.get('username')} with model {model_version}")
        return {
            "prediction": prediction,
            "model_version": model_version,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Prediction error for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )

@router.post("/retrain", response_model=RetrainingResponse)
async def retrain(
    request: RetrainingRequest,
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        model_version = request.model_version
        dataset_path = request.dataset_path if request.dataset_path else "default_dataset"
        hyperparameters = request.hyperparameters if request.hyperparameters else {}

        # Validate dataset path (placeholder logic)
        if not dataset_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dataset path must be provided for retraining"
            )

        # Trigger retraining (simulated)
        retraining_id = simulate_retraining(dataset_path, hyperparameters, model_version)

        logger.info(f"Retraining initiated by user {current_user.get('username')} for model {model_version}")
        return {
            "status": "success",
            "message": f"Retraining started for model version {model_version}",
            "retraining_id": retraining_id,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Retraining error for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retraining failed: {str(e)}"
        )

@router.get("/retraining_status/{retraining_id}", response_model=Dict)
async def get_retraining_status(
    retraining_id: str,
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        if retraining_id not in retraining_tasks:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Retraining task {retraining_id} not found"
            )
        logger.info(f"Retraining status checked by user {current_user.get('username')} for task {retraining_id}")
        return retraining_tasks[retraining_id]
    except Exception as e:
        logger.error(f"Error fetching retraining status for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch retraining status: {str(e)}"
        )

@router.post("/models/upload", response_model=ModelUploadResponse)
async def upload_model(
    file: UploadFile = File(...),
    version: Optional[str] = "custom_upload",
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        # Save uploaded model file
        model_path = os.path.join(MODEL_DIR, f"model_{version}.pth")
        with open(model_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Attempt to load the model to verify integrity
        model = load_model(version)
        if model is None:
            os.remove(model_path)  # Clean up if model loading fails
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded file for version {version} is not a valid model"
            )

        logger.info(f"Model version {version} uploaded by user {current_user.get('username')}")
        return {
            "status": "success",
            "message": f"Model version {version} uploaded successfully",
            "version": version,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Model upload error for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model upload failed: {str(e)}"
        )
    finally:
        file.file.close()

@router.get("/models", response_model=List[ModelInfo])
async def list_models(
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        models = []
        for model_file in os.listdir(MODEL_DIR):
            if model_file.startswith("model_") and model_file.endswith(".pth"):
                version = model_file.replace("model_", "").replace(".pth", "")
                file_path = os.path.join(MODEL_DIR, model_file)
                created_at = datetime.fromtimestamp(os.path.getctime(file_path)).isoformat()
                status = "loaded" if version in loaded_models else "available"
                models.append({
                    "version": version,
                    "path": file_path,
                    "created_at": created_at,
                    "status": status
                })
        logger.info(f"Model list retrieved by user {current_user.get('username')}")
        return models
    except Exception as e:
        logger.error(f"Error listing models for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list models: {str(e)}"
        )

@router.delete("/models/{version}", response_model=Dict)
async def delete_model(
    version: str,
    current_user: Dict = Depends(get_current_active_user)
):
    try:
        model_path = os.path.join(MODEL_DIR, f"model_{version}.pth")
        if not os.path.exists(model_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Model version {version} not found"
            )
        os.remove(model_path)
        if version in loaded_models:
            del loaded_models[version]
        logger.info(f"Model version {version} deleted by user {current_user.get('username')}")
        return {
            "status": "success",
            "message": f"Model version {version} deleted successfully",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error deleting model for user {current_user.get('username')}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete model: {str(e)}"
        )
