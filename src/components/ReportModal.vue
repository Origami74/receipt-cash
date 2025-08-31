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
import { submitReport } from '../services/reportingService';

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

    // Submit the report using the reporting service
    const handleSubmitReport = async () => {
      isSubmitting.value = true;
      
      try {
        await submitReport({
          description: description.value,
          errorMessage: props.errorMessage,
          includeLogs: includeLogs.value,
          includeUrl: includeUrl.value
        });
        
        description.value = '';
        emit('submitted');
        emit('close');
      } catch (error) {
        console.error('Error submitting report:', error);
      } finally {
        isSubmitting.value = false;
      }
    };
    
    return {
      description,
      includeLogs,
      includeUrl,
      isSubmitting,
      submitReport: handleSubmitReport
    };
  }
};
</script>