import { createContext, useContext } from 'react';
import { translate, type Locale, type MessageKey } from './messages';

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const I18nContext = createContext<{ locale: Locale; t: Translate }>({
  locale: 'ja',
  t: (key) => translate('ja', key),
});

/** 表示文字列を引くフック。`t('history.count', { n: 3 })` のように使う。 */
export function useI18n() {
  return useContext(I18nContext);
}
