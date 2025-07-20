// Version-based update manager
import { showNotification } from './notification';

// Update this version number with each release
export const CURRENT_VERSION = '1.0.3';

// Key for storing version in localStorage
const VERSION_KEY = 'receipt-cash-version';

/**
 * Check if the app needs to be updated based on version
 * Call this on app startup
 */
export const checkForVersionUpdate = async () => {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    
    // If no stored version or version mismatch, force update
    if (!storedVersion || storedVersion !== CURRENT_VERSION) {
      console.log(`Version update required: ${storedVersion} -> ${CURRENT_VERSION}`);
      
      // Show notification to user
      showNotification('Updating to latest version...', 'info');
      
      // Force update
      await forceAppUpdate();
      
      // Store new version
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
      
      return true; // Update was performed
    }
    
    return false; // No update needed
  } catch (error) {
    console.error('Error checking version:', error);
    return false;
  }
};

/**
 * Force app update by clearing cache and reloading
 */
export const forceAppUpdate = async () => {
  try {
    // Clear service worker cache
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    // Clear browser cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    // Force reload with cache bypass
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
    
  } catch (error) {
    console.error('Error forcing app update:', error);
    // Fallback: just reload
    window.location.reload();
  }
};

/**
 * Get current stored version
 */
export const getStoredVersion = () => {
  return localStorage.getItem(VERSION_KEY);
};

/**
 * Manual update trigger (for settings menu)
 */
export const triggerManualUpdate = async () => {
  showNotification('Checking for updates...', 'info');
  
  // Always force update when manually triggered
  await forceAppUpdate();
  localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
};