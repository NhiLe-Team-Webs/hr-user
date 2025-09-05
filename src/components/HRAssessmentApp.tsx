// src/components/HRAssessmentApp.tsx
import React from 'react';
import { Heart } from 'lucide-react';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../hooks/useLanguage';

interface HRAssessmentAppProps {
  children: React.ReactNode;
}

const HRAssessmentApp: React.FC<HRAssessmentAppProps> = ({ children }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 font-inter text-foreground">
      <div className="min-h-screen w-full flex flex-col items-center p-4">
        {/* This header will be on every page */}
        <header className="w-full max-w-6xl mx-auto my-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Heart className="h-7 w-7 text-neutral-900 dark:text-neutral-50" />
            <h1 className="font-bold text-2xl tracking-tight">{t('common.teamName')}</h1>
          </div>
          <LanguageSwitcher />
        </header>

        <main className="w-full max-w-6xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default HRAssessmentApp;