// src/types/assessment.ts

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

export type Role = {
    name: 'Content Creator';
    title: 'Content Creator';
} | {
    name: 'Customer Support';
    title: 'Customer Support';
} | {
    name: 'Operations';
    title: 'Operations / Admin';
};

export interface UserAnswers {
    [questionIndex: number]: number;
}

export type Screen = 'landing' | 'login' | 'role-selection' | 'assessment' | 'result' | 'tryout';