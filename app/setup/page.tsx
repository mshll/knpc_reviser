'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RiArrowLeftLine, RiPlayLine } from '@remixicon/react';

import { HideChrome } from '@/components/app-shell';
import { quizHref } from '@/components/home/quiz-url';
import * as Button from '@/components/ui/button';
import * as Checkbox from '@/components/ui/checkbox';
import * as SegmentedControl from '@/components/ui/segmented-control';
import * as Switch from '@/components/ui/switch';
import { getSettings, DEFAULT_SETTINGS, type Settings } from '@/lib/db';
import {
  MODE_DESCRIPTIONS,
  TIER_DESCRIPTIONS,
  TIER_LABELS,
  modeLabel,
  pluralize,
  topicLabel,
} from '@/lib/format';
import { EMPTY_HISTORY, countMatching, tierCounts, topicCounts } from '@/lib/questions';
import { SOURCE_TIERS, type QuizConfig, type SourceTier, type Topic } from '@/lib/types';
import { cn } from '@/utils/cn';

const MOCK_COUNTS = [20, 40, 60] as const;
const PRACTICE_COUNTS = [10, 20, 30] as const;

const SECTION_HEADING =
  'text-subheading-xs uppercase tracking-wide text-text-soft-400';

type SetupMode = 'mock' | 'practice';

// ---------------------------------------------------------------------------
// Small form rows
// ---------------------------------------------------------------------------

function SwitchRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className='flex min-h-[2.75rem] items-center gap-3 py-1.5'>
      <label htmlFor={id} className='flex-1 cursor-pointer select-none'>
        <span className='block text-label-sm text-text-strong-950'>
          {title}
        </span>
        <span className='mt-0.5 block text-paragraph-xs text-text-sub-600'>
          {description}
        </span>
      </label>
      <Switch.Root id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function TierRow({
  tier,
  count,
  checked,
  onCheckedChange,
}: {
  tier: SourceTier;
  count: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `tier-${tier}`;
  return (
    <label
      htmlFor={id}
      className='flex min-h-[2.75rem] cursor-pointer select-none items-start gap-3 py-3'
    >
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(state) => onCheckedChange(state === true)}
        className='mt-0.5'
      />
      <span className='flex-1'>
        <span className='flex items-baseline justify-between gap-2'>
          <span className='text-label-sm text-text-strong-950'>
            {TIER_LABELS[tier]}
          </span>
          <span className='text-paragraph-xs text-text-soft-400'>{count}</span>
        </span>
        <span className='mt-0.5 block text-paragraph-xs text-text-sub-600'>
          {TIER_DESCRIPTIONS[tier]}
        </span>
      </span>
    </label>
  );
}

function TopicRow({
  topic,
  count,
  checked,
  onCheckedChange,
}: {
  topic: Topic;
  count: number;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = `topic-${topic}`;
  return (
    <label
      htmlFor={id}
      className='flex min-h-[2.75rem] cursor-pointer select-none items-center gap-3 py-2'
    >
      <Checkbox.Root
        id={id}
        checked={checked}
        onCheckedChange={(state) => onCheckedChange(state === true)}
      />
      <span className='flex-1 text-label-sm text-text-strong-950'>
        {topicLabel(topic)}
      </span>
      <span className='text-paragraph-sm text-text-soft-400'>{count}</span>
    </label>
  );
}

function CountControl({
  options,
  value,
  onChange,
}: {
  options: readonly number[];
  value: number;
  onChange: (count: number) => void;
}) {
  return (
    <SegmentedControl.Root
      value={String(value)}
      onValueChange={(v) => onChange(Number(v))}
    >
      <SegmentedControl.List>
        {options.map((option) => (
          <SegmentedControl.Trigger
            key={option}
            value={String(option)}
            className='h-10'
            aria-label={`${option} questions`}
          >
            {option}
          </SegmentedControl.Trigger>
        ))}
      </SegmentedControl.List>
    </SegmentedControl.Root>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

function SetupForm({ mode, settings }: { mode: SetupMode; settings: Settings }) {
  const router = useRouter();

  const countOptions = mode === 'mock' ? MOCK_COUNTS : PRACTICE_COUNTS;
  const defaultCount =
    mode === 'mock'
      ? 40
      : PRACTICE_COUNTS.includes(
            settings.practiceCount as (typeof PRACTICE_COUNTS)[number],
          )
        ? settings.practiceCount
        : 20;

  const [count, setCount] = React.useState<number>(defaultCount);
  const [timed, setTimed] = React.useState(
    mode === 'mock' ? settings.mockTimeLimitSec !== null : false,
  );
  const [tiers, setTiers] = React.useState<SourceTier[]>(
    settings.defaultTiers.length > 0
      ? [...settings.defaultTiers]
      : ['gold', 'practice'],
  );
  const [allTopics, setAllTopics] = React.useState(true);
  const [selectedTopics, setSelectedTopics] = React.useState<Set<Topic>>(
    () => new Set(),
  );

  const toggleTier = (tier: SourceTier, on: boolean) => {
    setTiers((prev) => {
      const next = prev.filter((t) => t !== tier);
      if (on) next.push(tier);
      return SOURCE_TIERS.filter((t) => next.includes(t));
    });
  };

  const toggleTopic = (topic: Topic, on: boolean) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (on) next.add(topic);
      else next.delete(topic);
      return next;
    });
  };

  const availableTopics = React.useMemo(
    () =>
      topicCounts({
        tiers: tiers.length > 0 ? tiers : undefined,
      }),
    [tiers],
  );

  const tierTotals = React.useMemo(() => {
    const map = new Map(tierCounts().map((c) => [c.tier, c.count]));
    return (tier: SourceTier) => map.get(tier) ?? 0;
  }, []);

  const topics = React.useMemo<Topic[] | 'all'>(
    () => (mode === 'mock' || allTopics ? 'all' : Array.from(selectedTopics)),
    [mode, allTopics, selectedTopics],
  );

  const matching = React.useMemo(() => {
    if (tiers.length === 0) return 0;
    if (topics !== 'all' && topics.length === 0) return 0;
    const probe: QuizConfig = {
      mode,
      topics,
      tiers,
      count: Number.MAX_SAFE_INTEGER,
      timeLimitSec: null,
      onlyMissed: false,
      shuffleOptions: settings.shuffleOptions,
    };
    return countMatching(probe, EMPTY_HISTORY);
  }, [mode, topics, tiers, settings.shuffleOptions]);

  const effectiveCount = Math.min(count, matching);
  const noTiers = tiers.length === 0;
  const noTopics = mode === 'practice' && !allTopics && selectedTopics.size === 0;
  const disabled = noTiers || noTopics || matching === 0;

  const statusLine = noTiers
    ? 'Turn on at least one source.'
    : noTopics
      ? 'Pick at least one topic.'
      : matching === 0
        ? 'No questions match these filters.'
        : matching < count
          ? `Only ${matching} ${pluralize(matching, 'question')} ${matching === 1 ? 'matches' : 'match'}; the quiz will be ${matching} ${pluralize(matching, 'question')}.`
          : `${matching} ${pluralize(matching, 'question')} match your filters.`;

  const start = () => {
    if (disabled) return;
    const config: QuizConfig = {
      mode,
      topics,
      tiers,
      count: effectiveCount,
      timeLimitSec: timed ? effectiveCount * 60 : null,
      onlyMissed: false,
      shuffleOptions: settings.shuffleOptions,
    };
    router.push(quizHref(config));
  };

  return (
    <>
      <div className='mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-5 pb-40 pt-3'>
        <header>
          <Link
            href='/'
            aria-label='Back to home'
            className={cn(
              '-ml-3 flex size-11 items-center justify-center rounded-10 text-text-sub-600 outline-none',
              'transition duration-200 ease-out',
              'hover:bg-bg-weak-50 hover:text-text-strong-950',
              'focus-visible:ring-2 focus-visible:ring-primary-base',
            )}
          >
            <RiArrowLeftLine className='size-5' aria-hidden='true' />
          </Link>
          <h1 className='mt-2 text-title-h5 text-text-strong-950'>
            {modeLabel(mode)}
          </h1>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>
            {MODE_DESCRIPTIONS[mode]}
          </p>
        </header>

        <section aria-label='Questions' className='flex flex-col gap-3'>
          <h2 className={SECTION_HEADING}>Questions</h2>
          <CountControl options={countOptions} value={count} onChange={setCount} />
          <SwitchRow
            id='timed'
            title='Timer'
            description={
              timed
                ? `One minute per question: ${effectiveCount} ${pluralize(effectiveCount, 'minute')} total.`
                : 'No time limit.'
            }
            checked={timed}
            onCheckedChange={setTimed}
          />
        </section>

        <section aria-label='Topics' className='flex flex-col gap-1'>
          <h2 className={cn(SECTION_HEADING, 'mb-2')}>Topics</h2>
          {mode === 'mock' ? (
            <p className='text-paragraph-sm text-text-sub-600'>
              All topics, mixed like the real paper.
            </p>
          ) : (
            <>
              <SwitchRow
                id='all-topics'
                title='All topics'
                description='Turn off to pick specific topics.'
                checked={allTopics}
                onCheckedChange={setAllTopics}
              />
              {!allTopics && (
                <ul className='divide-y divide-stroke-soft-200 border-t border-stroke-soft-200'>
                  {availableTopics.map(({ topic, count: n }) => (
                    <li key={topic}>
                      <TopicRow
                        topic={topic}
                        count={n}
                        checked={selectedTopics.has(topic)}
                        onCheckedChange={(on) => toggleTopic(topic, on)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section aria-label='Sources' className='flex flex-col gap-1'>
          <h2 className={cn(SECTION_HEADING, 'mb-1')}>Sources</h2>
          <div className='divide-y divide-stroke-soft-200'>
            {SOURCE_TIERS.map((tier) => (
              <TierRow
                key={tier}
                tier={tier}
                count={tierTotals(tier)}
                checked={tiers.includes(tier)}
                onCheckedChange={(on) => toggleTier(tier, on)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className='fixed inset-x-0 bottom-0 z-40 border-t border-stroke-soft-200 bg-bg-white-0/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-xl flex-col gap-2 px-5 py-3'>
          <p
            aria-live='polite'
            className={cn(
              'text-paragraph-xs',
              disabled ? 'text-error-base' : 'text-text-sub-600',
            )}
          >
            {statusLine}
          </p>
          <Button.Root
            variant='primary'
            mode='filled'
            className='h-12 w-full rounded-10'
            disabled={disabled}
            onClick={start}
          >
            <Button.Icon as={RiPlayLine} />
            {mode === 'mock'
              ? `Start mock exam${disabled ? '' : ` · ${effectiveCount} questions`}`
              : `Start practice${disabled ? '' : ` · ${effectiveCount} questions`}`}
          </Button.Root>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Settings gate + suspense boundary for useSearchParams
// ---------------------------------------------------------------------------

function SetupSkeleton() {
  return (
    <div
      aria-hidden='true'
      className='mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pt-6'
    >
      <div className='h-8 w-40 animate-pulse rounded bg-bg-weak-50' />
      <div className='h-10 w-full animate-pulse rounded-10 bg-bg-weak-50' />
      <div className='h-24 w-full animate-pulse rounded-10 bg-bg-weak-50' />
      <div className='h-40 w-full animate-pulse rounded-10 bg-bg-weak-50' />
    </div>
  );
}

function SetupScreen() {
  const params = useSearchParams();
  const mode: SetupMode = params.get('mode') === 'mock' ? 'mock' : 'practice';

  const [settings, setSettings] = React.useState<Settings | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        if (!cancelled) setSettings(DEFAULT_SETTINGS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!settings) return <SetupSkeleton />;
  return <SetupForm key={mode} mode={mode} settings={settings} />;
}

export default function SetupPage() {
  return (
    <>
      <HideChrome />
      <React.Suspense fallback={<SetupSkeleton />}>
        <SetupScreen />
      </React.Suspense>
    </>
  );
}
