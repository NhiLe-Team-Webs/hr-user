// src/components/LanguageSwitcher.tsx
import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage'; // Import hook ngôn ngữ

interface LanguageSwitcherProps {
  currentLanguage: 'vi' | 'en';
  onLanguageChange: (language: 'vi' | 'en') => void;
}

const LanguageSwitcher: React.FC = () => {
    const { lang, setLang } = useLanguage();

    return (
        <div className="flex gap-2 text-sm">
            <button
                onClick={() => setLang('vi')}
                className={`font-semibold transition-colors duration-200 ${lang === 'vi' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                VN
            </button>
            <span className="text-muted-foreground">|</span>
            <button
                onClick={() => setLang('en')}
                className={`font-semibold transition-colors duration-200 ${lang === 'en' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
            >
                EN
            </button>
        </div>
    );
};

export default LanguageSwitcher;