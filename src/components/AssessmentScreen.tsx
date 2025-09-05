// src/components/AssessmentScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { assessmentData } from '../data/assessmentData';
import { Role, UserAnswers } from '../types/assessment';
import { useLanguage } from '../hooks/useLanguage';

interface AssessmentScreenProps {
  role: Role;
  onFinish: (result: { score: number; strengths: string[]; }) => void;
}

const AssessmentScreen: React.FC<AssessmentScreenProps> = ({ role, onFinish }) => {
  const { t } = useLanguage();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (role) {
      startTimer(assessmentData[role].duration);
    }
  }, [role]);

  const startTimer = (duration: number) => {
    setTimer(duration);
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          finishAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    setTimerInterval(interval);
  };

  const finishAssessment = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    const result = {
      score: calculateScore(),
      strengths: getRandomStrengths()
    };
    onFinish(result);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveAnswer = (questionIndex: number, optionIndex: number) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const navigateQuestion = (direction: number) => {
    const questions = assessmentData[role].questions;
    const newIndex = currentQuestionIndex + direction;

    if (newIndex >= 0 && newIndex < questions.length) {
      setCurrentQuestionIndex(newIndex);
    }
  };

  const calculateScore = () => {
    if (!role) return 0;
    const questions = assessmentData[role].questions;
    let correctAnswers = 0;
    
    for (let i = 0; i < questions.length; i++) {
      if (userAnswers[i] === questions[i].correct) {
        correctAnswers++;
      }
    }
    
    return (correctAnswers / questions.length) * 100;
  };
  
  const getRandomStrengths = () => {
    const strengths = [
      t('strengths.strength1'),
      t('strengths.strength2'),
      t('strengths.strength3'),
      t('strengths.strength4'),
      t('strengths.strength5'),
      t('strengths.strength6')
    ];
    return strengths.sort(() => 0.5 - Math.random()).slice(0, 3);
  };

  const renderQuestion = () => {
    const questions = assessmentData[role].questions;
    if (questions.length === 0) return <p>{t('assessmentScreen.noAssessment')}</p>;

    const question = questions[currentQuestionIndex];

    return (
      <motion.div
        key={currentQuestionIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm font-semibold text-primary mb-2">{question.title}</p>
        <p className="text-xl font-semibold text-foreground mb-6 tracking-tight">{question.text}</p>
        <div className="space-y-4">
          {question.options.map((option, index) => (
            <label
              key={index}
              className={`block p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                userAnswers[currentQuestionIndex] === index
                  ? 'bg-primary/10 border-primary ring-1 ring-primary'
                  : 'border-border hover:bg-primary/5 hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name={`question${currentQuestionIndex}`}
                value={index}
                checked={userAnswers[currentQuestionIndex] === index}
                onChange={() => saveAnswer(currentQuestionIndex, index)}
                className="mr-3 accent-primary"
              />
              <span className="text-foreground">{option}</span>
            </label>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      key="assessment"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold tracking-tight">
          {t('assessmentScreen.assessmentTitle')}: {role}
        </h2>
        <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-xl shadow-sm">
          <Clock className="text-red-500 w-5 h-5" />
          <span className="font-mono font-semibold text-red-500 text-lg">
            {formatTime(timer)}
          </span>
        </div>
      </div>

      <div className="apple-card p-8 transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted-foreground">{t('assessmentScreen.progressLabel')}</span>
            <span className="text-sm font-medium text-primary">
              {t('assessmentScreen.questionLabel')} {currentQuestionIndex + 1} / {assessmentData[role].questions.length}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
              style={{
                width: `${((currentQuestionIndex + 1) / assessmentData[role].questions.length) * 100}%`
              }}
            />
          </div>
        </div>
        <div>
          {renderQuestion()}
        </div>
        <div className="mt-8 pt-6 border-t border-border/80 flex justify-between items-center">
          <Button
            onClick={() => navigateQuestion(-1)}
            disabled={currentQuestionIndex === 0}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{t('assessmentScreen.previousBtn')}</span>
          </Button>
          {currentQuestionIndex === assessmentData[role].questions.length - 1 ? (
            <Button
              onClick={finishAssessment}
              className="apple-button flex items-center gap-2 bg-green-500 hover:bg-green-600"
            >
              <span>{t('assessmentScreen.finishBtn')}</span>
              <CheckCircle className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              onClick={() => navigateQuestion(1)}
              className="apple-button flex items-center gap-2"
            >
              <span>{t('assessmentScreen.nextBtn')}</span>
              <ArrowRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default AssessmentScreen;