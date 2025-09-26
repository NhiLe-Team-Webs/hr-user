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
  tabViolations?: number;
}

const getRandomId = (fallback: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return fallback;
};

const buildStrengths = (score: number, correctAnswers: number, totalQuestions: number) => {
  const strengths: string[] = [];
  const accuracy = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;

  if (score >= 85) {
    strengths.push('Tư duy phản biện sắc bén và khả năng xử lý tình huống xuất sắc.');
  } else if (score >= 70) {
    strengths.push('Nền tảng kiến thức vững và tốc độ phản hồi ổn định.');
  }

  if (accuracy >= 0.6) {
    strengths.push('Khả năng nắm bắt yêu cầu và lựa chọn phương án hợp lý.');
  }

  if (strengths.length === 0) {
    strengths.push('Có tinh thần cầu tiến và hoàn thành bài đánh giá đầy đủ.');
  }

  return strengths;
};

const buildWeaknesses = (score: number, tabViolations?: number) => {
  const weaknesses: string[] = [];

  if (score < 70) {
    weaknesses.push('Cần củng cố thêm kiến thức chuyên môn để đạt hiệu suất cao hơn.');
  }

  if (tabViolations && tabViolations > 0) {
    weaknesses.push('Nên tập trung hơn trong quá trình làm bài, tránh chuyển tab nhiều lần.');
  }

  if (weaknesses.length === 0) {
    weaknesses.push('Tiếp tục duy trì phong độ hiện tại và phát triển kỹ năng nâng cao.');
  }

  return weaknesses;
};

const buildRecommendedRoles = (role: Role, score: number) => {
  if (score >= 80) {
    return [role.name, `Senior ${role.name}`];
  }
  if (score >= 60) {
    return [role.name, `${role.name} Trainee`];
  }
  return [`${role.name} Intern`];
};

const formatSummary = (role: Role, score: number, metrics: AssessmentMetrics) => {
  return `Bạn đã hoàn thành bài đánh giá cho vai trò ${role.title} với điểm số ${score}. ` +
    `Bạn trả lời chính xác ${metrics.correctAnswers}/${metrics.totalQuestions} câu hỏi, ` +
    `hoàn thành ${metrics.answeredQuestions} câu hỏi trong tổng số ${metrics.totalQuestions}.`;
};

const maybeCallGemini = async (prompt: string): Promise<string | null> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

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

    return text?.length ? text : null;
  } catch (error) {
    console.warn('Gemini analysis failed:', error);
    return null;
  }
};

export const generateAssessmentResult = async (
  params: GenerateResultParams,
): Promise<AssessmentResult> => {
  const totalQuestions = params.questions.length;
  const answeredQuestions = Object.values(params.answers).filter((value) => {
    if (typeof value === 'number') {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return false;
  }).length;

  let correctAnswers = 0;

  params.questions.forEach((question, index) => {
    if (question.format !== 'multiple_choice' || !question.correctAnswer) {
      return;
    }

    const rawAnswer = params.answers[index];
    if (typeof rawAnswer === 'number' && question.options?.[rawAnswer]) {
      const selectedOption = question.options[rawAnswer];
      if (selectedOption.id === question.correctAnswer) {
        correctAnswers += 1;
      }
    }
  });

  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const metrics: AssessmentMetrics = {
    totalQuestions,
    answeredQuestions,
    correctAnswers,
    durationSeconds: params.durationSeconds,
    tabViolations: params.tabViolations,
  };

  const strengths = buildStrengths(score, correctAnswers, totalQuestions);
  const weaknesses = buildWeaknesses(score, params.tabViolations);
  const recommendedRoles = buildRecommendedRoles(params.role, score);
  const summary = formatSummary(params.role, score, metrics);

  const aiPrompt =
    `Bạn là chuyên gia tuyển dụng. Hãy phân tích bài đánh giá cho vai trò ${params.role.title}.` +
    ` Người làm bài đạt ${score} điểm với ${correctAnswers}/${totalQuestions} câu đúng.` +
    ' Hãy tóm tắt điểm mạnh, điểm cần cải thiện và lời khuyên phát triển trong tối đa 3 đoạn.';

  const aiSummary = await maybeCallGemini(aiPrompt);

  const completedAt = new Date().toISOString();

  return {
    id: getRandomId(params.attemptId ? `${params.attemptId}-result` : `local-${Date.now()}`),
    score,
    strengths,
    weaknesses,
    summary,
    recommendedRoles,
    completedAt,
    hrMessage:
      'Kết quả của bạn đã được gửi về cho HR xem xét, bạn sẽ nhận được thông báo qua email hoặc trực tiếp trên giao diện.',
    aiSummary,
    metrics,
    analysisModel: aiSummary ? 'gemini-pro' : 'rule-based',
    analysisVersion: '2024.05',
  };
};
