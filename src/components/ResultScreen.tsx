// src/components/ResultScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';

interface ResultScreenProps {
  // Define props with correct types
  result: {
    score: number;
    strengths: string[];
  };
  onTryoutClick: () => void;
}

const ResultScreen: React.FC<ResultScreenProps> = ({ result, onTryoutClick }) => {
  const { t } = useLanguage();
  const { score, strengths } = result;
  const isAPlayer = score >= 80;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12"
    >
      <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('resultScreen.title')}</h2>
      <p className="text-muted-foreground mb-8">{t('resultScreen.subtitle')}</p>

      <div className="mb-8">
        <h3 className="font-semibold text-lg mb-4">{t('resultScreen.strengthsTitle')}</h3>
        <div className="flex justify-center flex-wrap gap-4">
          {strengths.map((strength, index) => (
            <div key={index} className="bg-green-100 text-green-800 font-medium px-4 py-2 rounded-full">
              {strength}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-border/80">
        <h3 className="font-semibold text-xl mb-2 tracking-tight">{t('resultScreen.nextStepsTitle')}</h3>
        {isAPlayer ? (
          <div>
            <p className="text-muted-foreground my-6 text-lg">
              {t('resultScreen.successText')}
            </p>
            <Button className="apple-button mt-4">
              {t('resultScreen.successCta')}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-muted-foreground my-6 text-lg">
              {t('resultScreen.tryoutText')}
            </p>
            <Button onClick={onTryoutClick} className="apple-button mt-4">
              {t('resultScreen.tryoutCta')}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ResultScreen;