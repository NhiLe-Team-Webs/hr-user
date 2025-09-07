// src/components/PreAssessmentScreen.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import { Clock, ListChecks } from 'lucide-react';
import { Role } from '../types/assessment';
import { assessmentData } from '../data/assessmentData';

interface PreAssessmentScreenProps {
  role: Role;
  onStartAssessment: () => void;
}

const PreAssessmentScreen: React.FC<PreAssessmentScreenProps> = ({ role, onStartAssessment }) => {
  const { t } = useLanguage();
  const assessment = assessmentData[role.name];

  if (!assessment) {
    return <p>{t('assessmentScreen.noAssessment')}</p>;
  }

  const durationInMinutes = Math.floor(assessment.duration / 60);
  const numberOfQuestions = assessment.questions.length;

  return (
    <motion.div
      key="pre-assessment"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="text-center apple-card p-8 md:p-12 max-w-lg mx-auto"
    >
      <h2 className="text-3xl font-bold mb-6 tracking-tight">
        {t('preAssessmentScreen.title')}
      </h2>
      <p className="text-muted-foreground mb-8 text-lg">
        {t('preAssessmentScreen.description', { role: role.name })}
      </p>

      <div className="flex justify-center items-center gap-8 mb-10">
        <div className="flex flex-col items-center gap-2">
          <Clock className="w-10 h-10 text-primary" />
          <span className="text-xl font-bold">{durationInMinutes}</span>
          <span className="text-muted-foreground">{t('preAssessmentScreen.minutes')}</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ListChecks className="w-10 h-10 text-primary" />
          <span className="text-xl font-bold">{numberOfQuestions}</span>
          <span className="text-muted-foreground">{t('preAssessmentScreen.questions')}</span>
        </div>
      </div>

      <Button
        onClick={onStartAssessment}
        className="apple-button text-lg px-8 py-4 w-full"
      >
        {t('preAssessmentScreen.startAssessment')}
      </Button>
    </motion.div>
  );
};

export default PreAssessmentScreen;