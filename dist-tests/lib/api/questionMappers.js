export const MULTIPLE_CHOICE_FORMATS = new Set(['multiple_choice', 'multiple-choice']);
export const normaliseQuestionFormat = (format) => {
    if (!format) {
        return 'text';
    }
    if (format === 'multiple-choice') {
        return 'multiple_choice';
    }
    return format;
};
export const mapSupabaseQuestion = (question) => {
    const format = normaliseQuestionFormat(question.format);
    const options = question.options?.map((option) => ({
        id: option.id,
        text: option.option_text,
        optionText: option.option_text,
        isCorrect: option.is_correct,
    }));
    const correctAnswer = question.options?.find((option) => option.is_correct)?.id;
    return {
        id: question.id,
        text: question.text,
        type: question.type ?? 'General',
        format,
        required: question.required ?? true,
        assessmentId: question.assessment_id,
        createdAt: question.created_at,
        options,
        correctAnswer,
    };
};
