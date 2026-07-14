'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiArrowRightSLine } from '@remixicon/react';

import * as ProgressBar from '@/components/ui/progress-bar';
import * as Tag from '@/components/ui/tag';
import { drillHref } from '@/components/home/quiz-url';
import { accuracyBarColor } from '@/components/results/accuracy';
import type { Settings } from '@/lib/db';
import { formatPercent, pluralize, topicLabel } from '@/lib/format';
import { topicCounts } from '@/lib/questions';
import type { Topic, TopicStat } from '@/lib/types';
import { cn } from '@/utils/cn';

const ROW_CLASSES = cn(
  'flex min-h-11 items-center gap-3 rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-3',
  'outline-none transition duration-200 ease-out',
  'hover:border-stroke-sub-300 hover:bg-bg-weak-50',
  'focus-visible:ring-2 focus-visible:ring-primary-base',
);

export interface TopicMasteryProps {
  /** Topics with at least one scored answer. Already worst-accuracy-first. */
  topicStats: readonly TopicStat[];
  /** Distinct question ids answered per topic, for an honest "seen n of N". */
  distinctSeen: ReadonlyMap<Topic, number>;
  /**
   * The user's saved quiz defaults. Tapping a topic here must serve exactly what tapping the
   * same topic on the home screen serves: a hand-rolled URL silently drops the tier and shuffle
   * preferences, so the same tap would yield two different question pools.
   */
  settings: Settings;
}

/**
 * Every topic in the default bank: accuracy where it exists, and an explicit
 * "untouched" state where it does not. Unknown is not zero, and this screen
 * never pretends otherwise.
 */
export function TopicMastery({
  topicStats,
  distinctSeen,
  settings,
}: TopicMasteryProps) {
  const bankCounts = React.useMemo(() => topicCounts(), []);
  const statByTopic = new Map(topicStats.map((stat) => [stat.topic, stat]));
  const availableByTopic = new Map(
    bankCounts.map((entry) => [entry.topic, entry.count]),
  );

  const attempted = topicStats.filter((stat) => availableByTopic.has(stat.topic));
  const untouched = bankCounts.filter((entry) => !statByTopic.has(entry.topic));

  return (
    <section aria-label='Topic mastery' className='flex flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        <h2 className='text-label-lg text-text-strong-950'>Topic mastery</h2>
        <p className='text-paragraph-sm text-text-sub-600'>
          Worst first. Tap a topic to drill it.
          {untouched.length > 0 && (
            <>
              {' '}
              {untouched.length} {pluralize(untouched.length, 'topic')}{' '}
              {untouched.length === 1 ? 'is' : 'are'} untouched: that is
              unknown, not 0%.
            </>
          )}
        </p>
      </div>

      {attempted.length === 0 ? (
        <p className='rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600'>
          No topic has been attempted yet.
        </p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {attempted.map((stat) => {
            const available = availableByTopic.get(stat.topic) ?? 0;
            const seenDistinct = Math.min(
              distinctSeen.get(stat.topic) ?? 0,
              available,
            );
            const label = topicLabel(stat.topic);
            return (
              <li key={stat.topic}>
                <Link
                  href={drillHref({ topics: [stat.topic] }, settings)}
                  aria-label={`Drill ${label}. Accuracy ${formatPercent(stat.accuracy)} over ${stat.seen} ${pluralize(stat.seen, 'answer')}.`}
                  className={ROW_CLASSES}
                >
                  <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                    <div className='flex items-baseline justify-between gap-3'>
                      <span className='truncate text-label-sm text-text-strong-950'>
                        {label}
                      </span>
                      <span className='shrink-0 text-label-sm tabular-nums text-text-strong-950'>
                        {formatPercent(stat.accuracy)}
                      </span>
                    </div>
                    <ProgressBar.Root
                      value={stat.accuracy * 100}
                      color={accuracyBarColor(stat.accuracy)}
                    />
                    <div className='flex items-baseline justify-between gap-3 text-paragraph-xs text-text-soft-400'>
                      <span>
                        {stat.correct} of {stat.seen}{' '}
                        {pluralize(stat.seen, 'answer')} correct
                      </span>
                      <span>
                        seen {seenDistinct} of {available} in the bank
                      </span>
                    </div>
                  </div>
                  <RiArrowRightSLine
                    aria-hidden='true'
                    className='size-5 shrink-0 text-text-soft-400'
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {untouched.length > 0 && (
        <div className='flex flex-col gap-2'>
          <h3 className='pt-2 text-subheading-xs uppercase text-text-soft-400'>
            Untouched
          </h3>
          <ul className='flex flex-col gap-2'>
            {untouched.map((entry) => {
              const label = topicLabel(entry.topic);
              return (
                <li key={entry.topic}>
                  <Link
                    href={drillHref({ topics: [entry.topic] }, settings)}
                    aria-label={`Start drilling ${label}. ${entry.count} ${pluralize(entry.count, 'question')} available, none attempted yet.`}
                    className={ROW_CLASSES}
                  >
                    <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                      <div className='flex items-center justify-between gap-3'>
                        <span className='truncate text-label-sm text-text-strong-950'>
                          {label}
                        </span>
                        <Tag.Root variant='gray'>Untouched</Tag.Root>
                      </div>
                      <span className='text-paragraph-xs text-text-soft-400'>
                        {entry.count} {pluralize(entry.count, 'question')}{' '}
                        waiting, none attempted
                      </span>
                    </div>
                    <RiArrowRightSLine
                      aria-hidden='true'
                      className='size-5 shrink-0 text-text-soft-400'
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

export default TopicMastery;
