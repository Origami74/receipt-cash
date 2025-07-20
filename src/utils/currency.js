const currencies = {
  // Priority currencies (always shown at top)
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  
  // Major currencies
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭' },
  
  // Nordic currencies
  SEK: { symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴' },
  DKK: { symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰' },
  ISK: { symbol: 'kr', name: 'Icelandic Krona', flag: '🇮🇸' },
  
  // European currencies
  PLN: { symbol: 'zł', name: 'Polish Zloty', flag: '🇵🇱' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', flag: '🇨🇿' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', flag: '🇭🇺' },
  RON: { symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev', flag: '🇧🇬' },
  HRK: { symbol: 'kn', name: 'Croatian Kuna', flag: '🇭🇷' },
  
  // Other major economies
  RUB: { symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  TRY: { symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷' },
  MXN: { symbol: 'Mex$', name: 'Mexican Peso', flag: '🇲🇽' },
  ARS: { symbol: 'Arg$', name: 'Argentine Peso', flag: '🇦🇷' },
  CLP: { symbol: 'CLP$', name: 'Chilean Peso', flag: '🇨🇱' },
  COP: { symbol: 'COL$', name: 'Colombian Peso', flag: '🇨🇴' },
  PEN: { symbol: 'S/', name: 'Peruvian Sol', flag: '🇵🇪' },
  
  // Asian currencies
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰' },
  KRW: { symbol: '₩', name: 'South Korean Won', flag: '🇰🇷' },
  THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩' },
  MYR: { symbol: 'RM', name: 'Malaysian Ringgit', flag: '🇲🇾' },
  PHP: { symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭' },
  VND: { symbol: '₫', name: 'Vietnamese Dong', flag: '🇻🇳' },
  INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  PKR: { symbol: '₨', name: 'Pakistani Rupee', flag: '🇵🇰' },
  LKR: { symbol: '₨', name: 'Sri Lankan Rupee', flag: '🇱🇰' },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka', flag: '🇧🇩' },
  
  // Middle East & Africa
  AED: { symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪' },
  SAR: { symbol: '﷼', name: 'Saudi Riyal', flag: '🇸🇦' },
  QAR: { symbol: '﷼', name: 'Qatari Riyal', flag: '🇶🇦' },
  KWD: { symbol: 'د.ك', name: 'Kuwaiti Dinar', flag: '🇰🇼' },
  BHD: { symbol: '.د.ب', name: 'Bahraini Dinar', flag: '🇧🇭' },
  ILS: { symbol: '₪', name: 'Israeli Shekel', flag: '🇮🇱' },
  EGP: { symbol: '£', name: 'Egyptian Pound', flag: '🇪🇬' },
  ZAR: { symbol: 'R', name: 'South African Rand', flag: '🇿🇦' },
  NGN: { symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬' },
  KES: { symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪' },
  
  // Oceania
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿' },
  FJD: { symbol: 'FJ$', name: 'Fijian Dollar', flag: '🇫🇯' },
  
  // Caribbean
  BBD: { symbol: 'Bds$', name: 'Barbadian Dollar', flag: '🇧🇧' },
  JMD: { symbol: 'J$', name: 'Jamaican Dollar', flag: '🇯🇲' },
  TTD: { symbol: 'TT$', name: 'Trinidad & Tobago Dollar', flag: '🇹🇹' },
  BSD: { symbol: 'B$', name: 'Bahamian Dollar', flag: '🇧🇸' },
  XCD: { symbol: 'EC$', name: 'East Caribbean Dollar', flag: '🏴' },
  
  // Central America
  GTQ: { symbol: 'Q', name: 'Guatemalan Quetzal', flag: '🇬🇹' },
  HNL: { symbol: 'L', name: 'Honduran Lempira', flag: '🇭🇳' },
  NIO: { symbol: 'C$', name: 'Nicaraguan Córdoba', flag: '🇳🇮' },
  CRC: { symbol: '₡', name: 'Costa Rican Colón', flag: '🇨🇷' },
  PAB: { symbol: 'B/.', name: 'Panamanian Balboa', flag: '🇵🇦' },
  
  // South America (additional)
  UYU: { symbol: '$U', name: 'Uruguayan Peso', flag: '🇺🇾' },
  PYG: { symbol: '₲', name: 'Paraguayan Guaraní', flag: '🇵🇾' },
  BOB: { symbol: 'Bs.', name: 'Bolivian Boliviano', flag: '🇧🇴' },
  VES: { symbol: 'Bs.S', name: 'Venezuelan Bolívar', flag: '🇻🇪' },
  GYD: { symbol: 'GY$', name: 'Guyanese Dollar', flag: '🇬🇾' },
  SRD: { symbol: 'Sr$', name: 'Surinamese Dollar', flag: '🇸🇷' },
  
  // Additional European currencies
  ALL: { symbol: 'L', name: 'Albanian Lek', flag: '🇦🇱' },
  BAM: { symbol: 'KM', name: 'Bosnia-Herzegovina Convertible Mark', flag: '🇧🇦' },
  MKD: { symbol: 'ден', name: 'Macedonian Denar', flag: '🇲🇰' },
  RSD: { symbol: 'дин', name: 'Serbian Dinar', flag: '🇷🇸' },
  MDL: { symbol: 'L', name: 'Moldovan Leu', flag: '🇲🇩' },
  UAH: { symbol: '₴', name: 'Ukrainian Hryvnia', flag: '🇺🇦' },
  BYN: { symbol: 'Br', name: 'Belarusian Ruble', flag: '🇧🇾' },
  GEL: { symbol: '₾', name: 'Georgian Lari', flag: '🇬🇪' },
  AMD: { symbol: '֏', name: 'Armenian Dram', flag: '🇦🇲' },
  AZN: { symbol: '₼', name: 'Azerbaijani Manat', flag: '🇦🇿' },
  
  // Additional Asian currencies
  KZT: { symbol: '₸', name: 'Kazakhstani Tenge', flag: '🇰🇿' },
  UZS: { symbol: 'сўм', name: 'Uzbekistani Som', flag: '🇺🇿' },
  KGS: { symbol: 'с', name: 'Kyrgyzstani Som', flag: '🇰🇬' },
  TJS: { symbol: 'ЅМ', name: 'Tajikistani Somoni', flag: '🇹🇯' },
  TMT: { symbol: 'T', name: 'Turkmenistani Manat', flag: '🇹🇲' },
  AFN: { symbol: '؋', name: 'Afghan Afghani', flag: '🇦🇫' },
  IRR: { symbol: '﷼', name: 'Iranian Rial', flag: '🇮🇷' },
  IQD: { symbol: 'ع.د', name: 'Iraqi Dinar', flag: '🇮🇶' },
  JOD: { symbol: 'د.ا', name: 'Jordanian Dinar', flag: '🇯🇴' },
  LBP: { symbol: 'ل.ل', name: 'Lebanese Pound', flag: '🇱🇧' },
  SYP: { symbol: '£', name: 'Syrian Pound', flag: '🇸🇾' },
  YER: { symbol: '﷼', name: 'Yemeni Rial', flag: '🇾🇪' },
  OMR: { symbol: '﷼', name: 'Omani Rial', flag: '🇴🇲' },
  
  // Additional Asian currencies
  TWD: { symbol: 'NT$', name: 'Taiwan Dollar', flag: '🇹🇼' },
  MOP: { symbol: 'MOP$', name: 'Macanese Pataca', flag: '🇲🇴' },
  BND: { symbol: 'B$', name: 'Brunei Dollar', flag: '🇧🇳' },
  KHR: { symbol: '៛', name: 'Cambodian Riel', flag: '🇰🇭' },
  LAK: { symbol: '₭', name: 'Lao Kip', flag: '🇱🇦' },
  MMK: { symbol: 'Ks', name: 'Myanmar Kyat', flag: '🇲🇲' },
  NPR: { symbol: '₨', name: 'Nepalese Rupee', flag: '🇳🇵' },
  BTN: { symbol: 'Nu.', name: 'Bhutanese Ngultrum', flag: '🇧🇹' },
  MVR: { symbol: '.ރ', name: 'Maldivian Rufiyaa', flag: '🇲🇻' },
  
  // African currencies
  MAD: { symbol: 'د.م.', name: 'Moroccan Dirham', flag: '🇲🇦' },
  TND: { symbol: 'د.ت', name: 'Tunisian Dinar', flag: '🇹🇳' },
  DZD: { symbol: 'د.ج', name: 'Algerian Dinar', flag: '🇩🇿' },
  LYD: { symbol: 'ل.د', name: 'Libyan Dinar', flag: '🇱🇾' },
  SDG: { symbol: 'ج.س.', name: 'Sudanese Pound', flag: '🇸🇩' },
  ETB: { symbol: 'Br', name: 'Ethiopian Birr', flag: '🇪🇹' },
  UGX: { symbol: 'USh', name: 'Ugandan Shilling', flag: '🇺🇬' },
  TZS: { symbol: 'TSh', name: 'Tanzanian Shilling', flag: '🇹🇿' },
  RWF: { symbol: 'RF', name: 'Rwandan Franc', flag: '🇷🇼' },
  BIF: { symbol: 'FBu', name: 'Burundian Franc', flag: '🇧🇮' },
  DJF: { symbol: 'Fdj', name: 'Djiboutian Franc', flag: '🇩🇯' },
  SOS: { symbol: 'Sh', name: 'Somali Shilling', flag: '🇸🇴' },
  MGA: { symbol: 'Ar', name: 'Malagasy Ariary', flag: '🇲🇬' },
  MUR: { symbol: '₨', name: 'Mauritian Rupee', flag: '🇲🇺' },
  SCR: { symbol: '₨', name: 'Seychellois Rupee', flag: '🇸🇨' },
  KMF: { symbol: 'CF', name: 'Comorian Franc', flag: '🇰🇲' },
  
  // West African CFA
  XOF: { symbol: 'CFA', name: 'West African CFA Franc', flag: '🌍' },
  XAF: { symbol: 'FCFA', name: 'Central African CFA Franc', flag: '🌍' },
  
  // Additional African currencies
  GHS: { symbol: '₵', name: 'Ghanaian Cedi', flag: '🇬🇭' },
  GMD: { symbol: 'D', name: 'Gambian Dalasi', flag: '🇬🇲' },
  GNF: { symbol: 'FG', name: 'Guinean Franc', flag: '🇬🇳' },
  LRD: { symbol: 'L$', name: 'Liberian Dollar', flag: '🇱🇷' },
  SLE: { symbol: 'Le', name: 'Sierra Leonean Leone', flag: '🇸🇱' },
  SLL: { symbol: 'Le', name: 'Sierra Leonean Leone (old)', flag: '🇸🇱' },
  CVE: { symbol: '$', name: 'Cape Verdean Escudo', flag: '🇨🇻' },
  STN: { symbol: 'Db', name: 'São Tomé and Príncipe Dobra', flag: '🇸🇹' },
  AOA: { symbol: 'Kz', name: 'Angolan Kwanza', flag: '🇦🇴' },
  MZN: { symbol: 'MT', name: 'Mozambican Metical', flag: '🇲🇿' },
  ZMW: { symbol: 'ZK', name: 'Zambian Kwacha', flag: '🇿🇲' },
  MWK: { symbol: 'MK', name: 'Malawian Kwacha', flag: '🇲🇼' },
  BWP: { symbol: 'P', name: 'Botswanan Pula', flag: '🇧🇼' },
  NAD: { symbol: 'N$', name: 'Namibian Dollar', flag: '🇳🇦' },
  SZL: { symbol: 'L', name: 'Swazi Lilangeni', flag: '🇸🇿' },
  LSL: { symbol: 'L', name: 'Lesotho Loti', flag: '🇱🇸' },
  
  // Pacific currencies
  TOP: { symbol: 'T$', name: 'Tongan Paʻanga', flag: '🇹🇴' },
  WST: { symbol: 'WS$', name: 'Samoan Tala', flag: '🇼🇸' },
  VUV: { symbol: 'VT', name: 'Vanuatu Vatu', flag: '🇻🇺' },
  SBD: { symbol: 'SI$', name: 'Solomon Islands Dollar', flag: '🇸🇧' },
  PGK: { symbol: 'K', name: 'Papua New Guinea Kina', flag: '🇵🇬' },
  
  // Exotic and Special currencies
  XPF: { symbol: '₣', name: 'CFP Franc', flag: '🇵🇫' },
  FKP: { symbol: '£', name: 'Falkland Islands Pound', flag: '🇫🇰' },
  SHP: { symbol: '£', name: 'Saint Helena Pound', flag: '🇸🇭' },
  GIP: { symbol: '£', name: 'Gibraltar Pound', flag: '🇬🇮' },
  JEP: { symbol: '£', name: 'Jersey Pound', flag: '🇯🇪' },
  GGP: { symbol: '£', name: 'Guernsey Pound', flag: '🇬🇬' },
  IMP: { symbol: '£', name: 'Isle of Man Pound', flag: '🇮🇲' }
};

// Priority order for top currencies
const priorityCurrencies = ['USD', 'EUR', 'GBP'];

export function getCurrencySymbol(isoCode) {
  return currencies[isoCode]?.symbol || isoCode;
}

export function getCurrencyInfo(isoCode) {
  return currencies[isoCode] || { symbol: isoCode, name: isoCode, flag: '💱' };
}

export function getAllCurrencies() {
  return currencies;
}

export function getOrderedCurrencies() {
  const priority = priorityCurrencies.map(code => ({ code, ...currencies[code] }));
  const others = Object.entries(currencies)
    .filter(([code]) => !priorityCurrencies.includes(code))
    .map(([code, info]) => ({ code, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  return [...priority, ...others];
}

export function searchCurrencies(query) {
  const searchTerm = query.toLowerCase();
  const allCurrencies = getOrderedCurrencies();
  
  return allCurrencies.filter(currency =>
    currency.code.toLowerCase().includes(searchTerm) ||
    currency.name.toLowerCase().includes(searchTerm) ||
    currency.symbol.includes(searchTerm)
  );
}

export function formatCurrency(amount, isoCode) {
  const symbol = getCurrencySymbol(isoCode);
  
  // Handle null, undefined, or NaN amounts
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${symbol}0.00`;
  }
  
  return `${symbol}${amount.toFixed(2)}`;
}