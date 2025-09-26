import type { ReactNode } from 'react';
import { Textarea } from '@/components/ui/textarea';
import type { Question } from '@/types/assessment';
import { cn } from '../utils';

interface RenderQuestionParams {
  question: Question;
  selectedOptionId?: string | null;
  onSelectOption?: (optionId: string) => void;
  textValue?: string;
  onTextChange?: (value: string) => void;
  onTextBlur?: () => void;
  t: (key: string) => string;
}

const fallbackMessage = (message: string) => (
  <p className="text-sm text-muted-foreground text-center py-4">{message}</p>
);

export const renderQuestion = ({
  question,
  selectedOptionId,
  onSelectOption,
  textValue,
  onTextChange,
  onTextBlur,
  t,
}: RenderQuestionParams): ReactNode => {
  if (question.format === 'multiple_choice') {
    if (!question.options || question.options.length === 0) {
      return fallbackMessage(t('assessmentScreen.noOptions'));
    }

    return (
      <div className="space-y-3">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <label
              key={option.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer transition-all',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
              )}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                className="sr-only"
                checked={isSelected}
                onChange={() => onSelectOption?.(option.id)}
              />
              <span className="flex-1 text-left text-sm md:text-base">{option.text}</span>
              <span
                className={cn(
                  'h-4 w-4 rounded-full border-2 transition-colors',
                  isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                )}
                aria-hidden="true"
              />
            </label>
          );
        })}
      </div>
    );
  }

  if (question.format === 'text' || question.format === 'essay') {
    return (
      <Textarea
        placeholder={t('assessmentScreen.typeYourAnswer')}
        value={textValue ?? ''}
        onChange={(event) => onTextChange?.(event.target.value)}
        onBlur={onTextBlur}
        className="min-h-[160px] resize-y"
      />
    );
  }

  return fallbackMessage(t('assessmentScreen.noOptions'));
};
