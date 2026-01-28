/**
 * Change Jar Service (Migration Only)
 *
 * @deprecated This service is DEPRECATED and only exists for one-time migration.
 * All change jar functionality has been migrated to Coco wallet.
 *
 * DO NOT USE THIS SERVICE FOR NEW CODE.
 *
 * This service:
 * - Reads legacy change jar storage from localStorage
 * - Provides proofs for migration to Coco wallet via migrationService
 * - Can be safely removed after all users have migrated (v3.0+)
 *
 * Migration happens automatically on app startup via migrationService.ts
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
   *
   * @deprecated Only used during one-time migration to Coco wallet
   */
  getAllProofsForMigration(): Array<{ mintUrl: string; proofs: any[] }> {
    console.warn('⚠️ DEPRECATED: changeJarService.getAllProofsForMigration() - Only use for migration');
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
   *
   * @deprecated Only used during one-time migration to Coco wallet
   */
  clear(): void {
    console.warn('⚠️ DEPRECATED: changeJarService.clear() - Only use for migration');
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