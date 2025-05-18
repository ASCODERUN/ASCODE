import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';

class SolanaUtils {
  constructor(clusterUrl = 'https://api.devnet.solana.com') {
    this.connection = new Connection(clusterUrl, 'confirmed');
    this.wallet = null;
  }

  async connectWallet(privateKeyString) {
    try {
      const decodedKey = bs58.decode(privateKeyString);
      this.wallet = Keypair.fromSecretKey(decodedKey);
      const balance = await this.getBalance(this.wallet.publicKey);
      return {
        success: true,
        publicKey: this.wallet.publicKey.toString(),
        balance: balance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getBalance(publicKeyOrString) {
    try {
      const publicKey = typeof publicKeyOrString === 'string'
        ? new PublicKey(publicKeyOrString)
        : publicKeyOrString;
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      throw new Error(`Failed to fetch balance: ${error.message}`);
    }
  }

  async sendSol(toPublicKeyString, amountInSol) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    try {
      const toPublicKey = new PublicKey(toPublicKeyString);
      const lamports = amountInSol * LAMPORTS_PER_SOL;
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: toPublicKey,
          lamports: lamports,
        })
      );
      const signature = await this.connection.sendTransaction(transaction, [this.wallet]);
      await this.connection.confirmTransaction(signature, 'confirmed');
      return {
        success: true,
        signature: signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getTokenBalance(tokenMintAddress, ownerPublicKeyString) {
    try {
      const ownerPublicKey = new PublicKey(ownerPublicKeyString);
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        ownerPublicKey,
        { mint: tokenMintPublicKey }
      );
      if (tokenAccounts.value.length === 0) {
        return 0;
      }
      const tokenAccountInfo = await this.connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      return Number(tokenAccountInfo.value.uiAmount);
    } catch (error) {
      throw new Error(`Failed to fetch token balance: ${error.message}`);
    }
  }

  async transferToken(tokenMintAddress, toPublicKeyString, amount, tokenAccountAddress) {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    try {
      const tokenMintPublicKey = new PublicKey(tokenMintAddress);
      const toPublicKey = new PublicKey(toPublicKeyString);
      const token = new Token(
        this.connection,
        tokenMintPublicKey,
        TOKEN_PROGRAM_ID,
        this.wallet
      );
      const fromTokenAccount = new PublicKey(tokenAccountAddress);
      const toTokenAccounts = await this.connection.getTokenAccountsByOwner(
        toPublicKey,
        { mint: tokenMintPublicKey }
      );
      let toTokenAccount;
      if (toTokenAccounts.value.length === 0) {
        toTokenAccount = await token.createAssociatedTokenAccount(toPublicKey);
      } else {
        toTokenAccount = toTokenAccounts.value[0].pubkey;
      }
      const transaction = new Transaction().add(
        Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          fromTokenAccount,
          toTokenAccount,
          this.wallet.publicKey,
          [],
          amount
        )
      );
      const signature = await this.connection.sendTransaction(transaction, [this.wallet]);
      await this.connection.confirmTransaction(signature, 'confirmed');
      return {
        success: true,
        signature: signature,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getTransactionHistory(publicKeyString, limit = 10) {
    try {
      const publicKey = new PublicKey(publicKeyString);
      const signatures = await this.connection.getSignaturesForAddress(publicKey, { limit });
      const transactions = await Promise.all(
        signatures.map(async (sig) => {
          const tx = await this.connection.getTransaction(sig.signature, { commitment: 'confirmed' });
          return {
            signature: sig.signature,
            slot: sig.slot,
            timestamp: tx ? tx.blockTime : null,
            status: sig.err ? 'failed' : 'success',
          };
        })
      );
      return transactions;
    } catch (error) {
      throw new Error(`Failed to fetch transaction history: ${error.message}`);
    }
  }

  async switchNetwork(clusterUrl) {
    try {
      this.connection = new Connection(clusterUrl, 'confirmed');
      return {
        success: true,
        network: clusterUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  getWalletPublicKey() {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    return this.wallet.publicKey.toString();
  }
}

export default SolanaUtils;
