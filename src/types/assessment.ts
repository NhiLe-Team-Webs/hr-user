// src/types/assessment.ts

// This is the correct, unified Question interface
export interface Question {
  id: string;
  text: string;
  type: string;
  format: 'text' | 'multiple_choice';
  required: boolean;
  points: number;
  options?: Option[];
  correctAnswer?: string;
}

export interface UserAnswers {
  [questionIndex: number]: number;
}
// Option interface for multiple-choice questions
export interface Option {
  id: string;
  text: string;
}

// Assessment interface
export interface Assessment {
  id: string;
  title: string;
  description: string;
  duration: number; // in seconds
  questions: {
    question_id: string;
    order: number;
  }[];
}

// Unified Role interface
export interface Role {
  name: string;
  title: string;
}