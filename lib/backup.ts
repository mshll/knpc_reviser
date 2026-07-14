import {
  DEFAULT_SETTINGS,
  getAllAttempts,
  getAllResponses,
  getAttempt,
  getSettings,
  replaceSettings,
  saveAttempt,
  type Settings,
  type StoredResponse,
} from '@/lib/db';
import {
  QUIZ_MODES,
  SOURCE_TIERS,
  TOPICS,
  type Attempt,
  type QuizConfig,
  type QuizMode,
  type Response,
  type SourceTier,
  type Topic,
} from '@/lib/types';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  attempts: Attempt[];
  responses: StoredResponse[];
  settings: Settings;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface ImportResult {
  attemptsAdded: number;
  /** Attempts already present under the same id. Never overwritten. */
  attemptsSkipped: number;
  responsesAdded: number;
  settingsApplied: boolean;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function buildBackup(): Promise<BackupFile> {
  const [attempts, responses, settings] = await Promise.all([
    getAllAttempts(),
    getAllResponses(),
    getSettings(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    attempts,
    responses,
    settings,
  };
}

export function backupFilename(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `knpc-reviser-backup-${stamp}.json`;
}

/** Serializes everything and hands the browser a download. Browser-only. */
export async function exportBackup(): Promise<{ filename: string; backup: BackupFile }> {
  if (typeof window === 'undefined') {
    throw new BackupError('exportBackup can only run in the browser.');
  }

  const backup = await buildBackup();
  const filename = backupFilename();
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  return { filename, backup };
}

// ---------------------------------------------------------------------------
// Import. Validate the whole file before touching storage - never half-import.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMemberOf<T extends string>(
  value: unknown,
  members: readonly T[],
): value is T {
  return typeof value === 'string' && (members as readonly string[]).includes(value);
}

function parseStringArray(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) throw new BackupError(`${what} is not an array.`);
  return value.map((entry) => {
    if (typeof entry !== 'string') throw new BackupError(`${what} holds a non-string.`);
    return entry;
  });
}

function parseConfig(value: unknown, what: string): QuizConfig {
  if (!isRecord(value)) throw new BackupError(`${what} is missing its config.`);
  if (!isMemberOf<QuizMode>(value.mode, QUIZ_MODES)) {
    throw new BackupError(`${what} has an unknown mode.`);
  }

  let topics: Topic[] | 'all';
  if (value.topics === 'all') {
    topics = 'all';
  } else if (Array.isArray(value.topics)) {
    topics = value.topics.map((entry) => {
      if (!isMemberOf<Topic>(entry, TOPICS)) {
        throw new BackupError(`${what} has an unknown topic.`);
      }
      return entry;
    });
  } else {
    throw new BackupError(`${what} has a malformed topic list.`);
  }

  if (!Array.isArray(value.tiers)) throw new BackupError(`${what} has a malformed tier list.`);
  const tiers: SourceTier[] = value.tiers.map((entry) => {
    if (!isMemberOf<SourceTier>(entry, SOURCE_TIERS)) {
      throw new BackupError(`${what} has an unknown source tier.`);
    }
    return entry;
  });

  if (typeof value.count !== 'number') throw new BackupError(`${what} has a bad count.`);
  if (value.timeLimitSec !== null && typeof value.timeLimitSec !== 'number') {
    throw new BackupError(`${what} has a bad time limit.`);
  }
  if (typeof value.onlyMissed !== 'boolean') {
    throw new BackupError(`${what} has a bad onlyMissed.`);
  }
  if (typeof value.shuffleOptions !== 'boolean') {
    throw new BackupError(`${what} has a bad shuffleOptions.`);
  }

  // A backup taken before unverified items left the bank still carries `includeUnverified`.
  // It is read past, not rejected: the export is a record of attempts the user really sat.
  return {
    mode: value.mode,
    topics,
    tiers,
    count: value.count,
    timeLimitSec: value.timeLimitSec,
    onlyMissed: value.onlyMissed,
    shuffleOptions: value.shuffleOptions,
  };
}

function parseResponse(value: unknown, what: string): Response {
  if (!isRecord(value)) throw new BackupError(`${what} holds a malformed response.`);
  if (typeof value.questionId !== 'string') {
    throw new BackupError(`${what} has a response with no questionId.`);
  }
  if (typeof value.correct !== 'boolean' || typeof value.skipped !== 'boolean') {
    throw new BackupError(`${what} has a response with a bad grade.`);
  }
  if (typeof value.timeSpentSec !== 'number') {
    throw new BackupError(`${what} has a response with a bad timeSpentSec.`);
  }

  const response: Response = {
    questionId: value.questionId,
    selected: parseStringArray(value.selected, `${what} response.selected`),
    correct: value.correct,
    skipped: value.skipped,
    timeSpentSec: value.timeSpentSec,
  };
  if (typeof value.revealedAt === 'number') response.revealedAt = value.revealedAt;
  if (typeof value.text === 'string') response.text = value.text;
  if (typeof value.selfGraded === 'boolean') response.selfGraded = value.selfGraded;
  return response;
}

function parseAttempt(value: unknown, index: number): Attempt {
  const what = `attempt ${index}`;
  if (!isRecord(value)) throw new BackupError(`${what} is not an object.`);
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new BackupError(`${what} has no id.`);
  }
  if (!isMemberOf<QuizMode>(value.mode, QUIZ_MODES)) {
    throw new BackupError(`${what} has an unknown mode.`);
  }
  if (typeof value.startedAt !== 'number') throw new BackupError(`${what} has a bad startedAt.`);
  if (value.finishedAt !== null && typeof value.finishedAt !== 'number') {
    throw new BackupError(`${what} has a bad finishedAt.`);
  }
  if (typeof value.score !== 'number' || typeof value.total !== 'number') {
    throw new BackupError(`${what} has a bad score.`);
  }
  if (typeof value.durationSec !== 'number') {
    throw new BackupError(`${what} has a bad durationSec.`);
  }
  if (!Array.isArray(value.responses)) {
    throw new BackupError(`${what} has no responses array.`);
  }

  return {
    id: value.id,
    mode: value.mode,
    config: parseConfig(value.config, what),
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    questionIds: parseStringArray(value.questionIds, `${what} questionIds`),
    responses: value.responses.map((entry) => parseResponse(entry, what)),
    score: value.score,
    total: value.total,
    durationSec: value.durationSec,
  };
}

function parseSettings(value: unknown): Settings {
  if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
  if (!isRecord(value)) throw new BackupError('The settings block is malformed.');

  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (Array.isArray(value.defaultTiers)) {
    settings.defaultTiers = value.defaultTiers.map((entry) => {
      if (!isMemberOf<SourceTier>(entry, SOURCE_TIERS)) {
        throw new BackupError('The settings block has an unknown source tier.');
      }
      return entry;
    });
  }
  if (typeof value.shuffleOptions === 'boolean') {
    settings.shuffleOptions = value.shuffleOptions;
  }
  if (typeof value.mockCount === 'number') settings.mockCount = value.mockCount;
  if (typeof value.practiceCount === 'number') settings.practiceCount = value.practiceCount;
  if (typeof value.drillCount === 'number') settings.drillCount = value.drillCount;
  if (value.mockTimeLimitSec === null || typeof value.mockTimeLimitSec === 'number') {
    settings.mockTimeLimitSec = value.mockTimeLimitSec;
  }
  return settings;
}

/** Throws BackupError on anything malformed. Nothing is written until this returns. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new BackupError(`That file is not valid JSON. ${detail}`);
  }

  if (!isRecord(raw)) throw new BackupError('That file is not a KNPC Reviser backup.');
  if (typeof raw.version !== 'number') {
    throw new BackupError('That file has no backup version.');
  }
  if (raw.version !== BACKUP_VERSION) {
    throw new BackupError(
      `That backup is version ${raw.version}. This app reads version ${BACKUP_VERSION}.`,
    );
  }
  if (!Array.isArray(raw.attempts)) {
    throw new BackupError('That backup has no attempts array.');
  }

  const attempts = raw.attempts.map((entry, index) => parseAttempt(entry, index));
  const ids = new Set<string>();
  for (const attempt of attempts) {
    if (ids.has(attempt.id)) {
      throw new BackupError(`That backup contains attempt id "${attempt.id}" twice.`);
    }
    ids.add(attempt.id);
  }

  return {
    version: raw.version,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    attempts,
    // Responses are rebuilt from each attempt on write, so a missing or stale
    // responses block in the file is not fatal.
    responses: [],
    settings: parseSettings(raw.settings),
  };
}

/**
 * Merges a backup into the local database. Attempts already present under the same id are
 * left alone, never clobbered. The file is fully validated before a single write happens,
 * so a malformed file cannot leave storage half-imported.
 */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text();
  const backup = parseBackup(text);

  let attemptsAdded = 0;
  let attemptsSkipped = 0;
  let responsesAdded = 0;

  for (const attempt of backup.attempts) {
    const existing = await getAttempt(attempt.id);
    if (existing) {
      attemptsSkipped += 1;
      continue;
    }
    await saveAttempt(attempt);
    attemptsAdded += 1;
    responsesAdded += attempt.responses.length;
  }

  await replaceSettings(backup.settings);

  return {
    attemptsAdded,
    attemptsSkipped,
    responsesAdded,
    settingsApplied: true,
  };
}
