import { Languages } from 'lucide-react';

import { useI18nStore } from './store';

export function LanguageSwitcher() {
  const locale = useI18nStore((state) => state.locale);
  const toggleLocale = useI18nStore((state) => state.toggleLocale);
  const nextLabel = locale === 'zh' ? 'EN' : '中文';
  const ariaLabel = locale === 'zh' ? 'Switch to English' : 'Switch to Chinese';

  return (
    <button
      type="button"
      className="thinkflow-language-switcher"
      onClick={toggleLocale}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Languages size={16} />
      <span>{nextLabel}</span>
    </button>
  );
}

