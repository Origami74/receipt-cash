/**
 * Change Jar Service (Migration Only)
 * 
 * Minimal service to read legacy change jar storage and migrate proofs to Coco.
 * This service is only used during migration and can be removed after all users migrate.
 */

const LEGACY_CHANGE_JAR_KEY = 'receipt-cash-change-jar';

interface LegacyChangeJarMint {
  mintUrl: string;
  proofs: any[];
  totalAmount: number;
  lastUpdated: number;
}

interface LegacyChangeJar {
  [mintKey: string]: LegacyChangeJarMint;
}

class ChangeJarService {
  /**
   * Get all proofs from legacy change jar storage
   * Returns array of { mintUrl, proofs } for migration
   */
  getAllProofsForMigration(): Array<{ mintUrl: string; proofs: any[] }> {
    try {
      const stored = localStorage.getItem(LEGACY_CHANGE_JAR_KEY);
      if (!stored) {
        return [];
      }

      const changeJar: LegacyChangeJar = JSON.parse(stored);
      const result: Array<{ mintUrl: string; proofs: any[] }> = [];

      Object.values(changeJar).forEach((mintData) => {
        if (mintData.proofs && mintData.proofs.length > 0) {
          result.push({
            mintUrl: mintData.mintUrl,
            proofs: mintData.proofs
          });
        }
      });

      return result;
    } catch (error) {
      console.error('Failed to read legacy change jar:', error);
      return [];
    }
  }

  /**
   * Clear legacy change jar storage after successful migration
   */
  clear(): void {
    try {
      localStorage.removeItem(LEGACY_CHANGE_JAR_KEY);
      console.log('🧹 Cleared legacy change jar storage');
    } catch (error) {
      console.error('Failed to clear change jar:', error);
    }
  }
}

// Export singleton instance
export const changeJarService = new ChangeJarService();