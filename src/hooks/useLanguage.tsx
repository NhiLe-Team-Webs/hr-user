// src/hooks/useLanguage.tsx

import { useState, createContext, useContext, ReactNode, useEffect } from 'react';
import viTranslations from '../locales/vi.json';
import enTranslations from '../locales/en.json';
import TranslationKey from '../types/locales'; // Import the new type

type Language = 'vi' | 'en';

type Translations = {
  [key in Language]: TranslationKey;
};

const translations: Translations = {
  vi: viTranslations,
  en: enTranslations,
};

type LanguageContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
};

export const LanguageContext = createContext<LanguageContextType>({
  lang: 'vi',
  setLang: () => {},
  t: (key) => key,
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Language>('vi');

  useEffect(() => {
    const storedLang = localStorage.getItem('lang') as Language | null;
    if (storedLang && ['vi', 'en'].includes(storedLang)) {
      setLang(storedLang);
    } else {
      const browserLang = navigator.language.split('-')[0];
      setLang(browserLang === 'en' ? 'en' : 'vi');
    }
  }, []);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };
  
  const t = (key: string): string => {
    const keys = key.split('.');
    let result = translations[lang];

    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        return key; // Trả về key gốc nếu không tìm thấy
      }
    }

    return typeof result === 'string' ? result : key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);