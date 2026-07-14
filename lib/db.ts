import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { getQuestionById } from '@/lib/questions';
import { isUngraded } from '@/lib/quiz';
import {
  DEFAULT_TIERS,
  SOURCE_TIERS,
  type Attempt,
  type Question,
  type Response,
  type SourceTier,
} from '@/lib/types';

export const DB_NAME = 'knpc-reviser';
export const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * A response, denormalized out of its attempt into its own store. This is what makes
 * "questions I keep missing" a single index read instead of a full scan of every attempt.
 */
export interface StoredResponse extends Response {
  /** `${attemptId}::${questionId}` - the composite key. */
  id: string;
  attemptId: string;
  /** Denormalized from the attempt, so the miss queue can sort by recency without joining. */
  attemptStartedAt: number;
}

export function responseKey(attemptId: string, questionId: string): string {
  return `${attemptId}::${questionId}`;
}

export interface Settings {
  defaultTiers: SourceTier[];
  shuffleOptions: boolean;
  mockCount: number;
  mockTimeLimitSec: number | null;
  practiceCount: number;
  drillCount: number;
}

export type SettingsKey = keyof Settings;
type SettingsValue = Settings[SettingsKey];

export interface SettingRecord {
  key: string;
  value: SettingsValue;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultTiers: [...DEFAULT_TIERS],
  shuffleOptions: true,
  // The real KNPC paper: 40 questions, 60 minutes.
  mockCount: 40,
  mockTimeLimitSec: 60 * 60,
  practiceCount: 20,
  drillCount: 15,
};

function isTierArray(value: unknown): value is SourceTier[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry): entry is SourceTier =>
        typeof entry === 'string' && (SOURCE_TIERS as readonly string[]).includes(entry),
    )
  );
}

/** Reads are defensive: a corrupt or stale settings row falls back to the default. */
function coerceSetting(key: SettingsKey, value: unknown): SettingsValue | undefined {
  switch (key) {
    case 'defaultTiers':
      return isTierArray(value) ? value : undefined;
    case 'shuffleOptions':
      return typeof value === 'boolean' ? value : undefined;
    case 'mockCount':
    case 'practiceCount':
    case 'drillCount':
      return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : undefined;
    case 'mockTimeLimitSec':
      if (value === null) return null;
      return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? Math.floor(value)
        : undefined;
  }
}

const SETTINGS_KEYS: readonly SettingsKey[] = [
  'defaultTiers',
  'shuffleOptions',
  'mockCount',
  'mockTimeLimitSec',
  'practiceCount',
  'drillCount',
];

/**
 * Rows whose key is not one of the above are ignored on read, which is what retires a setting
 * safely: a browser that still has the old `includeUnverified` row from before unverified items
 * left the bank simply never sees it loaded, and cannot resurrect the behaviour.
 */
function isSettingsKey(key: string): key is SettingsKey {
  return (SETTINGS_KEYS as readonly string[]).includes(key);
}

// ---------------------------------------------------------------------------
// Storage status. Private browsing and blocked-IDB must degrade, never throw.
// ---------------------------------------------------------------------------

export type StorageMode = 'indexeddb' | 'memory' | 'pending';

export interface StorageStatus {
  mode: StorageMode;
  /** True when history will NOT survive a reload. The UI must warn. */
  degraded: boolean;
  /** Human-readable reason, when degraded. */
  reason: string | null;
}

let status: StorageStatus = { mode: 'pending', degraded: false, reason: null };
const statusListeners = new Set<(status: StorageStatus) => void>();

function setStatus(next: StorageStatus): void {
  status = next;
  for (const listener of statusListeners) listener(status);
}

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(
  listener: (status: StorageStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

interface Backend {
  putAttempt(attempt: Attempt): Promise<void>;
  getAttempt(id: string): Promise<Attempt | undefined>;
  getAllAttempts(): Promise<Attempt[]>;
  deleteAttempt(id: string): Promise<void>;
  putResponses(responses: StoredResponse[]): Promise<void>;
  deleteResponsesForAttempt(attemptId: string): Promise<void>;
  getResponsesForQuestion(questionId: string): Promise<StoredResponse[]>;
  getAllResponses(): Promise<StoredResponse[]>;
  getSettingRecords(): Promise<SettingRecord[]>;
  putSettingRecord(record: SettingRecord): Promise<void>;
  clearAll(): Promise<void>;
}

interface KnpcSchema extends DBSchema {
  attempts: {
    key: string;
    value: Attempt;
    indexes: { 'by-startedAt': number };
  };
  responses: {
    key: string;
    value: StoredResponse;
    indexes: { 'by-questionId': string; 'by-attemptId': string };
  };
  settings: {
    key: string;
    value: SettingRecord;
  };
}

class IdbBackend implements Backend {
  constructor(private readonly db: IDBPDatabase<KnpcSchema>) {}

  async putAttempt(attempt: Attempt): Promise<void> {
    await this.db.put('attempts', attempt);
  }

  getAttempt(id: string): Promise<Attempt | undefined> {
    return this.db.get('attempts', id);
  }

  getAllAttempts(): Promise<Attempt[]> {
    return this.db.getAllFromIndex('attempts', 'by-startedAt');
  }

  async deleteAttempt(id: string): Promise<void> {
    await this.db.delete('attempts', id);
  }

  async putResponses(responses: StoredResponse[]): Promise<void> {
    const tx = this.db.transaction('responses', 'readwrite');
    await Promise.all(responses.map((response) => tx.store.put(response)));
    await tx.done;
  }

  async deleteResponsesForAttempt(attemptId: string): Promise<void> {
    const tx = this.db.transaction('responses', 'readwrite');
    const keys = await tx.store.index('by-attemptId').getAllKeys(attemptId);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  }

  getResponsesForQuestion(questionId: string): Promise<StoredResponse[]> {
    return this.db.getAllFromIndex('responses', 'by-questionId', questionId);
  }

  getAllResponses(): Promise<StoredResponse[]> {
    return this.db.getAll('responses');
  }

  getSettingRecords(): Promise<SettingRecord[]> {
    return this.db.getAll('settings');
  }

  async putSettingRecord(record: SettingRecord): Promise<void> {
    await this.db.put('settings', record);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.db.clear('attempts'),
      this.db.clear('responses'),
      this.db.clear('settings'),
    ]);
  }
}

/** Used when IndexedDB is unavailable (private browsing, blocked, SSR). Nothing persists. */
class MemoryBackend implements Backend {
  private readonly attempts = new Map<string, Attempt>();
  private readonly responses = new Map<string, StoredResponse>();
  private readonly settings = new Map<string, SettingRecord>();

  async putAttempt(attempt: Attempt): Promise<void> {
    this.attempts.set(attempt.id, attempt);
  }

  async getAttempt(id: string): Promise<Attempt | undefined> {
    return this.attempts.get(id);
  }

  async getAllAttempts(): Promise<Attempt[]> {
    return [...this.attempts.values()].sort((a, b) => a.startedAt - b.startedAt);
  }

  async deleteAttempt(id: string): Promise<void> {
    this.attempts.delete(id);
  }

  async putResponses(responses: StoredResponse[]): Promise<void> {
    for (const response of responses) this.responses.set(response.id, response);
  }

  async deleteResponsesForAttempt(attemptId: string): Promise<void> {
    for (const [key, response] of this.responses) {
      if (response.attemptId === attemptId) this.responses.delete(key);
    }
  }

  async getResponsesForQuestion(questionId: string): Promise<StoredResponse[]> {
    return [...this.responses.values()].filter(
      (response) => response.questionId === questionId,
    );
  }

  async getAllResponses(): Promise<StoredResponse[]> {
    return [...this.responses.values()];
  }

  async getSettingRecords(): Promise<SettingRecord[]> {
    return [...this.settings.values()];
  }

  async putSettingRecord(record: SettingRecord): Promise<void> {
    this.settings.set(record.key, record);
  }

  async clearAll(): Promise<void> {
    this.attempts.clear();
    this.responses.clear();
    this.settings.clear();
  }
}

let backendPromise: Promise<Backend> | null = null;

async function createBackend(): Promise<Backend> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    // Static build / SSR pass. Not a degraded state - there is no user here to warn.
    return new MemoryBackend();
  }

  try {
    const db = await openDB<KnpcSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('attempts')) {
          const attempts = database.createObjectStore('attempts', { keyPath: 'id' });
          attempts.createIndex('by-startedAt', 'startedAt');
        }
        if (!database.objectStoreNames.contains('responses')) {
          const responses = database.createObjectStore('responses', { keyPath: 'id' });
          responses.createIndex('by-questionId', 'questionId');
          responses.createIndex('by-attemptId', 'attemptId');
        }
        if (!database.objectStoreNames.contains('settings')) {
          database.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
    setStatus({ mode: 'indexeddb', degraded: false, reason: null });
    return new IdbBackend(db);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[db] IndexedDB unavailable (${reason}). Falling back to in-memory storage: history will not be saved.`,
    );
    setStatus({
      mode: 'memory',
      degraded: true,
      reason: 'IndexedDB is unavailable in this browser session.',
    });
    return new MemoryBackend();
  }
}

function getBackend(): Promise<Backend> {
  if (typeof window === 'undefined') {
    // Never cache the SSR backend - the browser must get a real attempt at IndexedDB.
    return createBackend();
  }
  if (!backendPromise) backendPromise = createBackend();
  return backendPromise;
}

/**
 * Opens the database (or the fallback) and reports what the app actually got. Call this
 * once on mount and surface `degraded` to the user.
 */
export async function ensureStorageReady(): Promise<StorageStatus> {
  await getBackend();
  return status;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function toStoredResponses(attempt: Attempt): StoredResponse[] {
  return attempt.responses.map((response) => ({
    ...response,
    id: responseKey(attempt.id, response.questionId),
    attemptId: attempt.id,
    attemptStartedAt: attempt.startedAt,
  }));
}

/** Writes the attempt and fans its responses out into the responses index. Idempotent. */
export async function saveAttempt(attempt: Attempt): Promise<void> {
  const backend = await getBackend();
  await backend.putAttempt(attempt);
  await backend.deleteResponsesForAttempt(attempt.id);
  await backend.putResponses(toStoredResponses(attempt));
}

export async function getAttempt(id: string): Promise<Attempt | undefined> {
  const backend = await getBackend();
  return backend.getAttempt(id);
}

export interface ListAttemptsOptions {
  limit?: number;
  offset?: number;
}

/** Newest first. */
export async function listAttempts(
  options: ListAttemptsOptions = {},
): Promise<Attempt[]> {
  const backend = await getBackend();
  const all = await backend.getAllAttempts();
  const newestFirst = all.sort((a, b) => b.startedAt - a.startedAt);
  const offset = Math.max(0, options.offset ?? 0);
  const limit = options.limit ?? newestFirst.length;
  return newestFirst.slice(offset, offset + limit);
}

export async function countAttempts(): Promise<number> {
  const backend = await getBackend();
  const all = await backend.getAllAttempts();
  return all.length;
}

export async function deleteAttempt(id: string): Promise<void> {
  const backend = await getBackend();
  await backend.deleteAttempt(id);
  await backend.deleteResponsesForAttempt(id);
}

export async function clearAll(): Promise<void> {
  const backend = await getBackend();
  await backend.clearAll();
}

/** Every time this question has ever been answered, across all attempts. */
export async function getResponsesForQuestion(
  questionId: string,
): Promise<StoredResponse[]> {
  const backend = await getBackend();
  const responses = await backend.getResponsesForQuestion(questionId);
  return responses.sort((a, b) => b.attemptStartedAt - a.attemptStartedAt);
}

export async function getAllResponses(): Promise<StoredResponse[]> {
  const backend = await getBackend();
  return backend.getAllResponses();
}

export async function getAllAttempts(): Promise<Attempt[]> {
  const backend = await getBackend();
  const all = await backend.getAllAttempts();
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Ids answered wrong at least once. A skip is not a miss, and neither is a written answer the
 * user has not self-graded yet: nobody has judged it, so it cannot have been judged wrong.
 * Most recently missed first.
 */
export async function getMissedQuestionIds(
  lookup: (id: string) => Question | undefined = getQuestionById,
): Promise<string[]> {
  const responses = await getAllResponses();
  const lastMissedAt = new Map<string, number>();
  for (const response of responses) {
    if (response.skipped || response.correct) continue;
    if (isUngraded(lookup(response.questionId), response)) continue;
    const previous = lastMissedAt.get(response.questionId) ?? 0;
    if (response.attemptStartedAt > previous) {
      lastMissedAt.set(response.questionId, response.attemptStartedAt);
    }
  }
  return [...lastMissedAt.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([questionId]) => questionId);
}

export async function getSettings(): Promise<Settings> {
  const backend = await getBackend();
  const records = await backend.getSettingRecords();
  const settings: Settings = { ...DEFAULT_SETTINGS };
  for (const record of records) {
    if (!isSettingsKey(record.key)) continue;
    const value = coerceSetting(record.key, record.value);
    if (value === undefined) continue;
    assignSetting(settings, record.key, value);
  }
  return settings;
}

/** Narrow per-key assignment, so the union of value types never widens. */
function assignSetting(
  settings: Settings,
  key: SettingsKey,
  value: SettingsValue,
): void {
  switch (key) {
    case 'defaultTiers':
      if (isTierArray(value)) settings.defaultTiers = value;
      return;
    case 'shuffleOptions':
      if (typeof value === 'boolean') settings.shuffleOptions = value;
      return;
    case 'mockCount':
      if (typeof value === 'number') settings.mockCount = value;
      return;
    case 'practiceCount':
      if (typeof value === 'number') settings.practiceCount = value;
      return;
    case 'drillCount':
      if (typeof value === 'number') settings.drillCount = value;
      return;
    case 'mockTimeLimitSec':
      if (value === null || typeof value === 'number') settings.mockTimeLimitSec = value;
      return;
  }
}

export async function setSetting<K extends SettingsKey>(
  key: K,
  value: Settings[K],
): Promise<void> {
  const backend = await getBackend();
  await backend.putSettingRecord({ key, value });
}

export async function replaceSettings(settings: Partial<Settings>): Promise<void> {
  const backend = await getBackend();
  for (const key of SETTINGS_KEYS) {
    const value = settings[key];
    if (value === undefined) continue;
    const coerced = coerceSetting(key, value);
    if (coerced === undefined) continue;
    await backend.putSettingRecord({ key, value: coerced });
  }
}
