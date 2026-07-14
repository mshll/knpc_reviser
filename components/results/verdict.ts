import { isUngraded } from '@/lib/quiz';
import type { Question, Response } from '@/lib/types';

export type Verdict = 'correct' | 'wrong' | 'skipped' | 'ungraded';

/**
 * Free text is never auto-graded, and a mock reveals nothing until submit - so a
 * worked_problem the user genuinely wrote out arrives at the results screen graded by
 * nobody. That is `ungraded`, not `wrong`: the results screen asks the user to settle it
 * rather than quietly scoring their work as a miss.
 *
 * The same `isUngraded` predicate gates the miss queue and the topic stats (lib/stats,
 * lib/db), so the score, the drill queue and this badge cannot disagree about one response.
 *
 * `question` is optional because the bank can be replaced under a stored attempt.
 */
export function verdictOf(
  question: Question | undefined,
  response: Response,
): Verdict {
  if (response.skipped) return 'skipped';
  if (isUngraded(question, response)) return 'ungraded';
  return response.correct ? 'correct' : 'wrong';
}
