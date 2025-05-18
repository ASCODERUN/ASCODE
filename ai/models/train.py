import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from typing import Dict, List, Tuple, Optional, Union
import logging
import os
from pathlib import Path
import json
import itertools
from datetime import datetime

class AgentModel(nn.Module):
    """
    A simple neural network model for decision-making and behavior prediction.
    This can be replaced or extended based on specific needs.
    """
    def __init__(self, input_size: int, hidden_sizes: List[int], output_size: int, dropout_rate: float = 0.2):
        """
        Initialize the neural network model.
        
        Args:
            input_size (int): Number of input features.
            hidden_sizes (List[int]): List of sizes for hidden layers.
            output_size (int): Number of output units.
            dropout_rate (float): Dropout rate for regularization. Defaults to 0.2.
        """
        super(AgentModel, self).__init__()
        layers = []
        prev_size = input_size
        
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout_rate))
            prev_size = hidden_size
            
        layers.append(nn.Linear(prev_size, output_size))
        self.network = nn.Sequential(*layers)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass of the model.
        
        Args:
            x (torch.Tensor): Input tensor.
            
        Returns:
            torch.Tensor: Output tensor.
        """
        return self.network(x)

class ModelTrainer:
    """
    A class to handle training of AI models with hyperparameter tuning and logging.
    """
    def __init__(self, model_class, input_size: int, output_size: int, device: str = 'cpu',
                 logger: Optional[logging.Logger] = None):
        """
        Initialize the ModelTrainer.
        
        Args:
            model_class: The model class to train (e.g., AgentModel).
            input_size (int): Number of input features.
            output_size (int): Number of output units.
            device (str): Device to train on ('cpu' or 'cuda'). Defaults to 'cpu'.
            logger (Optional[logging.Logger]): Logger instance for tracking training.
        """
        self.model_class = model_class
        self.input_size = input_size
        self.output_size = output_size
        self.device = torch.device(device if torch.cuda.is_available() else 'cpu')
        self.logger = logger or logging.getLogger(__name__)
        self.best_model = None
        self.best_val_loss = float('inf')
        self.training_history: Dict[str, List[float]] = {'train_loss': [], 'val_loss': []}

    def load_data(self, data_path: Union[str, Path], target_column: str, 
                  test_size: float = 0.2, random_state: int = 42) -> Tuple[DataLoader, DataLoader]:
        """
        Load and prepare data for training.
        
        Args:
            data_path (Union[str, Path]): Path to the preprocessed data file.
            target_column (str): Name of the target column for prediction.
            test_size (float): Proportion of data for validation. Defaults to 0.2.
            random_state (int): Random seed for reproducibility. Defaults to 42.
            
        Returns:
            Tuple[DataLoader, DataLoader]: Training and validation DataLoaders.
        """
        try:
            data_path = Path(data_path)
            if not data_path.exists():
                raise FileNotFoundError(f"Data file not found at {data_path}")
                
            data = pd.read_csv(data_path)
            if target_column not in data.columns:
                raise ValueError(f"Target column {target_column} not found in data")
                
            X = data.drop(columns=[target_column]).values
            y = data[target_column].values
            
            X_train, X_val, y_train, y_val = train_test_split(
                X, y, test_size=test_size, random_state=random_state
            )
            
            train_dataset = TensorDataset(
                torch.FloatTensor(X_train), torch.FloatTensor(y_train)
            )
            val_dataset = TensorDataset(
                torch.FloatTensor(X_val), torch.FloatTensor(y_val)
            )
            
            train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
            val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
            
            self.logger.info(f"Loaded data with {len(train_dataset)} training and "
                            f"{len(val_dataset)} validation samples")
            return train_loader, val_loader
        except Exception as e:
            self.logger.error(f"Error loading data: {str(e)}")
            raise

    def train_epoch(self, model: nn.Module, train_loader: DataLoader, criterion: nn.Module,
                    optimizer: optim.Optimizer) -> float:
        """
        Train the model for one epoch.
        
        Args:
            model (nn.Module): Model to train.
            train_loader (DataLoader): DataLoader for training data.
            criterion (nn.Module): Loss function.
            optimizer (optim.Optimizer): Optimizer for training.
            
        Returns:
            float: Average training loss for the epoch.
        """
        model.train()
        total_loss = 0.0
        for batch_X, batch_y in train_loader:
            batch_X, batch_y = batch_X.to(self.device), batch_y.to(self.device)
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y.unsqueeze(1) if outputs.shape != batch_y.shape else batch_y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        return total_loss / len(train_loader)

    def validate(self, model: nn.Module, val_loader: DataLoader, criterion: nn.Module) -> float:
        """
        Validate the model on the validation set.
        
        Args:
            model (nn.Module): Model to validate.
            val_loader (DataLoader): DataLoader for validation data.
            criterion (nn.Module): Loss function.
            
        Returns:
            float: Average validation loss.
        """
        model.eval()
        total_loss = 0.0
        with torch.no_grad():
            for batch_X, batch_y in val_loader:
                batch_X, batch_y = batch_X.to(self.device), batch_y.to(self.device)
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y.unsqueeze(1) if outputs.shape != batch_y.shape else batch_y)
                total_loss += loss.item()
        return total_loss / len(val_loader)

    def train(self, train_loader: DataLoader, val_loader: DataLoader, hyperparameters: Dict,
              num_epochs: int = 50, early_stopping_patience: int = 5) -> Dict:
        """
        Train the model with given hyperparameters.
        
        Args:
            train_loader (DataLoader): DataLoader for training data.
            val_loader (DataLoader): DataLoader for validation data.
            hyperparameters (Dict): Dictionary of hyperparameters.
            num_epochs (int): Maximum number of epochs to train. Defaults to 50.
            early_stopping_patience (int): Patience for early stopping. Defaults to 5.
            
        Returns:
            Dict: Training results including final loss and history.
        """
        try:
            model = self.model_class(
                input_size=self.input_size,
                hidden_sizes=hyperparameters['hidden_sizes'],
                output_size=self.output_size,
                dropout_rate=hyperparameters['dropout_rate']
            ).to(self.device)
            
            criterion = nn.MSELoss()
            optimizer = optim.Adam(model.parameters(), lr=hyperparameters['learning_rate'])
            
            early_stopping_counter = 0
            local_best_val_loss = float('inf')
            local_history = {'train_loss': [], 'val_loss': []}
            
            for epoch in range(num_epochs):
                train_loss = self.train_epoch(model, train_loader, criterion, optimizer)
                val_loss = self.validate(model, val_loader, criterion)
                
                local_history['train_loss'].append(train_loss)
                local_history['val_loss'].append(val_loss)
                
                self.logger.info(f"Epoch {epoch+1}/{num_epochs} - Train Loss: {train_loss:.4f}, "
                                f"Val Loss: {val_loss:.4f}")
                
                if val_loss < local_best_val_loss:
                    local_best_val_loss = val_loss
                    early_stopping_counter = 0
                    if val_loss < self.best_val_loss:
                        self.best_val_loss = val_loss
                        self.best_model = model.state_dict()
                else:
                    early_stopping_counter += 1
                    if early_stopping_counter >= early_stopping_patience:
                        self.logger.info(f"Early stopping triggered at epoch {epoch+1}")
                        break
                        
            return {
                'final_train_loss': train_loss,
                'final_val_loss': val_loss,
                'history': local_history
            }
        except Exception as e:
            self.logger.error(f"Error during training: {str(e)}")
            raise

    def hyperparameter_tuning(self, train_loader: DataLoader, val_loader: DataLoader,
                              param_grid: Dict, num_epochs: int = 50,
                              early_stopping_patience: int = 5) -> Dict:
        """
        Perform hyperparameter tuning using grid search.
        
        Args:
            train_loader (DataLoader): DataLoader for training data.
            val_loader (DataLoader): DataLoader for validation data.
            param_grid (Dict): Dictionary of hyperparameter grids to search.
            num_epochs (int): Maximum number of epochs per configuration. Defaults to 50.
            early_stopping_patience (int): Patience for early stopping. Defaults to 5.
            
        Returns:
            Dict: Best hyperparameters and corresponding performance.
        """
        try:
            keys, values = zip(*param_grid.items())
            combinations = [dict(zip(keys, v)) for v in itertools.product(*values)]
            self.logger.info(f"Starting hyperparameter tuning with {len(combinations)} combinations")
            
            best_params = None
            best_val_loss = float('inf')
            tuning_results = []
            
            for params in combinations:
                self.logger.info(f"Training with parameters: {params}")
                result = self.train(
                    train_loader, val_loader, params, num_epochs, early_stopping_patience
                )
                val_loss = result['final_val_loss']
                tuning_results.append({'params': params, 'val_loss': val_loss})
                
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    best_params = params
                    
            self.logger.info(f"Best parameters: {best_params} with validation loss: {best_val_loss:.4f}")
            return {'best_params': best_params, 'best_val_loss': best_val_loss, 'results': tuning_results}
        except Exception as e:
            self.logger.error(f"Error during hyperparameter tuning: {str(e)}")
            raise

    def save_model(self, output_path: Union[str, Path]) -> None:
        """
        Save the best model to a file.
        
        Args:
            output_path (Union[str, Path]): Path to save the model.
        """
        try:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            if self.best_model is None:
                raise ValueError("No model to save. Please train the model first.")
            torch.save(self.best_model, output_path)
            self.logger.info(f"Best model saved to {output_path}")
        except Exception as e:
            self.logger.error(f"Error saving model: {str(e)}")
            raise

    def save_training_history(self, output_path: Union[str, Path]) -> None:
        """
        Save the training history to a JSON file.
        
        Args:
            output_path (Union[str, Path]): Path to save the training history.
        """
        try:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w') as f:
                json.dump(self.training_history, f, indent=4)
            self.logger.info(f"Training history saved to {output_path}")
        except Exception as e:
            self.logger.error(f"Error saving training history: {str(e)}")
            raise

def setup_logging(log_file: Optional[Union[str, Path]] = None) -> logging.Logger:
    """
    Set up logging configuration for the training script.
    
    Args:
        log_file (Optional[Union[str, Path]]): Path to save log file. If None, logs to console.
        
    Returns:
        logging.Logger: Configured logger instance.
    """
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    if log_file:
        log_file = Path(log_file)
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_file)
    else:
        handler = logging.StreamHandler()
        
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger

if __name__ == "__main__":
    try:
        # Set up logging
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        logger = setup_logging(f"training_log_{timestamp}.txt")
        
        # Define hyperparameter grid for tuning
        param_grid = {
            'hidden_sizes': [[64, 32], [128, 64, 32]],
            'learning_rate': [0.001, 0.01],
            'dropout_rate': [0.2, 0.3]
        }
        
        # Initialize trainer
        trainer = ModelTrainer(
            model_class=AgentModel,
            input_size=10,  # Adjust based on your dataset
            output_size=1,  # Adjust based on your task
            device='cuda' if torch.cuda.is_available() else 'cpu',
            logger=logger
        )
        
        # Load data (replace with actual file path and target column)
        train_loader, val_loader = trainer.load_data(
            data_path="preprocessed_data.csv",
            target_column="target"  # Replace with actual target column name
        )
        
        # Perform hyperparameter tuning
        tuning_result = trainer.hyperparameter_tuning(
            train_loader=train_loader,
            val_loader=val_loader,
            param_grid=param_grid,
            num_epochs=50,
            early_stopping_patience=5
        )
        
        # Save the best model and training history
        trainer.save_model(f"models/best_model_{timestamp}.pth")
        trainer.save_training_history(f"history/training_history_{timestamp}.json")
        
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        raise
