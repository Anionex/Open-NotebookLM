import { useEffect } from 'react';

import { installDomTranslator, translateDom } from './domTranslator';
import { useI18nStore } from './store';

export function useI18nDom() {
  const locale = useI18nStore((state) => state.locale);

  useEffect(() => {
    window.__tfTranslateDom = translateDom;
    installDomTranslator(locale);
    translateDom(locale);
  }, [locale]);
}
