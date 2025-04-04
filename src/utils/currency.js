const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  CHF: 'Fr',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  RUB: '₽',
  TRY: '₺',
  BRL: 'R$',
  MXN: 'Mex$',
  SGD: 'S$',
  NZD: 'NZ$',
  HKD: 'HK$',
  KRW: '₩',
  THB: '฿',
  IDR: 'Rp',
  MYR: 'RM',
  PHP: '₱',
  VND: '₫',
  ZAR: 'R'
};

export function getCurrencySymbol(isoCode) {
  return currencySymbols[isoCode] || isoCode;
}

export function formatCurrency(amount, isoCode) {
  const symbol = getCurrencySymbol(isoCode);
  return `${symbol}${amount.toFixed(2)}`;
} 