import torch
import torch.nn as nn
import torch.nn.utils.prune as prune
import torch.quantization
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import argparse
import logging
import os
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import matplotlib.pyplot as plt
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("model_optimization.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Set random seed for reproducibility
torch.manual_seed(42)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(42)

class SimpleModel(nn.Module):
    def __init__(self, input_size=784, hidden_size=500, num_classes=10):
        super(SimpleModel, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)
    
    def forward(self, x):
        x = x.view(x.size(0), -1)
        x = self.fc1(x)
        x = self.relu(x)
        x = self.fc2(x)
        return x

def load_model(model_path, model, device='cpu'):
    """Load a pre-trained model from a file."""
    try:
        model.load_state_dict(torch.load(model_path, map_location=device))
        logger.info(f"Model loaded successfully from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Error loading model from {model_path}: {str(e)}")
        raise

def save_model(model, model_path):
    """Save the optimized model to a file."""
    try:
        torch.save(model.state_dict(), model_path)
        logger.info(f"Model saved successfully to {model_path}")
    except Exception as e:
        logger.error(f"Error saving model to {model_path}: {str(e)}")
        raise

def evaluate_model(model, data_loader, device, criterion=nn.CrossEntropyLoss()):
    """Evaluate the model on a given dataset."""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    inference_time = 0.0
    
    with torch.no_grad():
        for inputs, labels in data_loader:
            inputs, labels = inputs.to(device), labels.to(device)
            start_time = time.time()
            outputs = model(inputs)
            inference_time += time.time() - start_time
            loss = criterion(outputs, labels)
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
    
    accuracy = 100 * correct / total
    avg_loss = total_loss / len(data_loader)
    avg_inference_time = inference_time / len(data_loader)
    return accuracy, avg_loss, avg_inference_time

def apply_pruning(model, pruning_rate=0.5, method='l1_unstructured'):
    """Apply pruning to the model (structured or unstructured)."""
    try:
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear) or isinstance(module, nn.Conv2d):
                if method == 'l1_unstructured':
                    prune.l1_unstructured(module, name='weight', amount=pruning_rate)
                elif method == 'global_unstructured':
                    prune.global_unstructured(
                        [(module, 'weight')],
                        pruning_method=prune.L1Unstructured,
                        amount=pruning_rate
                    )
                logger.info(f"Applied {method} pruning to {name} with rate {pruning_rate}")
        return model
    except Exception as e:
        logger.error(f"Error during pruning: {str(e)}")
        raise

def remove_pruning_reparametrization(model):
    """Remove pruning reparametrization to finalize the pruned model."""
    try:
        for name, module in model.named_modules():
            if isinstance(module, nn.Linear) or isinstance(module, nn.Conv2d):
                prune.remove(module, 'weight')
        logger.info("Pruning reparametrization removed")
        return model
    except Exception as e:
        logger.error(f"Error removing pruning reparametrization: {str(e)}")
        raise

def apply_quantization_aware_training(model, train_loader, device, epochs=5, lr=0.001):
    """Perform quantization-aware training (QAT)."""
    try:
        model.train()
        model.qconfig = torch.quantization.get_default_qat_qconfig('fbgemm')
        torch.quantization.prepare_qat(model, inplace=True)
        optimizer = torch.optim.Adam(model.parameters(), lr=lr)
        criterion = nn.CrossEntropyLoss()
        
        logger.info("Starting quantization-aware training...")
        for epoch in range(epochs):
            running_loss = 0.0
            for inputs, labels in train_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()
                running_loss += loss.item()
            logger.info(f"QAT Epoch {epoch+1}/{epochs}, Loss: {running_loss/len(train_loader):.4f}")
        
        model = torch.quantization.convert(model.eval(), inplace=True)
        logger.info("Quantization-aware training completed and model converted to quantized format")
        return model
    except Exception as e:
        logger.error(f"Error during quantization-aware training: {str(e)}")
        raise

def apply_post_training_quantization(model, device):
    """Apply post-training quantization (PTQ)."""
    try:
        model.eval()
        model.qconfig = torch.quantization.get_default_qconfig('fbgemm')
        torch.quantization.prepare(model, inplace=True)
        model = torch.quantization.convert(model, inplace=True)
        logger.info("Post-training quantization applied")
        return model
    except Exception as e:
        logger.error(f"Error during post-training quantization: {str(e)}")
        raise

def get_model_size(model):
    """Calculate the size of the model in bytes."""
    try:
        torch.save(model.state_dict(), "temp_model.pth")
        size = os.path.getsize("temp_model.pth")
        os.remove("temp_model.pth")
        return size
    except Exception as e:
        logger.error(f"Error calculating model size: {str(e)}")
        return 0

def main():
    parser = argparse.ArgumentParser(description="Model Optimization Script for Pruning and Quantization")
    parser.add_argument('--model-path', type=str, default='model.pth', help='Path to the pre-trained model')
    parser.add_argument('--output-path', type=str, default='optimized_model.pth', help='Path to save the optimized model')
    parser.add_argument('--pruning-rate', type=float, default=0.5, help='Pruning rate (0 to 1)')
    parser.add_argument('--pruning-method', type=str, default='l1_unstructured', choices=['l1_unstructured', 'global_unstructured'], help='Pruning method')
    parser.add_argument('--quantization-type', type=str, default='qat', choices=['qat', 'ptq'], help='Quantization type: qat (quantization-aware training) or ptq (post-training quantization)')
    parser.add_argument('--epochs', type=int, default=5, help='Number of epochs for QAT')
    parser.add_argument('--batch-size', type=int, default=64, help='Batch size for data loading')
    parser.add_argument('--device', type=str, default='cpu', choices=['cpu', 'cuda'], help='Device to use for computation')
    args = parser.parse_args()

    # Set device
    device = torch.device(args.device if torch.cuda.is_available() else 'cpu')
    logger.info(f"Using device: {device}")

    # Create dummy data for demonstration (replace with real dataset)
    dummy_data = torch.randn(1000, 784)
    dummy_labels = torch.randint(0, 10, (1000,))
    dataset = TensorDataset(dummy_data, dummy_labels)
    train_loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
    test_loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False)

    # Initialize and load model
    model = SimpleModel().to(device)
    if os.path.exists(args.model_path):
        model = load_model(args.model_path, model, device)
    else:
        logger.warning(f"Model path {args.model_path} not found. Using randomly initialized model for demonstration.")

    # Evaluate original model
    original_accuracy, original_loss, original_time = evaluate_model(model, test_loader, device)
    original_size = get_model_size(model)
    logger.info(f"Original Model - Accuracy: {original_accuracy:.2f}%, Loss: {original_loss:.4f}, Inference Time: {original_time:.6f}s, Size: {original_size/1024**2:.2f} MB")

    # Apply pruning
    if args.pruning_rate > 0:
        model = apply_pruning(model, args.pruning_rate, args.pruning_method)
        model = remove_pruning_reparametrization(model)
        pruned_accuracy, pruned_loss, pruned_time = evaluate_model(model, test_loader, device)
        pruned_size = get_model_size(model)
        logger.info(f"Pruned Model - Accuracy: {pruned_accuracy:.2f}%, Loss: {pruned_loss:.4f}, Inference Time: {pruned_time:.6f}s, Size: {pruned_size/1024**2:.2f} MB")

    # Apply quantization
    if args.quantization_type == 'qat':
        model = apply_quantization_aware_training(model, train_loader, device, epochs=args.epochs)
    elif args.quantization_type == 'ptq':
        model = apply_post_training_quantization(model, device)
    
    # Evaluate optimized model
    optimized_accuracy, optimized_loss, optimized_time = evaluate_model(model, test_loader, device)
    optimized_size = get_model_size(model)
    logger.info(f"Optimized Model - Accuracy: {optimized_accuracy:.2f}%, Loss: {optimized_loss:.4f}, Inference Time: {optimized_time:.6f}s, Size: {optimized_size/1024**2:.2f} MB")

    # Save the optimized model
    save_model(model, args.output_path)

    # Plot comparison of original vs optimized metrics
    metrics = ['Accuracy (%)', 'Inference Time (s)', 'Model Size (MB)']
    original_values = [original_accuracy, original_time, original_size/1024**2]
    optimized_values = [optimized_accuracy, optimized_time, optimized_size/1024**2]
    
    x = np.arange(len(metrics))
    width = 0.35
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.bar(x - width/2, original_values, width, label='Original')
    ax.bar(x + width/2, optimized_values, width, label='Optimized')
    ax.set_xlabel('Metrics')
    ax.set_ylabel('Values')
    ax.set_title('Comparison of Original vs Optimized Model')
    ax.set_xticks(x)
    ax.set_xticklabels(metrics)
    ax.legend()
    plt.tight_layout()
    plt.savefig('optimization_comparison.png')
    plt.close()
    logger.info("Optimization comparison plot saved as 'optimization_comparison.png'")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        raise
