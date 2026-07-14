'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  RiArrowRightSLine,
  RiBookOpenLine,
  RiFocus2Line,
  RiTimerLine,
} from '@remixicon/react';

import * as ProgressBar from '@/components/ui/progress-bar';
import { drillHref, drillIdsHref } from '@/components/home/quiz-url';
import { useHomeStats } from '@/components/home/use-home-stats';
import {
  TIER_LABELS,
  formatDuration,
  formatPercent,
  formatRelative,
  formatScore,
  modeLabel,
  pluralize,
  topicLabel,
} from '@/lib/format';
import { tierCounts } from '@/lib/questions';
import { weakestTopics, type Stats } from '@/lib/stats';
import type { Settings } from '@/lib/db';
import type { Attempt } from '@/lib/types';
import { SOURCE_TIERS } from '@/lib/types';
import { cn } from '@/utils/cn';

const SECTION_HEADING =
  'text-subheading-xs uppercase tracking-wide text-text-soft-400';

const CARD =
  'rounded-20 bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200 shadow-regular-xs';

const ROW_LINK = cn(
  'flex min-h-[3.25rem] items-center gap-3 px-4 py-3 outline-none',
  'transition duration-200 ease-out',
  'hover:bg-bg-weak-50 active:bg-bg-weak-50',
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-base',
);

// ---------------------------------------------------------------------------
// Primary actions
// ---------------------------------------------------------------------------

function PrimaryAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof RiTimerLine;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        CARD,
        'flex min-h-[8rem] flex-col justify-between gap-4 p-4 outline-none',
        'transition duration-200 ease-out',
        'hover:bg-bg-weak-50 active:bg-bg-weak-50',
        'focus-visible:ring-2 focus-visible:ring-primary-base',
      )}
    >
      <span className='flex size-10 items-center justify-center rounded-full bg-primary-alpha-10 text-primary-base'>
        <Icon className='size-5' aria-hidden='true' />
      </span>
      <span>
        <span className='block text-label-md text-text-strong-950'>
          {title}
        </span>
        <span className='mt-0.5 block text-paragraph-xs text-text-sub-600'>
          {description}
        </span>
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

function readinessColor(score: number): 'red' | 'orange' | 'green' {
  if (score >= 70) return 'green';
  if (score >= 40) return 'orange';
  return 'red';
}

function ReadinessSection({ stats }: { stats: Stats }) {
  const { readiness } = stats;

  return (
    <section aria-label='Readiness' className='flex flex-col gap-3'>
      <h2 className={SECTION_HEADING}>Where you stand</h2>

      {readiness.score !== null ? (
        <div className={cn(CARD, 'flex flex-col gap-3 p-4')}>
          <div className='flex items-baseline justify-between gap-2'>
            <p className='text-title-h4 text-text-strong-950'>
              {Math.round(readiness.score)}
              <span className='ml-1 text-paragraph-sm text-text-soft-400'>
                / 100
              </span>
            </p>
            <p className='text-paragraph-xs text-text-sub-600'>
              covers {formatPercent(readiness.coverage)} of the bank
            </p>
          </div>
          <ProgressBar.Root
            value={readiness.score}
            max={100}
            color={readinessColor(readiness.score)}
            aria-label='Readiness score'
          />
          <p className='text-paragraph-xs text-text-sub-600'>
            {stats.answered} answered · {formatPercent(stats.overallAccuracy)}{' '}
            correct
            {stats.streakDays > 1 ? ` · ${stats.streakDays}-day streak` : ''}
          </p>
        </div>
      ) : (
        <div className={cn(CARD, 'p-4')}>
          <p className='text-label-sm text-text-strong-950'>
            Answer {readiness.answersNeeded} more{' '}
            {pluralize(readiness.answersNeeded, 'question')} to see your
            readiness score.
          </p>
          <p className='mt-1 text-paragraph-xs text-text-sub-600'>
            {stats.answered} answered so far ·{' '}
            {formatPercent(stats.overallAccuracy)} correct
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Weak topics + miss queue
// ---------------------------------------------------------------------------

function WeakTopicsSection({
  stats,
  settings,
}: {
  stats: Stats;
  settings: Settings;
}) {
  const weak = weakestTopics(stats.topicStats);
  if (weak.length === 0) return null;

  return (
    <section aria-label='Weak topics' className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between gap-2'>
        <h2 className={SECTION_HEADING}>Weak topics</h2>
        <p className='text-paragraph-xs text-text-soft-400'>Tap to drill</p>
      </div>
      <ul className={cn(CARD, 'divide-y divide-stroke-soft-200 overflow-hidden')}>
        {weak.map((stat) => (
          <li key={stat.topic}>
            <Link
              href={drillHref({ topics: [stat.topic] }, settings)}
              className={ROW_LINK}
              aria-label={`Drill ${topicLabel(stat.topic)}, currently ${formatPercent(stat.accuracy)} correct`}
            >
              <span className='flex-1 text-label-sm text-text-strong-950'>
                {topicLabel(stat.topic)}
              </span>
              <span className='text-label-sm text-text-sub-600'>
                {formatPercent(stat.accuracy)}
              </span>
              <RiArrowRightSLine
                className='size-5 text-text-soft-400'
                aria-hidden='true'
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MissQueueLink({
  stats,
  settings,
}: {
  stats: Stats;
  settings: Settings;
}) {
  const count = stats.missQueue.length;
  if (count === 0) return null;

  // The count comes from the unfiltered miss queue, so the link must serve the ids themselves.
  // Routing this through the tier/topic filters would promise N questions and then hand over
  // however many survived the filter - or, with the bank tier off, an empty-quiz error screen.
  const ids = stats.missQueue
    .slice(0, settings.drillCount)
    .map((missed) => missed.questionId);

  return (
    <Link
      href={drillIdsHref(ids, settings)}
      className={cn(CARD, ROW_LINK, 'overflow-hidden')}
    >
      <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-lighter text-warning-base'>
        <RiFocus2Line className='size-5' aria-hidden='true' />
      </span>
      <span className='flex-1'>
        <span className='block text-label-sm text-text-strong-950'>
          Questions you keep missing: {count}
        </span>
        <span className='block text-paragraph-xs text-text-sub-600'>
          {ids.length < count
            ? `Drill the worst ${ids.length}`
            : 'Drill exactly these'}
        </span>
      </span>
      <RiArrowRightSLine
        className='size-5 text-text-soft-400'
        aria-hidden='true'
      />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Last attempt
// ---------------------------------------------------------------------------

function LastAttemptSection({ attempt }: { attempt: Attempt }) {
  return (
    <section aria-label='Last attempt' className='flex flex-col gap-3'>
      <h2 className={SECTION_HEADING}>Last attempt</h2>
      <Link
        href={`/results?id=${encodeURIComponent(attempt.id)}`}
        className={cn(CARD, ROW_LINK, 'overflow-hidden')}
      >
        <span className='flex-1'>
          <span className='block text-label-sm text-text-strong-950'>
            {modeLabel(attempt.mode)} ·{' '}
            {formatScore(attempt.score, attempt.total)}
          </span>
          <span className='block text-paragraph-xs text-text-sub-600'>
            {formatRelative(attempt.startedAt)} ·{' '}
            {formatDuration(attempt.durationSec)}
          </span>
        </span>
        <RiArrowRightSLine
          className='size-5 text-text-soft-400'
          aria-hidden='true'
        />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cold start + loading
// ---------------------------------------------------------------------------

function ColdStartSection() {
  const counts = React.useMemo(() => tierCounts(), []);
  const countByTier = new Map(counts.map((c) => [c.tier, c.count]));

  return (
    <section aria-label='Getting started' className='flex flex-col gap-3'>
      <h2 className={SECTION_HEADING}>Getting started</h2>
      <div className={cn(CARD, 'p-4')}>
        <p className='text-label-sm text-text-strong-950'>
          Nothing tracked yet.
        </p>
        <p className='mt-1 text-paragraph-sm text-text-sub-600'>
          A mock exam gives you an honest baseline. Practice lets you pick
          topics and see each answer as you go. Your readiness score, weak
          topics, and missed questions all appear here after your first quiz.
        </p>
        <dl className='mt-4 divide-y divide-stroke-soft-200 border-t border-stroke-soft-200'>
          {SOURCE_TIERS.map((tier) => (
            <div
              key={tier}
              className='flex items-center justify-between gap-3 py-2.5'
            >
              <dt className='text-paragraph-sm text-text-sub-600'>
                {TIER_LABELS[tier]}
              </dt>
              <dd className='text-label-sm text-text-strong-950'>
                {countByTier.get(tier) ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function LoadingSection() {
  return (
    <div aria-hidden='true' className='flex flex-col gap-3'>
      <div className='h-4 w-28 animate-pulse rounded bg-bg-weak-50' />
      <div className={cn(CARD, 'flex flex-col gap-3 p-4')}>
        <div className='h-8 w-24 animate-pulse rounded bg-bg-weak-50' />
        <div className='h-1.5 w-full animate-pulse rounded-full bg-bg-weak-50' />
        <div className='h-4 w-48 animate-pulse rounded bg-bg-weak-50' />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function HomeScreen() {
  const { loading, stats, lastAttempt, settings } = useHomeStats();

  const defaultBankSize = React.useMemo(
    () =>
      tierCounts()
        .filter((c) => c.tier !== 'bank')
        .reduce((sum, c) => sum + c.count, 0),
    [],
  );

  const coldStart = !loading && (stats === null || stats.attemptCount === 0);

  return (
    <div className='mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 pb-8 pt-6 md:pt-10'>
      <header>
        <h1 className='text-title-h5 font-extrabold text-text-strong-950 md:sr-only'>
          KNPC Reviser
        </h1>
        <p className='mt-1 text-paragraph-sm text-text-sub-600 md:mt-0'>
          {defaultBankSize} {pluralize(defaultBankSize, 'question')} from
          recalled KNPC and KOC papers and close practice sets.
        </p>
      </header>

      <div className='grid grid-cols-2 gap-3'>
        <PrimaryAction
          href='/setup?mode=mock'
          icon={RiTimerLine}
          title='Mock Exam'
          description='Timed. Scored at the end, like the real paper.'
        />
        <PrimaryAction
          href='/setup?mode=practice'
          icon={RiBookOpenLine}
          title='Practice'
          description='Pick topics. See each answer as you go.'
        />
      </div>

      {loading && <LoadingSection />}

      {coldStart && <ColdStartSection />}

      {!loading && !coldStart && stats && (
        <>
          <ReadinessSection stats={stats} />
          <MissQueueLink stats={stats} settings={settings} />
          <WeakTopicsSection stats={stats} settings={settings} />
          {lastAttempt && <LastAttemptSection attempt={lastAttempt} />}
        </>
      )}
    </div>
  );
}

export default HomeScreen;
