import { useMemo, type ReactNode } from 'react';
import { I18nContext, type Translate } from './context';
import { translate, type Locale } from './messages';

/**
 * 言語を配るだけの Provider。
 * fast-refresh の制約でコンポーネント以外を同居させられないため、
 * フックと型は context.ts、辞書は messages.ts に分けている。
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(
    () => ({ locale, t: ((key, vars) => translate(locale, key, vars)) as Translate }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
