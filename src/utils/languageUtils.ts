interface LanguageInfo {
  name: string;
  nativeName: string;
  flag: string;
}

const languages: Record<string, LanguageInfo> = {
  // Priority languages
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },

  // European
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  sv: { name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  no: { name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  da: { name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  fi: { name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  el: { name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  ro: { name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  hu: { name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  bg: { name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  hr: { name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
  sk: { name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  sl: { name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
  sr: { name: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
  uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  lt: { name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },
  lv: { name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
  et: { name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
  is: { name: 'Icelandic', nativeName: 'Íslenska', flag: '🇮🇸' },
  ga: { name: 'Irish', nativeName: 'Gaeilge', flag: '🇮🇪' },
  ca: { name: 'Catalan', nativeName: 'Català', flag: '🏴' },
  eu: { name: 'Basque', nativeName: 'Euskara', flag: '🏴' },
  gl: { name: 'Galician', nativeName: 'Galego', flag: '🏴' },

  // Asian
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  ms: { name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  tl: { name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  ta: { name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
  te: { name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  ur: { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  ne: { name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
  km: { name: 'Khmer', nativeName: 'ខ្មែរ', flag: '🇰🇭' },
  my: { name: 'Burmese', nativeName: 'ဗမာ', flag: '🇲🇲' },
  ka: { name: 'Georgian', nativeName: 'ქართული', flag: '🇬🇪' },

  // Middle East & Africa
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  he: { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  fa: { name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  sw: { name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  am: { name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹' },
  af: { name: 'Afrikaans', nativeName: 'Afrikaans', flag: '🇿🇦' },
};

const priorityLanguages = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru'];

export function getLanguageInfo(code: string): LanguageInfo {
  const normalized = code.split('-')[0].toLowerCase();
  return languages[normalized] || { name: code, nativeName: code, flag: '🌐' };
}

export function getLanguageFlag(code: string): string {
  return getLanguageInfo(code).flag;
}

export function getLanguageName(code: string): string {
  return getLanguageInfo(code).name;
}

export interface OrderedLanguage extends LanguageInfo {
  code: string;
}

export function getOrderedLanguages(): OrderedLanguage[] {
  const priority = priorityLanguages.map(code => ({ code, ...languages[code] }));
  const others = Object.entries(languages)
    .filter(([code]) => !priorityLanguages.includes(code))
    .map(([code, info]) => ({ code, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return [...priority, ...others];
}

export function getSystemLanguage(): string {
  return (navigator.language || 'en').split('-')[0];
}
