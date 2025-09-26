import type {
  AssessmentMetrics,
  AssessmentResult,
  Question,
  Role,
  UserAnswers,
} from '@/types/assessment';

interface GenerateResultParams {
  attemptId?: string;
  role: Role;
  questions: Question[];
  answers: UserAnswers;
  durationSeconds?: number;
  cheatingCount?: number;
}

interface GeminiEvaluationResponse {
  overall_score: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

interface GeminiPromptPayload {
  role: Role;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  baseScore: number;
  cheatingCount: number;
  durationSeconds?: number;
  questions: Array<{
    id: string;
    text: string;
    format: string;
    correctOptionId?: string | null;
    selectedOptionId?: string | null;
    selectedOptionText?: string | null;
    userAnswerText?: string | null;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  }>;
}

const HR_MESSAGE =
  'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.';

const ANALYSIS_VERSION = '2024.06';

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
};

const getRandomId = (fallback: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallback;
};

const buildRecommendedRoles = (role: Role, score: number) => {
  if (score >= 85) {
    return [role.name, `Senior ${role.name}`];
  }
  if (score >= 65) {
    return [role.name, `${role.name} Trainee`];
  }
  return [`${role.name} Intern`];
};

const buildFallbackStrengths = (score: number, correctAnswers: number, totalQuestions: number) => {
  const strengths: string[] = [];
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;

  if (score >= 85) {
    strengths.push('Tư duy phản biện tốt và tốc độ xử lý tình huống xuất sắc.');
  } else if (score >= 70) {
    strengths.push('Nền tảng kiến thức vững chắc và khả năng phản hồi ổn định.');
  }

  if (accuracy >= 0.6) {
    strengths.push('Khả năng lựa chọn phương án phù hợp cho phần lớn câu hỏi.');
  }

  if (strengths.length === 0) {
    strengths.push('Hoàn thành bài đánh giá và thể hiện tinh thần cầu tiến.');
  }

  return strengths;
};

const buildFallbackWeaknesses = (score: number, cheatingCount: number) => {
  const weaknesses: string[] = [];

  if (score < 70) {
    weaknesses.push('Cần củng cố thêm kiến thức chuyên môn để nâng cao hiệu suất.');
  }

  if (cheatingCount > 0) {
    weaknesses.push('Cần tập trung hơn khi làm bài và hạn chế chuyển tab để đảm bảo tính trung thực.');
  }

  if (weaknesses.length === 0) {
    weaknesses.push('Tiếp tục phát huy và rèn luyện thêm kỹ năng nâng cao.');
  }

  return weaknesses;
};

const buildFallbackSummary = (role: Role, score: number, metrics: AssessmentMetrics, cheatingCount: number) => {
  const baseSummary =
    `Bạn đã hoàn thành bài đánh giá cho vai trò ${role.title} với điểm số ${score}. ` +
    `Bạn trả lời chính xác ${metrics.correctAnswers}/${metrics.totalQuestions} câu hỏi và hoàn thành ${metrics.answeredQuestions}/${metrics.totalQuestions} câu hỏi.`;

  if (cheatingCount > 0) {
    return (
      baseSummary +
      ` Hệ thống ghi nhận ${cheatingCount} lần chuyển tab, vì vậy hãy chú ý tập trung hơn để tránh bị trừ điểm trong các lần đánh giá tiếp theo.`
    );
  }

  return baseSummary;
};

const parseGeminiJson = (text: string | null | undefined): GeminiEvaluationResponse | null => {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return null;
  }

  const maybeJson = trimmed.slice(jsonStart, jsonEnd + 1);

  try {
    const parsed = JSON.parse(maybeJson) as GeminiEvaluationResponse;
    if (
      typeof parsed.overall_score === 'number' &&
      Array.isArray(parsed.strengths) &&
      Array.isArray(parsed.weaknesses) &&
      typeof parsed.summary === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn('Failed to parse Gemini JSON payload:', error);
    return null;
  }
};

const callGemini = async (payload: GeminiPromptPayload): Promise<GeminiEvaluationResponse | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const prompt =
    'Bạn là chuyên gia tuyển dụng của phòng nhân sự. Phân tích dữ liệu JSON của một bài đánh giá tuyển dụng theo yêu cầu sau: ' +
    'Trả về JSON với cấu trúc {"overall_score": number 0-100, "strengths": string[], "weaknesses": string[], "summary": string}. ' +
    'Hãy đánh giá điểm tổng quan dựa trên điểm nền (baseScore), số câu trả lời đúng/sai và giảm điểm nếu chỉ số cheatingCount lớn. ' +
    'Phần summary tối đa 3 câu và viết tiếng Việt trang trọng. Dưới đây là dữ liệu:\n' +
    `${JSON.stringify(payload, null, 2)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      console.warn('Gemini returned non-OK response when generating insights.');
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text?.trim())
      .filter(Boolean)
      .join('\n');

    return parseGeminiJson(text);
  } catch (error) {
    console.warn('Gemini analysis failed:', error);
    return null;
  }
};

export const generateAssessmentResult = async (
  params: GenerateResultParams,
): Promise<AssessmentResult> => {
  const questionDetails = params.questions.map((question, index) => {
    const rawAnswer = params.answers[index];
    let selectedOptionId: string | null = null;
    let selectedOptionText: string | null = null;
    let userAnswerText: string | null = null;

    if (question.format === 'multiple_choice' && typeof rawAnswer === 'number') {
      const selectedOption = question.options?.[rawAnswer];
      if (selectedOption) {
        selectedOptionId = selectedOption.id;
        selectedOptionText = selectedOption.text;
      }
    } else if (typeof rawAnswer === 'string' && rawAnswer.trim().length > 0) {
      userAnswerText = rawAnswer.trim();
    }

    return {
      id: question.id,
      text: question.text,
      format: question.format,
      correctOptionId: question.correctAnswer ?? null,
      selectedOptionId,
      selectedOptionText,
      userAnswerText,
      options: question.options?.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.id === question.correctAnswer,
      })),
    };
  });

  const totalQuestions = questionDetails.length;
  const answeredQuestions = questionDetails.filter((detail) => detail.selectedOptionId || detail.userAnswerText).length;
  const correctAnswers = questionDetails.filter(
    (detail) => detail.correctOptionId && detail.correctOptionId === detail.selectedOptionId,
  ).length;

  const baseScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  const cheatingCount = params.cheatingCount ?? 0;

  const metrics: AssessmentMetrics = {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    durationSeconds: params.durationSeconds,
    cheatingCount,
  };

  const evaluationPayload: GeminiPromptPayload = {
    role: params.role,
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    baseScore: Math.round(baseScore),
    cheatingCount,
    durationSeconds: params.durationSeconds,
    questions: questionDetails,
  };

  const geminiEvaluation = await callGemini(evaluationPayload);

  const fallbackPenalty = Math.min(cheatingCount * 7, 35);
  const fallbackScore = clampScore(Math.round(baseScore) - fallbackPenalty);

  const strengths = geminiEvaluation?.strengths?.length
    ? geminiEvaluation.strengths
    : buildFallbackStrengths(fallbackScore, correctAnswers, totalQuestions);

  const weaknesses = geminiEvaluation?.weaknesses?.length
    ? geminiEvaluation.weaknesses
    : buildFallbackWeaknesses(fallbackScore, cheatingCount);

  const summary = geminiEvaluation?.summary?.trim()?.length
    ? geminiEvaluation.summary.trim()
    : buildFallbackSummary(params.role, fallbackScore, metrics, cheatingCount);

  const score = clampScore(geminiEvaluation?.overall_score ?? fallbackScore);
  const recommendedRoles = buildRecommendedRoles(params.role, score);
  const completedAt = new Date().toISOString();

  return {
    id: getRandomId(params.attemptId ? `${params.attemptId}-result` : `local-${Date.now()}`),
    score,
    strengths,
    weaknesses,
    summary,
    recommendedRoles,
    completedAt,
    hrMessage: HR_MESSAGE,
    aiSummary: summary,
    metrics,
    analysisModel: geminiEvaluation ? 'gemini-pro' : 'rule-based',
    analysisVersion: ANALYSIS_VERSION,
  };
};
