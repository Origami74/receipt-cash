import { getProofs, updateProofStatus } from '../storageService.js';
import { cashuDmSender } from '../new/payout/cashuDmSender.js';
import { DEV_CASHU_REQ } from '../nostr/constants.js';

/**
 * V1 Developer Proofs Migration Service
 * 
 * Migrates old v1 developer proofs (stored in localStorage under 'receipt-cash-proofs')
 * by sending them to the developer with a 'stranded devsplit' message.
 */

const MIGRATION_KEY = 'receipt-cash-v1-dev-proofs-migrated';

class V1DevProofsMigration {
  constructor() {
    this.isMigrated = false;
  }

  /**
   * Check if migration has already been completed
   * @returns {boolean} True if migration was already done
   */
  _checkMigrationStatus() {
    try {
      const migrated = localStorage.getItem(MIGRATION_KEY);
      return migrated === 'true';
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Mark migration as completed
   */
  _markMigrationComplete() {
    try {
      localStorage.setItem(MIGRATION_KEY, 'true');
      console.log('✅ V1 dev proofs migration marked as complete');
    } catch (error) {
      console.error('Error marking migration complete:', error);
    }
  }

  /**
   * Find all v1 developer proofs that need to be migrated
   * @returns {Array} Array of developer proof entries
   */
  _findV1DeveloperProofs() {
    const allProofs = getProofs();
    const developerProofs = [];

    // Iterate through all transactions
    for (const [transactionId, transaction] of Object.entries(allProofs)) {
      if (!transaction.categories) continue;

      // Check if there's a 'developer' category
      const devCategory = transaction.categories['developer'];
      if (devCategory && devCategory.proofs && devCategory.proofs.length > 0) {
        developerProofs.push({
        transactionId,
        proofs: devCategory.proofs,
        mintUrl: devCategory.mintUrl,
        timestamp: transaction.timestamp,
        lastUpdated: devCategory.lastUpdated
        });
      }
    }

    return developerProofs;
  }

  /**
   * Send developer proofs to the developer with a message
   * @param {Object} devProofEntry - Developer proof entry
   * @returns {Promise<boolean>} Success status
   */
  async _sendDeveloperProofs(devProofEntry) {
    try {
      console.log(`📤 Sending stranded dev proofs from transaction ${devProofEntry.transactionId.slice(0, 8)}...`);
      console.log(`   💰 Proofs: ${devProofEntry.proofs.length}`);
      console.log(`   🏦 Mint: ${devProofEntry.mintUrl}`);

      // Send the proofs to the developer's payment request
      const success = await cashuDmSender.payCashuPaymentRequest(
        DEV_CASHU_REQ,
        devProofEntry.proofs,
        devProofEntry.mintUrl
      );

      if (success) {
        console.log(`✅ Successfully sent stranded dev proofs from ${devProofEntry.transactionId.slice(0, 8)}...`);
        
        // Update the proof status to 'migrated'
        updateProofStatus(devProofEntry.transactionId, 'developer', 'migrated');
        
        return true;
      } else {
        console.error(`❌ Failed to send stranded dev proofs from ${devProofEntry.transactionId.slice(0, 8)}...`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error sending developer proofs:`, error);
      return false;
    }
  }

  /**
   * Run the migration process
   * Finds all v1 developer proofs and sends them to the developer
   * @returns {Promise<Object>} Migration results
   */
  async migrate() {
    try {
      // Check if migration was already done
      if (this._checkMigrationStatus()) {
        console.log('ℹ️ V1 dev proofs migration already completed, skipping...');
        return {
          alreadyMigrated: true,
          success: true,
          processed: 0,
          sent: 0,
          failed: 0
        };
      }

      console.log('🔄 Starting V1 developer proofs migration...');

      // Find all v1 developer proofs
      const developerProofs = this._findV1DeveloperProofs();

      if (developerProofs.length === 0) {
        console.log('✅ No v1 developer proofs found to migrate');
        this._markMigrationComplete();
        return {
          alreadyMigrated: false,
          success: true,
          processed: 0,
          sent: 0,
          failed: 0
        };
      }

      console.log(`📦 Found ${developerProofs.length} v1 developer proof entries to migrate`);

      let sent = 0;
      let failed = 0;

      // Process each developer proof entry
      for (const devProofEntry of developerProofs) {
        const success = await this._sendDeveloperProofs(devProofEntry);
        if (success) {
          sent++;
        } else {
          failed++;
        }

        // Add a small delay between sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ V1 dev proofs migration complete:`);
      console.log(`   📤 Sent: ${sent}`);
      console.log(`   ❌ Failed: ${failed}`);

      // Mark migration as complete even if some failed
      // (they can be retried manually if needed)
      this._markMigrationComplete();

      return {
        alreadyMigrated: false,
        success: true,
        processed: developerProofs.length,
        sent,
        failed
      };
    } catch (error) {
      console.error('❌ Error during V1 dev proofs migration:', error);
      return {
        alreadyMigrated: false,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Reset migration status (for testing purposes)
   */
  resetMigration() {
    try {
      localStorage.removeItem(MIGRATION_KEY);
      console.log('🔄 Migration status reset');
    } catch (error) {
      console.error('Error resetting migration:', error);
    }
  }
}

// Export singleton instance
export const v1DevProofsMigration = new V1DevProofsMigration();