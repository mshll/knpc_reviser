'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiAlertLine, RiBook2Line, RiErrorWarningLine } from '@remixicon/react';

import * as Alert from '@/components/ui/alert';
import * as Button from '@/components/ui/button';
import * as Divider from '@/components/ui/divider';
import { useStorageStatus } from '@/components/app-shell';
import AttemptList from '@/components/history/attempt-list';
import TopicMastery from '@/components/history/topic-mastery';
import TrendChart from '@/components/history/trend-chart';
import {
  DEFAULT_SETTINGS,
  deleteAttempt,
  getAllAttempts,
  getAllResponses,
  getSettings,
  type Settings,
  type StoredResponse,
} from '@/lib/db';
import { formatPercent } from '@/lib/format';
import { getQuestionById } from '@/lib/questions';
import { computeStats } from '@/lib/stats';
import type { Attempt, Topic } from '@/lib/types';

interface HistoryData {
  attempts: Attempt[];
  responses: StoredResponse[];
  /** Drives the topic-drill links, so they serve the same pool the home screen's links do. */
  settings: Settings;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: HistoryData };

function HistorySkeleton() {
  return (
    <div aria-hidden='true' className='flex animate-pulse flex-col gap-4 py-4'>
      <div className='h-7 w-32 rounded-full bg-bg-weak-50' />
      <div className='h-20 w-full rounded-2xl bg-bg-weak-50' />
      <div className='h-16 w-full rounded-10 bg-bg-weak-50' />
      <div className='h-16 w-full rounded-10 bg-bg-weak-50' />
      <div className='h-16 w-full rounded-10 bg-bg-weak-50' />
    </div>
  );
}

function EmptyState() {
  return (
    <div className='flex flex-col items-center gap-4 py-16 text-center'>
      <span className='flex size-14 items-center justify-center rounded-full bg-bg-weak-50 text-text-sub-600'>
        <RiBook2Line className='size-7' aria-hidden='true' />
      </span>
      <div className='flex flex-col gap-1'>
        <h2 className='text-title-h6 text-text-strong-950'>No attempts yet</h2>
        <p className='max-w-sm text-paragraph-sm text-text-sub-600'>
          Take one quiz and this page starts working for you: every attempt
          logged, every topic scored, every miss queued for a re-drill.
        </p>
      </div>
      <Button.Root asChild className='h-11'>
        <Link href='/quiz'>Start your first quiz</Link>
      </Button.Root>
    </div>
  );
}

function StatStrip({
  attemptCount,
  answered,
  accuracy,
}: {
  attemptCount: number;
  answered: number;
  accuracy: number;
}) {
  const cells = [
    { label: 'Attempts', value: String(attemptCount) },
    { label: 'Answered', value: String(answered) },
    { label: 'Accuracy', value: formatPercent(accuracy) },
  ];
  return (
    <dl className='grid grid-cols-3 gap-2'>
      {cells.map((cell) => (
        <div
          key={cell.label}
          className='flex flex-col items-center gap-0.5 rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-3'
        >
          <dt className='text-subheading-2xs uppercase text-text-soft-400'>
            {cell.label}
          </dt>
          <dd className='text-label-lg tabular-nums text-text-strong-950'>
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function distinctSeenByTopic(
  responses: readonly StoredResponse[],
): Map<Topic, number> {
  const seenIds = new Map<Topic, Set<string>>();
  for (const response of responses) {
    const question = getQuestionById(response.questionId);
    if (!question) continue;
    const set = seenIds.get(question.topic) ?? new Set<string>();
    set.add(response.questionId);
    seenIds.set(question.topic, set);
  }
  return new Map([...seenIds].map(([topic, ids]) => [topic, ids.size]));
}

export function HistoryScreen() {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const storage = useStorageStatus();

  const load = React.useCallback(async () => {
    try {
      const [attempts, responses, settings] = await Promise.all([
        getAllAttempts(),
        getAllResponses(),
        // A failed settings read must not blank the whole history screen: the drill links
        // fall back to the documented defaults, exactly as /quiz does.
        getSettings().catch((error: unknown) => {
          console.warn('[history] could not load settings, using defaults:', error);
          return DEFAULT_SETTINGS;
        }),
      ]);
      setState({ status: 'ready', data: { attempts, responses, settings } });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Could not read storage.';
      setState({ status: 'error', message });
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const data = state.status === 'ready' ? state.data : null;

  const stats = React.useMemo(
    () =>
      data
        ? computeStats({ attempts: data.attempts, responses: data.responses })
        : null,
    [data],
  );

  const distinctSeen = React.useMemo(
    () => (data ? distinctSeenByTopic(data.responses) : new Map<Topic, number>()),
    [data],
  );

  const handleDelete = React.useCallback(
    async (id: string) => {
      await deleteAttempt(id);
      await load();
    },
    [load],
  );

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12'>
      <h1 className='text-title-h4 text-text-strong-950'>History</h1>

      {storage.degraded && (
        <Alert.Root variant='lighter' status='warning' size='small'>
          <Alert.Icon as={RiAlertLine} />
          Storage is unavailable in this browser, so history will not survive a
          reload.
        </Alert.Root>
      )}

      {state.status === 'loading' && <HistorySkeleton />}

      {state.status === 'error' && (
        <Alert.Root variant='lighter' status='error' size='small'>
          <Alert.Icon as={RiErrorWarningLine} />
          Could not load history: {state.message}
        </Alert.Root>
      )}

      {data && stats && (
        <>
          {data.attempts.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <StatStrip
                attemptCount={stats.attemptCount}
                answered={stats.answered}
                accuracy={stats.overallAccuracy}
              />

              <TopicMastery
                topicStats={stats.topicStats}
                distinctSeen={distinctSeen}
                settings={data.settings}
              />

              <Divider.Root />

              <section aria-label='Accuracy over time' className='flex flex-col gap-4'>
                <h2 className='text-label-lg text-text-strong-950'>
                  Accuracy over time
                </h2>
                <TrendChart trend={stats.trend} />
              </section>

              <Divider.Root />

              <AttemptList attempts={data.attempts} onDelete={handleDelete} />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default HistoryScreen;
