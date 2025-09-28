import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AssessmentResolution } from './resolveAssessmentState';
import type { AssessmentAttemptRow } from './types';

interface QueryResponse<T> {
  data: T | null;
  error: unknown;
}

type MaybeSingleResponse<T> = Promise<QueryResponse<T>>;

interface MockQueryBuilder<T> {
  select: () => MockQueryBuilder<T>;
  eq: () => MockQueryBuilder<T>;
  order: () => MockQueryBuilder<T>;
  limit: () => MockQueryBuilder<T>;
  maybeSingle: () => MaybeSingleResponse<T>;
  is?: () => MockQueryBuilder<T>;
  neq?: () => MockQueryBuilder<T>;
}

interface MockSupabaseClient {
  from: <T>(table: string) => MockQueryBuilder<T>;
}

const createMockClient = <ResultRow, AttemptRow>(options: {
  resultResponse: QueryResponse<ResultRow>;
  attemptResponse: QueryResponse<AttemptRow>;
}): MockSupabaseClient => ({
  from: <T>(table: string) => {
    if (table === 'results') {
      const builder: MockQueryBuilder<T> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(options.resultResponse as unknown as QueryResponse<T>),
      };
      return builder;
    }

    if (table === 'assessment_attempts') {
      const builder: MockQueryBuilder<T> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () => Promise.resolve(options.attemptResponse as unknown as QueryResponse<T>),
      };

      builder.is = () => builder;
      builder.neq = () => builder;

      return builder;
    }

    throw new Error(`Unexpected table ${table}`);
  },
});

const loadModule = async () => {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost';
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? 'anon-key';

  return import('./resolveAssessmentState.js');
};

const expectResolution = async (
  client: MockSupabaseClient,
  matcher: Partial<AssessmentResolution>,
) => {
  const { resolveAssessmentState } = await loadModule();
  const resolution = await resolveAssessmentState({ profileId: 'user-1', client: client as never });
  for (const [key, value] of Object.entries(matcher)) {
    assert.deepEqual((resolution as unknown as Record<string, unknown>)[key], value);
  }
  return resolution;
};

describe('resolveAssessmentState', () => {
  it('prioritises existing assessment results', async () => {
    const client = createMockClient({
      resultResponse: {
        data: {
          id: 'result-1',
          overall_score: 92,
          strengths: ['Focus', 'Collaboration'],
          assessment: [{ target_role: 'Content Creator' }],
        },
        error: null,
      },
      attemptResponse: { data: null, error: null },
    });

    const resolution = await expectResolution(client, {
      nextRoute: '/result',
      assessmentResult: {
        score: 92,
        summary: null,
        strengths: ['Focus', 'Collaboration'],
        developmentAreas: [],
        skillScores: [],
        recommendedRoles: [],
        developmentSuggestions: [],
        completedAt: null,
      },
      selectedRole: { name: 'Content Creator', title: 'Content Creator' },
      activeAttempt: null,
    });

    assert.equal(resolution.activeAttempt, null);
  });

  it('returns in-progress attempt when no result exists', async () => {
    const attemptRow: AssessmentAttemptRow = {
      id: 'attempt-1',
      profile_id: 'user-1',
      assessment_id: 'assessment-1',
      role: 'Customer Support',
      status: 'in_progress',
      answered_count: 3,
      total_questions: 10,
      progress_percent: 30,
      started_at: '2024-01-01T00:00:00.000Z',
      submitted_at: null,
      completed_at: null,
      last_activity_at: '2024-01-01T01:00:00.000Z',
    };

    const client = createMockClient({
      resultResponse: { data: null, error: null },
      attemptResponse: { data: attemptRow, error: null },
    });

    const resolution = await expectResolution(client, {
      nextRoute: '/assessment',
      selectedRole: { name: 'Customer Support', title: 'Customer Support' },
      assessmentResult: null,
    });

    assert.notEqual(resolution.activeAttempt, null);
    assert.equal(resolution.activeAttempt?.id, 'attempt-1');
    assert.equal(resolution.activeAttempt?.progressPercent, 30);
  });

  it('falls back to role selection when nothing is available', async () => {
    const client = createMockClient({
      resultResponse: { data: null, error: null },
      attemptResponse: { data: null, error: null },
    });

    await expectResolution(client, {
      nextRoute: '/role-selection',
      selectedRole: null,
      assessmentResult: null,
      activeAttempt: null,
    });
  });
});

