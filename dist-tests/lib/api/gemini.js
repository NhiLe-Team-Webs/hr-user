import { GoogleGenerativeAI } from '@google/generative-ai';
const MODEL_NAME = 'gemini-pro';
export class GeminiApiError extends Error {
    constructor(message, options) {
        super(message);
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "payload", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'GeminiApiError';
        this.status = options?.status;
        this.payload = options?.payload;
    }
}
const ensureApiKey = () => {
    const importMetaEnv = import.meta.env;
    const processEnv = typeof process !== 'undefined' ? process.env : undefined;
    const apiKey = importMetaEnv?.VITE_GEMINI_API_KEY ?? processEnv?.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new GeminiApiError('Gemini API key is not configured.');
    }
    return apiKey;
};
const getGenAIClient = () => {
    const apiKey = ensureApiKey();
    return new GoogleGenerativeAI(apiKey);
};
const resolveNumericEnvValue = (value) => {
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
const resolveMaxPromptCharLength = () => {
    const fromImport = resolveNumericEnvValue(import.meta.env
        ?.VITE_GEMINI_MAX_PROMPT_CHARS);
    if (typeof fromImport === 'number' && fromImport > 0) {
        return fromImport;
    }
    const fromProcess = resolveNumericEnvValue(typeof process !== 'undefined'
        ? process.env?.VITE_GEMINI_MAX_PROMPT_CHARS
        : undefined);
    if (typeof fromProcess === 'number' && fromProcess > 0) {
        return fromProcess;
    }
    return 12000;
};
const MAX_PROMPT_CHAR_LENGTH = resolveMaxPromptCharLength();
const MIN_TRUNCATED_ANSWER_CHARS = 400;
const TRUNCATION_STEP_CHARS = 200;
const buildPrompt = (request, answers) => {
    const languageInstruction = request.language === 'vi'
        ?
            'IMPORTANT: You MUST respond in Vietnamese language. All text in the JSON response (summary, strengths, development_areas, skill names) must be written in Vietnamese. Phân tích câu trả lời và trả về kết quả bằng tiếng Việt.'
        :
            'IMPORTANT: You MUST respond in English language. All text in the JSON response must be written in English.';
    const payload = {
        candidate: {
            name: request.candidateName,
            target_role: request.role,
        },
        available_teams: request.availableTeams,
        answers: answers.map((answer, index) => {
            const serialised = {
                order: index + 1,
                answer_text: answer.answerText,
            };
            if (answer.questionId) {
                serialised.question_id = answer.questionId;
            }
            return serialised;
        }),
    };
    const promptParts = [
        'You are an experienced HR assessor specialising in behavioural and culture-fit interviews.',
        'Evaluate the candidate responses and provide a structured summary.',
        '',
        languageInstruction,
        '',
        'Return a strict JSON object with the following keys:',
        '- "skill_scores": array of objects with "name" (string) and "score" (0-100).',
        '- "strengths": array of strings describing positive behaviours.',
        '- "development_areas": array of strings for improvements.',
        '- "recommended_roles": array of strings suggesting suitable roles for this candidate.',
        '- "team_fit": array of strings listing the most suitable teams from the provided "available_teams" list. Only select teams that are relevant.',
        '- "summary": a concise paragraph (string) tailored for the candidate.',
        '',
        'Do not include any additional commentary or markdown. Return only valid JSON.',
        '',
        'Assessment context:',
        JSON.stringify(payload, null, 2),
    ];
    return promptParts.join('\n');
};
const truncateAnswers = (answers, maxLength) => {
    const ellipsis = '…';
    const maxContentLength = Math.max(0, maxLength - ellipsis.length);
    return answers.map((answer) => {
        const trimmed = answer.answerText.trim();
        if (trimmed.length <= maxLength) {
            return { ...answer, answerText: trimmed };
        }
        const truncated = trimmed.slice(0, maxContentLength).trimEnd();
        return {
            ...answer,
            answerText: `${truncated}${ellipsis}`,
        };
    });
};
const preparePrompt = (request, answers) => {
    const sanitisedAnswers = answers.map((answer) => ({
        ...answer,
        answerText: answer.answerText.trim(),
    }));
    const buildWith = (candidateAnswers) => buildPrompt(request, candidateAnswers);
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
    let limitPerAnswer = Math.max(MIN_TRUNCATED_ANSWER_CHARS, Math.floor(MAX_PROMPT_CHAR_LENGTH / Math.max(1, sanitisedAnswers.length)));
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
const normaliseNumber = (value) => {
    const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (!Number.isFinite(num)) {
        return null;
    }
    if (Number.isNaN(num)) {
        return null;
    }
    return Math.min(100, Math.max(0, Math.round(num * 100) / 100));
};
const normaliseSkillScores = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (typeof item !== 'object' || !item) {
            return null;
        }
        const name = typeof item.name === 'string'
            ? item.name
            : typeof item.skill === 'string'
                ? (item.skill)
                : null;
        const score = normaliseNumber(item.score);
        if (!name || score === null) {
            return null;
        }
        return { name, score };
    })
        .filter((item) => item !== null);
};
const normaliseStringArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
};
const parseGeminiPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        throw new GeminiApiError('Gemini response does not include a JSON object.');
    }
    const typed = payload;
    const skillScores = normaliseSkillScores(typed.skill_scores);
    const strengths = normaliseStringArray(typed.strengths);
    const developmentAreas = normaliseStringArray(typed.development_areas ?? typed.opportunities);
    const recommendedRoles = normaliseStringArray(typed.recommended_roles);
    const teamFit = normaliseStringArray(typed.team_fit);
    const summary = typeof typed.summary === 'string' ? typed.summary.trim() : '';
    return {
        model: MODEL_NAME,
        skillScores,
        strengths,
        developmentAreas,
        recommendedRoles,
        teamFit,
        summary,
        raw: payload,
    };
};
const tryParseJson = (raw) => {
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
    const candidates = [trimmed];
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
    }
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        }
        catch (error) {
            // Try the next candidate variant.
        }
    }
    const candidateText = typeof trimmed === 'string' ? trimmed : String(trimmed ?? '');
    const snippet = candidateText.length > 1000 ? candidateText.slice(0, 1000) + '...' : candidateText;
    console.error('[Gemini] Invalid JSON payload received from model', { snippet, totalLength: candidateText.length });
    throw new GeminiApiError('Gemini returned an invalid JSON payload.', { payload: raw });
};
const extractCandidateResponse = (response) => {
    if (!response || typeof response !== 'object') {
        throw new GeminiApiError('Gemini response does not include a JSON object.', {
            payload: response,
        });
    }
    const candidates = response.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
        const promptFeedback = response.promptFeedback;
        let detail = '';
        if (promptFeedback && typeof promptFeedback === 'object') {
            const blockReason = promptFeedback.blockReason;
            const blockReasonText = typeof blockReason === 'string' ? blockReason : null;
            const feedbackSegments = [];
            if (blockReasonText) {
                feedbackSegments.push(`block reason: ${blockReasonText}`);
            }
            try {
                const serialised = JSON.stringify(promptFeedback);
                if (serialised && serialised !== '{}' && serialised !== 'null') {
                    feedbackSegments.push(`prompt feedback: ${serialised}`);
                }
            }
            catch (error) {
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
    const [firstCandidate] = candidates;
    const promptFeedback = response.promptFeedback;
    const finishReason = typeof firstCandidate?.finishReason === 'string'
        ? firstCandidate.finishReason
        : null;
    const safetyRatings = firstCandidate?.safetyRatings;
    const parts = firstCandidate?.content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
        const detailSegments = [];
        if (finishReason) {
            detailSegments.push(`finish reason: ${finishReason}`);
        }
        if (promptFeedback &&
            typeof promptFeedback === 'object' &&
            promptFeedback.blockReason) {
            const blockReason = promptFeedback.blockReason;
            if (typeof blockReason === 'string') {
                detailSegments.push(`block reason: ${blockReason}`);
            }
        }
        const detail = detailSegments.length > 0 ? ` (${detailSegments.join('; ')})` : '';
        throw new GeminiApiError(`Gemini response did not include any content parts${detail}.`, {
            payload: {
                promptFeedback,
                finishReason,
                safetyRatings,
            },
        });
    }
    let lastError = null;
    for (const part of parts) {
        const text = part.text;
        if (typeof text === 'string') {
            try {
                const parsed = tryParseJson(text);
                if (parsed) {
                    return parsed;
                }
            }
            catch (error) {
                lastError = error;
            }
        }
        const functionCall = part.functionCall;
        if (functionCall && typeof functionCall === 'object') {
            try {
                const args = functionCall.args;
                const parsed = tryParseJson(args);
                if (parsed) {
                    return parsed;
                }
            }
            catch (error) {
                lastError = error;
            }
        }
    }
    if (lastError instanceof GeminiApiError) {
        throw lastError;
    }
    throw new GeminiApiError('Gemini response does not include a JSON object.', { payload: response });
};
export const analyzeWithGemini = async (request) => {
    const apiKey = ensureApiKey();
    const filteredAnswers = request.answers.filter((answer) => answer.answerText.trim().length > 0);
    if (filteredAnswers.length === 0) {
        return {
            model: MODEL_NAME,
            skillScores: [],
            strengths: [],
            developmentAreas: [],
            recommendedRoles: [],
            teamFit: [],
            summary: '',
            raw: null,
        };
    }
    const { prompt, promptLength, basePromptLength, truncated } = preparePrompt(request, filteredAnswers);
    const importMetaEnv = import.meta.env;
    const isDev = Boolean(importMetaEnv?.DEV);
    const debugLogsEnabled = isDev ||
        `${(importMetaEnv?.VITE_GEMINI_DEBUG_LOGS ?? (typeof process !== 'undefined'
            ? process.env?.VITE_GEMINI_DEBUG_LOGS
            : undefined)) ?? ''}`
            .toString()
            .toLowerCase() === 'true';
    console.log('[Gemini] Analysis request started. API Key present:', apiKey ? 'Yes (ends with ' + apiKey.slice(-4) + ')' : 'No');
    console.log('[Gemini] Debug logs enabled:', debugLogsEnabled);
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
    }
    else if (!truncated && isDev) {
        console.info('[Gemini] Submitting analysis request', {
            answerCount: filteredAnswers.length,
            language: request.language,
            role: request.role,
            promptLength,
            maxPromptLength: MAX_PROMPT_CHAR_LENGTH,
        });
    }
    let result;
    try {
        const genai = getGenAIClient();
        const model = genai.getGenerativeModel({ model: MODEL_NAME });
        console.log('[Gemini] Making API request using GoogleGenerativeAI SDK');
        const generationConfig = {
            temperature: 0.2,
            topP: 0.9,
            topK: 32,
            maxOutputTokens: 3000,
        };
        const response = await model.generateContent(prompt);
        const responseText = response.response.text();
        console.log('[Gemini] API response received successfully');
        if (debugLogsEnabled) {
            console.debug('[Gemini] Raw API response', responseText);
        }
        const parsed = tryParseJson(responseText);
        const analysisResult = parseGeminiPayload(parsed);
        result = {
            ...analysisResult,
            model: MODEL_NAME,
        };
        if (debugLogsEnabled) {
            console.debug('[Gemini] Parsed analysis payload', result);
        }
    }
    catch (error) {
        console.error('[Gemini] Error while calling API', error);
        // Enhanced error handling with more specific error types
        if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();
            // Handle specific Google AI SDK errors
            if (errorMessage.includes('api_key') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
                throw new GeminiApiError('Gemini API authentication failed. Please check your API key configuration.', { status: 401, payload: error.message });
            }
            if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
                throw new GeminiApiError('Gemini API rate limit exceeded. Please wait a moment and try again.', { status: 429, payload: error.message });
            }
            if (errorMessage.includes('model') || errorMessage.includes('not found') || errorMessage.includes('invalid model')) {
                throw new GeminiApiError('Gemini API model not found or unavailable. Please check model configuration.', { status: 404, payload: error.message });
            }
            if (errorMessage.includes('timeout') || errorMessage.includes('deadline exceeded')) {
                throw new GeminiApiError('Gemini API request timed out. Please try again.', { status: 408, payload: error.message });
            }
            if (errorMessage.includes('content policy') || errorMessage.includes('safety') || errorMessage.includes('blocked')) {
                throw new GeminiApiError('Gemini API content policy violation. The request was blocked by safety filters.', { status: 400, payload: error.message });
            }
            if (errorMessage.includes('invalid argument') || errorMessage.includes('invalid request')) {
                throw new GeminiApiError('Gemini API invalid request. Please check the request parameters.', { status: 400, payload: error.message });
            }
            if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('fetch')) {
                throw new GeminiApiError('Gemini API network error. Please check your internet connection and try again.', { status: 503, payload: error.message });
            }
            // Generic Google AI SDK error
            throw new GeminiApiError(`Gemini API error: ${error.message}`, { status: 500, payload: error.message });
        }
        // Handle non-Error objects
        const errorPayload = typeof error === 'object' ? JSON.stringify(error) : String(error);
        throw new GeminiApiError('Gemini API error occurred. Unknown error type.', { status: 500, payload: errorPayload });
    }
    return result;
};
const normaliseScore = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    const clamped = Math.max(0, Math.min(100, value));
    return Math.round(clamped * 100) / 100;
};
const normaliseTextArray = (values) => values
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
export const toAssessmentResult = (analysis) => ({
    summary: analysis.summary?.trim()?.length ? analysis.summary.trim() : null,
    strengths: normaliseTextArray(analysis.strengths),
    developmentAreas: normaliseTextArray(analysis.developmentAreas),
    skillScores: analysis.skillScores
        .filter((item) => typeof item?.name === 'string' && Number.isFinite(item?.score))
        .map((item) => ({
        name: item.name.trim(),
        score: normaliseScore(item.score) ?? 0,
    })),
    recommendedRoles: normaliseTextArray(analysis.recommendedRoles),
    developmentSuggestions: normaliseTextArray(analysis.developmentAreas),
    completedAt: null,
    hrApprovalStatus: 'pending',
    teamFit: normaliseTextArray(analysis.teamFit),
});
export { MODEL_NAME as GEMINI_MODEL_NAME };
