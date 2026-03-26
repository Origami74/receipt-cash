import { getTranslateLanguage } from './storageService';
import { getSystemLanguage } from '../utils/languageUtils';

const LINGVA_BASE = 'https://lingva.ml/api/v1';

/**
 * Translate an array of texts using Lingva Translate (Google Translate proxy)
 */
export async function translateTexts(texts: string[], from: string = 'auto', to: string = 'en'): Promise<string[]> {
  const joined = texts.join('\n');
  const url = `${LINGVA_BASE}/${from}/${to}/${encodeURIComponent(joined)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation failed: ${response.status}`);
  }

  const data = await response.json();
  return data.translation.split('\n');
}

/**
 * Get the user's preferred target language for translation.
 * Uses stored preference, falls back to system language.
 */
export function getTargetLanguage(): string {
  const stored = getTranslateLanguage();
  if (stored && stored !== 'auto') return stored;
  return getSystemLanguage();
}
