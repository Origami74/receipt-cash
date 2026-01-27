import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

const STORAGE_KEY = 'receipt-cash-seedphrase';

/**
 * Seedphrase Service
 * Manages 12-word BIP39 seedphrase for deterministic wallet recovery
 */
export class SeedphraseService {
  /**
   * Generate a new 12-word BIP39 seedphrase
   */
  generateSeedphrase(): string {
    return generateMnemonic(wordlist, 128); // 128 bits = 12 words
  }

  /**
   * Store seedphrase in localStorage (unencrypted per user request)
   */
  storeSeedphrase(mnemonic: string): void {
    if (!this.validateSeedphrase(mnemonic)) {
      throw new Error('Invalid seedphrase');
    }
    localStorage.setItem(STORAGE_KEY, mnemonic);
    console.log('✅ Seedphrase stored');
  }

  /**
   * Retrieve seedphrase from localStorage
   */
  getSeedphrase(): string | null {
    return localStorage.getItem(STORAGE_KEY);
  }

  /**
   * Convert mnemonic to 64-byte seed for coco
   */
  mnemonicToSeed(mnemonic: string): Uint8Array {
    if (!this.validateSeedphrase(mnemonic)) {
      throw new Error('Invalid seedphrase');
    }
    return mnemonicToSeedSync(mnemonic, ''); // No passphrase
  }

  /**
   * Validate a seedphrase
   */
  validateSeedphrase(mnemonic: string): boolean {
    try {
      return validateMnemonic(mnemonic, wordlist);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if seedphrase exists
   */
  hasSeedphrase(): boolean {
    return this.getSeedphrase() !== null;
  }

  /**
   * Delete seedphrase (for testing/reset)
   */
  clearSeedphrase(): void {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Seedphrase cleared');
  }

  /**
   * Get seedphrase as array of words
   */
  getSeedphraseWords(): string[] | null {
    const mnemonic = this.getSeedphrase();
    if (!mnemonic) return null;
    return mnemonic.split(' ');
  }
}

// Export singleton
export const seedphraseService = new SeedphraseService();