# custom_agent.py 
# Example of creating a custom AI agent with specific behaviors for Web3 applications

import numpy as np
import random
import json
import logging
import os
from typing import Dict, List, Any, Optional
from datetime import datetime

# Set up logging for debugging and tracking agent behavior
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('agent_log.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class CustomAgent:
    """
    A custom AI agent designed for Web3 applications like Ontora AI.
    The agent learns and adapts based on user interactions and predefined behaviors.
    It can evolve over time through simulated reinforcement learning.
    """
    def __init__(
        self,
        agent_id: str,
        behaviors: Dict[str, float],
        learning_rate: float = 0.1,
        exploration_rate: float = 0.2,
        config_path: str = "agent_config.json"
    ) -> None:
        """
        Initialize the custom AI agent with unique ID and behaviors.
        
        Args:
            agent_id (str): Unique identifier for the agent.
            behaviors (Dict[str, float]): Dictionary of behavior names and their initial weights.
            learning_rate (float): Rate at which the agent learns from feedback.
            exploration_rate (float): Probability of exploring new actions instead of exploiting known ones.
            config_path (str): Path to save/load agent configuration.
        """
        self.agent_id = agent_id
        self.behaviors = behaviors
        self.learning_rate = learning_rate
        self.exploration_rate = exploration_rate
        self.config_path = config_path
        self.experience = {}  # Store state-action-reward history
        self.current_state = None
        self.total_rewards = 0.0
        logger.info(f"Agent {self.agent_id} initialized with behaviors: {self.behaviors}")

        # Load existing configuration if available
        self.load_config()

    def load_config(self) -> None:
        """
        Load agent configuration and past experience from a JSON file if it exists.
        """
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r') as f:
                    config = json.load(f)
                    if config.get('agent_id') == self.agent_id:
                        self.behaviors = config.get('behaviors', self.behaviors)
                        self.experience = config.get('experience', {})
                        self.total_rewards = config.get('total_rewards', 0.0)
                        logger.info(f"Loaded configuration for agent {self.agent_id} from {self.config_path}")
                    else:
                        logger.warning("Config file exists but agent ID does not match. Using default settings.")
            else:
                logger.info(f"No config file found at {self.config_path}. Starting with default settings.")
        except Exception as e:
            logger.error(f"Error loading config for agent {self.agent_id}: {str(e)}")
            logger.info("Proceeding with default settings.")

    def save_config(self) -> None:
        """
        Save agent configuration and experience to a JSON file.
        """
        try:
            config = {
                'agent_id': self.agent_id,
                'behaviors': self.behaviors,
                'experience': self.experience,
                'total_rewards': self.total_rewards,
                'timestamp': datetime.now().isoformat()
            }
            with open(self.config_path, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info(f"Saved configuration for agent {self.agent_id} to {self.config_path}")
        except Exception as e:
            logger.error(f"Error saving config for agent {self.agent_id}: {str(e)}")

    def set_state(self, state: Any) -> None:
        """
        Update the current state of the agent based on environment or user input.
        
        Args:
            state (Any): The current state or context (e.g., user action, blockchain event).
        """
        self.current_state = str(state)  # Convert to string for consistency in dictionary keys
        if self.current_state not in self.experience:
            self.experience[self.current_state] = {b: 0.0 for b in self.behaviors.keys()}
        logger.debug(f"Agent {self.agent_id} state updated to: {self.current_state}")

    def choose_action(self) -> str:
        """
        Choose an action based on current state using epsilon-greedy policy.
        
        Returns:
            str: The selected behavior/action to perform.
        """
        if self.current_state is None:
            logger.warning(f"Agent {self.agent_id} has no current state. Defaulting to random action.")
            return random.choice(list(self.behaviors.keys()))

        # Epsilon-greedy: Explore with probability exploration_rate, otherwise exploit
        if random.random() < self.exploration_rate:
            action = random.choice(list(self.behaviors.keys()))
            logger.debug(f"Agent {self.agent_id} exploring: chose action {action}")
        else:
            state_experience = self.experience.get(self.current_state, {b: 0.0 for b in self.behaviors.keys()})
            action = max(state_experience, key=state_experience.get)
            logger.debug(f"Agent {self.agent_id} exploiting: chose action {action} based on experience")
        return action

    def perform_action(self, action: str) -> float:
        """
        Simulate performing the chosen action and return a reward.
        In a real application, this could interact with a Web3 API or Solana contract.
        
        Args:
            action (str): The action to perform.
        
        Returns:
            float: Simulated reward for the action.
        """
        try:
            # Simulate reward based on behavior weight (in real use, replace with actual outcome)
            base_reward = self.behaviors.get(action, 0.0)
            noise = random.uniform(-0.1, 0.1)  # Add some randomness to reward
            reward = base_reward + noise
            logger.info(f"Agent {self.agent_id} performed action {action} with reward {reward:.2f}")
            return reward
        except Exception as e:
            logger.error(f"Error performing action {action} for agent {self.agent_id}: {str(e)}")
            return 0.0

    def update_learning(self, action: str, reward: float) -> None:
        """
        Update the agent's experience and behavior weights based on the reward received.
        
        Args:
            action (str): The action that was performed.
            reward (float): The reward received for the action.
        """
        try:
            if self.current_state is None:
                logger.warning(f"Agent {self.agent_id} has no state to update learning.")
                return

            # Update experience for the state-action pair
            current_value = self.experience[self.current_state].get(action, 0.0)
            new_value = current_value + self.learning_rate * (reward - current_value)
            self.experience[self.current_state][action] = new_value

            # Update behavior weight based on reward
            self.behaviors[action] = self.behaviors.get(action, 0.0) + self.learning_rate * reward
            self.total_rewards += reward

            logger.debug(f"Agent {self.agent_id} updated learning for action {action}: new value {new_value:.2f}")
        except Exception as e:
            logger.error(f"Error updating learning for agent {self.agent_id}: {str(e)}")

    def evolve(self, num_iterations: int = 10, state_sequence: Optional[List[Any]] = None) -> List[Dict]:
        """
        Simulate the agent's evolution over a number of iterations or state sequence.
        
        Args:
            num_iterations (int): Number of iterations to run if no state sequence is provided.
            state_sequence (Optional[List[Any]]): List of states to process (e.g., user actions).
        
        Returns:
            List[Dict]: History of actions and rewards for analysis.
        """
        history = []
        iterations = state_sequence if state_sequence else [f"state_{i}" for i in range(num_iterations)]

        try:
            for state in iterations:
                self.set_state(state)
                action = self.choose_action()
                reward = self.perform_action(action)
                self.update_learning(action, reward)
                history.append({
                    'state': state,
                    'action': action,
                    'reward': reward,
                    'total_rewards': self.total_rewards,
                    'timestamp': datetime.now().isoformat()
                })
                logger.info(f"Iteration complete for agent {self.agent_id}: State={state}, Action={action}, Reward={reward:.2f}")
            self.save_config()  # Save progress after evolution
        except Exception as e:
            logger.error(f"Error during evolution of agent {self.agent_id}: {str(e)}")
        return history

    def get_summary(self) -> Dict:
        """
        Get a summary of the agent's current status and performance.
        
        Returns:
            Dict: Summary of agent's ID, behaviors, and total rewards.
        """
        return {
            'agent_id': self.agent_id,
            'behaviors': self.behaviors,
            'total_rewards': self.total_rewards,
            'exploration_rate': self.exploration_rate,
            'learning_rate': self.learning_rate,
            'experience_states': len(self.experience)
        }


def main():
    """
    Main function to demonstrate the usage of the CustomAgent class.
    """
    try:
        # Define initial behaviors with weights (higher weight = more likely to be chosen initially)
        initial_behaviors = {
            'stake_tokens': 0.5,
            'claim_rewards': 0.3,
            'analyze_data': 0.2,
            'idle': 0.1
        }

        # Create a new agent instance
        agent = CustomAgent(
            agent_id="ontora_agent_001",
            behaviors=initial_behaviors,
            learning_rate=0.1,
            exploration_rate=0.2,
            config_path="agent_001_config.json"
        )

        # Simulate a sequence of states (e.g., user interactions or blockchain events)
        state_sequence = [
            "user_login",
            "wallet_connected",
            "low_balance",
            "high_activity",
            "transaction_failed"
        ]

        # Run agent evolution over the state sequence
        history = agent.evolve(state_sequence=state_sequence)

        # Print summary and history
        print("\nAgent Summary:")
        print(json.dumps(agent.get_summary(), indent=2))
        print("\nEvolution History:")
        for entry in history:
            print(f"State: {entry['state']}, Action: {entry['action']}, Reward: {entry['reward']:.2f}")

        logger.info("Demo completed successfully.")
    except Exception as e:
        logger.error(f"Error in main execution: {str(e)}")
        print(f"An error occurred: {str(e)}")


if __name__ == "__main__":
    main()
