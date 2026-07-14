import type {
  Attempt,
  Question,
  QuizConfig,
  QuizMode,
  Response,
} from '@/lib/types';

// A pure reducer. No IndexedDB, no React, no Date.now - every action carries the time it
// needs, so a session replays identically and the whole thing is trivially testable.

export type QuizStatus = 'active' | 'submitted';

export interface QuizState {
  attemptId: string;
  mode: QuizMode;
  config: QuizConfig;
  questions: Question[];
  index: number;
  /** Index-aligned with `questions`. Always the same length. */
  responses: Response[];
  startedAt: number;
  finishedAt: number | null;
  elapsedSec: number;
  /** null when the attempt is untimed. Never goes below zero. */
  remainingSec: number | null;
  status: QuizStatus;
}

export type QuizAction =
  /** Pick an option. Single-answer questions replace; multi-answer questions toggle. */
  | { type: 'answer'; label: string }
  /** Free text for a short_answer / worked_problem item. */
  | { type: 'setText'; text: string }
  /** The user's own verdict on a free-text item. We never auto-grade free text. */
  | { type: 'selfGrade'; correct: boolean }
  /** Reveal a practice-mode answer without picking (also what a "show answer" button fires). */
  | { type: 'reveal' }
  | { type: 'skip' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'jumpTo'; index: number }
  /** Advance the clock. Charges the time to the question currently on screen. */
  | { type: 'tick'; deltaSec: number }
  | { type: 'submit' };

export function isFreeText(question: Question): boolean {
  return question.type === 'short_answer' || question.type === 'worked_problem';
}

/**
 * Free text is never auto-graded, and a mock reveals nothing until submit - so a worked_problem
 * the user genuinely wrote out arrives at the results screen judged by nobody. `correct: false`
 * on such a response is the ABSENCE of a verdict, not a verdict of "wrong".
 *
 * This is the single definition of that state. Everything that scores a response - the results
 * verdict, the miss queue, topic stats, readiness - must ask this before reading `correct`, or
 * the app punishes the user for work it never marked.
 *
 * `question` is optional because the bank can be replaced under a stored attempt.
 */
export function isUngraded(
  question: Question | undefined,
  response: Response,
): boolean {
  if (response.skipped) return false;
  if (!question || !isFreeText(question)) return false;
  return response.selfGraded !== true;
}

export function isMultiSelect(question: Question): boolean {
  return question.answerOptionLabels.length > 1;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const right = new Set(b);
  return a.every((entry) => right.has(entry));
}

function emptyResponse(question: Question): Response {
  return {
    questionId: question.id,
    selected: [],
    correct: false,
    skipped: false,
    timeSpentSec: 0,
  };
}

export interface CreateQuizInput {
  attemptId: string;
  config: QuizConfig;
  questions: Question[];
  startedAt: number;
}

export function createQuizState(input: CreateQuizInput): QuizState {
  return {
    attemptId: input.attemptId,
    mode: input.config.mode,
    config: input.config,
    questions: input.questions,
    index: 0,
    responses: input.questions.map(emptyResponse),
    startedAt: input.startedAt,
    finishedAt: null,
    elapsedSec: 0,
    remainingSec: input.config.timeLimitSec,
    status: 'active',
  };
}

/** Wall-clock time derived from the session clock, so the reducer stays pure. */
function nowMs(state: QuizState): number {
  return state.startedAt + state.elapsedSec * 1000;
}

/** Mock mode holds everything back until submit. Practice and drill reveal as you go. */
function revealsImmediately(mode: QuizMode): boolean {
  return mode !== 'mock';
}

function replaceResponse(
  state: QuizState,
  index: number,
  next: Response,
): Response[] {
  const responses = state.responses.slice();
  responses[index] = next;
  return responses;
}

function finish(state: QuizState): QuizState {
  const finishedAt = nowMs(state);
  const responses = state.responses.map((response) => {
    // Typed-but-ungraded free text is engaged, not skipped. A mock never reveals, so the
    // user cannot self-grade a worked_problem until the results screen - marking it skipped
    // here would bury real work as a non-answer and keep it out of the miss queue.
    const wroteSomething =
      response.text !== undefined && response.text.trim().length > 0;
    const answered =
      response.selected.length > 0 || Boolean(response.selfGraded) || wroteSomething;
    return {
      ...response,
      // An explicit Skip stands. The rescue above is for the killed-tab and timer-expiry
      // cases, where nobody ever declared anything: it must not overrule a user who jotted
      // half a thought, decided they did not know it, and tapped Skip.
      skipped: response.skipped || !answered,
      revealedAt: response.revealedAt ?? finishedAt,
    };
  });

  return {
    ...state,
    responses,
    status: 'submitted',
    finishedAt,
    remainingSec: state.remainingSec === null ? null : 0,
  };
}

/**
 * A submitted attempt is frozen, with two exceptions: `jumpTo` (so review navigation still
 * works) and `selfGrade` (free text is never auto-graded, and in a mock the answer is not
 * revealed until submit - so post-submit is the only moment it *can* be graded).
 */
const POST_SUBMIT_ACTIONS: readonly QuizAction['type'][] = ['jumpTo', 'selfGrade'];

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  if (state.status === 'submitted' && !POST_SUBMIT_ACTIONS.includes(action.type)) {
    return state;
  }

  const question: Question | undefined = state.questions[state.index];
  const current: Response | undefined = state.responses[state.index];

  switch (action.type) {
    case 'answer': {
      if (!question || !current) return state;
      if (isFreeText(question)) return state;
      // In practice mode an answered question is locked once revealed.
      if (revealsImmediately(state.mode) && current.revealedAt !== undefined) return state;

      const selected = isMultiSelect(question)
        ? current.selected.includes(action.label)
          ? current.selected.filter((label) => label !== action.label)
          : [...current.selected, action.label]
        : [action.label];

      const next: Response = {
        ...current,
        selected,
        correct: sameSet(selected, question.answerOptionLabels),
        skipped: false,
      };

      // Multi-select in practice mode should not reveal on the first tick of a two-part
      // answer, so it only reveals once the pick count matches the key.
      const shouldReveal =
        revealsImmediately(state.mode) &&
        selected.length === question.answerOptionLabels.length;
      if (shouldReveal) next.revealedAt = nowMs(state);

      return { ...state, responses: replaceResponse(state, state.index, next) };
    }

    case 'setText': {
      if (!question || !current) return state;
      if (!isFreeText(question)) return state;
      return {
        ...state,
        responses: replaceResponse(state, state.index, {
          ...current,
          text: action.text,
          skipped: false,
        }),
      };
    }

    case 'selfGrade': {
      if (!question || !current) return state;
      if (!isFreeText(question)) return state;
      return {
        ...state,
        responses: replaceResponse(state, state.index, {
          ...current,
          correct: action.correct,
          selfGraded: true,
          skipped: false,
          revealedAt: current.revealedAt ?? nowMs(state),
        }),
      };
    }

    case 'reveal': {
      if (!question || !current) return state;
      if (!revealsImmediately(state.mode)) return state;
      if (current.revealedAt !== undefined) return state;
      return {
        ...state,
        responses: replaceResponse(state, state.index, {
          ...current,
          revealedAt: nowMs(state),
        }),
      };
    }

    case 'skip': {
      if (!question || !current) return state;
      const next: Response = {
        ...current,
        selected: [],
        correct: false,
        skipped: true,
      };
      const responses = replaceResponse(state, state.index, next);
      const index = Math.min(state.index + 1, state.questions.length - 1);
      return { ...state, responses, index };
    }

    case 'next': {
      if (state.index >= state.questions.length - 1) return state;
      return { ...state, index: state.index + 1 };
    }

    case 'prev': {
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };
    }

    case 'jumpTo': {
      if (action.index < 0 || action.index >= state.questions.length) return state;
      return { ...state, index: action.index };
    }

    case 'tick': {
      if (action.deltaSec <= 0) return state;

      const elapsedSec = state.elapsedSec + action.deltaSec;
      const responses = current
        ? replaceResponse(state, state.index, {
            ...current,
            timeSpentSec: current.timeSpentSec + action.deltaSec,
          })
        : state.responses;

      const remainingSec =
        state.remainingSec === null
          ? null
          : Math.max(0, state.remainingSec - action.deltaSec);

      const ticked: QuizState = { ...state, elapsedSec, responses, remainingSec };

      // Time up. Auto-submit; whatever is unanswered counts as skipped.
      if (remainingSec === 0) return finish(ticked);
      return ticked;
    }

    case 'submit':
      return finish(state);
  }
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function currentQuestion(state: QuizState): Question | undefined {
  return state.questions[state.index];
}

export function currentResponse(state: QuizState): Response | undefined {
  return state.responses[state.index];
}

/** Whether the answer to question `index` is visible to the user right now. */
export function isRevealed(state: QuizState, index: number): boolean {
  if (state.status === 'submitted') return true;
  if (!revealsImmediately(state.mode)) return false;
  return state.responses[index]?.revealedAt !== undefined;
}

/** Answered means "engaged with", so a self-graded free-text item counts. Skips do not. */
export function isAnswered(state: QuizState, index: number): boolean {
  const response = state.responses[index];
  if (!response || response.skipped) return false;
  return response.selected.length > 0 || response.selfGraded === true;
}

export function answeredCount(state: QuizState): number {
  return state.responses.reduce(
    (total, _response, index) => total + (isAnswered(state, index) ? 1 : 0),
    0,
  );
}

export function scoreOf(responses: readonly Response[]): number {
  return responses.filter((response) => response.correct).length;
}

export function progress(state: QuizState): {
  index: number;
  total: number;
  answered: number;
  ratio: number;
} {
  const total = state.questions.length;
  const answered = answeredCount(state);
  return {
    index: state.index,
    total,
    answered,
    ratio: total === 0 ? 0 : answered / total,
  };
}

/** The persistable record. Call after `submit`; `finishedAt` is null on an abandoned session. */
export function toAttempt(state: QuizState): Attempt {
  const durationSec =
    state.finishedAt === null
      ? Math.round(state.elapsedSec)
      : Math.round((state.finishedAt - state.startedAt) / 1000);

  return {
    id: state.attemptId,
    mode: state.mode,
    config: state.config,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    questionIds: state.questions.map((question) => question.id),
    responses: state.responses,
    score: scoreOf(state.responses),
    total: state.questions.length,
    durationSec,
  };
}
