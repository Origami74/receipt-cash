/**
 * Debug logging utility to capture console logs for display in the UI
 */

// Maximum number of log entries to keep
const MAX_LOGS = 2000;

// Store for captured logs
let capturedLogs = [];
let isCapturingEnabled = false;

// Original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
  info: console.info
};

/**
 * Start capturing console logs
 */
export function startCapturingLogs() {
  if (isCapturingEnabled) return;
  
  isCapturingEnabled = true;
  
  // Save state to localStorage
  localStorage.setItem('debug-logging-enabled', 'true');
  
  // Override console methods to capture logs
  console.log = function(...args) {
    captureLog('log', args);
    originalConsole.log.apply(console, args);
  };
  
  console.error = function(...args) {
    captureLog('error', args);
    originalConsole.error.apply(console, args);
  };
  
  console.warn = function(...args) {
    captureLog('warn', args);
    originalConsole.warn.apply(console, args);
  };
  
  console.info = function(...args) {
    captureLog('info', args);
    originalConsole.info.apply(console, args);
  };
  
  // Add initial log entry
  captureLog('info', ['Debug logging started']);
}

/**
 * Stop capturing console logs and restore original console methods
 */
export function stopCapturingLogs() {
  if (!isCapturingEnabled) return;
  
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  
  isCapturingEnabled = false;
  
  // Clear state in localStorage
  localStorage.setItem('debug-logging-enabled', 'false');
}

/**
 * Capture a log entry
 * @param {string} level - Log level (log, error, warn, info)
 * @param {Array} args - Arguments passed to the console method
 */
function captureLog(level, args) {
  try {
    // Check for Error objects to capture stack traces
    let stackTrace = null;
    const originalArgs = [...args]; // Keep original args
    
    // If this is an error log, check if any argument is an Error object
    if (level === 'error') {
      for (const arg of args) {
        if (arg instanceof Error) {
          stackTrace = arg.stack;
          break;
        }
      }
      
      // If no Error object was found but we're logging an error,
      // create a new Error to capture the current stack trace
      if (!stackTrace) {
        const err = new Error();
        stackTrace = err.stack;
      }
    }
    
    // Format the log message
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: formattedArgs,
      stack: stackTrace
    };
    
    // Add to captured logs
    capturedLogs.push(logEntry);
    
    // Limit the number of logs
    if (capturedLogs.length > MAX_LOGS) {
      capturedLogs = capturedLogs.slice(-MAX_LOGS);
    }
    
    // Store in localStorage for persistence
    saveLogsToStorage();
  } catch (error) {
    // Prevent infinite loops by not calling console methods here
    originalConsole.error('Error capturing log:', error);
  }
}

/**
 * Save logs to localStorage
 */
function saveLogsToStorage() {
  try {
    localStorage.setItem('debug-logs', JSON.stringify(capturedLogs));
  } catch (error) {
    // Silent fail to avoid issues with localStorage
  }
}

/**
 * Load logs from localStorage
 */
function loadLogsFromStorage() {
  try {
    const storedLogs = localStorage.getItem('debug-logs');
    if (storedLogs) {
      capturedLogs = JSON.parse(storedLogs);
    }
  } catch (error) {
    // Silent fail to avoid issues with localStorage
    capturedLogs = [];
  }
}

/**
 * Get captured logs
 * @returns {Array} Array of log entries
 */
export function getCapturedLogs() {
  loadLogsFromStorage();
  return capturedLogs;
}

/**
 * Clear captured logs
 */
export function clearCapturedLogs() {
  capturedLogs = [];
  saveLogsToStorage();
}

/**
 * Check if capturing is enabled
 * @returns {boolean} True if capturing is enabled
 */
export function isCapturingLogsEnabled() {
  return isCapturingEnabled;
}

/**
 * Add a custom log entry
 * @param {string} message - Message to log
 * @param {string} level - Log level (default: 'log')
 */
export function addCustomLog(message, level = 'log') {
  if (isCapturingEnabled) {
    captureLog(level, [message]);
  }
}

// Load any previously stored logs
loadLogsFromStorage();

export default {
  startCapturingLogs,
  stopCapturingLogs,
  getCapturedLogs,
  clearCapturedLogs,
  isCapturingLogsEnabled,
  addCustomLog
};