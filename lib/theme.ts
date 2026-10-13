'use client';

import { useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from './themeScript';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_EVENT = 'dar-theme-change';

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const dark = pref === 'dark' || (pref === 'system' && systemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111318' : '#ee7318');
}

export function setThemePreference(pref: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Hook React : préférence courante + indicateur « sombre effectif ». */
export function useTheme() {
  const [pref, setPref] = useState<ThemePreference>('system');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => {
      const p = getThemePreference();
      setPref(p);
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    sync();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getThemePreference() === 'system') {
        applyTheme('system');
        sync();
      }
    };
    window.addEventListener(THEME_EVENT, sync);
    mq.addEventListener('change', onSystemChange);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      mq.removeEventListener('change', onSystemChange);
    };
  }, []);

  return {
    preference: pref,
    isDark,
    setPreference: setThemePreference,
    toggle: () => setThemePreference(isDark ? 'light' : 'dark'),
  };
}
