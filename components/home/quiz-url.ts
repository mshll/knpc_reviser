import type { Settings } from '@/lib/db';
import type { QuizConfig, Topic } from '@/lib/types';

/**
 * Serializes a QuizConfig into the /quiz query-string contract.
 *
 * Params (omitted params take the documented default):
 *   mode        mock | practice | drill            (required)
 *   topics      comma-separated Topic slugs        (absent = all topics)
 *   tiers       comma-separated SourceTier slugs   (absent = gold,practice)
 *   count       number of questions                (required)
 *   time        time limit in whole seconds        (absent = untimed)
 *   missed      1 to serve only missed questions   (absent = off)
 *   shuffle     0 to keep source option order      (absent = shuffle)
 *
 * `unverified` was retired with the unverified items themselves. An old bookmark carrying it
 * still opens: unknown params are ignored.
 */
export function quizHref(config: QuizConfig): string {
  const params = new URLSearchParams();
  params.set('mode', config.mode);
  if (config.topics !== 'all') params.set('topics', config.topics.join(','));
  params.set('tiers', config.tiers.join(','));
  params.set('count', String(config.count));
  if (config.timeLimitSec !== null && config.timeLimitSec > 0) {
    params.set('time', String(Math.floor(config.timeLimitSec)));
  }
  if (config.onlyMissed) params.set('missed', '1');
  if (!config.shuffleOptions) params.set('shuffle', '0');
  return `/quiz?${params.toString()}`;
}

export interface DrillTarget {
  topics?: readonly Topic[];
  onlyMissed?: boolean;
}

/** One-tap drill links on the home screen, honouring the user's saved settings. */
export function drillHref(target: DrillTarget, settings: Settings): string {
  return quizHref({
    mode: 'drill',
    topics: target.topics ? [...target.topics] : 'all',
    tiers: settings.defaultTiers,
    count: settings.drillCount,
    timeLimitSec: null,
    onlyMissed: target.onlyMissed ?? false,
    shuffleOptions: settings.shuffleOptions,
  });
}

/**
 * "Re-drill exactly these questions", by id.
 *
 * The miss queue is computed across the WHOLE bank, so it cannot be served through the tier and
 * topic filters: a question you missed while the bank tier was on would vanish from a drill the
 * moment you turned that tier off, and a promise of "12 questions you keep missing" would open
 * an empty quiz. `selectQuestionsByIds` deliberately bypasses those filters for this reason, and
 * the `ids` param is how you reach it.
 */
export function drillIdsHref(
  ids: readonly string[],
  settings: Settings,
): string {
  const params = new URLSearchParams();
  params.set('mode', 'drill');
  params.set('ids', ids.join(','));
  if (!settings.shuffleOptions) params.set('shuffle', '0');
  return `/quiz?${params.toString()}`;
}
