import { ref, reactive } from 'vue';
import { translateTexts, getTargetLanguage } from '../services/translationService';

export const CONFIDENCE_THRESHOLD = 0.8;

export function useTranslation(getNames: () => string[], getSourceLanguage: () => string) {
  const isTranslated = ref(false);
  const isTranslating = ref(false);
  const translatedNames = reactive<Record<string, string>>({});

  const toggleTranslation = async () => {
    if (isTranslated.value) {
      isTranslated.value = false;
      return;
    }

    const names = getNames();
    if (names.every(name => translatedNames[name])) {
      isTranslated.value = true;
      return;
    }

    isTranslating.value = true;
    try {
      const from = getSourceLanguage().split('-')[0] || 'auto';
      const to = getTargetLanguage();
      const translated = await translateTexts(names, from, to);
      names.forEach((name, i) => {
        translatedNames[name] = translated[i];
      });
      isTranslated.value = true;
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      isTranslating.value = false;
    }
  };

  const displayName = (originalName: string): string => {
    return isTranslated.value && translatedNames[originalName] ? translatedNames[originalName] : originalName;
  };

  return {
    isTranslated,
    isTranslating,
    translatedNames,
    toggleTranslation,
    displayName
  };
}
