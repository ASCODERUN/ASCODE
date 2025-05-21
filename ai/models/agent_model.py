import torch 
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import Dict, List, Tuple, Optional
from collections import deque
import random
import json
import logging

# Set up logging for debugging and monitoring
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AgentConfig:
    """Configuration class for the AI agent model."""
    def __init__(self, config_dict: Optional[Dict] = None):
        self.state_dim = config_dict.get('state_dim', 64) if config_dict else 64
        self.action_dim = config_dict.get('action_dim', 4) if config_dict else 4
        self.hidden_dim = config_dict.get('hidden_dim', 128) if config_dict else 128
        self.learning_rate = config_dict.get('learning_rate', 0.001) if config_dict else 0.001
        self.gamma = config_dict.get('gamma', 0.99) if config_dict else 0.99
        self.epsilon_start = config_dict.get('epsilon_start', 1.0) if config_dict else 1.0
        self.epsilon_end = config_dict.get('epsilon_end', 0.02) if config_dict else 0.02
        self.epsilon_decay = config_dict.get('epsilon_decay', 1000) if config_dict else 1000
        self.memory_size = config_dict.get('memory_size', 10000) if config_dict else 10000
        self.batch_size = config_dict.get('batch_size', 64) if config_dict else 64
        self.target_update_freq = config_dict.get('target_update_freq', 100) if config_dict else 100
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def to_dict(self) -> Dict:
        """Convert configuration to dictionary for saving."""
        return {
            'state_dim': self.state_dim,
            'action_dim': self.action_dim,
            'hidden_dim': self.hidden_dim,
            'learning_rate': self.learning_rate,
            'gamma': self.gamma,
            'epsilon_start': self.epsilon_start,
            'epsilon_end': self.epsilon_end,
            'epsilon_decay': self.epsilon_decay,
            'memory_size': self.memory_size,
            'batch_size': self.batch_size,
            'target_update_freq': self.target_update_freq
        }

class AgentNetwork(nn.Module):
    """Neural network for the AI agent using a deep Q-network architecture."""
    def __init__(self, state_dim: int, action_dim: int, hidden_dim: int):
        super(AgentNetwork, self).__init__()
        self.layer1 = nn.Linear(state_dim, hidden_dim)
        self.layer2 = nn.Linear(hidden_dim, hidden_dim)
        self.layer3 = nn.Linear(hidden_dim, action_dim)
        self.relu = nn.ReLU()

    def forward(self, state: torch.Tensor) -> torch.Tensor:
        x = self.relu(self.layer1(state))
        x = self.relu(self.layer2(x))
        x = self.layer3(x)
        return x

class ReplayMemory:
    """Experience replay buffer for storing and sampling transitions."""
    def __init__(self, capacity: int):
        self.memory = deque(maxlen=capacity)

    def push(self, state: np.ndarray, action: int, reward: float, next_state: np.ndarray, done: bool):
        """Add a transition to memory."""
        self.memory.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int) -> List[Tuple]:
        """Randomly sample a batch of transitions."""
        return random.sample(self.memory, batch_size)

    def __len__(self) -> int:
        return len(self.memory)

class OntoraAgent:
    """Core AI agent for decision-making and behavior prediction in Web3 context."""
    def __init__(self, config: AgentConfig, model_path: Optional[str] = None):
        self.config = config
        self.policy_net = AgentNetwork(config.state_dim, config.action_dim, config.hidden_dim).to(config.device)
        self.target_net = AgentNetwork(config.state_dim, config.action_dim, config.hidden_dim).to(config.device)
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=config.learning_rate)
        self.memory = ReplayMemory(config.memory_size)
        self.frame_idx = 0
        self.epsilon = config.epsilon_start
        
        if model_path:
            self.load_model(model_path)
        logger.info(f"Agent initialized with device: {config.device}")

    def select_action(self, state: np.ndarray) -> int:
        """Select an action using epsilon-greedy policy."""
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.config.device)
        self.epsilon = self.config.epsilon_end + (self.config.epsilon_start - self.config.epsilon_end) * \
                       np.exp(-1. * self.frame_idx / self.config.epsilon_decay)
        self.frame_idx += 1

        if random.random() < self.epsilon:
            return random.randrange(self.config.action_dim)
        else:
            with torch.no_grad():
                q_values = self.policy_net(state_tensor)
                return q_values.max(1)[1].item()

    def store_transition(self, state: np.ndarray, action: int, reward: float, next_state: np.ndarray, done: bool):
        """Store a transition in memory for experience replay."""
        self.memory.push(state, action, reward, next_state, done)

    def optimize_model(self):
        """Optimize the model using experience replay and DQN loss."""
        if len(self.memory) < self.config.batch_size:
            return

        transitions = self.memory.sample(self.config.batch_size)
        batch_state, batch_action, batch_reward, batch_next_state, batch_done = zip(*transitions)

        state_batch = torch.FloatTensor(batch_state).to(self.config.device)
        action_batch = torch.LongTensor(batch_action).to(self.config.device)
        reward_batch = torch.FloatTensor(batch_reward).to(self.config.device)
        next_state_batch = torch.FloatTensor(batch_next_state).to(self.config.device)
        done_batch = torch.FloatTensor(batch_done).to(self.config.device)

        current_q_values = self.policy_net(state_batch).gather(1, action_batch.unsqueeze(1))
        next_q_values = self.target_net(next_state_batch).max(1)[0].detach()
        target_q_values = reward_batch + self.config.gamma * next_q_values * (1 - done_batch)

        loss = nn.MSELoss()(current_q_values.squeeze(), target_q_values)

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        if self.frame_idx % self.config.target_update_freq == 0:
            self.target_net.load_state_dict(self.policy_net.state_dict())
            logger.info(f"Target network updated at frame {self.frame_idx}")

    def evolve(self, user_feedback: float, custom_params: Optional[Dict] = None):
        """Evolve the agent's behavior based on user feedback or custom parameters."""
        if custom_params:
            for param_name, param_value in custom_params.items():
                if hasattr(self.config, param_name):
                    setattr(self.config, param_name, param_value)
                    logger.info(f"Updated config {param_name} to {param_value}")
        
        # Adjust learning rate based on feedback (simple heuristic)
        if user_feedback < 0:
            new_lr = max(self.config.learning_rate * 0.9, 1e-5)
            for param_group in self.optimizer.param_groups:
                param_group['lr'] = new_lr
            self.config.learning_rate = new_lr
            logger.info(f"Reduced learning rate to {new_lr} due to negative feedback")
        elif user_feedback > 0:
            new_lr = min(self.config.learning_rate * 1.1, 0.01)
            for param_group in self.optimizer.param_groups:
                param_group['lr'] = new_lr
            self.config.learning_rate = new_lr
            logger.info(f"Increased learning rate to {new_lr} due to positive feedback")

    def save_model(self, path: str):
        """Save the agent's model and configuration."""
        torch.save({
            'policy_net_state_dict': self.policy_net.state_dict(),
            'target_net_state_dict': self.target_net.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'config': self.config.to_dict(),
            'frame_idx': self.frame_idx,
            'epsilon': self.epsilon
        }, path)
        logger.info(f"Model saved to {path}")

    def load_model(self, path: str):
        """Load the agent's model and configuration."""
        checkpoint = torch.load(path, map_location=self.config.device)
        self.policy_net.load_state_dict(checkpoint['policy_net_state_dict'])
        self.target_net.load_state_dict(checkpoint['target_net_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.config = AgentConfig(checkpoint['config'])
        self.frame_idx = checkpoint['frame_idx']
        self.epsilon = checkpoint['epsilon']
        logger.info(f"Model loaded from {path}")

    def predict_behavior(self, state: np.ndarray) -> Dict[str, float]:
        """Predict behavior probabilities for a given state."""
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.config.device)
        with torch.no_grad():
            q_values = self.policy_net(state_tensor).softmax(dim=1).squeeze().cpu().numpy()
        return {f"action_{i}": float(prob) for i, prob in enumerate(q_values)}

def create_agent_from_config(config_path: str) -> OntoraAgent:
    """Create an agent from a JSON configuration file."""
    with open(config_path, 'r') as f:
        config_dict = json.load(f)
    config = AgentConfig(config_dict)
    return OntoraAgent(config)

if __name__ == "__main__":
    # Example usage of the agent
    config = AgentConfig({
        'state_dim': 64,
        'action_dim': 4,
        'hidden_dim': 128,
        'learning_rate': 0.001,
        'memory_size': 10000,
        'batch_size': 64
    })
    agent = OntoraAgent(config)

    # Simulate a simple training loop
    num_episodes = 10
    for episode in range(num_episodes):
        state = np.random.randn(config.state_dim)  # Mock state
        done = False
        total_reward = 0

        while not done:
            action = agent.select_action(state)
            next_state = np.random.randn(config.state_dim)  # Mock next state
            reward = random.uniform(-1, 1)  # Mock reward
            done = random.random() < 0.1  # Randomly end episode

            agent.store_transition(state, action, reward, next_state, done)
            agent.optimize_model()
            total_reward += reward
            state = next_state

        logger.info(f"Episode {episode + 1}/{num_episodes}, Total Reward: {total_reward:.2f}")

        # Simulate user feedback for evolution
        user_feedback = random.uniform(-1, 1)
        agent.evolve(user_feedback)

    # Save the model
    agent.save_model("ontora_agent.pth")

    # Predict behavior for a sample state
    sample_state = np.random.randn(config.state_dim)
    behavior_probs = agent.predict_behavior(sample_state)
    logger.info(f"Behavior prediction: {behavior_probs}")
