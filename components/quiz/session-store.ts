import { orderedOptions, servableQuestionsByIds } from '@/lib/questions';
import { createQuizState, type QuizState } from '@/lib/quiz';
import {
  QUIZ_MODES,
  SOURCE_TIERS,
  TOPICS,
  type QuizConfig,
  type Response,
  type SourceTier,
  type Topic,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Crash safety. The in-progress session mirrors into localStorage on every
// state change, so a killed tab mid-mock costs nothing: the quiz route offers
// to resume from exactly where the state was last written.
//
// localStorage over IndexedDB on purpose: writes are synchronous (they cannot
// lose a race with tab teardown) and the payload is tiny.
// ---------------------------------------------------------------------------

export const SESSION_STORAGE_KEY = 'knpc-reviser:active-session:v1';

export interface StoredSession {
  version: 1;
  attemptId: string;
  config: QuizConfig;
  questionIds: string[];
  /** Index-aligned with `questionIds`. */
  responses: Response[];
  index: number;
  startedAt: number;
  elapsedSec: number;
  /** Epoch ms at which the timer hits zero. The wall clock keeps running through a screen lock. */
  deadlineAt: number | null;
  savedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isConfig(value: unknown): value is QuizConfig {
  if (!isRecord(value)) return false;
  if (!QUIZ_MODES.includes(value.mode as (typeof QUIZ_MODES)[number])) return false;
  const topicsOk =
    value.topics === 'all' ||
    (Array.isArray(value.topics) &&
      value.topics.every((topic) => TOPICS.includes(topic as Topic)));
  if (!topicsOk) return false;
  if (
    !Array.isArray(value.tiers) ||
    !value.tiers.every((tier) => SOURCE_TIERS.includes(tier as SourceTier))
  ) {
    return false;
  }
  if (typeof value.count !== 'number') return false;
  if (value.timeLimitSec !== null && typeof value.timeLimitSec !== 'number') return false;
  // A session stored before unverified items left the bank still carries `includeUnverified`.
  // The extra key is ignored rather than rejected, so an in-flight quiz still resumes.
  if (typeof value.onlyMissed !== 'boolean') return false;
  if (typeof value.shuffleOptions !== 'boolean') return false;
  return true;
}

function isResponse(value: unknown): value is Response {
  if (!isRecord(value)) return false;
  if (typeof value.questionId !== 'string') return false;
  if (!isStringArray(value.selected)) return false;
  if (typeof value.correct !== 'boolean') return false;
  if (typeof value.skipped !== 'boolean') return false;
  if (typeof value.timeSpentSec !== 'number') return false;
  return true;
}

function parseStoredSession(raw: string): StoredSession | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (value.version !== 1) return null;
  if (typeof value.attemptId !== 'string' || value.attemptId.length === 0) return null;
  if (!isConfig(value.config)) return null;
  if (!isStringArray(value.questionIds) || value.questionIds.length === 0) return null;
  if (!Array.isArray(value.responses) || !value.responses.every(isResponse)) return null;
  if (value.responses.length !== value.questionIds.length) return null;
  if (typeof value.index !== 'number') return null;
  if (typeof value.startedAt !== 'number') return null;
  if (typeof value.elapsedSec !== 'number') return null;
  if (value.deadlineAt !== null && typeof value.deadlineAt !== 'number') return null;
  if (typeof value.savedAt !== 'number') return null;

  return {
    version: 1,
    attemptId: value.attemptId,
    config: value.config,
    questionIds: value.questionIds,
    responses: value.responses,
    index: value.index,
    startedAt: value.startedAt,
    elapsedSec: value.elapsedSec,
    deadlineAt: value.deadlineAt,
    savedAt: value.savedAt,
  };
}

export function saveSession(state: QuizState, deadlineAt: number | null): void {
  if (typeof window === 'undefined') return;
  const session: StoredSession = {
    version: 1,
    attemptId: state.attemptId,
    config: state.config,
    questionIds: state.questions.map((question) => question.id),
    responses: state.responses,
    index: state.index,
    startedAt: state.startedAt,
    elapsedSec: state.elapsedSec,
    deadlineAt,
    savedAt: Date.now(),
  };
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    // Quota or privacy mode. The quiz still works; only crash recovery is lost.
    console.warn('[quiz] could not persist the in-progress session:', error);
  }
}

export function loadSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = parseStoredSession(raw);
    if (!session) clearSession();
    return session;
  } catch (error) {
    console.warn('[quiz] could not read the stored session:', error);
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn('[quiz] could not clear the stored session:', error);
  }
}

/** Seconds left on a stored timed session right now, or null when untimed. */
export function sessionRemainingSec(session: StoredSession): number | null {
  if (session.deadlineAt === null) return null;
  return Math.max(0, Math.ceil((session.deadlineAt - Date.now()) / 1000));
}

/**
 * Rebuilds a live QuizState from a stored session. Returns null when the servable pool no
 * longer holds every question the session was sat with, in which case the session is
 * unrecoverable and the quiz route offers a fresh start.
 *
 * The lookup is deliberately the SERVABLE pool, not the whole bank: a session saved before the
 * free-response items were quarantined still names them, and resuming it would put a question
 * the app cannot mark back in front of the user.
 */
export function restoreQuizState(session: StoredSession): QuizState | null {
  const bankQuestions = servableQuestionsByIds(session.questionIds);
  if (bankQuestions.length !== session.questionIds.length) return null;

  for (let i = 0; i < session.responses.length; i++) {
    if (session.responses[i].questionId !== session.questionIds[i]) return null;
  }

  const questions = bankQuestions.map((question) => {
    if (!session.config.shuffleOptions) return question;
    const options = orderedOptions(question, session.attemptId, true);
    return options === question.options ? question : { ...question, options };
  });

  const remainingSec = sessionRemainingSec(session);
  const elapsedSec =
    session.config.timeLimitSec !== null && remainingSec !== null
      ? session.config.timeLimitSec - remainingSec
      : session.elapsedSec;

  return {
    ...createQuizState({
      attemptId: session.attemptId,
      config: session.config,
      questions,
      startedAt: session.startedAt,
    }),
    index: Math.min(Math.max(session.index, 0), questions.length - 1),
    responses: session.responses,
    elapsedSec,
    remainingSec,
  };
}
