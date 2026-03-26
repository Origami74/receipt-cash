import { Manager } from 'coco-cashu-core';
import { IndexedDbRepositories } from 'coco-cashu-indexeddb';
import { seedphraseService } from './seedphraseService';

/**
 * Coco Service
 * Manages the coco-cashu Manager instance and provides wallet operations
 */
export class CocoService {
  private coco: Manager | null = null;
  private isInitialized = false;

  async initialize(): Promise<Manager> {
    if (this.isInitialized && this.coco) {
      console.log('✅ Coco already initialized');
      return this.coco;
    }

    console.log('🔄 Initializing Coco...');

    // Get or generate seedphrase
    let mnemonic = seedphraseService.getSeedphrase();
    if (!mnemonic) {
      console.log('🔑 Generating new seedphrase...');
      mnemonic = seedphraseService.generateSeedphrase();
      seedphraseService.storeSeedphrase(mnemonic);
      console.log('✅ Seedphrase generated and stored');
    } else {
      console.log('🔑 Using existing seedphrase');
    }

    // Create seed getter for coco
    const seedGetter = async (): Promise<Uint8Array> => {
      const mnemonic = seedphraseService.getSeedphrase();
      if (!mnemonic) {
        throw new Error('No seedphrase found');
      }
      return seedphraseService.mnemonicToSeed(mnemonic);
    };

    // Initialize IndexedDB repositories
    const repo = new IndexedDbRepositories({});
    await repo.init();

    // Create Manager instance (following demo-web pattern)
    this.coco = new Manager(repo, seedGetter);
    
    // Enable watchers manually
    await this.coco.enableMintOperationWatcher({ watchExistingPendingOnStart: true });
    await this.coco.enableProofStateWatcher();

    this.isInitialized = true;
    console.log('✅ Coco initialized successfully');

    // Subscribe to coco events for logging
    this.coco.on('receive:created', (payload) => {
      console.log('💰 Coco received:', payload);
    });

    this.coco.on('send:created', (payload) => {
      console.log('📤 Coco sent:', payload);
    });

    this.coco.on('mint:added', (payload) => {
      console.log('🏦 Mint added:', payload.mint);
    });

    console.log('✅ Coco initialized successfully');
    return this.coco;
  }

  getCoco(): Manager {
    if (!this.isInitialized || !this.coco) {
      throw new Error('Coco not initialized. Call initialize() first.');
    }
    return this.coco;
  }

  async getBalance(mintUrl: string): Promise<number> {
    const balances = await this.coco!.wallet.getBalances();
    return balances[mintUrl] || 0;
  }

  async getAllBalances(): Promise<Record<string, number>> {
    return await this.coco!.wallet.getBalances();
  }

  async getTotalBalance(): Promise<number> {
    const balances = await this.getAllBalances();
    return Object.values(balances).reduce((sum, balance) => sum + balance, 0);
  }

  async getBalancePerMint(): Promise<Array<{ url: string; balance: number }>> {
    const balances = await this.getAllBalances();
    return Object.entries(balances).map(([url, balance]) => ({
      url,
      balance
    }));
  }

  async dispose(): Promise<void> {
    if (this.coco) {
      await this.coco.dispose();
      this.isInitialized = false;
      this.coco = null;
      console.log('🛑 Coco disposed');
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.coco !== null;
  }
}

// Export singleton
export const cocoService = new CocoService();