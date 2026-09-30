import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeSystemOne, parseRetryAfter } from './api';
import type { JevRequest } from './jev';

const request: JevRequest = { model: 'jev-latest', state: 'hello', questions: { ok: { type: 'noul', instructions: 'Is this ok?' } } };
const success = { result: { model: 'jev-1.13.0', answers: { ok: { type: 'noul', noul: 0.9 } }, usage: { input_tokens: 10, output_tokens: 0 } }, meta: { latencyMs: 12, gateway: 'mock' } };

describe('api retry handling', () => {
  afterEach(() => vi.useRealTimers());

  it('honors retry-after on 429 before retrying', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { type: 'rate_limit', message: 'slow down' } }), { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(success), { status: 200 }));
    const promise = invokeSystemOne({ baseUrl: '/api', request, retries: 1, timeoutSec: 5, fetchImpl: fetchImpl as unknown as typeof fetch });
    const expectation = expect(promise).resolves.toEqual(success);
    await vi.advanceTimersByTimeAsync(1000);
    await expectation;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 529 with exponential backoff and then fails clearly', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { type: 'overloaded', message: 'try later' } }), { status: 529 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { type: 'overloaded', message: 'still later' } }), { status: 529 }));
    const promise = invokeSystemOne({ baseUrl: '/api', request, retries: 1, timeoutSec: 5, fetchImpl: fetchImpl as unknown as typeof fetch });
    const expectation = expect(promise).rejects.toThrow('still later');
    await vi.advanceTimersByTimeAsync(500);
    await expectation;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('parses retry-after seconds and dates', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter(null)).toBeUndefined();
  });
});
