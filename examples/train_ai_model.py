# train_ai_model.py
# Example of training an AI model with sample data and configurations using TensorFlow/Keras

import os
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import logging

# Set up logging for debugging and tracking
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set random seed for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# Define paths for saving model and logs
MODEL_DIR = "models"
LOG_DIR = "logs"
DATA_DIR = "data"
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# Function to generate synthetic data for demonstration
def generate_synthetic_data(num_samples=1000, num_features=10, num_classes=3):
    """
    Generate synthetic data for classification task.
    Simulates Web3 user behavior data (e.g., transaction frequency, wallet balance, etc.).
    """
    try:
        logger.info("Generating synthetic data for training...")
        X = np.random.randn(num_samples, num_features)
        y = np.random.randint(0, num_classes, num_samples)
        feature_names = [f"feature_{i}" for i in range(num_features)]
        data = pd.DataFrame(X, columns=feature_names)
        data['label'] = y
        return data
    except Exception as e:
        logger.error(f"Error generating synthetic data: {str(e)}")
        raise

# Function to load data (replace with real data loading logic)
def load_data():
    """
    Load data for training. Currently uses synthetic data.
    Replace this with actual Web3 data loading (e.g., from CSV, API, or blockchain).
    """
    try:
        logger.info("Loading data...")
        # Replace this with real data loading logic if available
        # Example: data = pd.read_csv(os.path.join(DATA_DIR, 'web3_user_data.csv'))
        data = generate_synthetic_data()
        logger.info(f"Data loaded successfully. Shape: {data.shape}")
        return data
    except Exception as e:
        logger.error(f"Error loading data: {str(e)}")
        raise

# Function to preprocess data
def preprocess_data(data, test_size=0.2, random_state=42):
    """
    Preprocess data by splitting features and labels, scaling features, and splitting into train/test sets.
    """
    try:
        logger.info("Preprocessing data...")
        X = data.drop('label', axis=1)
        y = data['label']
        
        # Split into training and testing sets
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        logger.info(f"Data preprocessing completed. Train shape: {X_train.shape}, Test shape: {X_test.shape}")
        return X_train_scaled, X_test_scaled, y_train, y_test, scaler
    except Exception as e:
        logger.error(f"Error preprocessing data: {str(e)}")
        raise

# Function to build the AI model
def build_model(input_shape, num_classes, learning_rate=0.001):
    """
    Build a neural network model using Keras for classification.
    """
    try:
        logger.info("Building AI model...")
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(64, activation='relu', input_shape=input_shape),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation='relu'),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(num_classes, activation='softmax')
        ])
        
        optimizer = tf.keras.optimizers.Adam(learning_rate=learning_rate)
        model.compile(
            optimizer=optimizer,
            loss='sparse_categorical_crossentropy',
            metrics=['accuracy']
        )
        
        logger.info("Model built successfully.")
        model.summary()
        return model
    except Exception as e:
        logger.error(f"Error building model: {str(e)}")
        raise

# Function to train the model
def train_model(model, X_train, y_train, X_test, y_test, epochs=50, batch_size=32):
    """
    Train the AI model with training data and validate on test data.
    """
    try:
        logger.info("Starting model training...")
        # Define callbacks for early stopping and model checkpointing
        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=10, restore_best_weights=True
        )
        checkpoint_path = os.path.join(MODEL_DIR, "best_model.ckpt")
        checkpoint = tf.keras.callbacks.ModelCheckpoint(
            checkpoint_path, save_best_only=True, monitor='val_accuracy', mode='max', save_weights_only=True
        )
        
        # Train the model
        history = model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=[early_stopping, checkpoint],
            verbose=1
        )
        
        logger.info("Model training completed.")
        return history
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise

# Function to evaluate the model
def evaluate_model(model, X_test, y_test):
    """
    Evaluate the trained model on test data and print metrics.
    """
    try:
        logger.info("Evaluating model...")
        test_loss, test_accuracy = model.evaluate(X_test, y_test, verbose=0)
        logger.info(f"Test Loss: {test_loss:.4f}, Test Accuracy: {test_accuracy:.4f}")
        
        # Generate predictions for detailed metrics
        y_pred = np.argmax(model.predict(X_test, verbose=0), axis=1)
        logger.info("\nClassification Report:")
        logger.info(classification_report(y_test, y_pred))
        
        # Log confusion matrix
        logger.info("\nConfusion Matrix:")
        cm = confusion_matrix(y_test, y_pred)
        logger.info(cm)
    except Exception as e:
        logger.error(f"Error evaluating model: {str(e)}")
        raise

# Function to plot training history
def plot_training_history(history):
    """
    Plot training and validation loss/accuracy over epochs.
    """
    try:
        logger.info("Plotting training history...")
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
        
        # Plot accuracy
        ax1.plot(history.history['accuracy'], label='Train Accuracy')
        ax1.plot(history.history['val_accuracy'], label='Validation Accuracy')
        ax1.set_title('Model Accuracy')
        ax1.set_xlabel('Epoch')
        ax1.set_ylabel('Accuracy')
        ax1.legend()
        
        # Plot loss
        ax2.plot(history.history['loss'], label='Train Loss')
        ax2.plot(history.history['val_loss'], label='Validation Loss')
        ax2.set_title('Model Loss')
        ax2.set_xlabel('Epoch')
        ax2.set_ylabel('Loss')
        ax2.legend()
        
        plt.tight_layout()
        plot_path = os.path.join(LOG_DIR, f"training_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
        plt.savefig(plot_path)
        plt.close()
        logger.info(f"Training history plot saved to {plot_path}")
    except Exception as e:
        logger.error(f"Error plotting training history: {str(e)}")
        raise

# Function to save the final model
def save_model(model, model_name="ontora_ai_model"):
    """
    Save the trained model for future use.
    """
    try:
        logger.info("Saving model...")
        model_path = os.path.join(MODEL_DIR, f"{model_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        model.save(model_path)
        logger.info(f"Model saved to {model_path}")
    except Exception as e:
        logger.error(f"Error saving model: {str(e)}")
        raise

# Main function to orchestrate the training process
def main():
    """
    Main function to load data, preprocess, build, train, evaluate, and save the AI model.
    """
    try:
        logger.info("Starting AI model training pipeline...")
        
        # Load and preprocess data
        data = load_data()
        X_train, X_test, y_train, y_test, scaler = preprocess_data(data)
        
        # Determine input shape and number of classes
        input_shape = (X_train.shape[1],)
        num_classes = len(np.unique(y_train))
        logger.info(f"Input shape: {input_shape}, Number of classes: {num_classes}")
        
        # Build model
        model = build_model(input_shape, num_classes)
        
        # Train model
        history = train_model(model, X_train, y_train, X_test, y_test)
        
        # Evaluate model
        evaluate_model(model, X_test, y_test)
        
        # Plot training history
        plot_training_history(history)
        
        # Save model
        save_model(model)
        
        logger.info("AI model training pipeline completed successfully.")
    except Exception as e:
        logger.error(f"Error in main pipeline: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.critical(f"Critical error occurred: {str(e)}")
        exit(1)
