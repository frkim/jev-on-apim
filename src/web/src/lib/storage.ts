import type { JevRequest, JevSuccessResponse } from './jev';

export interface AppSettings {
  apiBaseUrl: string;
  defaultModel: string;
  timeoutSec: number;
  retries: number;
  concurrency: number;
  confidenceThreshold: number;
  pricePerMillionInputUsd: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE || '/api',
  defaultModel: 'jev-latest',
  timeoutSec: 30,
  retries: 2,
  concurrency: 3,
  confidenceThreshold: 0.8,
  pricePerMillionInputUsd: 0.042,
};

export interface HistoryEntry {
  id: string;
  createdAt: string;
  request: JevRequest;
  response?: JevSuccessResponse;
  error?: string;
  latencyMs?: number;
  gateway?: string;
}

const SETTINGS_KEY = 'jev-studio-settings';
const HISTORY_KEY = 'jev-studio-history';
const PLAYGROUND_HANDOFF_KEY = 'jev-studio-playground-handoff';
const EVALUATE_HANDOFF_KEY = 'jev-studio-evaluate-handoff';

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  return readJson<HistoryEntry[]>(HISTORY_KEY, []);
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, 200);
  writeJson(HISTORY_KEY, next);
  return next;
}

export function deleteHistory(id: string): HistoryEntry[] {
  const next = loadHistory().filter((entry) => entry.id !== id);
  writeJson(HISTORY_KEY, next);
  return next;
}

export function clearHistory(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(HISTORY_KEY);
}

export function setPlaygroundHandoff(value: unknown): void {
  writeSessionJson(PLAYGROUND_HANDOFF_KEY, value);
}

export function takePlaygroundHandoff<T>(): T | null {
  return takeSessionJson<T>(PLAYGROUND_HANDOFF_KEY);
}

export function setEvaluateHandoff(value: unknown): void {
  writeSessionJson(EVALUATE_HANDOFF_KEY, value);
}

export function takeEvaluateHandoff<T>(): T | null {
  return takeSessionJson<T>(EVALUATE_HANDOFF_KEY);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
}

function writeSessionJson(key: string, value: unknown): void {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(key, JSON.stringify(value));
}

function takeSessionJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  window.sessionStorage.removeItem(key);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
