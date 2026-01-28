/**
 * Migration Service
 *
 * One-time migration to move existing proofs from the old storage system
 * into the new coco-based wallet system.
 *
 * This should run once on app startup after coco is initialized.
 */

import { cocoService } from './cocoService';
import { accountingService } from './accountingService';
import { changeJarService } from './changeJarService';

interface LegacyProof {
  amount: number;
  secret: string;
  C: string;
  id: string;
}

interface LegacyMoneyStorage {
  [mintUrl: string]: {
    proofs: LegacyProof[];
  };
}

class MigrationService {
  private readonly MIGRATION_FLAG_KEY = 'coco-migration-completed';
  private readonly LEGACY_MONEY_KEY = 'money-storage';
  private readonly LEGACY_DEV_PROOFS_KEY = 'dev-proofs';
  private readonly LEGACY_CHANGE_JAR_KEY = 'change-jar-state';

  /**
   * Check if migration has already been completed
   */
  hasMigrated(): boolean {
    return localStorage.getItem(this.MIGRATION_FLAG_KEY) === 'true';
  }

  /**
   * Mark migration as completed
   */
  private markMigrationComplete(): void {
    localStorage.setItem(this.MIGRATION_FLAG_KEY, 'true');
    console.log('✅ Migration marked as complete');
  }

  /**
   * Get legacy proofs from old storage
   */
  private getLegacyProofs(): { mintUrl: string; proofs: LegacyProof[] }[] {
    const result: { mintUrl: string; proofs: LegacyProof[] }[] = [];

    try {
      // Get main money storage
      const moneyStorageStr = localStorage.getItem(this.LEGACY_MONEY_KEY);
      if (moneyStorageStr) {
        const moneyStorage: LegacyMoneyStorage = JSON.parse(moneyStorageStr);
        for (const [mintUrl, data] of Object.entries(moneyStorage)) {
          if (data.proofs && data.proofs.length > 0) {
            result.push({ mintUrl, proofs: data.proofs });
          }
        }
      }

      // Get dev proofs
      const devProofsStr = localStorage.getItem(this.LEGACY_DEV_PROOFS_KEY);
      if (devProofsStr) {
        const devProofs: LegacyMoneyStorage = JSON.parse(devProofsStr);
        for (const [mintUrl, data] of Object.entries(devProofs)) {
          if (data.proofs && data.proofs.length > 0) {
            // Check if we already have this mint
            const existing = result.find(r => r.mintUrl === mintUrl);
            if (existing) {
              existing.proofs.push(...data.proofs);
            } else {
              result.push({ mintUrl, proofs: data.proofs });
            }
          }
        }
      }

      // Get change jar proofs
      const changeJarProofs = changeJarService.getAllProofsForMigration();
      for (const { mintUrl, proofs } of changeJarProofs) {
        if (proofs && proofs.length > 0) {
          // Check if we already have this mint
          const existing = result.find(r => r.mintUrl === mintUrl);
          if (existing) {
            existing.proofs.push(...proofs);
          } else {
            result.push({ mintUrl, proofs });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load legacy proofs:', error);
    }

    return result;
  }

  /**
   * Migrate proofs from old storage to coco
   */
  async migrate(): Promise<{
    success: boolean;
    migratedMints: number;
    migratedProofs: number;
    totalAmount: number;
    errors: string[];
  }> {
    console.log('🔄 Starting proof migration to coco...');

    if (this.hasMigrated()) {
      console.log('ℹ️ Migration v2->v3 already completed, skipping');
      return {
        success: true,
        migratedMints: 0,
        migratedProofs: 0,
        totalAmount: 0,
        errors: []
      };
    }

    const legacyData = this.getLegacyProofs();
    
    if (legacyData.length === 0) {
      console.log('ℹ️ No legacy proofs found, marking migration as complete');
      this.markMigrationComplete();
      return {
        success: true,
        migratedMints: 0,
        migratedProofs: 0,
        totalAmount: 0,
        errors: []
      };
    }

    let migratedMints = 0;
    let migratedProofs = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    for (const { mintUrl, proofs } of legacyData) {
      try {
        console.log(`📦 Migrating ${proofs.length} proofs from ${mintUrl}...`);

        // Add mint to coco (it will auto-trust when we receive proofs)
        await cocoService.getCoco().mint.addMint(mintUrl);

        // Import proofs into coco
        // Note: We use the wallet's receive method which will validate and store the proofs
        const token = {
          token: [{
            mint: mintUrl,
            proofs: proofs
          }]
        };

        const tokenString = JSON.stringify(token);
        await cocoService.getCoco().wallet.receive(tokenString);

        const mintAmount = proofs.reduce((sum, p) => sum + p.amount, 0);
        
        console.log(`✅ Migrated ${proofs.length} proofs (${mintAmount} sats) from ${mintUrl}`);
        
        // Record in accounting as "migration" - using a dummy receipt/settlement ID
        const migrationId = `migration-${Date.now()}`;
        accountingService.recordIncoming(
          migrationId, // receiptEventId
          migrationId, // settlementEventId
          mintAmount,
          mintUrl
        );

        migratedMints++;
        migratedProofs += proofs.length;
        totalAmount += mintAmount;

      } catch (error) {
        const errorMsg = `Failed to migrate proofs from ${mintUrl}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    if (errors.length === 0) {
      // Only mark as complete if no errors
      this.markMigrationComplete();
      
      // Backup old storage before clearing
      this.backupLegacyStorage();
      
      // Clear change jar (proofs already migrated to Coco)
      this.clearChangeJar();
      
      // Clear old storage
      this.clearLegacyStorage();
      
      console.log(`✅ Migration completed successfully!`);
      console.log(`   - Mints: ${migratedMints}`);
      console.log(`   - Proofs: ${migratedProofs}`);
      console.log(`   - Total: ${totalAmount} sats`);
    } else {
      console.error(`⚠️ Migration completed with ${errors.length} errors`);
    }

    return {
      success: errors.length === 0,
      migratedMints,
      migratedProofs,
      totalAmount,
      errors
    };
  }

  /**
   * Clear change jar (accounting-only, no proofs to migrate)
   */
  private clearChangeJar(): void {
    try {
      const changeJar = localStorage.getItem(this.LEGACY_CHANGE_JAR_KEY);
      if (changeJar) {
        const data = JSON.parse(changeJar);
        console.log(`🧹 Clearing change jar (${data.totalAmount || 0} sats tracked)`);
        changeJarService.clear();
      }
    } catch (error) {
      console.error('Failed to clear change jar:', error);
    }
  }

  /**
   * Backup legacy storage before clearing
   */
  private backupLegacyStorage(): void {
    try {
      const moneyStorage = localStorage.getItem(this.LEGACY_MONEY_KEY);
      const devProofs = localStorage.getItem(this.LEGACY_DEV_PROOFS_KEY);
      const changeJar = localStorage.getItem(this.LEGACY_CHANGE_JAR_KEY);

      if (moneyStorage) {
        localStorage.setItem(`${this.LEGACY_MONEY_KEY}-backup`, moneyStorage);
      }
      if (devProofs) {
        localStorage.setItem(`${this.LEGACY_DEV_PROOFS_KEY}-backup`, devProofs);
      }
      if (changeJar) {
        localStorage.setItem(`${this.LEGACY_CHANGE_JAR_KEY}-backup`, changeJar);
      }

      console.log('💾 Legacy storage backed up');
    } catch (error) {
      console.error('Failed to backup legacy storage:', error);
    }
  }

  /**
   * Clear legacy storage after successful migration
   */
  private clearLegacyStorage(): void {
    try {
      localStorage.removeItem(this.LEGACY_MONEY_KEY);
      localStorage.removeItem(this.LEGACY_DEV_PROOFS_KEY);
      console.log('🧹 Legacy storage cleared');
    } catch (error) {
      console.error('Failed to clear legacy storage:', error);
    }
  }

  /**
   * Restore from backup (in case of issues)
   */
  restoreFromBackup(): boolean {
    try {
      const moneyBackup = localStorage.getItem(`${this.LEGACY_MONEY_KEY}-backup`);
      const devProofsBackup = localStorage.getItem(`${this.LEGACY_DEV_PROOFS_KEY}-backup`);

      if (moneyBackup) {
        localStorage.setItem(this.LEGACY_MONEY_KEY, moneyBackup);
      }
      if (devProofsBackup) {
        localStorage.setItem(this.LEGACY_DEV_PROOFS_KEY, devProofsBackup);
      }

      // Clear migration flag to allow re-migration
      localStorage.removeItem(this.MIGRATION_FLAG_KEY);

      console.log('✅ Restored from backup');
      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Get migration status for debugging
   */
  getStatus(): {
    migrated: boolean;
    hasLegacyProofs: boolean;
    hasBackup: boolean;
  } {
    return {
      migrated: this.hasMigrated(),
      hasLegacyProofs: this.getLegacyProofs().length > 0,
      hasBackup: 
        localStorage.getItem(`${this.LEGACY_MONEY_KEY}-backup`) !== null ||
        localStorage.getItem(`${this.LEGACY_DEV_PROOFS_KEY}-backup`) !== null
    };
  }
}

// Export singleton instance
export const migrationService = new MigrationService();