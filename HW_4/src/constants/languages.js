/**
 * Target languages for narration translation. At least one per human-inhabited continent:
 * Africa, Asia, Europe, North America, South America, Oceania.
 * Each has code (for API) and label (for UI).
 */
export const TRANSLATION_LANGUAGES = [
  { code: 'en', label: 'English', continent: 'North America' },
  { code: 'es', label: 'Spanish', continent: 'Europe / South America' },
  { code: 'fr', label: 'French', continent: 'Europe' },
  { code: 'de', label: 'German', continent: 'Europe' },
  { code: 'pt', label: 'Portuguese', continent: 'South America' },
  { code: 'ar', label: 'Arabic (Egypt)', continent: 'Africa' },
  { code: 'sw', label: 'Swahili', continent: 'Africa' },
  { code: 'hi', label: 'Hindi', continent: 'Asia' },
  { code: 'zh', label: 'Chinese (Mandarin)', continent: 'Asia' },
  { code: 'ja', label: 'Japanese', continent: 'Asia' },
  { code: 'ko', label: 'Korean', continent: 'Asia' },
  { code: 'mi', label: 'Māori', continent: 'Oceania' },
];
