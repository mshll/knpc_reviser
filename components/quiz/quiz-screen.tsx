'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { RiErrorWarningLine, RiHistoryLine, RiPlayLine } from '@remixicon/react';

import * as Button from '@/components/ui/button';
import { QuizRunner } from '@/components/quiz/quiz-runner';
import {
  clearSession,
  loadSession,
  restoreQuizState,
  saveSession,
  sessionRemainingSec,
  type StoredSession,
} from '@/components/quiz/session-store';
import { getAllResponses, getMissedQuestionIds, getSettings, type Settings } from '@/lib/db';
import { formatClock, formatRelative, modeLabel, pluralize } from '@/lib/format';
import {
  EMPTY_HISTORY,
  getQuestionById,
  newAttemptId,
  selectQuestions,
  selectQuestionsByIds,
  type SelectionHistory,
} from '@/lib/questions';
import { createQuizState, type QuizState } from '@/lib/quiz';
import { computeTopicStats } from '@/lib/stats';
import {
  QUIZ_MODES,
  SOURCE_TIERS,
  TOPICS,
  type Attempt,
  type QuizConfig,
  type QuizMode,
  type SourceTier,
  type Topic,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Orchestrates the /quiz route.
//
// /setup (and the home screen's one-tap drills) push here with the query-string
// contract from components/home/quiz-url.ts: mode + count means "a full config,
// start now". A stored in-progress session always wins over a new config - the
// user is offered a resume, never silently costed a mock. Bare /quiz redirects
// to /setup.
// ---------------------------------------------------------------------------

interface UrlConfig {
  mode?: QuizMode;
  topics?: Topic[];
  tiers?: SourceTier[];
  /** An explicit question-id list. Results emits this for "drill the ones I got wrong". */
  ids?: string[];
  count?: number;
  timeLimitSec: number | null;
  onlyMissed: boolean;
  shuffleOptions: boolean;
}

function parseUrlConfig(params: URLSearchParams): UrlConfig {
  const out: UrlConfig = {
    // Per the quiz-url contract: absent time = untimed, absent missed = off, absent
    // shuffle = shuffle. An old link's `unverified` param is read past and ignored -
    // unverified items are no longer in the bank, so there is nothing to opt in to.
    timeLimitSec: null,
    onlyMissed: params.get('missed') === '1',
    shuffleOptions: params.get('shuffle') !== '0',
  };

  const mode = params.get('mode');
  if (mode && (QUIZ_MODES as readonly string[]).includes(mode)) {
    out.mode = mode as QuizMode;
  }

  const topics = params.get('topics');
  if (topics) {
    const parsed = topics
      .split(',')
      .filter((entry): entry is Topic => (TOPICS as readonly string[]).includes(entry));
    if (parsed.length > 0) out.topics = parsed;
  }

  const tiers = params.get('tiers');
  if (tiers) {
    const parsed = tiers
      .split(',')
      .filter((entry): entry is SourceTier =>
        (SOURCE_TIERS as readonly string[]).includes(entry),
      );
    if (parsed.length > 0) out.tiers = parsed;
  }

  const ids = params.get('ids');
  if (ids) {
    const parsed = ids
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (parsed.length > 0) out.ids = parsed;
  }

  const count = Number(params.get('count'));
  if (Number.isInteger(count) && count > 0) out.count = count;

  const time = Number(params.get('time'));
  if (Number.isInteger(time) && time > 0) out.timeLimitSec = time;

  return out;
}

/**
 * A drill link may legitimately omit `count` (the history screen's topic rows do), so the
 * mode's saved default fills it in rather than the whole link failing shut to /setup.
 */
function defaultCountFor(mode: QuizMode, settings: Settings): number {
  switch (mode) {
    case 'mock':
      return settings.mockCount;
    case 'practice':
      return settings.practiceCount;
    case 'drill':
      return settings.drillCount;
  }
}

/** What to actually serve. `ids` non-null means "exactly these questions, in this set". */
interface StartPlan {
  config: QuizConfig;
  ids: string[] | null;
}

function toStartPlan(url: UrlConfig, settings: Settings): StartPlan | null {
  if (!url.mode) return null;

  // An explicit id list bypasses tier and topic filtering by design: a question you missed
  // while the bank tier was on must still be re-drillable after you turn it off. It cannot
  // bypass quarantine - selectQuestionsByIds reads the servable pool.
  if (url.ids && url.ids.length > 0) {
    return {
      ids: url.ids,
      config: {
        mode: url.mode,
        topics: 'all',
        tiers: [...SOURCE_TIERS],
        count: url.ids.length,
        timeLimitSec: url.timeLimitSec,
        onlyMissed: false,
        shuffleOptions: url.shuffleOptions,
      },
    };
  }

  return {
    ids: null,
    config: {
      mode: url.mode,
      topics: url.topics && url.topics.length > 0 ? url.topics : 'all',
      tiers: url.tiers ?? [...settings.defaultTiers],
      count: url.count ?? defaultCountFor(url.mode, settings),
      timeLimitSec: url.timeLimitSec,
      onlyMissed: url.onlyMissed,
      shuffleOptions: url.shuffleOptions,
    },
  };
}

type Phase =
  | { kind: 'boot' }
  | { kind: 'resume'; session: StoredSession; nextPlan: StartPlan | null }
  | { kind: 'running'; state: QuizState; deadlineAt: number | null }
  | { kind: 'error'; message: string };

function sessionEngagedCount(session: StoredSession): number {
  return session.responses.filter(
    (response) =>
      response.selected.length > 0 ||
      response.selfGraded === true ||
      (response.text !== undefined && response.text.trim().length > 0),
  ).length;
}

function BootSkeleton() {
  return (
    <div
      className='mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 md:py-12'
      role='status'
      aria-label='Preparing your quiz'
    >
      <div className='h-1 w-full overflow-hidden rounded-full bg-bg-weak-50'>
        <div className='h-full w-1/3 animate-pulse rounded-full bg-bg-soft-200' />
      </div>
      <div className='flex flex-col gap-4 pt-4'>
        <div className='h-5 w-40 animate-pulse rounded-md bg-bg-weak-50' />
        <div className='h-7 w-full animate-pulse rounded-md bg-bg-weak-50' />
        <div className='h-7 w-2/3 animate-pulse rounded-md bg-bg-weak-50' />
      </div>
      <div className='flex flex-col gap-3 pt-2'>
        <div className='h-14 w-full animate-pulse rounded-10 bg-bg-weak-50' />
        <div className='h-14 w-full animate-pulse rounded-10 bg-bg-weak-50' />
        <div className='h-14 w-full animate-pulse rounded-10 bg-bg-weak-50' />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className='mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center'>
      <div className='flex size-14 items-center justify-center rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200'>
        <RiErrorWarningLine className='size-6 text-text-sub-600' />
      </div>
      <div className='flex flex-col gap-1'>
        <h1 className='text-title-h6 text-text-strong-950'>Nothing to quiz</h1>
        <p className='text-paragraph-sm text-text-sub-600'>{message}</p>
      </div>
      <Button.Root variant='primary' mode='filled' asChild className='h-11 px-6'>
        <Link href='/setup'>Open quiz setup</Link>
      </Button.Root>
    </div>
  );
}

function ResumePrompt({
  session,
  onResume,
  onDiscard,
}: {
  session: StoredSession;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const engaged = sessionEngagedCount(session);
  const total = session.questionIds.length;
  const remaining = sessionRemainingSec(session);

  return (
    <div className='mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10'>
      <div className='flex flex-col items-center gap-4 text-center'>
        <div className='flex size-14 items-center justify-center rounded-full bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200'>
          <RiHistoryLine className='size-6 text-text-sub-600' />
        </div>
        <div className='flex flex-col gap-1'>
          <h1 className='text-title-h6 text-text-strong-950'>Pick up where you left off?</h1>
          <p className='text-paragraph-sm text-text-sub-600'>
            {modeLabel(session.config.mode)}, {engaged} of {total}{' '}
            {pluralize(total, 'question')} answered, started {formatRelative(session.startedAt)}.
          </p>
          {remaining !== null && (
            <p className='text-paragraph-sm text-text-sub-600'>
              {remaining > 0
                ? `${formatClock(remaining)} left on the clock.`
                : 'The time limit has expired. Resuming will submit it as it stands.'}
            </p>
          )}
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <Button.Root
          type='button'
          variant='primary'
          mode='filled'
          onClick={onResume}
          className='h-12 w-full text-label-md'
        >
          <Button.Icon as={RiPlayLine} />
          Resume quiz
        </Button.Root>
        <Button.Root
          type='button'
          variant='neutral'
          mode='ghost'
          onClick={onDiscard}
          className='h-11 w-full'
        >
          Discard it and start fresh
        </Button.Root>
      </div>
    </div>
  );
}

export function QuizScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlConfig = React.useMemo(
    () => parseUrlConfig(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [phase, setPhase] = React.useState<Phase>({ kind: 'boot' });

  const start = React.useCallback(
    (plan: StartPlan, selectionHistory: SelectionHistory) => {
      const attemptId = newAttemptId();
      const { config } = plan;
      const questions = plan.ids
        ? selectQuestionsByIds(plan.ids, attemptId, {
            shuffleOptions: config.shuffleOptions,
          })
        : selectQuestions(config, selectionHistory, attemptId);

      if (questions.length === 0) {
        setPhase({
          kind: 'error',
          message: plan.ids
            ? 'Those questions are no longer in the question bank, so they cannot be drilled.'
            : 'No questions match that setup. Loosen the topic filter or switch on more sources.',
        });
        return;
      }

      const startedAt = Date.now();
      const finalConfig: QuizConfig = { ...config, count: questions.length };
      const state = createQuizState({ attemptId, config: finalConfig, questions, startedAt });
      const deadlineAt =
        finalConfig.timeLimitSec !== null
          ? startedAt + finalConfig.timeLimitSec * 1000
          : null;

      saveSession(state, deadlineAt);
      setPhase({ kind: 'running', state, deadlineAt });
    },
    [],
  );

  const loadHistory = React.useCallback(async (): Promise<SelectionHistory> => {
    try {
      const [missedIds, responses] = await Promise.all([
        getMissedQuestionIds(),
        getAllResponses(),
      ]);
      return {
        missedQuestionIds: missedIds,
        topicStats: computeTopicStats(responses, getQuestionById),
      };
    } catch (error) {
      console.warn('[quiz] could not load history, selecting without it:', error);
      return EMPTY_HISTORY;
    }
  }, []);

  React.useEffect(() => {
    if (phase.kind !== 'boot') return;
    let cancelled = false;

    void (async () => {
      let settings: Settings;
      try {
        settings = await getSettings();
      } catch (error) {
        console.warn('[quiz] could not load settings, using defaults:', error);
        const { DEFAULT_SETTINGS } = await import('@/lib/db');
        settings = DEFAULT_SETTINGS;
      }
      const plan = toStartPlan(urlConfig, settings);

      // An interrupted attempt always wins: never silently throw away a mock.
      const session = loadSession();
      if (cancelled) return;
      if (session) {
        setPhase({ kind: 'resume', session, nextPlan: plan });
        return;
      }

      if (!plan) {
        router.replace('/setup');
        return;
      }

      const history = await loadHistory();
      if (cancelled) return;
      start(plan, history);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase.kind, urlConfig, router, start, loadHistory]);

  const handleResume = React.useCallback(() => {
    if (phase.kind !== 'resume') return;
    const restored = restoreQuizState(phase.session);
    if (!restored) {
      clearSession();
      setPhase({
        kind: 'error',
        message:
          'The interrupted session could not be restored because the question bank has changed since it started.',
      });
      return;
    }
    setPhase({ kind: 'running', state: restored, deadlineAt: phase.session.deadlineAt });
  }, [phase]);

  const handleDiscard = React.useCallback(() => {
    if (phase.kind !== 'resume') return;
    clearSession();
    const plan = phase.nextPlan;
    if (!plan) {
      router.replace('/setup');
      return;
    }
    // Stay on the current phase while history loads; start() swaps to running.
    void loadHistory().then((history) => start(plan, history));
  }, [phase, router, start, loadHistory]);

  const handleFinished = React.useCallback(
    (attempt: Attempt) => {
      router.push(`/results?id=${encodeURIComponent(attempt.id)}`);
    },
    [router],
  );

  const handleExit = React.useCallback(() => {
    router.push('/');
  }, [router]);

  if (phase.kind === 'running') {
    return (
      <QuizRunner
        key={phase.state.attemptId}
        initialState={phase.state}
        deadlineAt={phase.deadlineAt}
        onFinished={handleFinished}
        onExit={handleExit}
      />
    );
  }

  if (phase.kind === 'resume') {
    return (
      <ResumePrompt session={phase.session} onResume={handleResume} onDiscard={handleDiscard} />
    );
  }

  if (phase.kind === 'error') {
    return <ErrorState message={phase.message} />;
  }

  return <BootSkeleton />;
}

export default QuizScreen;
