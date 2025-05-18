import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset, Subset
import numpy as np
import argparse
import logging
import os
import copy
import random
from sklearn.metrics import accuracy_score
import matplotlib.pyplot as plt
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("federated_learning.log"),
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

class Client:
    def __init__(self, client_id, data_loader, model, device, learning_rate=0.01):
        self.client_id = client_id
        self.data_loader = data_loader
        self.model = copy.deepcopy(model)
        self.device = device
        self.optimizer = optim.SGD(self.model.parameters(), lr=learning_rate)
        self.criterion = nn.CrossEntropyLoss()
    
    def train(self, epochs=1):
        """Train the local model on client's private data."""
        self.model.train()
        total_loss = 0.0
        for epoch in range(epochs):
            epoch_loss = 0.0
            for inputs, labels in self.data_loader:
                inputs, labels = inputs.to(self.device), labels.to(self.device)
                self.optimizer.zero_grad()
                outputs = self.model(inputs)
                loss = self.criterion(outputs, labels)
                loss.backward()
                self.optimizer.step()
                epoch_loss += loss.item()
            total_loss += epoch_loss / len(self.data_loader)
        avg_loss = total_loss / epochs
        logger.info(f"Client {self.client_id} - Local Training Loss: {avg_loss:.4f}")
        return self.model.state_dict(), avg_loss
    
    def evaluate(self):
        """Evaluate the local model on client's data."""
        self.model.eval()
        correct = 0
        total = 0
        total_loss = 0.0
        with torch.no_grad():
            for inputs, labels in self.data_loader:
                inputs, labels = inputs.to(self.device), labels.to(self.device)
                outputs = self.model(inputs)
                loss = self.criterion(outputs, labels)
                total_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
        accuracy = 100 * correct / total
        avg_loss = total_loss / len(self.data_loader)
        return accuracy, avg_loss

class FederatedServer:
    def __init__(self, global_model, num_clients, client_fraction=1.0):
        self.global_model = global_model
        self.num_clients = num_clients
        self.client_fraction = client_fraction
    
    def select_clients(self):
        """Select a subset of clients for this round based on client_fraction."""
        num_selected = max(1, int(self.num_clients * self.client_fraction))
        selected_clients = random.sample(range(self.num_clients), num_selected)
        logger.info(f"Selected {num_selected} clients for this round: {selected_clients}")
        return selected_clients
    
    def aggregate_models(self, client_updates, client_weights=None):
        """Aggregate client models using FedAvg (weighted average)."""
        if client_weights is None:
            client_weights = [1.0 / len(client_updates) for _ in range(len(client_updates))]
        global_dict = copy.deepcopy(client_updates[0])
        for key in global_dict.keys():
            global_dict[key] = sum(
                client_dict[key] * weight for client_dict, weight in zip(client_updates, client_weights)
            )
        self.global_model.load_state_dict(global_dict)
        logger.info("Global model updated via FedAvg aggregation")
        return self.global_model

def split_data(dataset, num_clients, method='iid'):
    """Split dataset across clients (IID or Non-IID)."""
    data_size = len(dataset)
    client_data = []
    if method == 'iid':
        indices = list(range(data_size))
        random.shuffle(indices)
        chunk_size = data_size // num_clients
        for i in range(num_clients):
            start_idx = i * chunk_size
            end_idx = (i + 1) * chunk_size if i < num_clients - 1 else data_size
            client_indices = indices[start_idx:end_idx]
            client_data.append(Subset(dataset, client_indices))
    elif method == 'non_iid':
        # Simple non-IID: Assign data based on label distribution (simulated)
        labels = [label for _, label in dataset]
        unique_labels = sorted(set(labels))
        num_labels_per_client = len(unique_labels) // num_clients
        for i in range(num_clients):
            client_labels = unique_labels[i * num_labels_per_client:(i + 1) * num_labels_per_client]
            client_indices = [idx for idx, (_, label) in enumerate(dataset) if label in client_labels]
            client_data.append(Subset(dataset, client_indices))
    logger.info(f"Data split across {num_clients} clients using {method} method")
    return client_data

def evaluate_global_model(model, data_loader, device):
    """Evaluate the global model on a test dataset."""
    model.eval()
    correct = 0
    total = 0
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()
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

def save_model(model, model_path):
    """Save the model to a file."""
    try:
        torch.save(model.state_dict(), model_path)
        logger.info(f"Model saved successfully to {model_path}")
    except Exception as e:
        logger.error(f"Error saving model to {model_path}: {str(e)}")
        raise

def main():
    parser = argparse.ArgumentParser(description="Federated Learning Script for Decentralized Training")
    parser.add_argument('--num-clients', type=int, default=5, help='Number of clients in federated learning')
    parser.add_argument('--client-fraction', type=float, default=1.0, help='Fraction of clients to select each round (0 to 1)')
    parser.add_argument('--rounds', type=int, default=10, help='Number of federated learning rounds')
    parser.add_argument('--local-epochs', type=int, default=1, help='Number of local epochs per client per round')
    parser.add_argument('--batch-size', type=int, default=64, help='Batch size for data loading')
    parser.add_argument('--learning-rate', type=float, default=0.01, help='Learning rate for local training')
    parser.add_argument('--data-split', type=str, default='iid', choices=['iid', 'non_iid'], help='Data distribution method: iid or non_iid')
    parser.add_argument('--device', type=str, default='cpu', choices=['cpu', 'cuda'], help='Device to use for computation')
    parser.add_argument('--output-path', type=str, default='global_model.pth', help='Path to save the global model')
    args = parser.parse_args()

    # Set device
    device = torch.device(args.device if torch.cuda.is_available() else 'cpu')
    logger.info(f"Using device: {device}")

    # Create dummy data for demonstration (replace with real dataset)
    dummy_data = torch.randn(5000, 784)
    dummy_labels = torch.randint(0, 10, (5000,))
    full_dataset = TensorDataset(dummy_data, dummy_labels)
    test_data = torch.randn(1000, 784)
    test_labels = torch.randint(0, 10, (1000,))
    test_dataset = TensorDataset(test_data, test_labels)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    # Split data across clients
    client_datasets = split_data(full_dataset, args.num_clients, method=args.data_split)
    client_loaders = [
        DataLoader(dataset, batch_size=args.batch_size, shuffle=True)
        for dataset in client_datasets
    ]

    # Initialize global model and federated server
    global_model = SimpleModel().to(device)
    server = FederatedServer(global_model, args.num_clients, args.client_fraction)

    # Initialize clients
    clients = [
        Client(i, client_loaders[i], global_model, device, args.learning_rate)
        for i in range(args.num_clients)
    ]

    # Track metrics for plotting
    global_accuracies = []
    global_losses = []
    inference_times = []

    # Federated learning rounds
    for round in range(args.rounds):
        logger.info(f"Starting Round {round+1}/{args.rounds}")
        
        # Select clients for this round
        selected_client_ids = server.select_clients()
        selected_clients = [clients[i] for i in selected_client_ids]
        
        # Local training on selected clients
        client_updates = []
        client_weights = []
        for client in selected_clients:
            local_model_dict, local_loss = client.train(epochs=args.local_epochs)
            client_updates.append(local_model_dict)
            client_weights.append(1.0)  # Equal weight for simplicity; can be based on data size
        
        # Aggregate updates to update global model
        server.aggregate_models(client_updates, client_weights)
        
        # Distribute updated global model to all clients
        for client in clients:
            client.model.load_state_dict(server.global_model.state_dict())
        
        # Evaluate global model on test data
        accuracy, loss, inference_time = evaluate_global_model(server.global_model, test_loader, device)
        logger.info(f"Round {round+1} - Global Model Accuracy: {accuracy:.2f}%, Loss: {loss:.4f}, Inference Time: {inference_time:.6f}s")
        
        global_accuracies.append(accuracy)
        global_losses.append(loss)
        inference_times.append(inference_time)
    
    # Save the final global model
    save_model(server.global_model, args.output_path)

    # Plot training progress
    rounds = list(range(1, args.rounds + 1))
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 12))
    
    ax1.plot(rounds, global_accuracies, marker='o', label='Global Accuracy')
    ax1.set_title('Global Model Accuracy Over Rounds')
    ax1.set_xlabel('Round')
    ax1.set_ylabel('Accuracy (%)')
    ax1.grid(True)
    ax1.legend()
    
    ax2.plot(rounds, global_losses, marker='o', label='Global Loss')
    ax2.set_title('Global Model Loss Over Rounds')
    ax2.set_xlabel('Round')
    ax2.set_ylabel('Loss')
    ax2.grid(True)
    ax2.legend()
    
    ax3.plot(rounds, inference_times, marker='o', label='Inference Time')
    ax3.set_title('Global Model Inference Time Over Rounds')
    ax3.set_xlabel('Round')
    ax3.set_ylabel('Time (s)')
    ax3.grid(True)
    ax3.legend()
    
    plt.tight_layout()
    plt.savefig('federated_learning_progress.png')
    plt.close()
    logger.info("Training progress plots saved as 'federated_learning_progress.png'")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        raise
