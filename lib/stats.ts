import type { StoredResponse } from '@/lib/db';
import { getQuestionById, servableQuestions } from '@/lib/questions';
import { isUngraded } from '@/lib/quiz';
import {
  TOPICS,
  type Attempt,
  type Question,
  type SourceTier,
  type Topic,
  type TopicStat,
} from '@/lib/types';

/** Below this many answered questions, readiness is null. Three data points is not a signal. */
export const READINESS_MIN_ANSWERED = 30;

/** The tiers readiness is measured against: the questions that actually look like the exam. */
export const READINESS_TIERS: readonly SourceTier[] = ['gold', 'practice'];

export interface TrendPoint {
  attemptId: string;
  startedAt: number;
  score: number;
  total: number;
  /** 0..1 */
  accuracy: number;
}

export interface MissedQuestion {
  questionId: string;
  question: Question;
  seen: number;
  missed: number;
  /** 0..1 over every time this question was answered (skips excluded). */
  accuracy: number;
  lastMissedAt: number;
  lastSeenAt: number;
  /** True when the most recent answer was wrong. These are the ones still hurting. */
  missedLastTime: boolean;
}

export interface Readiness {
  /** 0..100, or null when there is not enough evidence. */
  score: number | null;
  /**
   * The share of the gold+practice bank sitting in topics the user has actually attempted.
   * A readiness of 90 across 20% coverage is not the same claim as 90 across 95%.
   */
  coverage: number;
  answered: number;
  /** How many more answers are needed before a score appears. Zero once it does. */
  answersNeeded: number;
}

export interface Stats {
  attemptCount: number;
  /** Answered questions across all attempts. Skips excluded. */
  answered: number;
  correct: number;
  /** 0..1 */
  overallAccuracy: number;
  topicStats: TopicStat[];
  trend: TrendPoint[];
  /** Consecutive calendar days, counting back from today, with at least one attempt. */
  streakDays: number;
  missQueue: MissedQuestion[];
  readiness: Readiness;
}

export interface StatsInput {
  attempts: readonly Attempt[];
  responses: readonly StoredResponse[];
  /** Defaults to the servable bank. Injectable so the formulas are testable in isolation. */
  bank?: readonly Question[];
  /** How many attempts the trend line covers. */
  trendLength?: number;
  /** Resolves a question id. Defaults to the real bank. Injectable for tests. */
  lookup?: (id: string) => Question | undefined;
}

type Lookup = (id: string) => Question | undefined;

/**
 * A response carries a score only if someone actually judged it. A skip was never answered, and
 * an ungraded free-text answer was never marked - counting either as `correct: false` would score
 * the user wrong on work nobody looked at. See `isUngraded` in lib/quiz.
 */
function isScored(response: StoredResponse, lookup: Lookup): boolean {
  if (response.skipped) return false;
  return !isUngraded(lookup(response.questionId), response);
}

export function overallAccuracy(
  responses: readonly StoredResponse[],
  lookup: Lookup = getQuestionById,
): number {
  const scored = responses.filter((response) => isScored(response, lookup));
  if (scored.length === 0) return 0;
  return scored.filter((response) => response.correct).length / scored.length;
}

export function computeTopicStats(
  responses: readonly StoredResponse[],
  lookup: Lookup,
): TopicStat[] {
  const seen = new Map<Topic, number>();
  const correct = new Map<Topic, number>();
  const lastSeen = new Map<Topic, number>();

  for (const response of responses) {
    if (!isScored(response, lookup)) continue;
    const question = lookup(response.questionId);
    if (!question) continue;
    const topic = question.topic;

    seen.set(topic, (seen.get(topic) ?? 0) + 1);
    if (response.correct) correct.set(topic, (correct.get(topic) ?? 0) + 1);
    const previous = lastSeen.get(topic) ?? 0;
    if (response.attemptStartedAt > previous) {
      lastSeen.set(topic, response.attemptStartedAt);
    }
  }

  return TOPICS.filter((topic) => (seen.get(topic) ?? 0) > 0)
    .map((topic) => {
      const topicSeen = seen.get(topic) ?? 0;
      const topicCorrect = correct.get(topic) ?? 0;
      return {
        topic,
        seen: topicSeen,
        correct: topicCorrect,
        accuracy: topicSeen === 0 ? 0 : topicCorrect / topicSeen,
        lastSeenAt: lastSeen.get(topic) ?? null,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
}

/** Newest last, so a chart can plot it left to right. */
export function accuracyTrend(
  attempts: readonly Attempt[],
  length: number,
): TrendPoint[] {
  return [...attempts]
    .filter((attempt) => attempt.finishedAt !== null && attempt.total > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-length)
    .map((attempt) => ({
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      score: attempt.score,
      total: attempt.total,
      accuracy: attempt.score / attempt.total,
    }));
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Consecutive calendar days with at least one attempt, counting back from today. A streak
 * that ended yesterday still counts today (you have not broken it until today is over);
 * a streak whose last day is older than yesterday is dead.
 */
export function currentStreak(attempts: readonly Attempt[], now: number = Date.now()): number {
  if (attempts.length === 0) return 0;

  const days = new Set(attempts.map((attempt) => dayKey(attempt.startedAt)));
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);

  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(dayKey(cursor.getTime()))) return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Worst first: most misses, then most recent. This is the re-drill queue. */
export function buildMissQueue(
  responses: readonly StoredResponse[],
  lookup: Lookup,
): MissedQuestion[] {
  const byQuestion = new Map<string, StoredResponse[]>();
  for (const response of responses) {
    if (!isScored(response, lookup)) continue;
    const list = byQuestion.get(response.questionId);
    if (list) list.push(response);
    else byQuestion.set(response.questionId, [response]);
  }

  const queue: MissedQuestion[] = [];
  for (const [questionId, list] of byQuestion) {
    const misses = list.filter((response) => !response.correct);
    if (misses.length === 0) continue;

    const question = lookup(questionId);
    if (!question) continue;

    const chronological = [...list].sort((a, b) => a.attemptStartedAt - b.attemptStartedAt);
    const latest = chronological[chronological.length - 1];
    const lastMissedAt = Math.max(...misses.map((response) => response.attemptStartedAt));

    queue.push({
      questionId,
      question,
      seen: list.length,
      missed: misses.length,
      accuracy: (list.length - misses.length) / list.length,
      lastMissedAt,
      lastSeenAt: latest.attemptStartedAt,
      missedLastTime: !latest.correct,
    });
  }

  return queue.sort((a, b) => {
    if (b.missed !== a.missed) return b.missed - a.missed;
    return b.lastMissedAt - a.lastMissedAt;
  });
}

/**
 * READINESS
 *
 *   readiness = 100 * ( Σ_t  w_t * accuracy_t ) / ( Σ_t  w_t )     over topics with seen > 0
 *   w_t       = (gold+practice questions in topic t) / (gold+practice questions total)
 *
 * It is a weighted mean of your per-topic accuracy, weighted by how much of the real bank
 * each topic occupies. Getting networking right matters more than getting `misc` right,
 * in exact proportion to how much networking is on the paper.
 *
 * What it is NOT:
 *   - It is not a predicted exam score. It is a weighted average of past answers.
 *   - It does not punish topics you have never touched; it excludes them and reports
 *     `coverage` instead. Read the two numbers together: 90 at 30% coverage means you are
 *     good at a third of the paper and have no idea about the rest.
 *   - It returns null below READINESS_MIN_ANSWERED answers, rather than inventing a
 *     confident number out of a handful of data points.
 */
export function computeReadiness(
  topicStats: readonly TopicStat[],
  bank: readonly Question[],
  answered: number,
): Readiness {
  const relevant = bank.filter((question) =>
    READINESS_TIERS.includes(question.source.tier),
  );

  const bankByTopic = new Map<Topic, number>();
  for (const question of relevant) {
    bankByTopic.set(question.topic, (bankByTopic.get(question.topic) ?? 0) + 1);
  }
  const bankTotal = relevant.length;

  let weightedAccuracy = 0;
  let weightSum = 0;
  for (const stat of topicStats) {
    if (stat.seen === 0) continue;
    const share = bankTotal === 0 ? 0 : (bankByTopic.get(stat.topic) ?? 0) / bankTotal;
    if (share === 0) continue;
    weightedAccuracy += share * stat.accuracy;
    weightSum += share;
  }

  const enoughEvidence = answered >= READINESS_MIN_ANSWERED && weightSum > 0;

  return {
    score: enoughEvidence ? Math.round(100 * (weightedAccuracy / weightSum)) : null,
    coverage: weightSum,
    answered,
    answersNeeded: Math.max(0, READINESS_MIN_ANSWERED - answered),
  };
}

export function computeStats(input: StatsInput): Stats {
  const bank = input.bank ?? servableQuestions();
  const lookup = input.lookup ?? getQuestionById;
  const trendLength = input.trendLength ?? 10;

  const scored = input.responses.filter((response) => isScored(response, lookup));
  const correct = scored.filter((response) => response.correct).length;
  const topicStats = computeTopicStats(input.responses, lookup);

  return {
    attemptCount: input.attempts.length,
    answered: scored.length,
    correct,
    overallAccuracy: scored.length === 0 ? 0 : correct / scored.length,
    topicStats,
    trend: accuracyTrend(input.attempts, trendLength),
    streakDays: currentStreak(input.attempts),
    missQueue: buildMissQueue(input.responses, lookup),
    readiness: computeReadiness(topicStats, bank, scored.length),
  };
}

/** The topics to hammer next: worst accuracy first, only those with enough evidence to trust. */
export function weakestTopics(
  topicStats: readonly TopicStat[],
  options: { limit?: number; minSeen?: number } = {},
): TopicStat[] {
  const minSeen = options.minSeen ?? 5;
  const limit = options.limit ?? 3;
  return topicStats
    .filter((stat) => stat.seen >= minSeen)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}
