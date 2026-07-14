import { describe, expect, test } from 'bun:test';

import type { StoredResponse } from '@/lib/db';
import {
  READINESS_MIN_ANSWERED,
  accuracyTrend,
  buildMissQueue,
  computeReadiness,
  computeStats,
  computeTopicStats,
  currentStreak,
  overallAccuracy,
} from '@/lib/stats';
import type { Attempt, Question, QuizConfig, SourceTier, Topic } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-07-14T12:00:00Z').getTime();

function question(id: string, topic: Topic, tier: SourceTier = 'gold'): Question {
  return {
    id,
    type: 'mcq',
    topic,
    stem: `Stem ${id}`,
    options: [
      { label: 'A', text: 'A', isCorrect: true },
      { label: 'B', text: 'B', isCorrect: false },
    ],
    answerOptionLabels: ['A'],
    source: { file: 'test', exam: 'KNPC', tier },
    keyProvenance: 'inline_bold',
    keyVerified: true,
    verificationLevel: 'double',
    needsReview: false,
    flags: [],
    dedupeHash: id,
  };
}

/** A free-text item: never auto-graded, so it can only be settled by the user. */
function workedProblem(id: string, topic: Topic, tier: SourceTier = 'gold'): Question {
  return {
    ...question(id, topic, tier),
    type: 'worked_problem',
    options: [],
    answerOptionLabels: [],
    answerText: 'X = A + B',
  };
}

/**
 * What finish() actually stores for a worked_problem the user wrote out but never marked:
 * engaged, unjudged. The pair {skipped: false, correct: false} must not read as "wrong".
 */
function ungraded(questionId: string, at: number = NOW): StoredResponse {
  return {
    id: `a1::${questionId}`,
    attemptId: 'a1',
    attemptStartedAt: at,
    questionId,
    selected: [],
    correct: false,
    skipped: false,
    timeSpentSec: 40,
    text: 'X = A + B',
  };
}

function bankOf(spec: Array<[Topic, number]>, tier: SourceTier = 'gold'): Question[] {
  const out: Question[] = [];
  for (const [topic, count] of spec) {
    for (let i = 0; i < count; i++) out.push(question(`${topic}-${i}`, topic, tier));
  }
  return out;
}

function lookupFrom(bank: readonly Question[]): (id: string) => Question | undefined {
  const byId = new Map(bank.map((entry) => [entry.id, entry]));
  return (id) => byId.get(id);
}

function response(
  questionId: string,
  correct: boolean,
  options: { attemptId?: string; at?: number; skipped?: boolean } = {},
): StoredResponse {
  const attemptId = options.attemptId ?? 'a1';
  const at = options.at ?? NOW;
  return {
    id: `${attemptId}::${questionId}`,
    attemptId,
    attemptStartedAt: at,
    questionId,
    selected: correct ? ['A'] : ['B'],
    correct,
    skipped: options.skipped ?? false,
    timeSpentSec: 10,
  };
}

const CONFIG: QuizConfig = {
  mode: 'mock',
  topics: 'all',
  tiers: ['gold', 'practice'],
  count: 10,
  timeLimitSec: null,
  onlyMissed: false,
  shuffleOptions: false,
};

function attempt(id: string, startedAt: number, score: number, total: number): Attempt {
  return {
    id,
    mode: 'mock',
    config: CONFIG,
    startedAt,
    finishedAt: startedAt + 60_000,
    questionIds: [],
    responses: [],
    score,
    total,
    durationSec: 60,
  };
}

describe('overallAccuracy', () => {
  test('is zero with no data, and excludes skips', () => {
    expect(overallAccuracy([])).toBe(0);

    const responses = [
      response('q1', true),
      response('q2', false),
      response('q3', false, { skipped: true }),
    ];
    expect(overallAccuracy(responses)).toBe(0.5);
  });
});

describe('computeTopicStats', () => {
  test('counts per topic and reports the last time each was seen', () => {
    const bank = [
      question('n1', 'networking'),
      question('n2', 'networking'),
      question('d1', 'databases'),
    ];
    const responses = [
      response('n1', true, { at: NOW - DAY }),
      response('n2', false, { at: NOW }),
      response('d1', true, { at: NOW - 2 * DAY }),
    ];

    const stats = computeTopicStats(responses, lookupFrom(bank));
    const networking = stats.find((stat) => stat.topic === 'networking');
    const databases = stats.find((stat) => stat.topic === 'databases');

    expect(networking).toEqual({
      topic: 'networking',
      seen: 2,
      correct: 1,
      accuracy: 0.5,
      lastSeenAt: NOW,
    });
    expect(databases?.accuracy).toBe(1);
    // Worst first.
    expect(stats[0].topic).toBe('networking');
  });

  test('ignores a response whose question has left the bank', () => {
    const stats = computeTopicStats([response('gone', true)], lookupFrom([]));
    expect(stats).toEqual([]);
  });
});

describe('computeReadiness', () => {
  // Bank is 80% networking, 20% databases. Both topics attempted.
  const bank = bankOf([
    ['networking', 80],
    ['databases', 20],
  ]);

  test('is null below the evidence floor, and says how many more are needed', () => {
    const readiness = computeReadiness(
      [{ topic: 'networking', seen: 5, correct: 5, accuracy: 1, lastSeenAt: NOW }],
      bank,
      5,
    );
    expect(readiness.score).toBeNull();
    expect(readiness.answersNeeded).toBe(READINESS_MIN_ANSWERED - 5);
  });

  test('weights each topic by its share of the gold+practice bank', () => {
    // 0.5 accuracy on 80% of the bank, 1.0 on 20% => 0.8*0.5 + 0.2*1.0 = 0.6
    const readiness = computeReadiness(
      [
        { topic: 'networking', seen: 20, correct: 10, accuracy: 0.5, lastSeenAt: NOW },
        { topic: 'databases', seen: 20, correct: 20, accuracy: 1, lastSeenAt: NOW },
      ],
      bank,
      40,
    );
    expect(readiness.score).toBe(60);
    expect(readiness.coverage).toBeCloseTo(1, 6);
    expect(readiness.answersNeeded).toBe(0);
  });

  test('an untouched topic is excluded, and coverage says so', () => {
    // Only databases (20% of the bank) attempted. Perfect on it, but coverage is 0.2.
    const readiness = computeReadiness(
      [{ topic: 'databases', seen: 40, correct: 40, accuracy: 1, lastSeenAt: NOW }],
      bank,
      40,
    );
    expect(readiness.score).toBe(100);
    expect(readiness.coverage).toBeCloseTo(0.2, 6);
  });

  test('the bank tier is what counts: a bank-tier question carries no weight', () => {
    const bankTierOnly = bankOf([['general-it', 50]], 'bank');
    const readiness = computeReadiness(
      [{ topic: 'general-it', seen: 50, correct: 25, accuracy: 0.5, lastSeenAt: NOW }],
      bankTierOnly,
      50,
    );
    // Nothing in gold+practice, so there is no weight to average over.
    expect(readiness.score).toBeNull();
    expect(readiness.coverage).toBe(0);
  });
});

describe('accuracyTrend', () => {
  test('takes the last N finished attempts, oldest first', () => {
    const attempts = [
      attempt('a1', NOW - 3 * DAY, 5, 10),
      attempt('a2', NOW - 2 * DAY, 8, 10),
      attempt('a3', NOW - DAY, 9, 10),
    ];
    const trend = accuracyTrend(attempts, 2);
    expect(trend.map((point) => point.attemptId)).toEqual(['a2', 'a3']);
    expect(trend[1].accuracy).toBe(0.9);
  });

  test('skips an abandoned attempt', () => {
    const abandoned: Attempt = { ...attempt('a1', NOW, 0, 10), finishedAt: null };
    expect(accuracyTrend([abandoned], 10)).toEqual([]);
  });
});

describe('currentStreak', () => {
  test('counts back from today', () => {
    const attempts = [
      attempt('a1', NOW, 1, 1),
      attempt('a2', NOW - DAY, 1, 1),
      attempt('a3', NOW - 2 * DAY, 1, 1),
    ];
    expect(currentStreak(attempts, NOW)).toBe(3);
  });

  test('a gap breaks it', () => {
    const attempts = [attempt('a1', NOW, 1, 1), attempt('a2', NOW - 3 * DAY, 1, 1)];
    expect(currentStreak(attempts, NOW)).toBe(1);
  });

  test('a streak that ran to yesterday is still alive today', () => {
    const attempts = [attempt('a1', NOW - DAY, 1, 1), attempt('a2', NOW - 2 * DAY, 1, 1)];
    expect(currentStreak(attempts, NOW)).toBe(2);
  });

  test('a streak last touched three days ago is dead', () => {
    expect(currentStreak([attempt('a1', NOW - 3 * DAY, 1, 1)], NOW)).toBe(0);
    expect(currentStreak([], NOW)).toBe(0);
  });
});

describe('buildMissQueue', () => {
  const bank = [question('q1', 'networking'), question('q2', 'databases')];

  test('ranks by miss count, then by recency, and skips the never-missed', () => {
    const responses = [
      response('q1', false, { attemptId: 'a1', at: NOW - 2 * DAY }),
      response('q1', false, { attemptId: 'a2', at: NOW - DAY }),
      response('q1', true, { attemptId: 'a3', at: NOW }),
      response('q2', false, { attemptId: 'a1', at: NOW - 2 * DAY }),
    ];

    const queue = buildMissQueue(responses, lookupFrom(bank));
    expect(queue.map((entry) => entry.questionId)).toEqual(['q1', 'q2']);

    const first = queue[0];
    expect(first.seen).toBe(3);
    expect(first.missed).toBe(2);
    expect(first.accuracy).toBeCloseTo(1 / 3, 6);
    expect(first.lastMissedAt).toBe(NOW - DAY);
    // Got it right on the most recent go, so it is no longer actively hurting.
    expect(first.missedLastTime).toBe(false);
    expect(queue[1].missedLastTime).toBe(true);
  });

  test('a question answered correctly every time never enters the queue', () => {
    expect(buildMissQueue([response('q1', true)], lookupFrom(bank))).toEqual([]);
  });

  test('a skip is not a miss', () => {
    const responses = [response('q1', false, { skipped: true })];
    expect(buildMissQueue(responses, lookupFrom(bank))).toEqual([]);
  });

  test('an ungraded written answer is not a miss: nobody has marked it yet', () => {
    const written = [workedProblem('w1', 'digital-logic')];
    // The user wrote out the right answer in a mock and closed the tab before self-grading.
    // finish() stores that as {skipped: false, correct: false} - which is NOT "wrong".
    const responses = [ungraded('w1')];
    expect(buildMissQueue(responses, lookupFrom(written))).toEqual([]);
  });

  test('a self-graded miss is a real miss', () => {
    const written = [workedProblem('w1', 'digital-logic')];
    const responses = [{ ...ungraded('w1'), selfGraded: true }];
    expect(buildMissQueue(responses, lookupFrom(written)).map((e) => e.questionId)).toEqual([
      'w1',
    ]);
  });
});

describe('ungraded free text is unscored everywhere', () => {
  // verdict.ts exists to say "ungraded is not wrong". Before this, the persistence layer
  // disagreed: the same response showed as "Needs grading" on results while being counted
  // as a wrong answer in accuracy, topic mastery, readiness and the miss queue.
  const bank = [question('q1', 'networking'), workedProblem('w1', 'digital-logic')];
  const lookup = lookupFrom(bank);

  test('it is excluded from accuracy, not counted as wrong', () => {
    const responses = [response('q1', true), ungraded('w1')];
    // One scored answer, and it was correct. The written one is simply not in the sample.
    expect(overallAccuracy(responses, lookup)).toBe(1);
  });

  test('it does not drag a topic to zero', () => {
    const stats = computeTopicStats([ungraded('w1')], lookup);
    expect(stats).toEqual([]);
  });

  test('it does not count towards the readiness evidence floor', () => {
    const stats = computeStats({
      attempts: [attempt('a1', NOW, 0, 1)],
      responses: [ungraded('w1')],
      bank,
      lookup,
    });
    expect(stats.answered).toBe(0);
    expect(stats.correct).toBe(0);
    expect(stats.overallAccuracy).toBe(0);
    expect(stats.missQueue).toEqual([]);
  });

  test('once the user marks it, it scores like anything else', () => {
    const graded = { ...ungraded('w1'), selfGraded: true, correct: true };
    const stats = computeTopicStats([graded], lookup);
    expect(stats).toEqual([
      {
        topic: 'digital-logic',
        seen: 1,
        correct: 1,
        accuracy: 1,
        lastSeenAt: NOW,
      },
    ]);
  });
});

describe('computeStats', () => {
  test('assembles the full picture off an injected bank', () => {
    const bank = bankOf([
      ['networking', 60],
      ['databases', 40],
    ]);
    const responses = [
      ...Array.from({ length: 20 }, (_, i) =>
        response(`networking-${i}`, i < 10, { at: NOW }),
      ),
      ...Array.from({ length: 20 }, (_, i) =>
        response(`databases-${i}`, true, { at: NOW }),
      ),
    ];

    const stats = computeStats({
      attempts: [attempt('a1', NOW, 30, 40)],
      responses,
      bank,
      lookup: lookupFrom(bank),
    });

    expect(stats.answered).toBe(40);
    expect(stats.correct).toBe(30);
    expect(stats.overallAccuracy).toBe(0.75);
    expect(stats.attemptCount).toBe(1);
    // 0.6 * 0.5 + 0.4 * 1.0 = 0.7
    expect(stats.readiness.score).toBe(70);
    expect(stats.missQueue).toHaveLength(10);
    expect(stats.topicStats[0].topic).toBe('networking');
  });

  test('readiness stays null on a thin history', () => {
    const bank = bankOf([['networking', 10]]);
    const stats = computeStats({
      attempts: [attempt('a1', NOW, 3, 3)],
      responses: [response('networking-0', true), response('networking-1', true)],
      bank,
      lookup: lookupFrom(bank),
    });
    expect(stats.readiness.score).toBeNull();
    expect(stats.overallAccuracy).toBe(1);
  });
});
