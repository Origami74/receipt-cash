<template>
  <div class="flex items-center gap-2">
    <label for="currency-select" class="text-xs text-gray-500">Currency:</label>
    <select 
      id="currency-select"
      :value="modelValue" 
      @change="$emit('update:modelValue', $event.target.value)"
      class="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
    >
      <option value="USD">USD ($)</option>
      <option value="EUR">EUR (€)</option>
      <option value="GBP">GBP (£)</option>
      <option value="JPY">JPY (¥)</option>
      <option value="CAD">CAD (C$)</option>
      <option value="AUD">AUD (A$)</option>
      <option value="CHF">CHF (Fr)</option>
      <option value="SEK">SEK (kr)</option>
      <option value="NOK">NOK (kr)</option>
      <option value="DKK">DKK (kr)</option>
      <option value="PLN">PLN (zł)</option>
      <option value="RUB">RUB (₽)</option>
      <option value="TRY">TRY (₺)</option>
      <option value="BRL">BRL (R$)</option>
      <option value="MXN">MXN (Mex$)</option>
      <option value="SGD">SGD (S$)</option>
      <option value="NZD">NZD (NZ$)</option>
      <option value="HKD">HKD (HK$)</option>
      <option value="KRW">KRW (₩)</option>
      <option value="THB">THB (฿)</option>
      <option value="IDR">IDR (Rp)</option>
      <option value="MYR">MYR (RM)</option>
      <option value="PHP">PHP (₱)</option>
      <option value="VND">VND (₫)</option>
      <option value="ZAR">ZAR (R)</option>
    </select>
  </div>
</template>

<script>
export default {
  name: 'CurrencySelector',
  props: {
    modelValue: {
      type: String,
      required: true
    }
  },
  emits: ['update:modelValue']
};
</script>

<style scoped>
/* Component-specific styles */
</style>