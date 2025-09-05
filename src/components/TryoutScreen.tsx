import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';

interface TryoutScreenProps {
  onStartTask: () => void; // Có thể thêm logic để xử lý việc bắt đầu một nhiệm vụ cụ thể
}

const TryoutScreen: React.FC<TryoutScreenProps> = ({ onStartTask }) => {
  const { t } = useLanguage();

  return (
    <motion.div
      key="tryout"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 md:p-12"
    >
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-3 tracking-tight">{t('tryoutScreen.title')}</h2>
        <p className="text-muted-foreground">
          {t('tryoutScreen.subtitle')} <span className="font-semibold text-red-600">{t('tryoutScreen.deadline')}</span>.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-start gap-5 p-6 bg-muted/50 rounded-2xl">
          <div className="bg-primary/10 text-primary p-3 rounded-xl">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div className="flex-grow">
            <h3 className="font-bold text-lg">{t('tryoutScreen.task1Title')}</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {t('tryoutScreen.task1Text')}
            </p>
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full mt-3 inline-block">
              {t('tryoutScreen.task1Estimate')}
            </span>
          </div>
          <Button onClick={onStartTask} variant="secondary" className="w-full md:w-auto">
            {t('tryoutScreen.startBtn')}
          </Button>
        </div>

        <div className="flex flex-col md:flex-row items-start gap-5 p-6 bg-muted/50 rounded-2xl">
          <div className="bg-primary/10 text-primary p-3 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-grow">
            <h3 className="font-bold text-lg">{t('tryoutScreen.task2Title')}</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {t('tryoutScreen.task2Text')}
            </p>
            <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full mt-3 inline-block">
              {t('tryoutScreen.task2Estimate')}
            </span>
          </div>
          <Button onClick={onStartTask} variant="secondary" className="w-full md:w-auto">
            {t('tryoutScreen.startBtn')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default TryoutScreen;