import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { APP_CONFIG } from '../config';
import { createTranslator, formatPrice as formatPriceHelper, Language, TranslationKey } from '../i18n';
import { safeStorage } from '../utils';
import { useToastContext } from './ToastContext';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  formatPrice: (amount: number | string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToastContext();
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = safeStorage.get(APP_CONFIG.STORAGE_KEYS.LANGUAGE);
    return saved === 'en' || saved === 'ne' ? saved : 'en';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
    safeStorage.set(APP_CONFIG.STORAGE_KEYS.LANGUAGE, language);
  }, [language]);

  const t = useMemo(() => createTranslator(language), [language]);
  const formatPrice = useCallback((amount: number | string) => formatPriceHelper(amount, language), [language]);

  const setLanguage = useCallback(
    (nextLang: Language) => {
      setLanguageState(nextLang);
      const nextT = createTranslator(nextLang);
      showToast(nextT('toast.languageSwitched'), 'info');
    },
    [showToast]
  );

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next: Language = prev === 'en' ? 'ne' : 'en';
      const nextT = createTranslator(next);
      showToast(nextT('toast.languageSwitched'), 'info');
      return next;
    });
  }, [showToast]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t, formatPrice }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguageContext must be used within a LanguageProvider');
  return ctx;
}
