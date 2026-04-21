import { create } from 'zustand';

export type Locale = 'zh' | 'en';

const STORAGE_KEY = 'thinkflow_locale';

function isLocale(value: string | null): value is Locale {
  return value === 'zh' || value === 'en';
}

function detectLocale(): Locale {
  const saved = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem('locale');
  if (isLocale(saved)) return saved;
  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

type I18nState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    window.localStorage.setItem('locale', locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    set({ locale });
  },
  toggleLocale: () => {
    get().setLocale(get().locale === 'zh' ? 'en' : 'zh');
  },
}));

