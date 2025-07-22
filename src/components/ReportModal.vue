<template>
  <Transition
    enter-active-class="ease-out duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="ease-in duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="fixed inset-0 z-[100] overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div 
          class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          @click="$emit('close')"
        ></div>
        
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-medium leading-6 text-gray-900">
                Report an Issue
              </h3>
              <div class="mt-4">
                <p class="text-sm text-gray-500 mb-4">
                  Please describe the issue you encountered. This will help us improve the application.
                </p>
                
                <div class="mb-4">
                  <label for="reportDescription" class="block text-sm font-medium text-gray-700 mb-1 text-left">
                    Issue Description
                  </label>
                  <textarea
                    id="reportDescription"
                    v-model="description"
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Please describe what happened and what you were trying to do..."
                  ></textarea>
                </div>
                
                <div class="mb-4 text-xs text-blue-600 italic text-center">
                  Bug reports are always encrypted so only the developer can see their contents
                </div>
                
                <div class="flex items-center mb-4">
                  <input
                    id="includeLogs"
                    v-model="includeLogs"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="includeLogs" class="ml-2 block text-sm text-gray-700">
                    Include debug logs (helps with troubleshooting)
                    <span class="text-xs text-red-500 block">
                      Note: This may expose your receipt to the developer
                    </span>
                  </label>
                </div>
                
                <div class="flex items-center mb-4">
                  <input
                    id="includeUrl"
                    v-model="includeUrl"
                    type="checkbox"
                    class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label for="includeUrl" class="ml-2 block text-sm text-gray-700">
                    Include current URL
                    <span class="text-xs text-red-500 block">
                      Note: This may expose your receipt to the developer
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              class="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:col-start-2"
              @click="submitReport"
              :disabled="isSubmitting"
            >
              <span v-if="isSubmitting">
                <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Submitting...
              </span>
              <span v-else>Submit Report</span>
            </button>
            <button
              type="button"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
              @click="$emit('close')"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script>
import { ref } from 'vue';
import NDK, { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip44, generateSecretKey } from 'nostr-tools';
import { Buffer } from 'buffer';
import { showNotification } from '../utils/notificationService';
import nostrService from '../services/flows/shared/nostr';
import debugLogger from '../utils/loggingService';

// Developer public key to send reports to
const DEVELOPER_PUBKEY = 'a5db1b45079ed0a6b654857712bae6e5d62ff0345abb38571f898bb9cb70100c';

export default {
  name: 'ReportModal',
  props: {
    isOpen: {
      type: Boolean,
      default: false
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  emits: ['close', 'submitted'],
  setup(props, { emit }) {
    const description = ref('');
    const includeLogs = ref(true);
    const includeUrl = ref(false);
    const isSubmitting = ref(false);
    
    // Function to truncate logs to fit within NIP-44 size limits
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

    // Submit the report to the developer using Nostr
    const submitReport = async () => {
      isSubmitting.value = true;
      
      try {
        // Get logs if needed
        let logs = '';
        if (includeLogs.value) {
          const logEntries = debugLogger.getCapturedLogs();
          logs = truncateLogsToFit(logEntries);
        }
        
        // Get current URL if needed
        let currentUrl = '';
        if (includeUrl.value) {
          currentUrl = window.location.href;
        }
        
        // Create report content
        const reportContent = {
          type: 'bug_report',
          description: description.value,
          errorMessage: props.errorMessage,
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
        if (contentSize > 65000 && includeLogs.value) {
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
        
        // Create and publish event
        const ndk = await nostrService.getNdk();
        
        // Generate a random secret key for this report
        const reportPrivateKey = generateSecretKey();
        const reportSigner = new NDKPrivateKeySigner(reportPrivateKey);
        
        const event = new NDKEvent(ndk);
        event.kind = 1314; // kind for bug reports (infernal-insights)
        
        // Get developer's public key (hex to Uint8Array)
        const recipientPubkey = Uint8Array.from(Buffer.from(DEVELOPER_PUBKEY, 'hex'));
        
        // Encrypt the content using NIP-44
        const encryptedContent = await nip44.encrypt(plainContent, recipientPubkey);
        
        event.content = encryptedContent;
        event.created_at = Math.floor(Date.now() / 1000);
        event.tags = [
          ['n', 'receipt-cash'],
          ['p', DEVELOPER_PUBKEY],
          ['encrypted']
        ];
        
        // Sign and publish with temporary signer
        await event.sign(reportSigner);
        await event.publish();
        
        showNotification('Report submitted successfully. Thank you!', 'success');
        description.value = '';
        emit('submitted');
        emit('close');
      } catch (error) {
        console.error('Error submitting report:', error);
        showNotification('Failed to submit report. Please try again.', 'error');
      } finally {
        isSubmitting.value = false;
      }
    };
    
    return {
      description,
      includeLogs,
      includeUrl,
      isSubmitting,
      submitReport
    };
  }
};
</script>