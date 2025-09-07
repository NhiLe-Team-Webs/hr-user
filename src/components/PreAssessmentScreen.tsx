// src/components/PreAssessmentScreen.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { useLanguage } from '../hooks/useLanguage';
import { Clock, ListChecks } from 'lucide-react';
import { getAssessment } from '../lib/api';
import { Role, Assessment } from '../types/assessment';

interface PreAssessmentScreenProps {
  role: Role;
  onStartAssessment: (assessment: Assessment) => void;
}

const PreAssessmentScreen: React.FC<PreAssessmentScreenProps> = ({ role, onStartAssessment }) => {
  const { t } = useLanguage();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const assessmentData = await getAssessment(role.name);
        if (assessmentData) {
          setAssessment(assessmentData);
        } else {
          setError(t('preAssessmentScreen.noAssessment'));
        }
      } catch (err) {
        setError(t('preAssessmentScreen.errorDescription'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (role && role.name) {
      fetchAssessment();
    }
  }, [role, t]);

  if (!role || loading) {
    return (
      <motion.div
        key="pre-assessment"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center apple-card p-8 md:p-12 max-w-lg mx-auto"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
        <p>{t('preAssessmentScreen.loading')}</p>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        key="error-assessment"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center apple-card p-8 md:p-12 max-w-lg mx-auto text-red-500"
      >
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">
          {t('preAssessmentScreen.retryButton')}
        </Button>
      </motion.div>
    );
  }

  if (!assessment || !assessment.questions) {
    return (
        <motion.div
          key="no-assessment-data"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center apple-card p-8 md:p-12 max-w-lg mx-auto text-red-500"
        >
          <p>{t('preAssessmentScreen.noAssessment')}</p>
        </motion.div>
    );
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
        onClick={() => onStartAssessment(assessment)}
        className="apple-button text-lg px-8 py-4 w-full"
      >
        {t('preAssessmentScreen.startAssessment')}
      </Button>
    </motion.div>
  );
};

export default PreAssessmentScreen;