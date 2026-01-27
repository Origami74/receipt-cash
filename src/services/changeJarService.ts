/**
 * Change Jar Service
 * 
 * Tracks small amounts (dust) that accumulate from rounding and fees.
 * This dust can be used to fund AI queries or other small operations.
 * 
 * The change jar is accounting-only - it doesn't hold actual proofs,
 * but tracks how much of the unified balance is conceptually "dust".
 */

interface ChangeJarEntry {
  id: string;
  timestamp: number;
  amount: number;
  source: 'rounding' | 'fee_savings' | 'donation';
  description: string;
  settlementId?: string;
}

interface ChangeJarState {
  totalAmount: number;
  entries: ChangeJarEntry[];
  lastUpdated: number;
}

class ChangeJarService {
  private readonly STORAGE_KEY = 'change-jar-state';
  private state: ChangeJarState;

  constructor() {
    this.state = this.loadState();
  }

  /**
   * Load state from localStorage
   */
  private loadState(): ChangeJarState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load change jar state:', error);
    }

    return {
      totalAmount: 0,
      entries: [],
      lastUpdated: Date.now()
    };
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      this.state.lastUpdated = Date.now();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      console.error('Failed to save change jar state:', error);
    }
  }

  /**
   * Add dust to the change jar
   */
  addDust(
    amount: number,
    source: 'rounding' | 'fee_savings' | 'donation',
    description: string,
    settlementId?: string
  ): void {
    if (amount <= 0) {
      console.warn('Cannot add non-positive amount to change jar:', amount);
      return;
    }

    const entry: ChangeJarEntry = {
      id: `dust-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      amount,
      source,
      description,
      settlementId
    };

    this.state.entries.push(entry);
    this.state.totalAmount += amount;
    this.saveState();

    console.log(`💰 Added ${amount} sats to change jar (${source}): ${description}`);
  }

  /**
   * Spend from the change jar (e.g., for AI queries)
   */
  spend(amount: number, description: string): boolean {
    if (amount <= 0) {
      console.warn('Cannot spend non-positive amount:', amount);
      return false;
    }

    if (amount > this.state.totalAmount) {
      console.warn(`Insufficient change jar balance: ${this.state.totalAmount} < ${amount}`);
      return false;
    }

    // Record as negative entry
    const entry: ChangeJarEntry = {
      id: `spend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      amount: -amount,
      source: 'donation', // Spending is like donating to AI service
      description
    };

    this.state.entries.push(entry);
    this.state.totalAmount -= amount;
    this.saveState();

    console.log(`💸 Spent ${amount} sats from change jar: ${description}`);
    return true;
  }

  /**
   * Get current balance
   */
  getBalance(): number {
    return this.state.totalAmount;
  }

  /**
   * Get all entries
   */
  getEntries(): ChangeJarEntry[] {
    return [...this.state.entries];
  }

  /**
   * Get entries for a specific settlement
   */
  getEntriesForSettlement(settlementId: string): ChangeJarEntry[] {
    return this.state.entries.filter(e => e.settlementId === settlementId);
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalBalance: number;
    totalRounding: number;
    totalFeeSavings: number;
    totalDonations: number;
    totalSpent: number;
    entryCount: number;
  } {
    let totalRounding = 0;
    let totalFeeSavings = 0;
    let totalDonations = 0;
    let totalSpent = 0;

    for (const entry of this.state.entries) {
      if (entry.amount < 0) {
        totalSpent += Math.abs(entry.amount);
      } else {
        switch (entry.source) {
          case 'rounding':
            totalRounding += entry.amount;
            break;
          case 'fee_savings':
            totalFeeSavings += entry.amount;
            break;
          case 'donation':
            totalDonations += entry.amount;
            break;
        }
      }
    }

    return {
      totalBalance: this.state.totalAmount,
      totalRounding,
      totalFeeSavings,
      totalDonations,
      totalSpent,
      entryCount: this.state.entries.length
    };
  }

  /**
   * Clear all entries (for testing or reset)
   */
  clear(): void {
    this.state = {
      totalAmount: 0,
      entries: [],
      lastUpdated: Date.now()
    };
    this.saveState();
    console.log('🧹 Change jar cleared');
  }

  /**
   * Export state for backup
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import state from backup
   */
  importState(jsonState: string): boolean {
    try {
      const imported = JSON.parse(jsonState);
      if (
        typeof imported.totalAmount === 'number' &&
        Array.isArray(imported.entries)
      ) {
        this.state = imported;
        this.saveState();
        console.log('✅ Change jar state imported successfully');
        return true;
      }
    } catch (error) {
      console.error('Failed to import change jar state:', error);
    }
    return false;
  }
}

// Export singleton instance
export const changeJarService = new ChangeJarService();