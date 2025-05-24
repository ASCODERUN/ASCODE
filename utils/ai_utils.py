import numpy as np 
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
import json
from typing import Dict, List, Tuple, Union, Optional
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class AIUtils:
    def __init__(self, scaler_type: str = 'standard'):
        self.scaler = StandardScaler() if scaler_type == 'standard' else MinMaxScaler()
        self.logger = logging.getLogger(__name__)

    def load_data(self, file_path: str, file_type: str = 'csv') -> pd.DataFrame:
        try:
            if file_type == 'csv':
                data = pd.read_csv(file_path)
            elif file_type == 'json':
                data = pd.read_json(file_path)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            self.logger.info(f"Data loaded successfully from {file_path}")
            return data
        except Exception as e:
            self.logger.error(f"Error loading data: {str(e)}")
            raise

    def clean_data(self, df: pd.DataFrame, drop_na: bool = True, fill_na: Optional[Union[str, float]] = None) -> pd.DataFrame:
        try:
            cleaned_df = df.copy()
            if drop_na:
                cleaned_df = cleaned_df.dropna()
            elif fill_na is not None:
                cleaned_df = cleaned_df.fillna(fill_na)
            cleaned_df = cleaned_df.reset_index(drop=True)
            self.logger.info("Data cleaned successfully")
            return cleaned_df
        except Exception as e:
            self.logger.error(f"Error cleaning data: {str(e)}")
            raise

    def normalize_data(self, df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        try:
            normalized_df = df.copy()
            if columns:
                normalized_df[columns] = self.scaler.fit_transform(normalized_df[columns])
            self.logger.info("Data normalized successfully")
            return normalized_df
        except Exception as e:
            self.logger.error(f"Error normalizing data: {str(e)}")
            raise

    def inverse_normalize(self, df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        try:
            denormalized_df = df.copy()
            if columns:
                denormalized_df[columns] = self.scaler.inverse_transform(denormalized_df[columns])
            self.logger.info("Data denormalized successfully")
            return denormalized_df
        except Exception as e:
            self.logger.error(f"Error denormalizing data: {str(e)}")
            raise

    def split_data(self, df: pd.DataFrame, target_column: str, test_size: float = 0.2, 
                   random_state: int = 42) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        try:
            X = df.drop(columns=[target_column]).values
            y = df[target_column].values
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=test_size, random_state=random_state
            )
            self.logger.info("Data split into training and testing sets")
            return X_train, X_test, y_train, y_test
        except Exception as e:
            self.logger.error(f"Error splitting data: {str(e)}")
            raise

    def format_for_model(self, data: Union[pd.DataFrame, np.ndarray], 
                         reshape_dims: Optional[Tuple[int, ...]] = None) -> np.ndarray:
        try:
            if isinstance(data, pd.DataFrame):
                formatted_data = data.values
            else:
                formatted_data = data
            if reshape_dims:
                formatted_data = formatted_data.reshape(reshape_dims)
            self.logger.info("Data formatted for model input")
            return formatted_data
        except Exception as e:
            self.logger.error(f"Error formatting data for model: {str(e)}")
            raise

    def encode_labels(self, labels: Union[pd.Series, List], encoding_type: str = 'one_hot') -> Union[np.ndarray, List]:
        try:
            if encoding_type == 'one_hot':
                unique_labels = sorted(set(labels))
                label_map = {label: idx for idx, label in enumerate(unique_labels)}
                encoded = np.zeros((len(labels), len(unique_labels)))
                for idx, label in enumerate(labels):
                    encoded[idx, label_map[label]] = 1
                result = encoded
            else:
                result = labels
            self.logger.info(f"Labels encoded using {encoding_type}")
            return result
        except Exception as e:
            self.logger.error(f"Error encoding labels: {str(e)}")
            raise

    def preprocess_web3_data(self, data: Union[pd.DataFrame, Dict], 
                             key_fields: List[str] = None) -> pd.DataFrame:
        try:
            if isinstance(data, dict):
                df = pd.DataFrame(data)
            else:
                df = data
            if key_fields:
                df = df[key_fields]
            df = self.clean_data(df)
            self.logger.info("Web3 data preprocessed successfully")
            return df
        except Exception as e:
            self.logger.error(f"Error preprocessing Web3 data: {str(e)}")
            raise

    def save_processed_data(self, df: pd.DataFrame, output_path: str, 
                            file_type: str = 'csv') -> None:
        try:
            if file_type == 'csv':
                df.to_csv(output_path, index=False)
            elif file_type == 'json':
                df.to_json(output_path, orient='records', indent=2)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
            self.logger.info(f"Processed data saved to {output_path}")
        except Exception as e:
            self.logger.error(f"Error saving processed data: {str(e)}")
            raise

    def load_model_input(self, data: Union[str, pd.DataFrame], 
                         is_file: bool = False, file_type: str = 'csv') -> np.ndarray:
        try:
            if is_file:
                df = self.load_data(data, file_type)
            else:
                df = data
            processed = self.clean_data(df)
            formatted = self.format_for_model(processed)
            self.logger.info("Model input loaded and processed")
            return formatted
        except Exception as e:
            self.logger.error(f"Error loading model input: {str(e)}")
            raise
