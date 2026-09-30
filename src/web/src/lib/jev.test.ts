import { describe, expect, it } from 'vitest';
import { answerConfidence, coverageAccuracyCurve, estimateInputCost, isCorrect, parseStateInput, percentile, validateQuestions, type Answer } from './jev';

describe('Jev validation', () => {
  it('validates question ids and criteria rules', () => {
    const issues = validateQuestions({
      'bad id': { type: 'noul', instructions: 'x' },
      only_one: { type: 'choice', instructions: 'x', criteria: { a: 'A' } },
      too_short: { type: 'score', instructions: 'x', criteria: ['one'] },
    });
    expect(issues.map((issue) => issue.path)).toContain('bad id.id');
    expect(issues.some((issue) => issue.message.includes('2 to 255'))).toBe(true);
    expect(issues.some((issue) => issue.message.includes('2 to 10'))).toBe(true);
  });

  it('parses JSON state and rejects scalar JSON', () => {
    expect(parseStateInput('json', '{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(parseStateInput('json', '123').ok).toBe(false);
    expect(parseStateInput('text', 'plain')).toEqual({ ok: true, value: 'plain' });
  });
});

describe('Jev metrics', () => {
  const answers: Record<string, Answer> = {
    noul: { type: 'noul', noul: 0.8 },
    choice: { type: 'choice', choice: 'a', probabilities: { a: 0.7, b: 0.3 }, confidence: 0.7 },
    score: { type: 'score', score: 2.4, legend: { '0': 'bad', '1': 'ok', '2': 'good', '3': 'great' }, probabilities: { '2': 0.6, '3': 0.4 }, confidence: 0.6 },
  };

  it('calculates correctness per answer type', () => {
    expect(isCorrect(answers.noul, true)).toBe(true);
    expect(isCorrect(answers.choice, 'a')).toBe(true);
    expect(isCorrect(answers.score, 2)).toBe(true);
  });

  it('computes confidence, curve, percentiles, and cost', () => {
    expect(answerConfidence({ type: 'noul', noul: 0.2 })).toBeCloseTo(0.8);
    const curve = coverageAccuracyCurve([{ confidence: 0.9, correct: true }, { confidence: 0.6, correct: false }], [0.5, 0.8]);
    expect(curve[0]).toMatchObject({ coverage: 1, accuracy: 0.5, accepted: 2 });
    expect(curve[1]).toMatchObject({ coverage: 0.5, accuracy: 1, accepted: 1 });
    expect(percentile([10, 20, 30], 0.5)).toBe(20);
    expect(estimateInputCost(1_000_000, 0.042)).toBe(0.042);
  });
});
