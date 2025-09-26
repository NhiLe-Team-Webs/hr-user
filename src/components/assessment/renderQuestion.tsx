import React from 'react';
import { motion } from 'framer-motion';
import type { Question } from '@/types/question';
import type { AnswerValue } from '@/types/assessment';
import { Textarea } from '@/components/ui/textarea';

interface RenderQuestionConfig {
  currentAnswer: AnswerValue | undefined;
  onOptionSelect: (optionIndex: number) => void;
  onTextChange: (value: string) => void;
  onTextBlur: () => void;
  t: (key: string) => string;
}

export const renderQuestion = (
  question: Question,
  { currentAnswer, onOptionSelect, onTextChange, onTextBlur, t }: RenderQuestionConfig,
): React.ReactNode => {
  if (question.format === 'multiple_choice') {
    if (!question.options || question.options.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          {t('assessmentScreen.noOptions')}
        </p>
      );
    }

    return question.options.map((option, index) => {
      const isSelected = Number(currentAnswer) === index;
      return (
        <motion.div
          key={option.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div
            className={`relative flex items-center p-6 border-2 rounded-2xl cursor-pointer transition-all duration-300 font-medium text-lg min-h-[70px] ${
              isSelected
                ? 'bg-blue-100 border-blue-500 text-blue-800 shadow-lg shadow-blue-200'
                : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:shadow-md'
            }`}
            onClick={() => onOptionSelect(index)}
          >
            <span className="flex-1 text-left text-sm">{option.text}</span>
          </div>
        </motion.div>
      );
    });
  }

  return (
    <Textarea
      placeholder={t('assessmentScreen.typeYourAnswer')}
      value={typeof currentAnswer === 'string' ? currentAnswer : ''}
      onChange={(event) => onTextChange(event.target.value)}
      onBlur={onTextBlur}
      className="min-h-[150px] p-4 border-2 rounded-2xl focus:border-blue-500 focus:ring-blue-500 transition-all duration-300"
    />
  );
};
