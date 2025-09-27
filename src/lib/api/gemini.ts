import type { AssessmentResult } from '@/types/assessment';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MODEL_NAME = 'gemini-2.5-flash';

export interface GeminiAnswerPayload {
  questionId: string;
  questionText: string;
  answerText: string;
  format: string;
  options?: string[];
}

export interface GeminiAnalysisRequest {
  role: string;
  candidateName: string | null;
  language: 'vi' | 'en';
  answers: GeminiAnswerPayload[];
}

export interface GeminiSkillScore {
  name: string;
  score: number;
}

export interface GeminiAnalysisResponse {
  model: string;
  overallScore: number | null;
  skillScores: GeminiSkillScore[];
  strengths: string[];
  developmentAreas: string[];
  summary: string;
  raw: unknown;
}

export class GeminiApiError extends Error {
  public readonly status?: number;

  public readonly payload?: unknown;

  constructor(message: string, options?: { status?: number; payload?: unknown }) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = options?.status;
    this.payload = options?.payload;
  }
}

const ensureApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('Gemini API key is not configured.');
  }
  return apiKey;
};

const buildPrompt = (request: GeminiAnalysisRequest): string => {
  const languageInstruction =
    request.language === 'vi'
      ?
        'Please analyse the answers in Vietnamese. The response must be written in Vietnamese.'
      :
        'Please analyse the answers in English. The response must be written in English.';

  const payload = {
    candidate: {
      name: request.candidateName,
      target_role: request.role,
    },
    answers: request.answers.map((answer, index) => ({
      order: index + 1,
      question_id: answer.questionId,
      question_text: answer.questionText,
      answer_text: answer.answerText,
      format: answer.format,
      options: answer.options,
    })),
  } satisfies Record<string, unknown>;

  return [
    'You are an experienced HR assessor specialising in behavioural and culture-fit interviews.',
    'Evaluate the candidate responses and provide a structured summary.',
    'Return a strict JSON object with the following keys:',
    '- "overall_score": number from 0-100 (integer or float).',
    '- "skill_scores": array of objects with "name" and "score" (0-100).',
    '- "strengths": array of strings describing positive behaviours.',
    '- "development_areas": array of strings for improvements.',
    '- "summary": a concise paragraph (string) tailored for the candidate.',
    'Do not include any additional commentary. JSON only.',
    languageInstruction,
    'Assessment context:',
    JSON.stringify(payload, null, 2),
  ].join('\n\n');
};

const normaliseNumber = (value: unknown): number | null => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (Number.isNaN(num)) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round(num * 100) / 100));
};

const normaliseSkillScores = (value: unknown): GeminiSkillScore[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== 'object' || !item) {
        return null;
      }
      const name =
        typeof (item as { name?: unknown }).name === 'string'
          ? (item as { name: string }).name
          : typeof (item as { skill?: unknown }).skill === 'string'
            ? ((item as { skill: string }).skill)
            : null;
      const score = normaliseNumber((item as { score?: unknown }).score);
      if (!name || score === null) {
        return null;
      }
      return { name, score } satisfies GeminiSkillScore;
    })
    .filter((item): item is GeminiSkillScore => item !== null);
};

const normaliseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

const parseGeminiPayload = (payload: unknown): GeminiAnalysisResponse => {
  if (!payload || typeof payload !== 'object') {
    throw new GeminiApiError('Gemini response does not include a JSON object.');
  }

  const typed = payload as Record<string, unknown>;
  const overallScore = normaliseNumber(typed.overall_score ?? typed.total_score);
  const skillScores = normaliseSkillScores(typed.skill_scores);
  const strengths = normaliseStringArray(typed.strengths);
  const developmentAreas = normaliseStringArray(typed.development_areas ?? typed.opportunities);
  const summary = typeof typed.summary === 'string' ? typed.summary.trim() : '';

  return {
    model: MODEL_NAME,
    overallScore,
    skillScores,
    strengths,
    developmentAreas,
    summary,
    raw: payload,
  } satisfies GeminiAnalysisResponse;
};

const extractCandidateResponse = (response: unknown): unknown => {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const [firstCandidate] = candidates as Array<{ content?: unknown }>;
  const parts = (firstCandidate?.content as { parts?: unknown } | undefined)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const texts = parts
    .map((part) => (typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : null))
    .filter((item): item is string => item !== null);

  if (texts.length === 0) {
    return null;
  }

  const rawText = texts.join('\n');

  try {
    return JSON.parse(rawText);
  } catch (error) {
    throw new GeminiApiError('Gemini returned an invalid JSON payload.', { payload: rawText });
  }
};

export const analyzeWithGemini = async (
  request: GeminiAnalysisRequest,
): Promise<GeminiAnalysisResponse> => {
  const apiKey = ensureApiKey();
  const filteredAnswers = request.answers.filter((answer) => answer.answerText.trim().length > 0);
  if (filteredAnswers.length === 0) {
    return {
      model: MODEL_NAME,
      overallScore: null,
      skillScores: [],
      strengths: [],
      developmentAreas: [],
      summary: '',
      raw: null,
    } satisfies GeminiAnalysisResponse;
  }

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildPrompt({
              ...request,
              answers: filteredAnswers,
            }),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 32,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  } satisfies Record<string, unknown>;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = await response.text();
    }
    throw new GeminiApiError('Gemini API request failed.', { status: response.status, payload });
  }

  const json = await response.json();
  const parsed = extractCandidateResponse(json);
  return parseGeminiPayload(parsed);
};

export const toAssessmentResult = (analysis: GeminiAnalysisResponse): AssessmentResult => ({
  score: analysis.overallScore ?? 0,
  strengths: analysis.strengths.slice(0, 3),
});

export { MODEL_NAME as GEMINI_MODEL_NAME };
