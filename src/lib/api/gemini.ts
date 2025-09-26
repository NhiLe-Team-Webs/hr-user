interface GeminiAnswerPayload {
  questionId: string;
  questionText: string;
  format: string;
  answer: string;
}

interface GeminiAnalysisInput {
  answers: GeminiAnswerPayload[];
  cheatingCount: number;
  completedCount: number;
  role?: string | null;
  assessmentTitle?: string | null;
}

export interface GeminiAnalysisResult {
  overallScore: number | null;
  strengths: string[];
  weaknesses: string[];
  summary: string | null;
  skillScores?: Record<string, number>;
  aiSummary?: string | null;
}

const MODEL_NAME = 'gemini-2.5-flash';

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter((item) => item.trim().length > 0);
      }
    } catch (error) {
      return [trimmed];
    }
  }

  return [];
};

const toSkillScores = (value: unknown): Record<string, number> | undefined => {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, score]) => [key, Number(score)]).filter(([, score]) => !Number.isNaN(score)),
    );
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([key, score]) => [key, Number(score)]).filter(([, score]) => !Number.isNaN(score)),
        );
      }
    } catch (error) {
      console.warn('Failed to parse Gemini skill scores JSON:', error);
    }
  }

  return undefined;
};

export const analyzeWithGemini = async (
  input: GeminiAnalysisInput,
): Promise<GeminiAnalysisResult> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const prompt = [
    'You are an HR assessment assistant. Analyse the candidate responses and summarise insights for the recruiter.',
    `Role: ${input.role ?? 'Unknown'}`,
    `Assessment: ${input.assessmentTitle ?? 'N/A'}`,
    `Total answered questions: ${input.completedCount}.`,
    `Detected cheating incidents (tab switch): ${input.cheatingCount}.`,
    'Each answer is provided below. Focus on professional tone and respond in Vietnamese.',
    'Return ONLY a valid JSON object with the following structure:',
    '{"overall_score": number (0-100), "skill_scores": {"skill": number}, "strengths": [string], "weaknesses": [string], "summary": string}',
    'Do not include any additional commentary outside of the JSON response.',
    'Candidate responses:',
    ...input.answers.map(
      (item, index) =>
        `${index + 1}. [${item.format}] ${item.questionText}\nCandidate answer: ${item.answer || 'Chưa có câu trả lời.'}`,
    ),
  ].join('\n\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Gemini API error:', errorBody);
    throw new Error('Khong the phan tich ket qua voi Gemini.');
  }

  const json = await response.json();
  const candidateText: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidateText) {
    throw new Error('Khong the doc phan hoi tu Gemini.');
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(candidateText);
  } catch (error) {
    console.error('Failed to parse Gemini response:', error, candidateText);
    throw new Error('Gemini tra ve du lieu khong hop le.');
  }

  return {
    overallScore: toNumberOrNull(parsed.overall_score),
    strengths: toStringArray(parsed.strengths),
    weaknesses: toStringArray(parsed.weaknesses),
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    skillScores: toSkillScores(parsed.skill_scores),
    aiSummary: typeof parsed.ai_summary === 'string' ? parsed.ai_summary : undefined,
  } satisfies GeminiAnalysisResult;
};
