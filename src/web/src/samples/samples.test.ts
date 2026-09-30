import { describe, expect, it } from 'vitest';
import { validateQuestions } from '@/lib/jev';
import { samples } from './index';

describe('samples integrity', () => {
  it('has required realistic samples with valid questions and test expectations', () => {
    expect(samples.length).toBeGreaterThanOrEqual(10);
    const ids = new Set(samples.map((sample) => sample.id));
    expect(ids.size).toBe(samples.length);
    for (const sample of samples) {
      expect(validateQuestions(sample.questions), sample.id).toEqual([]);
      expect(sample.testCases.length, sample.id).toBeGreaterThanOrEqual(4);
      for (const testCase of sample.testCases) {
        for (const [questionId, expected] of Object.entries(testCase.expected)) {
          const question = sample.questions[questionId];
          expect(question, `${sample.id}/${testCase.name}/${questionId}`).toBeTruthy();
          if (question.type === 'noul') expect(typeof expected).toBe('boolean');
          if (question.type === 'choice') expect(Object.keys(question.criteria)).toContain(expected);
          if (question.type === 'score') {
            expect(typeof expected).toBe('number');
            expect(expected as number).toBeGreaterThanOrEqual(0);
            expect(expected as number).toBeLessThan(question.criteria.length);
          }
        }
      }
    }
  });
});
