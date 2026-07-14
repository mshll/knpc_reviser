'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiCheckLine, RiCloseLine, RiSkipForwardLine } from '@remixicon/react';

import * as Badge from '@/components/ui/badge';
import * as Button from '@/components/ui/button';
import {
  formatDateTime,
  formatDuration,
  formatPercent,
  modeLabel,
  pluralize,
} from '@/lib/format';
import type { Attempt } from '@/lib/types';

export interface ScoreSummaryProps {
  attempt: Attempt;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  /** Question ids the user can re-drill. Empty hides the drill action. */
  drillIds: readonly string[];
}

export function ScoreSummary({
  attempt,
  correctCount,
  wrongCount,
  skippedCount,
  drillIds,
}: ScoreSummaryProps) {
  const ratio = attempt.total > 0 ? attempt.score / attempt.total : 0;

  return (
    <section
      aria-label='Attempt score'
      className='flex flex-col items-center gap-6 text-center'
    >
      <div className='flex flex-col items-center gap-2'>
        <p className='text-subheading-xs uppercase text-text-soft-400'>
          {modeLabel(attempt.mode)}, {formatDateTime(attempt.startedAt)}
        </p>
        <p className='text-title-h1 text-text-strong-950'>
          {attempt.score}
          <span className='text-title-h4 text-text-soft-400'>/{attempt.total}</span>
        </p>
        <p className='text-paragraph-md text-text-sub-600'>
          {formatPercent(ratio)} correct in {formatDuration(attempt.durationSec)}
        </p>
        {attempt.finishedAt === null && (
          <p className='text-paragraph-sm text-warning-base'>
            This attempt was never submitted.
          </p>
        )}
      </div>

      <div className='flex flex-wrap items-center justify-center gap-2'>
        <Badge.Root variant='lighter' color='green' size='medium'>
          <Badge.Icon as={RiCheckLine} />
          {correctCount} correct
        </Badge.Root>
        <Badge.Root variant='lighter' color='red' size='medium'>
          <Badge.Icon as={RiCloseLine} />
          {wrongCount} wrong
        </Badge.Root>
        <Badge.Root variant='lighter' color='gray' size='medium'>
          <Badge.Icon as={RiSkipForwardLine} />
          {skippedCount} skipped
        </Badge.Root>
      </div>

      <div className='flex w-full max-w-sm flex-col gap-3'>
        {drillIds.length > 0 && (
          <Button.Root asChild className='h-11 w-full'>
            <Link href={`/quiz?mode=drill&ids=${drillIds.join(',')}`}>
              Drill the {drillIds.length}{' '}
              {pluralize(drillIds.length, 'question')} I got wrong
            </Link>
          </Button.Root>
        )}
        <Button.Root asChild variant='neutral' mode='stroke' className='h-11 w-full'>
          <Link href='/quiz'>Start another quiz</Link>
        </Button.Root>
      </div>
    </section>
  );
}

export default ScoreSummary;
