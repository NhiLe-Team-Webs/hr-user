import { supabase } from '@/lib/supabaseClient';
import { analyzeWithGemini, GEMINI_MODEL_NAME, toAssessmentResult, } from './gemini';
import { mapSupabaseQuestion, normaliseQuestionFormat, } from './questionMappers';
import { mapAssessmentAttempt } from './assessmentMappers';
export const getAssessment = async (role, roleId) => {
    // Build query with optional role_id filter
    let query = supabase
        .from('interview_assessments')
        .select(`
        id,
        title,
        description,
        duration,
        target_role,
        questions:interview_questions(
          id,
          text,
          format,
          required,
          options:interview_question_options(id, option_text, is_correct)
        )
      `);
    // Filter by target_role (for backward compatibility) or role_id if provided
    if (roleId) {
        query = query.eq('id', roleId);
    }
    else {
        query = query.eq('target_role', role);
    }
    const { data, error } = await query.single();
    if (error) {
        console.error(`Failed to load assessment for role ${role}:`, error);
        throw new Error('Khong the tai bai danh gia.');
    }
    if (!data) {
        return null;
    }
    const payload = data;
    return {
        ...payload,
        questions: payload.questions.map((question) => ({
            id: question.id,
            text: question.text,
            type: 'General',
            format: normaliseQuestionFormat(question.format),
            required: question.required ?? true,
            points: 0,
            options: question.options.map((option) => ({
                id: option.id,
                text: option.option_text,
                optionText: option.option_text,
                isCorrect: option.is_correct,
            })),
            correctAnswer: question.options.find((option) => option.is_correct)?.id,
        })),
    };
};
export const getQuestionsByIds = async (questionIds) => {
    if (questionIds.length === 0) {
        return [];
    }
    const { data, error } = await supabase
        .from('interview_questions')
        .select(`
        id,
        text,
        type,
        format,
        required,
        assessment_id,
        created_at,
        options:interview_question_options(id, option_text, is_correct)
      `)
        .in('id', questionIds);
    if (error) {
        console.error('Failed to load questions by ids:', error);
        throw new Error('Khong the tai danh sach cau hoi.');
    }
    return (data ?? []).map(mapSupabaseQuestion);
};
export const upsertAnswer = async (payload) => {
    const base = {
        result_id: payload.resultId ?? null,
        question_id: payload.questionId,
        user_answer_text: payload.userAnswerText ?? null,
        selected_option_id: payload.selectedOptionId ?? null,
    };
    if (payload.id) {
        const { data, error } = await supabase
            .from('interview_answers')
            .update(base)
            .eq('id', payload.id)
            .select()
            .single();
        if (error) {
            console.error('Failed to update answer:', error);
            throw new Error('Khong the luu cau tra loi.');
        }
        return data;
    }
    const { data, error } = await supabase
        .from('interview_answers')
        .insert(base)
        .select()
        .single();
    if (error) {
        console.error('Failed to insert answer:', error);
        throw new Error('Khong the luu cau tra loi.');
    }
    return data;
};
const fetchLatestAssessmentAttempt = async (authId, assessmentId) => {
    const { data, error } = await supabase
        .from('interview_assessment_attempts')
        .select('*, user:users!inner(auth_id)')
        .eq('user.auth_id', authId)
        .eq('assessment_id', assessmentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.error('Failed to fetch assessment attempt:', error);
        throw new Error('Khong the tai tien do bai danh gia.');
    }
    return data;
};
export const ensureUser = async (payload) => {
    console.log('[ensureUser] Creating/updating user:', { auth_id: payload.auth_id, email: payload.email, name: payload.full_name });
    const { data, error } = await supabase
        .from('users')
        .upsert({
        auth_id: payload.auth_id,
        email: payload.email,
        full_name: payload.full_name,
        role: 'candidate',
    }, { onConflict: 'email' })
        .select();
    if (error) {
        console.error('[ensureUser] Failed to ensure user:', error);
        throw new Error('Khong the khoi tao ho so nguoi dung.');
    }
    console.log('[ensureUser] User ensured successfully:', data);
};
/**
 * Starts a new assessment attempt for a candidate.
 *
 * Note: In this system, roles are defined by the interview_assessments table via the target_role field.
 * Each assessment has a unique target_role, creating a 1:1 relationship between assessments and roles.
 * Therefore, the assessmentId effectively serves as the role identifier.
 *
 * @param payload.userId - The Auth ID of the user
 * @param payload.assessmentId - The assessment ID, which uniquely identifies the role
 * @param payload.role - The role name (target_role) for display purposes
 * @param payload.roleId - Optional, for backward compatibility (not stored in database)
 * @param payload.totalQuestions - Total number of questions in the assessment
 * @returns The created or updated assessment attempt
 */
export const startAssessmentAttempt = async (payload) => {
    // Check if user already has a completed result
    // TEMPORARILY DISABLED FOR TESTING - REMOVE THIS COMMENT WHEN READY FOR PRODUCTION
    const ALLOW_RETAKE_FOR_TESTING = true; // Set to false in production
    if (!ALLOW_RETAKE_FOR_TESTING) {
        const { data: existingResult, error: resultError } = await supabase
            .from('interview_results')
            .select('id, hr_review_status, user:users!inner(auth_id)')
            .eq('user.auth_id', payload.userId)
            .limit(1)
            .maybeSingle();
        if (resultError) {
            console.error('Failed to check existing result:', resultError);
            throw new Error('Khong the kiem tra trang thai danh gia.');
        }
        if (existingResult) {
            throw new Error('Ban da hoan thanh danh gia. Khong the lam lai.');
        }
    }
    const nowIso = new Date().toISOString();
    const existing = await fetchLatestAssessmentAttempt(payload.userId, payload.assessmentId);
    if (existing && existing.status !== 'completed') {
        const updates = {
            total_questions: payload.totalQuestions,
            last_activity_at: nowIso,
        };
        if (!existing.started_at) {
            updates.started_at = nowIso;
        }
        if (existing.status === 'not_started') {
            updates.status = 'in_progress';
        }
        const { data, error } = await supabase
            .from('interview_assessment_attempts')
            .update(updates)
            .eq('id', existing.id)
            .select()
            .single();
        if (error) {
            console.error('Failed to update assessment attempt:', error);
            throw new Error('Khong the cap nhat tien trinh bai danh gia.');
        }
        return mapAssessmentAttempt(data);
    }
    // Get internal user ID from Auth ID
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', payload.userId)
        .single();
    if (userError || !userData) {
        console.error('Failed to find user for assessment:', userError);
        throw new Error('Khong tim thay thong tin nguoi dung.');
    }
    const { data, error } = await supabase
        .from('interview_assessment_attempts')
        .insert({
        user_id: userData.id,
        assessment_id: payload.assessmentId, // assessment_id serves as the role identifier
        role: payload.role, // Store the role name for display purposes
        total_questions: payload.totalQuestions,
        status: 'in_progress',
        started_at: nowIso,
        last_activity_at: nowIso,
        ai_status: 'idle',
        last_ai_error: null,
    })
        .select()
        .single();
    if (error) {
        console.error('Failed to create assessment attempt:', error);
        throw new Error('Khong the khoi tao bai danh gia.');
    }
    return mapAssessmentAttempt(data);
};
export const submitAssessmentAttempt = async (attemptId) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
        .from('interview_assessment_attempts')
        .update({
        status: 'awaiting_ai',
        submitted_at: nowIso,
        last_activity_at: nowIso,
        last_ai_error: null,
        ai_status: 'processing',
    })
        .eq('id', attemptId)
        .select()
        .single();
    if (error) {
        console.error('Failed to submit assessment attempt:', error);
        throw new Error('Khong the ghi nhan bai lam.');
    }
    return mapAssessmentAttempt(data);
};
const truncateErrorMessage = (value, maxLength = 500) => {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength - 1)}…`;
};
const logAiFailure = async (attemptId, message) => {
    const nowIso = new Date().toISOString();
    await supabase
        .from('interview_assessment_attempts')
        .update({
        last_ai_error: truncateErrorMessage(message),
        last_activity_at: nowIso,
        ai_status: 'failed',
    })
        .eq('id', attemptId);
};
export const finaliseAssessmentAttempt = async (payload) => {
    try {
        // Fetch available teams with both id and name
        const { data: teamsData } = await supabase
            .from('teams')
            .select('id, name')
            .is('deleted_at', null);
        const availableTeams = teamsData?.map(t => t.name) || [];
        const teamsMap = new Map(teamsData?.map(t => [t.name, t.id]) || []);
        const analysis = await analyzeWithGemini({
            role: payload.role,
            candidateName: payload.candidateName,
            language: payload.language,
            answers: payload.answers,
            availableTeams,
        });
        const completedAt = new Date().toISOString();
        // Map team names to team IDs
        let teamFitId = null;
        if (analysis.teamFit.length > 0) {
            const firstRecommendedTeam = analysis.teamFit[0];
            teamFitId = teamsMap.get(firstRecommendedTeam) || null;
        }
        const structuredSummary = {
            strengths: analysis.strengths,
            development_areas: analysis.developmentAreas,
            skill_scores: analysis.skillScores,
            summary: analysis.summary,
            team_fit: analysis.teamFit,
        };
        // Get internal user ID from Auth ID
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', payload.userId)
            .single();
        if (userError || !userData) {
            throw new Error('Khong tim thay thong tin nguoi dung.');
        }
        const resultPayload = {
            user_id: userData.id,
            assessment_id: payload.assessmentId,
            strengths: analysis.strengths,
            weaknesses: analysis.developmentAreas,
            development_suggestions: analysis.developmentAreas,
            recommended_roles: analysis.recommendedRoles,
            skill_scores: analysis.skillScores,
            summary: structuredSummary,
            ai_summary: analysis.summary,
            analysis_model: GEMINI_MODEL_NAME,
            analysis_completed_at: completedAt,
            insight_locale: payload.language,
            team_fit: teamFitId, // Store team UUID instead of team names
        };
        const { error: resultError } = await supabase.from('interview_results').insert(resultPayload);
        if (resultError) {
            console.error('Failed to persist assessment result:', resultError);
            throw new Error('Khong the luu ket qua danh gia.');
        }
        const { data: attemptData, error: attemptError } = await supabase
            .from('interview_assessment_attempts')
            .update({
            status: 'completed',
            completed_at: completedAt,
            last_activity_at: completedAt,
            last_ai_error: null,
            ai_status: 'completed',
            question_timings: payload.questionTimings ?? null,
            duration_seconds: payload.durationSeconds ?? null,
            average_seconds_per_question: payload.averageSecondsPerQuestion ?? null,
            cheating_count: payload.cheatingCount ?? 0,
            cheating_events: payload.cheatingEvents ?? null,
        })
            .eq('id', payload.attemptId)
            .select()
            .single();
        if (attemptError) {
            console.error('Failed to update attempt after AI analysis:', attemptError);
            throw new Error('Khong the cap nhat trang thai bai danh gia.');
        }
        return {
            attempt: mapAssessmentAttempt(attemptData),
            result: toAssessmentResult(analysis),
            aiSummary: analysis.summary,
        };
    }
    catch (error) {
        console.error('Failed to finalise assessment attempt with AI:', error);
        const message = error instanceof Error
            ? error.message
            : 'Khong the phan tich bai danh gia voi tri tue nhan tao.';
        await logAiFailure(payload.attemptId, message);
        throw error;
    }
};
const parseJsonCandidate = (value) => {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        if ((first === '[' && last === ']') || (first === '{' && last === '}')) {
            try {
                return JSON.parse(trimmed);
            }
            catch (error) {
                console.warn('[Gemini] Failed to parse JSON candidate from database field', {
                    error,
                    sample: trimmed.slice(0, 200),
                });
                return trimmed;
            }
        }
        return trimmed;
    }
    return value;
};
const getSummaryPayload = (row) => {
    const parsed = parseJsonCandidate(row.summary);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
    }
    return null;
};
const collectStringValues = (...candidates) => {
    const results = [];
    for (const candidate of candidates) {
        const parsed = parseJsonCandidate(candidate);
        if (Array.isArray(parsed)) {
            for (const entry of parsed) {
                if (typeof entry === 'string') {
                    const trimmed = entry.trim();
                    if (trimmed.length > 0) {
                        results.push(trimmed);
                    }
                }
            }
        }
        else if (typeof parsed === 'string') {
            const trimmed = parsed.trim();
            if (trimmed.length > 0) {
                results.push(trimmed);
            }
        }
    }
    const seen = new Set();
    const unique = [];
    for (const value of results) {
        const key = value.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(value);
        }
    }
    return unique;
};
const collectSkillScores = (...candidates) => {
    const scores = [];
    const seen = new Set();
    for (const candidate of candidates) {
        const parsed = parseJsonCandidate(candidate);
        if (!Array.isArray(parsed)) {
            continue;
        }
        for (const entry of parsed) {
            if (!entry || typeof entry !== 'object') {
                continue;
            }
            const nameRaw = entry.name;
            const scoreRaw = entry.score;
            if (typeof nameRaw !== 'string') {
                continue;
            }
            const name = nameRaw.trim();
            if (!name || seen.has(name.toLowerCase())) {
                continue;
            }
            let numericScore = null;
            if (typeof scoreRaw === 'number') {
                numericScore = scoreRaw;
            }
            else if (typeof scoreRaw === 'string') {
                const parsedScore = Number.parseFloat(scoreRaw);
                if (Number.isFinite(parsedScore)) {
                    numericScore = parsedScore;
                }
            }
            const safeScore = Number.isFinite(numericScore ?? NaN) ? numericScore ?? 0 : 0;
            const clampedScore = Math.max(0, Math.min(100, Math.round(safeScore * 100) / 100));
            scores.push({ name, score: clampedScore });
            seen.add(name.toLowerCase());
        }
    }
    return scores;
};
const normaliseHrApprovalStatus = (value) => {
    if (typeof value === 'string') {
        const normalised = value.trim().toLowerCase();
        if (!normalised) {
            return null;
        }
        if (['approved', 'accept', 'accepted', 'approved_by_hr', 'ready', 'green', 'go', 'tryout'].includes(normalised)) {
            return 'approved';
        }
        if (['rejected', 'declined', 'failed', 'no', 'not_approved'].includes(normalised)) {
            return 'rejected';
        }
        if (['pending', 'reviewing', 'in_review', 'waiting', 'processing'].includes(normalised)) {
            return 'pending';
        }
        return 'pending';
    }
    if (typeof value === 'boolean') {
        return value ? 'approved' : 'pending';
    }
    return null;
};
const extractHrApprovalStatusFromRow = (row) => {
    const reviewStatus = normaliseHrApprovalStatus(row.hr_review_status);
    if (reviewStatus) {
        return reviewStatus;
    }
    const userRecord = Array.isArray(row.user) ? row.user[0] : null;
    const bandStatus = normaliseHrApprovalStatus(userRecord?.band ?? null);
    return bandStatus ?? 'pending';
};
const extractStrengthsFromResult = (row, summary) => collectStringValues(row.strengths, summary?.strengths);
const extractDevelopmentAreasFromResult = (row, summary) => collectStringValues(row.weaknesses, summary?.development_areas);
const extractDevelopmentSuggestionsFromResult = (row, summary) => collectStringValues(row.development_suggestions, summary?.development_suggestions, summary?.development_areas);
const extractRecommendedRolesFromResult = (row, summary) => collectStringValues(row.recommended_roles, summary?.recommended_roles);
const extractSkillScoresFromResult = (row, summary) => collectSkillScores(row.skill_scores, summary?.skill_scores);
const extractSummaryText = (row, summary) => {
    const summaryField = parseJsonCandidate(summary?.summary);
    if (typeof summaryField === 'string' && summaryField.trim().length > 0) {
        return summaryField.trim();
    }
    if (typeof row.ai_summary === 'string' && row.ai_summary.trim().length > 0) {
        return row.ai_summary.trim();
    }
    const rawSummary = row.summary;
    if (typeof rawSummary === 'string' && rawSummary.trim().length > 0) {
        return rawSummary.trim();
    }
    return null;
};
export const getLatestResult = async (userId, // Auth ID
assessmentId) => {
    if (!userId) {
        throw new Error('Khong the tai ket qua danh gia.');
    }
    let query = supabase
        .from('interview_results')
        .select(`
        id,
        user_id,
        assessment_id,
        strengths,
        weaknesses,
        development_suggestions,
        skill_scores,
        recommended_roles,
        summary,
        ai_summary,
        analysis_model,
        analysis_completed_at,
        insight_locale,
        team_fit,
        user:users!inner(band, auth_id),
        created_at
      `)
        .eq('user.auth_id', userId);
    if (assessmentId) {
        query = query.eq('assessment_id', assessmentId);
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) {
        console.error('Failed to fetch latest assessment result:', error);
        throw new Error('Khong the tai ket qua danh gia.');
    }
    if (!data) {
        return null;
    }
    const row = data;
    const summaryPayload = getSummaryPayload(row);
    // Handle team_fit as UUID and fetch team name
    let teamFit = [];
    if (row.team_fit) {
        if (typeof row.team_fit === 'string') {
            // team_fit is a UUID, fetch team name
            const { data: teamData } = await supabase
                .from('teams')
                .select('name')
                .eq('id', row.team_fit)
                .is('deleted_at', null)
                .maybeSingle();
            if (teamData?.name) {
                teamFit = [teamData.name];
            }
        }
        else {
            // Fallback to old format (JSONB array of team names)
            teamFit = collectStringValues(row.team_fit, summaryPayload?.team_fit);
        }
    }
    return {
        id: row.id,
        assessmentId: row.assessment_id,
        userId: row.user_id,
        strengths: extractStrengthsFromResult(row, summaryPayload),
        summary: extractSummaryText(row, summaryPayload),
        developmentAreas: extractDevelopmentAreasFromResult(row, summaryPayload),
        developmentSuggestions: extractDevelopmentSuggestionsFromResult(row, summaryPayload),
        skillScores: extractSkillScoresFromResult(row, summaryPayload),
        recommendedRoles: extractRecommendedRolesFromResult(row, summaryPayload),
        hrApprovalStatus: extractHrApprovalStatusFromRow(row),
        analysisModel: typeof row.analysis_model === 'string' ? row.analysis_model : null,
        completedAt: typeof row.analysis_completed_at === 'string' ? row.analysis_completed_at : null,
        insightLocale: typeof row.insight_locale === 'string' ? row.insight_locale : null,
        createdAt: row.created_at,
        teamFit,
    };
};
