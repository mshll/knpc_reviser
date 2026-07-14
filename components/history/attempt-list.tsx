'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiDeleteBinLine, RiErrorWarningLine } from '@remixicon/react';

import * as Badge from '@/components/ui/badge';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import {
  formatDuration,
  formatPercent,
  formatRelative,
  formatScore,
  modeLabel,
  TOPIC_SHORT_LABELS,
} from '@/lib/format';
import type { Attempt } from '@/lib/types';

function topicsSummary(attempt: Attempt): string {
  const topics = attempt.config.topics;
  if (topics === 'all') return 'All topics';
  if (topics.length === 0) return 'All topics';
  const shown = topics.slice(0, 2).map((topic) => TOPIC_SHORT_LABELS[topic]);
  const rest = topics.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} +${rest}` : shown.join(', ');
}

function Dot() {
  return (
    <span aria-hidden='true' className='text-text-soft-400'>
      &middot;
    </span>
  );
}

export interface AttemptListProps {
  attempts: readonly Attempt[];
  onDelete: (id: string) => Promise<void>;
}

export function AttemptList({ attempts, onDelete }: AttemptListProps) {
  const [target, setTarget] = React.useState<Attempt | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await onDelete(target.id);
      setTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-label='Attempts' className='flex flex-col gap-4'>
      <h2 className='text-label-lg text-text-strong-950'>Attempts</h2>

      <ul className='flex flex-col gap-2'>
        {attempts.map((attempt) => {
          const ratio = attempt.total > 0 ? attempt.score / attempt.total : 0;
          return (
            <li key={attempt.id} className='flex items-stretch gap-2'>
              <Link
                href={`/results?id=${attempt.id}`}
                aria-label={`${modeLabel(attempt.mode)}, ${formatRelative(attempt.startedAt)}, scored ${formatScore(attempt.score, attempt.total)}. Open results.`}
                className='flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-1 rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-3 outline-none transition duration-200 ease-out hover:border-stroke-sub-300 hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base'
              >
                <div className='flex items-center justify-between gap-3'>
                  <span className='flex min-w-0 items-center gap-2'>
                    <span className='truncate text-label-sm text-text-strong-950'>
                      {modeLabel(attempt.mode)}
                    </span>
                    {attempt.finishedAt === null && (
                      <Badge.Root variant='lighter' color='orange' size='medium'>
                        Unfinished
                      </Badge.Root>
                    )}
                  </span>
                  <span className='shrink-0 text-label-sm tabular-nums text-text-strong-950'>
                    {formatScore(attempt.score, attempt.total)}{' '}
                    <span className='text-text-soft-400'>
                      {formatPercent(ratio)}
                    </span>
                  </span>
                </div>
                <div className='flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-paragraph-xs text-text-sub-600'>
                  <span>{formatRelative(attempt.startedAt)}</span>
                  <Dot />
                  <span>{formatDuration(attempt.durationSec)}</span>
                  <Dot />
                  <span>{topicsSummary(attempt)}</span>
                </div>
              </Link>

              <button
                type='button'
                onClick={() => setTarget(attempt)}
                aria-label={`Delete the ${modeLabel(attempt.mode)} attempt from ${formatRelative(attempt.startedAt)}`}
                className='flex w-11 shrink-0 items-center justify-center rounded-10 border border-stroke-soft-200 bg-bg-white-0 text-text-soft-400 outline-none transition duration-200 ease-out hover:border-error-base hover:bg-error-lighter hover:text-error-base focus-visible:ring-2 focus-visible:ring-error-base'
              >
                <RiDeleteBinLine className='size-5' />
              </button>
            </li>
          );
        })}
      </ul>

      <Modal.Root
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setTarget(null);
        }}
      >
        <Modal.Content>
          <Modal.Header
            icon={RiErrorWarningLine}
            title='Delete this attempt?'
            description='Its responses leave your topic stats and miss queue too. There is no undo.'
          />
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root
                variant='neutral'
                mode='stroke'
                disabled={deleting}
                className='h-11 flex-1'
              >
                Cancel
              </Button.Root>
            </Modal.Close>
            <Button.Root
              variant='error'
              mode='filled'
              disabled={deleting}
              onClick={() => {
                void confirmDelete();
              }}
              className='h-11 flex-1'
            >
              {deleting ? 'Deleting' : 'Delete'}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </section>
  );
}

export default AttemptList;
