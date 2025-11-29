import { mapAssessmentAttempt } from './assessmentMappers.js';
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
const parseMaybeJsonObject = (value) => {
    if (!value) {
        return null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        try {
            const parsed = JSON.parse(trimmed);
            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? parsed
                : null;
        }
        catch {
            return null;
        }
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value;
    }
    return null;
};
const getSummaryField = (summaryPayload, key) => (summaryPayload ? summaryPayload[key] : null);
const normaliseScoreValue = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.round(Math.max(0, Math.min(100, value)) * 100) / 100;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
            return Math.round(Math.max(0, Math.min(100, parsed)) * 100) / 100;
        }
    }
    return null;
};
const normaliseStringArray = (value) => {
    if (Array.isArray(value)) {
        return value
            .filter((entry) => typeof entry === 'string')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            return normaliseStringArray(parsed);
        }
        catch {
            return [trimmed];
        }
    }
    return [];
};
const mergeUniqueStrings = (...groups) => {
    const seen = new Set();
    const result = [];
    groups.forEach((group) => {
        group.forEach((entry) => {
            if (!seen.has(entry)) {
                seen.add(entry);
                result.push(entry);
            }
        });
    });
    return result;
};
const normaliseSkillScores = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }
        try {
            const parsed = JSON.parse(trimmed);
            return normaliseSkillScores(parsed);
        }
        catch {
            return [];
        }
    }
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((entry) => {
        if (typeof entry !== 'object' || entry === null) {
            return null;
        }
        const record = entry;
        if (typeof record.name !== 'string') {
            return null;
        }
        const score = normaliseScoreValue(record.score ?? null);
        if (score === null) {
            return null;
        }
        const name = record.name.trim();
        if (!name) {
            return null;
        }
        return { name, score };
    })
        .filter((entry) => entry !== null);
};
const resolveSummaryText = (row, summaryPayload) => {
    const fromSummary = getSummaryField(summaryPayload, 'summary');
    if (typeof fromSummary === 'string') {
        const trimmed = fromSummary.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    if (typeof row.ai_summary === 'string') {
        const trimmed = row.ai_summary.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }
    return null;
};
const defaultResolution = {
    nextRoute: '/role-selection',
    selectedRole: null,
    assessmentResult: null,
    activeAttempt: null,
};
const toRole = (roleName) => {
    if (!roleName) {
        return null;
    }
    return {
        name: roleName,
        title: roleName,
    };
};
export const resolveAssessmentState = async ({ userId, client, }) => {
    console.log('[resolveAssessmentState] Starting for userId (Auth ID):', userId);
    if (!userId) {
        console.log('[resolveAssessmentState] No userId, returning default');
        return defaultResolution;
    }
    const { data: resultData, error: resultError } = await client
        .from('interview_results')
        .select(`
        id,
        strengths,
        weaknesses,
        summary,
        ai_summary,
        skill_scores,
        development_suggestions,
        recommended_roles,
        analysis_completed_at,
        hr_review_status,
        team_fit,
        user:users!inner(band, auth_id),
        assessment:interview_assessments(target_role)
      `)
        .eq('user.auth_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (resultError) {
        console.error('[resolveAssessmentState] Error fetching result:', resultError);
        throw resultError;
    }
    const resultRow = resultData ?? null;
    console.log('[resolveAssessmentState] Result row:', resultRow ? 'Found' : 'Not found');
    if (resultRow) {
        console.log('[resolveAssessmentState] User has result, returning /result route');
        const summaryPayload = parseMaybeJsonObject(resultRow.summary ?? null);
        const strengths = mergeUniqueStrings(normaliseStringArray(resultRow.strengths), normaliseStringArray(getSummaryField(summaryPayload, 'strengths')));
        const roleName = resultRow.assessment?.[0]?.target_role ?? null;
        return {
            nextRoute: '/result',
            selectedRole: toRole(roleName),
            assessmentResult: {
                summary: resolveSummaryText(resultRow, summaryPayload),
                strengths,
                developmentAreas: mergeUniqueStrings(normaliseStringArray(resultRow.weaknesses), normaliseStringArray(getSummaryField(summaryPayload, 'development_areas') ??
                    getSummaryField(summaryPayload, 'weaknesses'))),
                skillScores: normaliseSkillScores(getSummaryField(summaryPayload, 'skill_scores') ?? resultRow.skill_scores),
                recommendedRoles: mergeUniqueStrings(normaliseStringArray(resultRow.recommended_roles), normaliseStringArray(getSummaryField(summaryPayload, 'recommended_roles'))),
                developmentSuggestions: mergeUniqueStrings(normaliseStringArray(resultRow.development_suggestions), normaliseStringArray(getSummaryField(summaryPayload, 'development_suggestions'))),
                completedAt: resultRow.analysis_completed_at ?? null,
                hrApprovalStatus: extractHrApprovalStatusFromRow(resultRow),
                teamFit: mergeUniqueStrings(normaliseStringArray(resultRow.team_fit), normaliseStringArray(getSummaryField(summaryPayload, 'team_fit'))),
            },
            activeAttempt: null,
        };
    }
    const { data: attemptData, error: attemptError } = await client
        .from('interview_assessment_attempts')
        .select('*, user:users!inner(auth_id)')
        .eq('user.auth_id', userId)
        .is('submitted_at', null)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (attemptError) {
        throw attemptError;
    }
    const attemptRow = attemptData ?? null;
    console.log('[resolveAssessmentState] Attempt row:', attemptRow ? 'Found' : 'Not found');
    if (attemptRow) {
        console.log('[resolveAssessmentState] User has active attempt, returning /assessment route');
        return {
            nextRoute: '/assessment',
            selectedRole: toRole(attemptRow.role),
            assessmentResult: null,
            activeAttempt: mapAssessmentAttempt(attemptRow),
        };
    }
    console.log('[resolveAssessmentState] No result or attempt, returning /role-selection');
    return defaultResolution;
};
