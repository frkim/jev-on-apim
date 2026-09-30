import type { JevErrorResponse, JevRequest, JevSuccessResponse } from './jev';

export interface HealthResponse {
  status: 'ok' | string;
  mode: 'apim' | 'mock' | string;
  apimConfigured: boolean;
  version: string;
}

export interface ModelsResponse {
  data: Array<{ id: string; description?: string }>;
  pricing?: { inputPerMillionUsd: number; outputPerMillionUsd: number };
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeoutSec?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: JevErrorResponse | unknown;
  readonly retryAfterMs?: number;

  constructor(message: string, status: number, payload?: unknown, retryAfterMs?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.retryAfterMs = retryAfterMs;
  }
}

const RETRYABLE_STATUS = new Set([429, 529]);
const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

export function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
}

export async function getHealth(options: ApiClientOptions = {}): Promise<HealthResponse> {
  return getJson<HealthResponse>(`${resolveBaseUrl(options.baseUrl)}/health`, options);
}

export async function getModels(options: ApiClientOptions = {}): Promise<ModelsResponse> {
  return getJson<ModelsResponse>(`${resolveBaseUrl(options.baseUrl)}/models`, options);
}

async function getJson<T>(url: string, options: ApiClientOptions): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, { signal: options.signal, cache: 'no-store' });
  if (!response.ok) throw await buildApiError(response);
  return (await response.json()) as T;
}

export interface InvokeOptions extends ApiClientOptions {
  request: JevRequest;
}

export async function invokeSystemOne(options: InvokeOptions): Promise<JevSuccessResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutSec = clampTimeout(options.timeoutSec ?? 30);
  const retries = Math.max(0, options.retries ?? 2);
  const base = resolveBaseUrl(options.baseUrl);
  const correlationId = crypto.randomUUID();
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= retries) {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutSec * 1000);
    const signal = mergeSignals([options.signal, timeoutController.signal]);
    try {
      const response = await fetchImpl(`${base}/systemone?timeout=${timeoutSec}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(options.request),
        signal,
      });
      clearTimeout(timer);
      if (response.ok) return (await response.json()) as JevSuccessResponse;
      const apiError = await buildApiError(response);
      if (!RETRYABLE_STATUS.has(apiError.status) || attempt === retries) throw apiError;
      lastError = apiError;
      await sleep(apiError.retryAfterMs ?? backoffMs(attempt), options.signal);
    } catch (error) {
      clearTimeout(timer);
      if (options.signal?.aborted) throw error;
      if (error instanceof ApiError) {
        lastError = error;
      } else {
        throw error;
      }
    }
    attempt += 1;
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed.');
}

function clampTimeout(value: number): number {
  return Math.min(120, Math.max(5, Math.round(value)));
}

function backoffMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  return Math.round(base + Math.random() * 250);
}

async function buildApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
  const message = isJevError(payload) ? payload.error.message : `Request failed with HTTP ${response.status}`;
  return new ApiError(message, response.status, payload, retryAfterMs);
}

function isJevError(value: unknown): value is JevErrorResponse {
  return Boolean(value && typeof value === 'object' && 'error' in value);
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function mergeSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter(Boolean) as AbortSignal[];
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];
  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  });
}
