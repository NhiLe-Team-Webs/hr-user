import { getAnswersByAttempt, completeAssessmentAttempt } from '@/lib/api/assessments';
import { upsertAssessmentResult } from '@/lib/api/results';
import type { Question } from '@/types/assessment';
import type { AssessmentResult } from '@/types/assessment';

interface AnalyzeWithGeminiParams {
  attemptId: string;
  assessmentId: string;
  role: string;
  questions: Question[];
  cheatingCount: number;
  profileId: string;
}

interface GeminiAnalysisResponse {
  overall_score?: number;
  skill_scores?: Record<string, number> | Array<{ skill: string; score: number }>;
  strengths?: string[];
  weaknesses?: string[];
  summary?: string;
}

const GEMINI_MODEL = 'gemini-1.5-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const extractJson = (text: string): unknown => {
  const codeBlockMatch = text.match(/```json([\s\S]*?)```/i);
  const raw = codeBlockMatch ? codeBlockMatch[1] : text;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse Gemini response as JSON. Returning raw text.');
    return null;
  }
};

const normaliseSkillScores = (
  skillScores: GeminiAnalysisResponse['skill_scores'],
): Record<string, number> | null => {
  if (!skillScores) {
    return null;
  }
  if (Array.isArray(skillScores)) {
    return skillScores.reduce<Record<string, number>>((acc, item) => {
      if (item && typeof item === 'object' && 'skill' in item && 'score' in item) {
        acc[String(item.skill)] = Number(item.score);
      }
      return acc;
    }, {});
  }
  return Object.entries(skillScores).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = Number(value);
    return acc;
  }, {});
};

const toArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === 'string') {
    return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

export const analyzeWithGemini = async ({
  attemptId,
  assessmentId,
  role,
  questions,
  cheatingCount,
  profileId,
}: AnalyzeWithGeminiParams): Promise<AssessmentResult> => {
  const answers = await getAnswersByAttempt(attemptId);
  const questionLookup = new Map(questions.map((question) => [question.id, question]));

  const formattedAnswers = answers.map((answer) => {
    const question = questionLookup.get(answer.question_id);
    const selectedOption = question?.options?.find((option) => option.id === answer.selected_option_id);
    const resolvedAnswer = answer.user_answer_text ?? selectedOption?.text ?? '';

    return {
      question_id: answer.question_id,
      question_text: question?.text ?? '',
      format: question?.format ?? 'text',
      answer: resolvedAnswer,
      selected_option_id: answer.selected_option_id,
    };
  });

  const completedCount = formattedAnswers.length;

  const baseSummary: GeminiAnalysisResponse = {
    overall_score: completedCount > 0 ? Math.min(100, completedCount * 10) : 0,
    strengths: [],
    weaknesses: [],
    summary: 'Hệ thống AI tạm thời không khả dụng để phân tích chi tiết.',
  };

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('Gemini API key is not configured. Falling back to heuristic scoring.');
  }

  let analysis: GeminiAnalysisResponse = baseSummary;

  if (apiKey && formattedAnswers.length > 0) {
    const payload = {
      role,
      cheating_count: cheatingCount,
      completed_count: completedCount,
      responses: formattedAnswers,
    };

    const prompt = [
      'Bạn là trợ lý AI chuyên gia nhân sự.',
      'Hãy phân tích câu trả lời của ứng viên cho vai trò nêu trên.',
      'Trả về JSON hợp lệ với các khóa: overall_score (0-100), skill_scores (map kỹ năng -> điểm 0-100),',
      'strengths (mảng string), weaknesses (mảng string), summary (chuỗi mô tả).',
      'Nếu phát hiện dấu hiệu gian lận (dựa trên cheating_count) hãy phản ánh vào điểm số và phân tích.',
      'Dữ liệu đầu vào:',
      JSON.stringify(payload, null, 2),
      'Chỉ trả lời bằng JSON, không thêm chú thích.',
    ].join('\n');

    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API responded with status ${response.status}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }>; }; }>;
      };

      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = textResponse ? extractJson(textResponse) : null;

      if (parsed && typeof parsed === 'object') {
        analysis = parsed as GeminiAnalysisResponse;
      } else {
        console.warn('Gemini did not return a parsable JSON payload. Using fallback analysis.');
      }
    } catch (error) {
      console.error('Gemini analysis failed:', error);
    }
  }

  const overallScore =
    typeof analysis.overall_score === 'number' && Number.isFinite(analysis.overall_score)
      ? Math.min(100, Math.max(0, analysis.overall_score))
      : baseSummary.overall_score ?? 0;

  const penalty = cheatingCount > 0 ? Math.min(cheatingCount * 10, 40) : 0;
  const adjustedScore = Math.max(0, Math.round(overallScore - penalty));

  const normalizedSkillScores = normaliseSkillScores(analysis.skill_scores);

  const aiSummary = {
    ...analysis,
    skill_scores: normalizedSkillScores ?? analysis.skill_scores ?? null,
    completed_count: completedCount,
    cheating_count: cheatingCount,
    adjusted_score: adjustedScore,
  } as Record<string, unknown>;

  if (!profileId) {
    throw new Error('Assessment attempt is missing profile information.');
  }

  const result = await upsertAssessmentResult({
    userId: profileId,
    assessmentId,
    overallScore,
    adjustedScore,
    strengths: toArray(analysis.strengths),
    weaknesses: toArray(analysis.weaknesses),
    summary: analysis.summary ?? baseSummary.summary ?? '',
    aiSummary,
    skillScores: normalizedSkillScores ?? undefined,
  });

  await completeAssessmentAttempt(attemptId, completedCount, aiSummary);

  return {
    ...result,
    overallScore,
    adjustedScore,
    completedCount,
    cheatingCount,
    skillScores: normalizedSkillScores ?? result.skillScores,
    rawSummary: aiSummary,
  } satisfies AssessmentResult;
};
