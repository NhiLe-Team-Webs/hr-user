import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { GeminiAnalysisRequest } from './gemini';

process.env.VITE_GEMINI_MAX_PROMPT_CHARS = process.env.VITE_GEMINI_MAX_PROMPT_CHARS ?? '1200';

let importCounter = 0;
const loadGeminiModule = async () => {
  process.env.VITE_GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY ?? 'test-api-key';
  importCounter += 1;
  return import(`./gemini.js?cacheBust=${importCounter}`);
};

const minimalSuccessResponse = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify({
              overall_score: 72,
              skill_scores: [],
              strengths: [],
              development_areas: [],
              summary: 'OK',
            }),
          },
        ],
      },
    },
  ],
} satisfies Record<string, unknown>;

const extractPromptPayload = (prompt: string): unknown => {
  const marker = 'Assessment context:';
  const markerIndex = prompt.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'prompt should contain assessment context marker');

  const jsonStart = prompt.indexOf('{', markerIndex);
  assert.notEqual(jsonStart, -1, 'prompt should include JSON payload');

  const payloadText = prompt.slice(jsonStart);
  return JSON.parse(payloadText);
};

describe('analyzeWithGemini', () => {
  it('omits verbose fields from the prompt payload', async () => {
    let capturedPrompt = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_input, init) => {
      if (!init?.body) {
        throw new Error('expected request body');
      }
      const parsedBody = JSON.parse(init.body.toString()) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      capturedPrompt = parsedBody.contents[0]?.parts[0]?.text ?? '';

      return new Response(JSON.stringify(minimalSuccessResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const { analyzeWithGemini } = await loadGeminiModule();
      await analyzeWithGemini({
        role: 'Product Designer',
        candidateName: 'Nguyễn Văn A',
        language: 'vi',
        answers: [
          {
            questionId: 'q1',
            questionText: 'Hãy kể về một dự án gần đây bạn dẫn dắt.',
            answerText: 'Tôi chịu trách nhiệm ...',
            format: 'long_form',
            options: ['A', 'B'],
          },
        ],
      });

      assert.ok(capturedPrompt.length > 0, 'prompt text should be captured');
      assert.ok(!capturedPrompt.includes('question_text'));
      assert.ok(!capturedPrompt.includes('options'));

      const payload = extractPromptPayload(capturedPrompt) as {
        candidate: { name: string | null; target_role: string };
        answers: Array<Record<string, unknown>>;
      };

      assert.equal(payload.candidate.target_role, 'Product Designer');
      assert.equal(payload.answers.length, 1);

      const [firstAnswer] = payload.answers;
      assert.deepEqual(Object.keys(firstAnswer).sort(), ['answer_text', 'order', 'question_id']);
      assert.equal(firstAnswer.answer_text, 'Tôi chịu trách nhiệm ...');
      assert.equal(firstAnswer.question_id, 'q1');
    } finally {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      } else {
        delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
      }
    }
  });

  it('truncates lengthy answers to honour the prompt length limit', async () => {
    let capturedPrompt = '';
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    globalThis.fetch = async (_input, init) => {
      if (!init?.body) {
        throw new Error('expected request body');
      }
      const parsedBody = JSON.parse(init.body.toString()) as {
        contents: Array<{ parts: Array<{ text: string }> }>;
      };
      capturedPrompt = parsedBody.contents[0]?.parts[0]?.text ?? '';

      return new Response(JSON.stringify(minimalSuccessResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    try {
      const { analyzeWithGemini } = await loadGeminiModule();
      const longAnswer = 'A'.repeat(20_000);

      await analyzeWithGemini({
        role: 'Design',
        candidateName: 'Long Answer',
        language: 'en',
        answers: [
          {
            questionId: 'q1',
            questionText: 'Describe your design process.',
            answerText: longAnswer,
            format: 'long_form',
          },
        ],
      });

      assert.ok(capturedPrompt.length > 0, 'prompt text should be captured');
      const payload = extractPromptPayload(capturedPrompt) as {
        answers: Array<{ answer_text: string }>;
      };
      const answerText = payload.answers[0]?.answer_text ?? '';

      assert.ok(answerText.endsWith('…'), 'answer should be truncated with ellipsis');
      assert.ok(answerText.length < longAnswer.length, 'answer should be shorter than original');
      assert.ok(capturedPrompt.length <= Number(process.env.VITE_GEMINI_MAX_PROMPT_CHARS),
        'prompt should not exceed configured limit');
      assert.ok(
        warnings.some(([message]) =>
          typeof message === 'string' && message.includes('Prompt truncated')
        ),
        'should log a truncation warning',
      );
    } finally {
      console.warn = originalWarn;
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      } else {
        delete (globalThis as { fetch?: typeof globalThis.fetch }).fetch;
      }
    }
  });

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

    const request: GeminiAnalysisRequest = {
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

  it('surfaces a helpful error when Gemini is unavailable', async () => {
    const unavailablePayload = {
      error: {
        code: 503,
        message: 'The service is currently unavailable.',
        status: 'UNAVAILABLE',
      },
    } satisfies Record<string, unknown>;

    const request: GeminiAnalysisRequest = {
      role: 'Support Specialist',
      candidateName: 'Jamie Example',
      language: 'en',
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
      new Response(JSON.stringify(unavailablePayload), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      const { analyzeWithGemini, GeminiApiError } = await loadGeminiModule();

      await assert.rejects(
        () => analyzeWithGemini(request),
        (error: unknown) => {
          assert.ok(error instanceof GeminiApiError);
          const typedError = error as InstanceType<typeof GeminiApiError>;
          assert.equal(typedError.status, 503);
          assert.match(typedError.message, /currently unavailable/i);
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
