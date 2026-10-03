import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set) => ({
      fontSizeStep: 0,
      highContrast: false,
      language: typeof window !== 'undefined' && window.localStorage.getItem('nawi_lang') === 'hi' ? 'HI' : 'EN',
      setFontSizeStep: (step) =>
        set({ fontSizeStep: Math.max(-1, Math.min(1, step)) }),
      toggleHighContrast: () =>
        set((s) => ({ highContrast: !s.highContrast })),
      setLanguage: (lang) => {
        if (typeof window !== 'undefined') window.localStorage.setItem('nawi_lang', lang.toLowerCase());
        set({ language: lang });
      },
    }),
    { name: 'nawi_theme' }
  )
);
