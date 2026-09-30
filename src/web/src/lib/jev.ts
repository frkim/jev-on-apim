export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JevState = string | JsonValue[] | { [key: string]: JsonValue };
export type Instructions = string | JsonValue[] | { [key: string]: JsonValue };

export const QUESTION_ID_REGEX = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export const MODELS = ['jev-latest', 'jev-preview', 'jev-1.13.0'] as const;
export const DEFAULT_PRICE_PER_MILLION = 0.042;

export type QuestionType = 'noul' | 'choice' | 'score';

export interface NoulQuestion {
  type: 'noul';
  instructions: Instructions;
  criteria?: { true?: string; false?: string };
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: Instructions;
  criteria: Record<string, string | null>;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: Instructions;
  criteria: string[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;
export type QuestionMap = Record<string, Question>;

export interface JevRequest {
  model: string;
  state: JevState;
  questions: QuestionMap;
}

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence?: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence?: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface JevSuccessResponse {
  result: {
    model: string;
    answers: Record<string, Answer>;
    usage: { input_tokens: number; output_tokens: number };
  };
  meta: {
    correlationId?: string;
    latencyMs?: number;
    upstreamStatus?: number;
    apimRequestId?: string;
    gateway?: 'apim' | 'mock';
  };
}

export interface JevErrorResponse {
  error: { type: string; message: string; details?: unknown; upstream?: unknown };
  meta?: Record<string, unknown>;
}

export type ExpectedValue = boolean | string | number;

export interface ValidationIssue {
  path: string;
  message: string;
}

export function parseStateInput(mode: 'text' | 'json', value: string): { ok: true; value: JevState } | { ok: false; error: string } {
  if (mode === 'text') return { ok: true, value };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'string' || Array.isArray(parsed) || (parsed !== null && typeof parsed === 'object')) {
      return { ok: true, value: parsed as JevState };
    }
    return { ok: false, error: 'State JSON must be a string, object, or array.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

export function parseInstructionsInput(mode: 'text' | 'json', value: string): { ok: true; value: Instructions } | { ok: false; error: string } {
  if (mode === 'text') return { ok: true, value };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === 'string' || Array.isArray(parsed) || (parsed !== null && typeof parsed === 'object')) {
      return { ok: true, value: parsed as Instructions };
    }
    return { ok: false, error: 'Instructions JSON must be a string, object, or array.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }
}

export function validateQuestionId(id: string): string | null {
  if (!id.trim()) return 'Question id is required.';
  if (!QUESTION_ID_REGEX.test(id)) return 'Use 1-64 chars: start with a letter or underscore; then letters, numbers, underscore, or hyphen.';
  return null;
}

export function validateQuestion(id: string, question: Question): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const idIssue = validateQuestionId(id);
  if (idIssue) issues.push({ path: `${id}.id`, message: idIssue });
  if (question.instructions === '' || question.instructions === null || question.instructions === undefined) {
    issues.push({ path: `${id}.instructions`, message: 'Instructions are required.' });
  }
  if (question.type === 'choice') {
    const entries = Object.entries(question.criteria ?? {});
    if (entries.length < 2 || entries.length > 255) issues.push({ path: `${id}.criteria`, message: 'Choice questions require 2 to 255 options.' });
    for (const [key] of entries) {
      if (!QUESTION_ID_REGEX.test(key)) issues.push({ path: `${id}.criteria.${key}`, message: 'Option keys use the same id format as questions.' });
    }
  }
  if (question.type === 'score') {
    if (!Array.isArray(question.criteria) || question.criteria.length < 2 || question.criteria.length > 10) {
      issues.push({ path: `${id}.criteria`, message: 'Score questions require 2 to 10 ordered levels.' });
    }
    question.criteria?.forEach((level, index) => {
      if (!level.trim()) issues.push({ path: `${id}.criteria.${index}`, message: 'Level descriptions cannot be empty.' });
    });
  }
  return issues;
}

export function validateQuestions(questions: QuestionMap): ValidationIssue[] {
  const entries = Object.entries(questions);
  const issues: ValidationIssue[] = [];
  if (entries.length === 0) issues.push({ path: 'questions', message: 'Add at least one question.' });
  if (entries.length > 32) issues.push({ path: 'questions', message: 'Jev accepts at most 32 questions per request.' });
  for (const [id, question] of entries) issues.push(...validateQuestion(id, question));
  return issues;
}

export function answerConfidence(answer: Answer): number {
  if (answer.type === 'noul') return Math.max(answer.noul, 1 - answer.noul);
  if (typeof answer.confidence === 'number') return answer.confidence;
  const values = Object.values(answer.probabilities ?? {});
  return values.length ? Math.max(...values) : 0;
}

export function predictedValue(answer: Answer): ExpectedValue {
  if (answer.type === 'noul') return answer.noul >= 0.5;
  if (answer.type === 'choice') return answer.choice;
  return Math.round(answer.score);
}

export function isCorrect(answer: Answer, expected: ExpectedValue): boolean {
  const predicted = predictedValue(answer);
  if (answer.type === 'noul') return typeof expected === 'boolean' && predicted === expected;
  if (answer.type === 'choice') return typeof expected === 'string' && predicted === expected;
  return typeof expected === 'number' && predicted === expected;
}

export function scoreAbsoluteError(answer: Answer, expected: ExpectedValue): number | null {
  if (answer.type !== 'score' || typeof expected !== 'number') return null;
  return Math.abs(answer.score - expected);
}

export interface MetricRow {
  confidence: number;
  correct: boolean;
}

export interface CoverageAccuracyPoint {
  threshold: number;
  coverage: number;
  accuracy: number | null;
  accepted: number;
}

export function coverageAccuracyCurve(rows: MetricRow[], thresholds = defaultThresholds()): CoverageAccuracyPoint[] {
  return thresholds.map((threshold) => {
    const acceptedRows = rows.filter((row) => row.confidence >= threshold);
    const correct = acceptedRows.filter((row) => row.correct).length;
    return {
      threshold,
      coverage: rows.length ? acceptedRows.length / rows.length : 0,
      accuracy: acceptedRows.length ? correct / acceptedRows.length : null,
      accepted: acceptedRows.length,
    };
  });
}

export function defaultThresholds(): number[] {
  const values: number[] = [];
  for (let value = 0.5; value <= 0.9901; value += 0.01) values.push(Number(value.toFixed(2)));
  return values;
}

export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function estimateInputCost(inputTokens: number, pricePerMillion = DEFAULT_PRICE_PER_MILLION): number {
  return (inputTokens * pricePerMillion) / 1_000_000;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: value < 0.01 ? 6 : 2, maximumFractionDigits: 6 }).format(value);
}

export function compactJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
