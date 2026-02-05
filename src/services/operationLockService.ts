/**
 * Operation Lock Service
 * 
 * Provides per-mint operation locking to prevent concurrent balance modifications.
 * Allows parallel execution of operations on different mints while serializing
 * operations on the same mint.
 */
class OperationLockService {
  private locks: Map<string, Promise<void>>;

  constructor() {
    this.locks = new Map();
  }

  /**
   * Execute an operation with a lock on the specified mint
   * Operations on the same mint are serialized, but operations on different mints can run in parallel
   * 
   * @param mintUrl - The mint URL to lock on
   * @param operation - The async operation to execute
   * @returns The result of the operation
   */
  async withLock<T>(mintUrl: string, operation: () => Promise<T>): Promise<T> {
    // Wait for any existing operation on this mint to complete
    const existingLock = this.locks.get(mintUrl);
    if (existingLock) {
      await existingLock;
    }

    // Create a new lock for this operation
    let resolveLock: () => void;
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(mintUrl, newLock);

    try {
      // Execute the operation
      const result = await operation();
      return result;
    } finally {
      // Release the lock
      resolveLock!();
      
      // Clean up if this was the last operation
      if (this.locks.get(mintUrl) === newLock) {
        this.locks.delete(mintUrl);
      }
    }
  }

  /**
   * Check if a mint is currently locked
   */
  isLocked(mintUrl: string): boolean {
    return this.locks.has(mintUrl);
  }

  /**
   * Get the number of active locks
   */
  getActiveLockCount(): number {
    return this.locks.size;
  }

  /**
   * Clear all locks (use with caution, mainly for testing)
   */
  clearAll(): void {
    this.locks.clear();
  }
}

// Export singleton
export const operationLockService = new OperationLockService();