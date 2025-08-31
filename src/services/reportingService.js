import { globalPool, globalEventStore } from './nostr/applesauce.js';
import { EventFactory } from 'applesauce-factory';
import { SimpleSigner } from 'applesauce-signers';
import { nip44, generateSecretKey } from 'nostr-tools';
import { Buffer } from 'buffer';
import { DEFAULT_RELAYS, DEVELOPER_PUBKEY, KIND_REPORT } from './nostr/constants.js';
import { showNotification } from './notificationService.js';
import debugLogger from './debugService.js';

/**
 * Function to truncate logs to fit within NIP-44 size limits
 * @param {Array} logEntries - Array of log entries
 * @param {number} maxSize - Maximum size in bytes (default: 60000)
 * @returns {string} Truncated logs as string
 */
const truncateLogsToFit = (logEntries, maxSize = 60000) => {
  // Reserve space for other report content (description, metadata, etc.)
  // NIP-44 max is 65535 bytes, we use 60000 to be safe
  
  let totalSize = 0;
  let truncatedLogs = [];
  
  // Start from the most recent logs and work backwards
  const reversedLogs = [...logEntries].reverse();
  
  for (const log of reversedLogs) {
    let logLine = `${new Date(log.timestamp).toISOString()} [${log.level.toUpperCase()}] ${log.message}`;
    
    // Add stack trace for error logs
    if (log.level === 'error' && log.stack) {
      logLine += `\n${log.stack}`;
    }
    
    const logLineSize = new TextEncoder().encode(logLine).length + 1; // +1 for newline
    
    if (totalSize + logLineSize > maxSize) {
      // If this log would exceed the limit, add a truncation notice
      if (truncatedLogs.length === 0) {
        // If we can't fit any logs, add a minimal notice
        truncatedLogs.push('[TRUNCATED] Logs were too large to include in report');
      } else {
        // Add truncation notice at the beginning
        truncatedLogs.unshift(`[TRUNCATED] Only showing ${truncatedLogs.length} most recent log entries`);
      }
      break;
    }
    
    totalSize += logLineSize;
    truncatedLogs.unshift(logLine); // Add to beginning to maintain chronological order
  }
  
  return truncatedLogs.join('\n');
};

/**
 * Submit a bug report to the developer using Nostr
 * @param {Object} params - Report parameters
 * @param {string} params.description - Issue description
 * @param {string} params.errorMessage - Error message if any
 * @param {boolean} params.includeLogs - Whether to include debug logs
 * @param {boolean} params.includeUrl - Whether to include current URL
 * @returns {Promise<void>}
 */
export const submitReport = async ({ description, errorMessage = '', includeLogs = true, includeUrl = false }) => {
  try {
    // Get logs if needed
    let logs = '';
    if (includeLogs) {
      const logEntries = debugLogger.getCapturedLogs();
      logs = truncateLogsToFit(logEntries);
    }
    
    // Get current URL if needed
    let currentUrl = '';
    if (includeUrl) {
      currentUrl = window.location.href;
    }
    
    // Create report content
    const reportContent = {
      type: 'bug_report',
      description: description,
      errorMessage: errorMessage,
      url: currentUrl,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      logs: logs
    };
    
    // Create initial report content
    let plainContent = JSON.stringify(reportContent);
    
    // Check if the content is too large for NIP-44 encryption (65535 bytes limit)
    let contentSize = new TextEncoder().encode(plainContent).length;
    
    // If still too large, progressively reduce log content
    if (contentSize > 65000 && includeLogs) {
      console.warn(`Report content too large (${contentSize} bytes), reducing log content...`);
      
      // Try with smaller log sizes
      const logSizes = [40000, 20000, 10000, 5000, 1000];
      
      for (const maxLogSize of logSizes) {
        const logEntries = debugLogger.getCapturedLogs();
        const reducedLogs = truncateLogsToFit(logEntries, maxLogSize);
        
        const reducedReportContent = {
          ...reportContent,
          logs: reducedLogs
        };
        
        const testContent = JSON.stringify(reducedReportContent);
        contentSize = new TextEncoder().encode(testContent).length;
        
        if (contentSize <= 65000) {
          reportContent.logs = reducedLogs;
          plainContent = testContent;
          console.log(`Successfully reduced report to ${contentSize} bytes with ${maxLogSize} byte log limit`);
          break;
        }
      }
      
      // Final fallback - remove logs entirely if still too large
      if (contentSize > 65000) {
        console.warn('Removing logs entirely due to size constraints');
        reportContent.logs = '[REMOVED] Logs were too large to include in report';
        plainContent = JSON.stringify(reportContent);
        contentSize = new TextEncoder().encode(plainContent).length;
      }
    }
    
    console.log(`Final report size: ${contentSize} bytes`);
    
    // Generate a random secret key for this report
    const reportPrivateKey = generateSecretKey();
    const reportSigner = new SimpleSigner(reportPrivateKey);
    const factory = new EventFactory({ signer: reportSigner });
    
    // Get developer's public key (hex to Uint8Array)
    const recipientPubkey = Uint8Array.from(Buffer.from(DEVELOPER_PUBKEY, 'hex'));
    
    // Encrypt the content using NIP-44
    const encryptedContent = await nip44.encrypt(plainContent, recipientPubkey);
    
    // Create the draft event using EventFactory
    const draft = await factory.build({
      kind: KIND_REPORT, // kind for bug reports (infernal-insights)
      content: encryptedContent,
      tags: [
        ['n', 'receipt-cash'],
        ['p', DEVELOPER_PUBKEY],
        ['encrypted']
      ]
    });
    
    // Sign the event
    const signed = await factory.sign(draft);
    
    // Add to local event store for caching
    globalEventStore.add(signed);
    
    // Publish using the global relay pool
    const responses = await globalPool.publish(DEFAULT_RELAYS, signed);
    
    const successResponses = [];
    responses.forEach((response) => {
      if (response.ok) {
        successResponses.push(response);
        console.log(`Bug report published successfully to ${response.from}`);
      } else {
        console.error(`Failed to publish bug report to ${response.from}: ${response.message}`);
      }
    });

    if (successResponses.length <= 1) {
      console.error(`Failed to publish bug report ${signed.id} to enough relays!`);
      throw new Error("Could not publish bug report to enough relays");
    }
    
    showNotification('Report submitted successfully. Thank you!', 'success');
    
  } catch (error) {
    console.error('Error submitting report:', error);
    showNotification('Failed to submit report. Please try again.', 'error');
    throw error;
  }
};

export default {
  submitReport
};