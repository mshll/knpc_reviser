import { describe, expect, test } from 'bun:test';

import {
  answeredCount,
  createQuizState,
  isRevealed,
  isUngraded,
  quizReducer,
  toAttempt,
  type QuizState,
} from '@/lib/quiz';
import type { Question, QuizConfig, QuizMode } from '@/lib/types';

const START = 1_700_000_000_000;

function mcq(id: string, answers: string[] = ['A']): Question {
  const labels = ['A', 'B', 'C', 'D'];
  return {
    id,
    type: 'mcq',
    topic: 'networking',
    stem: `Stem ${id}`,
    options: labels.map((label) => ({
      label,
      text: `Option ${label}`,
      isCorrect: answers.includes(label),
    })),
    answerOptionLabels: answers,
    source: { file: 'test', exam: 'KNPC', tier: 'gold' },
    keyProvenance: 'inline_bold',
    keyVerified: true,
    verificationLevel: 'double',
    needsReview: false,
    flags: [],
    dedupeHash: id,
  };
}

function freeText(id: string): Question {
  return {
    id,
    type: 'worked_problem',
    topic: 'networking',
    stem: `Stem ${id}`,
    options: [],
    answerOptionLabels: [],
    answerText: '62 usable hosts',
    source: { file: 'test', exam: 'KNPC', tier: 'gold' },
    keyProvenance: 'answer_page',
    keyVerified: true,
    verificationLevel: 'double',
    needsReview: false,
    flags: [],
    dedupeHash: id,
  };
}

function config(mode: QuizMode, overrides: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode,
    topics: 'all',
    tiers: ['gold', 'practice'],
    count: 10,
    timeLimitSec: null,
    onlyMissed: false,
    shuffleOptions: false,
    ...overrides,
  };
}

function state(mode: QuizMode, questions: Question[], overrides: Partial<QuizConfig> = {}): QuizState {
  return createQuizState({
    attemptId: 'attempt-1',
    config: config(mode, overrides),
    questions,
    startedAt: START,
  });
}

describe('createQuizState', () => {
  test('seeds one response per question', () => {
    const initial = state('practice', [mcq('q1'), mcq('q2')]);
    expect(initial.responses).toHaveLength(2);
    expect(initial.responses[0].questionId).toBe('q1');
    expect(initial.responses[0].selected).toEqual([]);
    expect(initial.status).toBe('active');
    expect(initial.remainingSec).toBeNull();
  });

  test('carries the time limit through', () => {
    const initial = state('mock', [mcq('q1')], { timeLimitSec: 600 });
    expect(initial.remainingSec).toBe(600);
  });
});

describe('answer', () => {
  test('grades a correct single pick', () => {
    const next = quizReducer(state('practice', [mcq('q1', ['B'])]), {
      type: 'answer',
      label: 'B',
    });
    expect(next.responses[0].selected).toEqual(['B']);
    expect(next.responses[0].correct).toBe(true);
    expect(next.responses[0].skipped).toBe(false);
  });

  test('grades a wrong single pick', () => {
    const next = quizReducer(state('practice', [mcq('q1', ['B'])]), {
      type: 'answer',
      label: 'C',
    });
    expect(next.responses[0].correct).toBe(false);
  });

  test('a single-answer pick replaces the previous one', () => {
    let next = quizReducer(state('mock', [mcq('q1', ['B'])]), { type: 'answer', label: 'A' });
    next = quizReducer(next, { type: 'answer', label: 'C' });
    expect(next.responses[0].selected).toEqual(['C']);
  });

  test('a multi-answer pick toggles, and is only correct on the exact set', () => {
    let next = quizReducer(state('mock', [mcq('q1', ['A', 'C'])]), {
      type: 'answer',
      label: 'A',
    });
    expect(next.responses[0].correct).toBe(false);

    next = quizReducer(next, { type: 'answer', label: 'C' });
    expect(next.responses[0].selected).toEqual(['A', 'C']);
    expect(next.responses[0].correct).toBe(true);

    next = quizReducer(next, { type: 'answer', label: 'A' });
    expect(next.responses[0].selected).toEqual(['C']);
    expect(next.responses[0].correct).toBe(false);
  });

  test('practice mode reveals immediately; mock mode does not', () => {
    const practice = quizReducer(state('practice', [mcq('q1')]), {
      type: 'answer',
      label: 'A',
    });
    expect(practice.responses[0].revealedAt).toBeDefined();
    expect(isRevealed(practice, 0)).toBe(true);

    const mock = quizReducer(state('mock', [mcq('q1')]), { type: 'answer', label: 'A' });
    expect(mock.responses[0].revealedAt).toBeUndefined();
    expect(isRevealed(mock, 0)).toBe(false);
  });

  test('a revealed practice answer is locked', () => {
    let next = quizReducer(state('practice', [mcq('q1', ['B'])]), {
      type: 'answer',
      label: 'A',
    });
    next = quizReducer(next, { type: 'answer', label: 'B' });
    expect(next.responses[0].selected).toEqual(['A']);
    expect(next.responses[0].correct).toBe(false);
  });

  test('a mock answer can be changed right up to submit', () => {
    let next = quizReducer(state('mock', [mcq('q1', ['B'])]), { type: 'answer', label: 'A' });
    next = quizReducer(next, { type: 'answer', label: 'B' });
    expect(next.responses[0].correct).toBe(true);
  });

  test('answering does nothing on a free-text question', () => {
    const next = quizReducer(state('practice', [freeText('q1')]), {
      type: 'answer',
      label: 'A',
    });
    expect(next.responses[0].selected).toEqual([]);
  });
});

describe('free text', () => {
  test('setText stores the text and selfGrade records the user verdict', () => {
    let next = quizReducer(state('practice', [freeText('q1')]), {
      type: 'setText',
      text: '62 hosts',
    });
    expect(next.responses[0].text).toBe('62 hosts');
    expect(next.responses[0].correct).toBe(false);
    expect(next.responses[0].selfGraded).toBeUndefined();

    next = quizReducer(next, { type: 'selfGrade', correct: true });
    expect(next.responses[0].correct).toBe(true);
    expect(next.responses[0].selfGraded).toBe(true);
    expect(next.responses[0].revealedAt).toBeDefined();
  });

  test('a self-graded free-text item counts as answered', () => {
    let next = quizReducer(state('practice', [freeText('q1')]), {
      type: 'selfGrade',
      correct: false,
    });
    expect(answeredCount(next)).toBe(1);
    expect(next.responses[0].correct).toBe(false);
    next = quizReducer(next, { type: 'submit' });
    expect(next.responses[0].skipped).toBe(false);
  });
});

describe('navigation', () => {
  const questions = [mcq('q1'), mcq('q2'), mcq('q3')];

  test('next and prev stay in bounds', () => {
    let next = quizReducer(state('mock', questions), { type: 'prev' });
    expect(next.index).toBe(0);

    next = quizReducer(next, { type: 'next' });
    next = quizReducer(next, { type: 'next' });
    next = quizReducer(next, { type: 'next' });
    expect(next.index).toBe(2);
  });

  test('jumpTo rejects an out-of-range index', () => {
    const initial = state('mock', questions);
    expect(quizReducer(initial, { type: 'jumpTo', index: 2 }).index).toBe(2);
    expect(quizReducer(initial, { type: 'jumpTo', index: 9 }).index).toBe(0);
    expect(quizReducer(initial, { type: 'jumpTo', index: -1 }).index).toBe(0);
  });

  test('skip marks the question skipped and moves on', () => {
    const next = quizReducer(state('mock', questions), { type: 'skip' });
    expect(next.responses[0].skipped).toBe(true);
    expect(next.responses[0].selected).toEqual([]);
    expect(next.index).toBe(1);
  });
});

describe('tick', () => {
  test('charges the time to the question on screen', () => {
    let next = quizReducer(state('mock', [mcq('q1'), mcq('q2')]), {
      type: 'tick',
      deltaSec: 5,
    });
    next = quizReducer(next, { type: 'next' });
    next = quizReducer(next, { type: 'tick', deltaSec: 3 });

    expect(next.responses[0].timeSpentSec).toBe(5);
    expect(next.responses[1].timeSpentSec).toBe(3);
    expect(next.elapsedSec).toBe(8);
  });

  test('an untimed attempt has no countdown', () => {
    const next = quizReducer(state('practice', [mcq('q1')]), { type: 'tick', deltaSec: 30 });
    expect(next.remainingSec).toBeNull();
    expect(next.status).toBe('active');
  });

  test('the countdown auto-submits at zero and never goes negative', () => {
    let next = quizReducer(state('mock', [mcq('q1'), mcq('q2')], { timeLimitSec: 10 }), {
      type: 'answer',
      label: 'A',
    });
    next = quizReducer(next, { type: 'tick', deltaSec: 4 });
    expect(next.remainingSec).toBe(6);
    expect(next.status).toBe('active');

    next = quizReducer(next, { type: 'tick', deltaSec: 30 });
    expect(next.remainingSec).toBe(0);
    expect(next.status).toBe('submitted');
    // The untouched question is a skip, the answered one still counts.
    expect(next.responses[0].skipped).toBe(false);
    expect(next.responses[1].skipped).toBe(true);
  });

  test('a zero or negative delta is a no-op', () => {
    const initial = state('mock', [mcq('q1')]);
    expect(quizReducer(initial, { type: 'tick', deltaSec: 0 })).toBe(initial);
    expect(quizReducer(initial, { type: 'tick', deltaSec: -5 })).toBe(initial);
  });
});

describe('submit', () => {
  test('marks the untouched questions skipped, reveals everything, and scores', () => {
    let next = quizReducer(state('mock', [mcq('q1', ['A']), mcq('q2', ['B']), mcq('q3')]), {
      type: 'answer',
      label: 'A',
    });
    next = quizReducer(next, { type: 'next' });
    next = quizReducer(next, { type: 'answer', label: 'C' });
    next = quizReducer(next, { type: 'submit' });

    expect(next.status).toBe('submitted');
    expect(next.responses[0].correct).toBe(true);
    expect(next.responses[1].correct).toBe(false);
    expect(next.responses[2].skipped).toBe(true);
    expect(isRevealed(next, 2)).toBe(true);

    const attempt = toAttempt(next);
    expect(attempt.score).toBe(1);
    expect(attempt.total).toBe(3);
    expect(attempt.questionIds).toEqual(['q1', 'q2', 'q3']);
    expect(attempt.mode).toBe('mock');
    expect(attempt.finishedAt).not.toBeNull();
  });

  test('a submitted session ignores further answers', () => {
    const submitted = quizReducer(state('mock', [mcq('q1', ['A'])]), { type: 'submit' });
    const after = quizReducer(submitted, { type: 'answer', label: 'A' });
    expect(after).toBe(submitted);
    expect(after.responses[0].correct).toBe(false);
  });

  test('a submitted session still allows review navigation', () => {
    const submitted = quizReducer(state('mock', [mcq('q1'), mcq('q2')]), { type: 'submit' });
    const reviewing = quizReducer(submitted, { type: 'jumpTo', index: 1 });
    expect(reviewing.index).toBe(1);
  });

  test('duration comes off the session clock, not the wall clock', () => {
    let next = quizReducer(state('mock', [mcq('q1')]), { type: 'tick', deltaSec: 90 });
    next = quizReducer(next, { type: 'submit' });
    expect(toAttempt(next).durationSec).toBe(90);
    expect(next.finishedAt).toBe(START + 90_000);
  });
});

describe('free text in a mock', () => {
  // A mock reveals nothing until submit, so the user cannot self-grade a worked_problem
  // while sitting it. Their written work must survive to the results screen gradable.
  test('typed-but-ungraded work is not buried as a skip', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: '62 usable hosts',
    });
    next = quizReducer(next, { type: 'submit' });

    expect(next.responses[0].skipped).toBe(false);
    expect(next.responses[0].text).toBe('62 usable hosts');
    // Not graded by anyone yet, so it is not yet correct - but it is not a skip either.
    expect(next.responses[0].selfGraded).toBeUndefined();
    expect(next.responses[0].correct).toBe(false);
  });

  test('genuinely blank free text is still a skip', () => {
    const submitted = quizReducer(state('mock', [freeText('q1')]), { type: 'submit' });
    expect(submitted.responses[0].skipped).toBe(true);
  });

  test('whitespace-only free text is a skip', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: '   \n  ',
    });
    next = quizReducer(next, { type: 'submit' });
    expect(next.responses[0].skipped).toBe(true);
  });

  test('a submitted attempt can still be self-graded, and the score follows', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: '62 usable hosts',
    });
    next = quizReducer(next, { type: 'submit' });
    expect(toAttempt(next).score).toBe(0);

    next = quizReducer(next, { type: 'selfGrade', correct: true });
    expect(next.responses[0].selfGraded).toBe(true);
    expect(next.responses[0].correct).toBe(true);
    expect(toAttempt(next).score).toBe(1);
  });

  test('a submitted attempt still refuses everything else', () => {
    const submitted = quizReducer(state('mock', [freeText('q1')]), { type: 'submit' });
    expect(quizReducer(submitted, { type: 'setText', text: 'late' })).toBe(submitted);
    expect(quizReducer(submitted, { type: 'skip' })).toBe(submitted);
  });

  test('an explicit skip survives submit, even with text still in the box', () => {
    // The user jots half a thought, decides they do not know it, and taps Skip. The
    // typed-text rescue is for the killed-tab case and must not overrule them: flipping
    // this back to "engaged" would file it as an ungraded miss they never made.
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: 'something about paging?',
    });
    next = quizReducer(next, { type: 'skip' });
    expect(next.responses[0].skipped).toBe(true);

    next = quizReducer(next, { type: 'submit' });
    expect(next.responses[0].skipped).toBe(true);
    expect(isUngraded(freeText('q1'), next.responses[0])).toBe(false);
  });

  test('typing after a skip takes the skip back', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), { type: 'skip' });
    expect(next.responses[0].skipped).toBe(true);

    next = quizReducer({ ...next, index: 0 }, { type: 'setText', text: '62 hosts' });
    next = quizReducer(next, { type: 'submit' });
    expect(next.responses[0].skipped).toBe(false);
  });
});

describe('isUngraded', () => {
  // The single definition of "nobody has judged this yet". `correct: false` on such a
  // response is the absence of a verdict, not a verdict of wrong - the miss queue, the
  // topic stats and the results badge all have to agree about that.
  test('written-but-unmarked free text is ungraded, not wrong', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: 'X = A + B',
    });
    next = quizReducer(next, { type: 'submit' });

    const response = next.responses[0];
    expect(response.correct).toBe(false);
    expect(response.skipped).toBe(false);
    expect(isUngraded(freeText('q1'), response)).toBe(true);
  });

  test('self-grading settles it, either way', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: 'X = A + B',
    });
    next = quizReducer(next, { type: 'submit' });
    next = quizReducer(next, { type: 'selfGrade', correct: false });
    // Marked wrong by the user. That IS a verdict, so it is a real miss.
    expect(isUngraded(freeText('q1'), next.responses[0])).toBe(false);
  });

  test('a skip is skipped, never ungraded', () => {
    const next = quizReducer(state('mock', [freeText('q1')]), { type: 'skip' });
    expect(isUngraded(freeText('q1'), next.responses[0])).toBe(false);
  });

  test('an unanswered multiple-choice question is wrong, not ungraded', () => {
    const next = quizReducer(state('mock', [mcq('q1', ['A'])]), {
      type: 'answer',
      label: 'B',
    });
    expect(isUngraded(mcq('q1', ['A']), next.responses[0])).toBe(false);
  });

  test('a question that has left the bank cannot be judged ungraded', () => {
    let next = quizReducer(state('mock', [freeText('q1')]), {
      type: 'setText',
      text: 'X',
    });
    next = quizReducer(next, { type: 'submit' });
    expect(isUngraded(undefined, next.responses[0])).toBe(false);
  });
});
