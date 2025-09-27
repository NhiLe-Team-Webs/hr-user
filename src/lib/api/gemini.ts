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
  const importMetaEnv = (import.meta as ImportMeta & {
    env?: { VITE_GEMINI_API_KEY?: string };
  }).env;

  const processEnv =
    typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : undefined;

  const apiKey = importMetaEnv?.VITE_GEMINI_API_KEY ?? processEnv?.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiApiError('Gemini API key is not configured.');
  }
  return apiKey;
};

const resolveNumericEnvValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const resolveMaxPromptCharLength = (): number => {
  const fromImport = resolveNumericEnvValue(
    (import.meta as ImportMeta & { env?: { VITE_GEMINI_MAX_PROMPT_CHARS?: unknown } }).env
      ?.VITE_GEMINI_MAX_PROMPT_CHARS,
  );
  if (typeof fromImport === 'number' && fromImport > 0) {
    return fromImport;
  }

  const fromProcess = resolveNumericEnvValue(
    typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>)?.VITE_GEMINI_MAX_PROMPT_CHARS
      : undefined,
  );
  if (typeof fromProcess === 'number' && fromProcess > 0) {
    return fromProcess;
  }

  return 12_000;
};

const MAX_PROMPT_CHAR_LENGTH = resolveMaxPromptCharLength();
const MIN_TRUNCATED_ANSWER_CHARS = 400;
const TRUNCATION_STEP_CHARS = 200;

const buildPrompt = (
  request: Pick<GeminiAnalysisRequest, 'candidateName' | 'role' | 'language'>,
  answers: GeminiAnswerPayload[],
): string => {
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
    answers: answers.map((answer, index) => {
      const serialised: { order: number; answer_text: string; question_id?: string } = {
        order: index + 1,
        answer_text: answer.answerText,
      };

      if (answer.questionId) {
        serialised.question_id = answer.questionId;
      }

      return serialised;
    }),
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

const truncateAnswers = (
  answers: GeminiAnswerPayload[],
  maxLength: number,
): GeminiAnswerPayload[] => {
  const ellipsis = '…';
  const maxContentLength = Math.max(0, maxLength - ellipsis.length);

  return answers.map((answer) => {
    const trimmed = answer.answerText.trim();
    if (trimmed.length <= maxLength) {
      return { ...answer, answerText: trimmed } satisfies GeminiAnswerPayload;
    }

    const truncated = trimmed.slice(0, maxContentLength).trimEnd();
    return {
      ...answer,
      answerText: `${truncated}${ellipsis}`,
    } satisfies GeminiAnswerPayload;
  });
};

const preparePrompt = (
  request: GeminiAnalysisRequest,
  answers: GeminiAnswerPayload[],
): {
  prompt: string;
  promptLength: number;
  basePromptLength: number;
  truncated: boolean;
} => {
  const sanitisedAnswers = answers.map((answer) => ({
    ...answer,
    answerText: answer.answerText.trim(),
  }));

  const buildWith = (candidateAnswers: GeminiAnswerPayload[]) =>
    buildPrompt(request, candidateAnswers);

  let prompt = buildWith(sanitisedAnswers);
  let promptLength = prompt.length;
  const basePromptLength = promptLength;

  if (promptLength <= MAX_PROMPT_CHAR_LENGTH) {
    return {
      prompt,
      promptLength,
      basePromptLength,
      truncated: false,
    };
  }

  let limitPerAnswer = Math.max(
    MIN_TRUNCATED_ANSWER_CHARS,
    Math.floor(MAX_PROMPT_CHAR_LENGTH / Math.max(1, sanitisedAnswers.length)),
  );

  let truncatedAnswers = truncateAnswers(sanitisedAnswers, limitPerAnswer);
  prompt = buildWith(truncatedAnswers);
  promptLength = prompt.length;

  while (promptLength > MAX_PROMPT_CHAR_LENGTH && limitPerAnswer > 0) {
    limitPerAnswer = Math.max(0, limitPerAnswer - TRUNCATION_STEP_CHARS);
    truncatedAnswers = truncateAnswers(sanitisedAnswers, limitPerAnswer);
    prompt = buildWith(truncatedAnswers);
    promptLength = prompt.length;
  }

  return {
    prompt,
    promptLength,
    basePromptLength,
    truncated: true,
  };
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

const tryParseJson = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw === 'object') {
    return raw;
  }

  if (typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  const candidates: string[] = [trimmed];

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Try the next candidate variant.
    }
  }

  throw new GeminiApiError('Gemini returned an invalid JSON payload.', { payload: raw });
};

const extractCandidateResponse = (response: unknown): unknown => {
  if (!response || typeof response !== 'object') {
    throw new GeminiApiError('Gemini response does not include a JSON object.', {
      payload: response,
    });
  }

  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    const promptFeedback = (response as { promptFeedback?: unknown }).promptFeedback;
    let detail = '';

    if (promptFeedback && typeof promptFeedback === 'object') {
      const blockReason = (promptFeedback as { blockReason?: unknown }).blockReason;
      const blockReasonText = typeof blockReason === 'string' ? blockReason : null;

      const feedbackSegments: string[] = [];
      if (blockReasonText) {
        feedbackSegments.push(`block reason: ${blockReasonText}`);
      }

      try {
        const serialised = JSON.stringify(promptFeedback);
        if (serialised && serialised !== '{}' && serialised !== 'null') {
          feedbackSegments.push(`prompt feedback: ${serialised}`);
        }
      } catch (error) {
        feedbackSegments.push('prompt feedback unavailable');
      }

      if (feedbackSegments.length > 0) {
        detail = ` (${feedbackSegments.join('; ')})`;
      }
    }

    throw new GeminiApiError(`Gemini response did not include any candidates${detail}.`, {
      payload: response,
    });
  }

  const [firstCandidate] = candidates as Array<{
    content?: unknown;
    finishReason?: unknown;
    safetyRatings?: unknown;
  }>;

  const promptFeedback = (response as { promptFeedback?: unknown }).promptFeedback;
  const finishReason =
    typeof firstCandidate?.finishReason === 'string'
      ? (firstCandidate.finishReason as string)
      : null;
  const safetyRatings = firstCandidate?.safetyRatings;

  const parts = (firstCandidate?.content as { parts?: unknown } | undefined)?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    const detailSegments: string[] = [];

    if (finishReason) {
      detailSegments.push(`finish reason: ${finishReason}`);
    }

    if (
      promptFeedback &&
      typeof promptFeedback === 'object' &&
      (promptFeedback as { blockReason?: unknown }).blockReason
    ) {
      const blockReason = (promptFeedback as { blockReason?: unknown }).blockReason;
      if (typeof blockReason === 'string') {
        detailSegments.push(`block reason: ${blockReason}`);
      }
    }

    const detail = detailSegments.length > 0 ? ` (${detailSegments.join('; ')})` : '';

    throw new GeminiApiError(
      `Gemini response did not include any content parts${detail}.`,
      {
        payload: {
          promptFeedback,
          finishReason,
          safetyRatings,
        },
      },
    );
  }

  let lastError: unknown = null;

  for (const part of parts) {
    const text = (part as { text?: unknown }).text;
    if (typeof text === 'string') {
      try {
        const parsed = tryParseJson(text);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        lastError = error;
      }
    }

    const functionCall = (part as { functionCall?: unknown }).functionCall;
    if (functionCall && typeof functionCall === 'object') {
      try {
        const args = (functionCall as { args?: unknown }).args;
        const parsed = tryParseJson(args);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError instanceof GeminiApiError) {
    throw lastError;
  }

  throw new GeminiApiError('Gemini response does not include a JSON object.', { payload: response });
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

  const { prompt, promptLength, basePromptLength, truncated } = preparePrompt(
    request,
    filteredAnswers,
  );

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
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

  const importMetaEnv = (import.meta as ImportMeta & {
    env?: Record<string, unknown>;
  }).env;
  const isDev = Boolean(importMetaEnv?.DEV);
  const debugLogsEnabled =
    isDev ||
    `${(importMetaEnv?.VITE_GEMINI_DEBUG_LOGS ?? (typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>)?.VITE_GEMINI_DEBUG_LOGS
      : undefined)) ?? ''}`
      .toString()
      .toLowerCase() === 'true';

  if (truncated) {
    console.warn('[Gemini] Prompt truncated to respect length limit', {
      answerCount: filteredAnswers.length,
      language: request.language,
      role: request.role,
      promptLength,
      basePromptLength,
      maxPromptLength: MAX_PROMPT_CHAR_LENGTH,
    });
  }

  if (debugLogsEnabled) {
    console.info('[Gemini] Submitting analysis request', {
      answerCount: filteredAnswers.length,
      language: request.language,
      role: request.role,
      promptLength,
      basePromptLength,
      maxPromptLength: MAX_PROMPT_CHAR_LENGTH,
      truncated,
    });
    console.debug('[Gemini] Prompt text', prompt);
  } else if (!truncated && isDev) {
    console.info('[Gemini] Submitting analysis request', {
      answerCount: filteredAnswers.length,
      language: request.language,
      role: request.role,
      promptLength,
      maxPromptLength: MAX_PROMPT_CHAR_LENGTH,
    });
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[Gemini] Network error while calling API', error);
    throw new GeminiApiError('Gemini API network error.', { payload: error });
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (parseJsonError) {
      try {
        payload = await response.text();
      } catch (parseTextError) {
        payload = null;
      }
    }

    const errorDetails = {
      status: response.status,
      statusText: response.statusText,
      payload,
      headers: {
        'x-request-id': response.headers.get('x-request-id'),
        'retry-after': response.headers.get('retry-after'),
        'x-ratelimit-limit': response.headers.get('x-ratelimit-limit'),
        'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
      },
    } as const;

    console.error('[Gemini] API request failed', errorDetails);

    if (response.status === 429) {
      throw new GeminiApiError(
        'Gemini API rate limit exceeded. Please wait a moment and try again.',
        { status: response.status, payload },
      );
    }

    throw new GeminiApiError('Gemini API request failed.', { status: response.status, payload });
  }

  const json = await response.json();

  if (debugLogsEnabled) {
    console.debug('[Gemini] API response', json);
  }

  const parsed = extractCandidateResponse(json);
  const result = parseGeminiPayload(parsed);

  if (debugLogsEnabled) {
    console.debug('[Gemini] Parsed analysis payload', result);
  }

  return result;

};

export const toAssessmentResult = (analysis: GeminiAnalysisResponse): AssessmentResult => ({
  score: analysis.overallScore ?? 0,
  strengths: analysis.strengths.slice(0, 3),
});

export { MODEL_NAME as GEMINI_MODEL_NAME };
