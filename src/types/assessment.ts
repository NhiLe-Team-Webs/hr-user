export interface Question {
  type: 'work_sample' | 'problem_solving' | 'reliability' | 'culture_fit';
  title: string;
  text: string;
  options: string[];
  correct: number;
}

export interface AssessmentData {
  duration: number; // duration in seconds
  questions: Question[];
}

export type Role = 'Content Creator' | 'Customer Support' | 'Operations';

export interface UserAnswers {
  [questionIndex: number]: number;
}

export type Screen = 'landing' | 'login' | 'role-selection' | 'assessment' | 'result' | 'tryout';