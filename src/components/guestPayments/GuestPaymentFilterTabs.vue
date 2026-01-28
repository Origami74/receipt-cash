<template>
  <div class="bg-white border-b px-4 py-2">
    <div class="flex space-x-4">
      <button
        @click="$emit('update:modelValue', 'all')"
        :class="modelValue === 'all' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
        class="pb-2 font-medium transition-colors"
      >
        All ({{ allCount }})
      </button>
      <button
        @click="$emit('update:modelValue', 'pending')"
        :class="modelValue === 'pending' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
        class="pb-2 font-medium transition-colors"
      >
        Pending ({{ pendingCount }})
      </button>
      <button
        @click="$emit('update:modelValue', 'confirmed')"
        :class="modelValue === 'confirmed' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-500'"
        class="pb-2 font-medium transition-colors"
      >
        Confirmed ({{ confirmedCount }})
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GuestPaymentFilterTabs',
  props: {
    modelValue: {
      type: String,
      required: true
    },
    allCount: {
      type: Number,
      required: true
    },
    pendingCount: {
      type: Number,
      required: true
    },
    confirmedCount: {
      type: Number,
      required: true
    }
  },
  emits: ['update:modelValue']
};
</script>