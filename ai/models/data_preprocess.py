import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from typing import Dict, List, Tuple, Optional, Union
import logging
import os
from pathlib import Path

class DataPreprocessor:
    """
    A comprehensive data preprocessing class for cleaning, normalizing, and augmenting data
    for machine learning model training.
    """
    def __init__(self, logger: Optional[logging.Logger] = None):
        """
        Initialize the DataPreprocessor with optional logging.
        
        Args:
            logger (Optional[logging.Logger]): Logger instance for tracking preprocessing steps.
        """
        self.logger = logger or logging.getLogger(__name__)
        self.scaler = StandardScaler()
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.imputer_numeric = SimpleImputer(strategy='mean')
        self.imputer_categorical = SimpleImputer(strategy='most_frequent')
        self.numerical_cols: List[str] = []
        self.categorical_cols: List[str] = []

    def load_data(self, file_path: Union[str, Path], file_type: str = 'csv') -> pd.DataFrame:
        """
        Load data from a file (CSV, JSON, etc.).
        
        Args:
            file_path (Union[str, Path]): Path to the data file.
            file_type (str): Type of file ('csv', 'json', etc.). Defaults to 'csv'.
            
        Returns:
            pd.DataFrame: Loaded data as a pandas DataFrame.
        """
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found at {file_path}")
            
            if file_type.lower() == 'csv':
                data = pd.read_csv(file_path)
            elif file_type.lower() == 'json':
                data = pd.read_json(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
                
            self.logger.info(f"Successfully loaded data from {file_path} with shape {data.shape}")
            return data
        except Exception as e:
            self.logger.error(f"Error loading data: {str(e)}")
            raise

    def identify_columns(self, data: pd.DataFrame, threshold: float = 0.5) -> None:
        """
        Identify numerical and categorical columns based on data types and unique value ratio.
        
        Args:
            data (pd.DataFrame): Input DataFrame.
            threshold (float): Threshold for unique value ratio to determine categorical columns.
        """
        try:
            self.numerical_cols = data.select_dtypes(include=[np.number]).columns.tolist()
            potential_categorical = data.select_dtypes(exclude=[np.number]).columns.tolist()
            
            for col in data.columns:
                if col in self.numerical_cols:
                    unique_ratio = data[col].nunique() / len(data[col])
                    if unique_ratio < threshold:
                        self.numerical_cols.remove(col)
                        self.categorical_cols.append(col)
                else:
                    self.categorical_cols.append(col)
                    
            self.logger.info(f"Identified {len(self.numerical_cols)} numerical and "
                            f"{len(self.categorical_cols)} categorical columns")
        except Exception as e:
            self.logger.error(f"Error identifying columns: {str(e)}")
            raise

    def handle_missing_values(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Handle missing values in the dataset using imputation.
        
        Args:
            data (pd.DataFrame): Input DataFrame with potential missing values.
            
        Returns:
            pd.DataFrame: DataFrame with imputed missing values.
        """
        try:
            if data.isna().sum().sum() == 0:
                self.logger.info("No missing values found in the dataset")
                return data
                
            if self.numerical_cols:
                data[self.numerical_cols] = self.imputer_numeric.fit_transform(data[self.numerical_cols])
            if self.categorical_cols:
                data[self.categorical_cols] = self.imputer_categorical.fit_transform(data[self.categorical_cols])
                
            self.logger.info("Missing values handled using imputation")
            return data
        except Exception as e:
            self.logger.error(f"Error handling missing values: {str(e)}")
            raise

    def encode_categorical(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Encode categorical variables into numerical format using LabelEncoder.
        
        Args:
            data (pd.DataFrame): Input DataFrame with categorical columns.
            
        Returns:
            pd.DataFrame: DataFrame with encoded categorical columns.
        """
        try:
            for col in self.categorical_cols:
                if col in data.columns:
                    self.label_encoders[col] = LabelEncoder()
                    data[col] = self.label_encoders[col].fit_transform(data[col].astype(str))
            self.logger.info("Categorical variables encoded successfully")
            return data
        except Exception as e:
            self.logger.error(f"Error encoding categorical variables: {str(e)}")
            raise

    def normalize_data(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Normalize numerical data using StandardScaler.
        
        Args:
            data (pd.DataFrame): Input DataFrame with numerical columns.
            
        Returns:
            pd.DataFrame: DataFrame with normalized numerical columns.
        """
        try:
            if self.numerical_cols:
                data[self.numerical_cols] = self.scaler.fit_transform(data[self.numerical_cols])
            self.logger.info("Numerical data normalized successfully")
            return data
        except Exception as e:
            self.logger.error(f"Error normalizing data: {str(e)}")
            raise

    def augment_data(self, data: pd.DataFrame, method: str = 'noise', factor: float = 0.1) -> pd.DataFrame:
        """
        Augment data by adding noise or duplicating with modifications for numerical columns.
        
        Args:
            data (pd.DataFrame): Input DataFrame to augment.
            method (str): Augmentation method ('noise' or 'duplicate'). Defaults to 'noise'.
            factor (float): Factor for noise addition or duplication ratio. Defaults to 0.1.
            
        Returns:
            pd.DataFrame: Augmented DataFrame.
        """
        try:
            augmented_data = data.copy()
            if method == 'noise' and self.numerical_cols:
                noise = np.random.normal(0, factor, size=(len(data), len(self.numerical_cols)))
                augmented_data[self.numerical_cols] += noise
                augmented_data = pd.concat([data, augmented_data], ignore_index=True)
            elif method == 'duplicate':
                sample_size = int(len(data) * factor)
                sampled_data = data.sample(sample_size, replace=True)
                augmented_data = pd.concat([data, sampled_data], ignore_index=True)
            else:
                self.logger.warning(f"Unsupported augmentation method: {method}")
                return data
                
            self.logger.info(f"Data augmented using {method} method, new shape: {augmented_data.shape}")
            return augmented_data
        except Exception as e:
            self.logger.error(f"Error augmenting data: {str(e)}")
            raise

    def preprocess_pipeline(self, data: pd.DataFrame, augment: bool = False, 
                           augment_method: str = 'noise', augment_factor: float = 0.1) -> pd.DataFrame:
        """
        Run the full preprocessing pipeline on the input data.
        
        Args:
            data (pd.DataFrame): Raw input DataFrame.
            augment (bool): Whether to apply data augmentation. Defaults to False.
            augment_method (str): Augmentation method if augment is True. Defaults to 'noise'.
            augment_factor (float): Factor for augmentation. Defaults to 0.1.
            
        Returns:
            pd.DataFrame: Fully preprocessed DataFrame.
        """
        try:
            self.logger.info("Starting preprocessing pipeline")
            self.identify_columns(data)
            data = self.handle_missing_values(data)
            data = self.encode_categorical(data)
            data = self.normalize_data(data)
            if augment:
                data = self.augment_data(data, method=augment_method, factor=augment_factor)
            self.logger.info("Preprocessing pipeline completed successfully")
            return data
        except Exception as e:
            self.logger.error(f"Error in preprocessing pipeline: {str(e)}")
            raise

    def save_preprocessed_data(self, data: pd.DataFrame, output_path: Union[str, Path], 
                              file_type: str = 'csv') -> None:
        """
        Save the preprocessed data to a file.
        
        Args:
            data (pd.DataFrame): Preprocessed DataFrame to save.
            output_path (Union[str, Path]): Path to save the file.
            file_type (str): Type of file to save ('csv', 'json', etc.). Defaults to 'csv'.
        """
        try:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            if file_type.lower() == 'csv':
                data.to_csv(output_path, index=False)
            elif file_type.lower() == 'json':
                data.to_json(output_path, orient='records')
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            self.logger.info(f"Preprocessed data saved to {output_path}")
        except Exception as e:
            self.logger.error(f"Error saving preprocessed data: {str(e)}")
            raise

def setup_logging(log_file: Optional[Union[str, Path]] = None) -> logging.Logger:
    """
    Set up logging configuration for the preprocessing script.
    
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
    # Example usage of the DataPreprocessor class
    try:
        logger = setup_logging("preprocess_log.txt")
        preprocessor = DataPreprocessor(logger=logger)
        
        # Load sample data (replace with actual file path)
        data = preprocessor.load_data("sample_data.csv")
        
        # Run preprocessing pipeline with augmentation
        preprocessed_data = preprocessor.preprocess_pipeline(
            data=data,
            augment=True,
            augment_method="noise",
            augment_factor=0.1
        )
        
        # Save preprocessed data
        preprocessor.save_preprocessed_data(preprocessed_data, "preprocessed_data.csv")
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        raise
