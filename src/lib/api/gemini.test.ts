import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const loadGeminiModule = async () => {
  process.env.VITE_GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY ?? 'test-api-key';
  return import('./gemini.js');
};

describe('analyzeWithGemini', () => {
  it('throws a descriptive error when Gemini blocks the response', async () => {
    const blockedResponse = {
      promptFeedback: {
        blockReason: 'SAFETY',
        safetyRatings: [
          { category: 'HARM_CATEGORY_DEROGATORY', probability: 'HIGH' },
        ],
      },
      candidates: [
        {
          finishReason: 'SAFETY',
          safetyRatings: [
            { category: 'HARM_CATEGORY_DEROGATORY', probability: 'HIGH' },
          ],
          content: {
            role: 'model',
            parts: [],
          },
        },
      ],
    } satisfies Record<string, unknown>;

    const request = {
      role: 'Support Specialist',
      candidateName: 'Jamie Example',
      language: 'en' as const,
      answers: [
        {
          questionId: 'q1',
          questionText: 'Tell me about yourself',
          answerText: 'I am a dedicated professional.',
          format: 'text',
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify(blockedResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      const { analyzeWithGemini, GeminiApiError } = await loadGeminiModule();

      await assert.rejects(
        () => analyzeWithGemini(request),
        (error: unknown) => {
          assert.ok(error instanceof GeminiApiError);
          assert.match(
            (error as Error).message,
            /did not include any content parts/,
            'error message should describe the missing content parts',
          );

          const payload = (error as InstanceType<typeof GeminiApiError>).payload as
            | { finishReason?: unknown; promptFeedback?: unknown; safetyRatings?: unknown }
            | undefined;

          assert.ok(payload);
          assert.equal(payload?.finishReason, 'SAFETY');
          assert.deepEqual(payload?.promptFeedback, blockedResponse.promptFeedback);
          assert.deepEqual(payload?.safetyRatings, blockedResponse.candidates[0]?.safetyRatings);
          return true;
        },
      );
    } finally {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      } else {
        delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
      }
    }
  });
});
