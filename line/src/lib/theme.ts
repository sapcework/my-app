// テーマ（ライト/ダーク/システム）の適用と永続化
export type Theme = 'light' | 'dark' | 'system';

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('theme') as Theme) || 'system';
}

function resolveDark(theme: Theme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches; // system
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme', theme);
  document.documentElement.classList.toggle('dark', resolveDark(theme));
}
