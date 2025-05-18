import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
import argparse
import logging
import os
from datetime import datetime
import sys
from typing import Union, List, Tuple
import json

# Set up logging
def setup_logging(log_dir: str = "logs") -> None:
    """
    Configure logging to save inference logs to a file and print to console.
    
    Args:
        log_dir (str): Directory to save log files.
    """
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(log_dir, f"inference_{timestamp}.log")
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    logging.info("Logging setup complete. Inference logs will be saved to: %s", log_file)

# Placeholder for the model class (replace with actual model definition or import)
class AgentModel(nn.Module):
    """
    Placeholder for the AI model architecture used during inference.
    Replace this with the actual model class or import it from a separate module.
    """
    def __init__(self, input_size: int = 10, hidden_size: int = 64, output_size: int = 2):
        super(AgentModel, self).__init__()
        self.layer1 = nn.Linear(input_size, hidden_size)
        self.layer2 = nn.Linear(hidden_size, hidden_size)
        self.layer3 = nn.Linear(hidden_size, output_size)
        self.relu = nn.ReLU()
        self.softmax = nn.Softmax(dim=1)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.relu(self.layer1(x))
        x = self.relu(self.layer2(x))
        x = self.layer3(x)
        x = self.softmax(x)
        return x

def load_model(model_path: str, device: str = "cpu") -> nn.Module:
    """
    Load a pre-trained model from the specified path.
    
    Args:
        model_path (str): Path to the saved model weights.
        device (str): Device to load the model on (cpu or cuda).
    
    Returns:
        nn.Module: Loaded model ready for inference.
    """
    try:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at: {model_path}")
        
        model = AgentModel()  # Replace with actual model initialization if different
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        model.eval()
        logging.info("Model successfully loaded from: %s", model_path)
        return model
    except Exception as e:
        logging.error("Error loading model: %s", str(e))
        raise

def preprocess_data(data: Union[np.ndarray, pd.DataFrame, List], 
                    feature_columns: List[str] = None) -> np.ndarray:
    """
    Preprocess input data for inference (e.g., normalization, handling missing values).
    
    Args:
        data: Input data as numpy array, pandas DataFrame, or list.
        feature_columns (List[str]): List of feature columns if data is a DataFrame.
    
    Returns:
        np.ndarray: Preprocessed data ready for model input.
    """
    try:
        if isinstance(data, pd.DataFrame):
            if feature_columns:
                data = data[feature_columns].values
            else:
                data = data.values
        elif isinstance(data, list):
            data = np.array(data)
        
        # Handle missing values (simple imputation with mean)
        if np.any(np.isnan(data)):
            data = np.nan_to_num(data, nan=np.nanmean(data, axis=0))
            logging.warning("Missing values detected in input data. Imputed with mean.")
        
        # Ensure data is 2D
        if len(data.shape) == 1:
            data = data.reshape(1, -1)
        
        logging.info("Input data preprocessed successfully. Shape: %s", data.shape)
        return data
    except Exception as e:
        logging.error("Error preprocessing data: %s", str(e))
        raise

def create_dataloader(data: np.ndarray, batch_size: int = 32) -> DataLoader:
    """
    Create a DataLoader for batch processing of input data.
    
    Args:
        data (np.ndarray): Preprocessed input data.
        batch_size (int): Size of each batch for inference.
    
    Returns:
        DataLoader: PyTorch DataLoader for batch processing.
    """
    try:
        data_tensor = torch.FloatTensor(data)
        dataset = TensorDataset(data_tensor)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=False, num_workers=2)
        logging.info("DataLoader created with batch size: %d", batch_size)
        return dataloader
    except Exception as e:
        logging.error("Error creating DataLoader: %s", str(e))
        raise

def perform_inference(model: nn.Module, dataloader: DataLoader, device: str = "cpu") -> np.ndarray:
    """
    Perform inference on the input data using the loaded model.
    
    Args:
        model (nn.Module): Pre-trained model for inference.
        dataloader (DataLoader): DataLoader with input data.
        device (str): Device to perform inference on (cpu or cuda).
    
    Returns:
        np.ndarray: Predictions from the model.
    """
    try:
        predictions = []
        with torch.no_grad():
            for batch in dataloader:
                inputs = batch[0].to(device)
                outputs = model(inputs)
                predictions.append(outputs.cpu().numpy())
        
        predictions = np.concatenate(predictions, axis=0)
        logging.info("Inference completed. Predictions shape: %s", predictions.shape)
        return predictions
    except Exception as e:
        logging.error("Error during inference: %s", str(e))
        raise

def save_predictions(predictions: np.ndarray, output_path: str) -> None:
    """
    Save predictions to a file (CSV or JSON).
    
    Args:
        predictions (np.ndarray): Model predictions to save.
        output_path (str): Path to save the predictions.
    """
    try:
        if output_path.endswith(".csv"):
            pd.DataFrame(predictions).to_csv(output_path, index=False)
        elif output_path.endswith(".json"):
            with open(output_path, "w") as f:
                json.dump(predictions.tolist(), f, indent=2)
        else:
            raise ValueError("Unsupported output format. Use .csv or .json")
        logging.info("Predictions saved to: %s", output_path)
    except Exception as e:
        logging.error("Error saving predictions: %s", str(e))
        raise

def main():
    """
    Main function to run the inference pipeline.
    """
    parser = argparse.ArgumentParser(description="Inference script for AI model predictions.")
    parser.add_argument("--model_path", type=str, required=True, 
                        help="Path to the pre-trained model file.")
    parser.add_argument("--input_data", type=str, required=True, 
                        help="Path to input data file (CSV) or directory.")
    parser.add_argument("--output_path", type=str, default="predictions.csv", 
                        help="Path to save predictions (CSV or JSON).")
    parser.add_argument("--batch_size", type=int, default=32, 
                        help="Batch size for inference.")
    parser.add_argument("--device", type=str, default="cpu", 
                        choices=["cpu", "cuda"], help="Device to run inference on.")
    parser.add_argument("--log_dir", type=str, default="logs", 
                        help="Directory to save inference logs.")
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logging(args.log_dir)
    
    try:
        # Check if CUDA is available if specified
        if args.device == "cuda" and not torch.cuda.is_available():
            logging.warning("CUDA not available. Falling back to CPU.")
            args.device = "cpu"
        
        logging.info("Starting inference pipeline with device: %s", args.device)
        
        # Load input data
        if args.input_data.endswith(".csv"):
            input_data = pd.read_csv(args.input_data)
        else:
            raise ValueError("Only CSV input data is supported for now.")
        logging.info("Input data loaded from: %s", args.input_data)
        
        # Preprocess data
        processed_data = preprocess_data(input_data)
        
        # Create DataLoader for batch processing
        dataloader = create_dataloader(processed_data, batch_size=args.batch_size)
        
        # Load model
        model = load_model(args.model_path, device=args.device)
        
        # Perform inference
        predictions = perform_inference(model, dataloader, device=args.device)
        
        # Save predictions
        save_predictions(predictions, args.output_path)
        
        logging.info("Inference pipeline completed successfully.")
    except Exception as e:
        logging.error("Inference pipeline failed: %s", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
