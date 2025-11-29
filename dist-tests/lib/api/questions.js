import { supabase } from '@/lib/supabaseClient';
import { mapSupabaseQuestion, MULTIPLE_CHOICE_FORMATS } from './questionMappers';
export const getQuestionsByRole = async (role) => {
    const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('id')
        .eq('target_role', role)
        .single();
    if (assessmentError || !assessmentData) {
        console.error(`Failed to load assessment for role ${role}:`, assessmentError);
        return [];
    }
    const { data, error } = await supabase
        .from('questions')
        .select(`
        id,
        text,
        type,
        format,
        required,
        assessment_id,
        created_at,
        options:question_options(id, option_text, is_correct)
      `)
        .eq('assessment_id', assessmentData.id);
    if (error) {
        console.error(`Failed to load questions for role ${role}:`, error);
        throw new Error('Khong the tai cau hoi.');
    }
    return (data ?? []).map((row) => mapSupabaseQuestion(row));
};
export const createQuestion = async (questionData, targetRole) => {
    const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .select('id')
        .eq('target_role', targetRole)
        .single();
    if (assessmentError || !assessment) {
        console.error('Assessment not found for role:', targetRole, assessmentError);
        throw new Error('Khong the tao cau hoi vi khong tim thay bai danh gia.');
    }
    const { data: inserted, error: questionError } = await supabase
        .from('questions')
        .insert([
        {
            text: questionData.text,
            type: questionData.type,
            format: questionData.format,
            required: questionData.required,
            assessment_id: assessment.id,
        },
    ])
        .select(`
        id,
        text,
        type,
        format,
        required,
        assessment_id,
        created_at,
        options:question_options(id, option_text, is_correct)
      `)
        .single();
    if (questionError || !inserted) {
        console.error('Failed to create question:', questionError);
        throw new Error('Khong the tao cau hoi.');
    }
    const question = mapSupabaseQuestion(inserted);
    if (MULTIPLE_CHOICE_FORMATS.has(questionData.format) && questionData.options?.length) {
        const { error: optionsError } = await supabase
            .from('question_options')
            .insert(questionData.options.map((option) => ({
            question_id: question.id,
            option_text: option.text,
            is_correct: option.isCorrect ?? false,
        })));
        if (optionsError) {
            console.error('Failed to create question options:', optionsError);
            throw new Error('Khong the tao lua chon cho cau hoi.');
        }
    }
    return question;
};
export const updateQuestion = async (questionData) => {
    if (!questionData.id) {
        throw new Error('Khong the cap nhat cau hoi khi thieu id.');
    }
    const { error: questionError } = await supabase
        .from('questions')
        .update({
        text: questionData.text,
        type: questionData.type,
        format: questionData.format,
        required: questionData.required,
    })
        .eq('id', questionData.id);
    if (questionError) {
        console.error('Failed to update question:', questionError);
        throw new Error('Khong the cap nhat cau hoi.');
    }
    const isMultipleChoice = questionData.format ? MULTIPLE_CHOICE_FORMATS.has(questionData.format) : false;
    const options = questionData.options ?? [];
    await supabase
        .from('question_options')
        .delete()
        .eq('question_id', questionData.id);
    if (isMultipleChoice && options.length > 0) {
        const { error: insertError } = await supabase
            .from('question_options')
            .insert(options.map((option) => ({
            question_id: questionData.id,
            option_text: option.text,
            is_correct: option.id === questionData.correctAnswer || option.isCorrect === true,
        })));
        if (insertError) {
            console.error('Failed to update question options:', insertError);
            throw new Error('Khong the cap nhat lua chon cau hoi.');
        }
    }
};
export const deleteQuestion = async (questionId) => {
    const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);
    if (error) {
        console.error('Failed to delete question:', error);
        throw new Error('Khong the xoa cau hoi.');
    }
};
