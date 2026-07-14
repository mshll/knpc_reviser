'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiArrowLeftLine, RiErrorWarningLine } from '@remixicon/react';

import * as Alert from '@/components/ui/alert';
import * as Button from '@/components/ui/button';
import * as Divider from '@/components/ui/divider';
import QuestionReview, {
  type ReviewFilter,
} from '@/components/results/question-review';
import ScoreSummary from '@/components/results/score-summary';
import TopicBreakdown, {
  type ReviewRow,
} from '@/components/results/topic-breakdown';
import { verdictOf } from '@/components/results/verdict';
import { getAttempt, saveAttempt } from '@/lib/db';
import { pluralize } from '@/lib/format';
import { getQuestionById, replayQuestions } from '@/lib/questions';
import { scoreOf } from '@/lib/quiz';
import type { Attempt } from '@/lib/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; attempt: Attempt };

function ResultsSkeleton() {
  return (
    <div aria-hidden='true' className='flex animate-pulse flex-col items-center gap-6 py-10'>
      <div className='h-4 w-40 rounded-full bg-bg-weak-50' />
      <div className='h-16 w-32 rounded-10 bg-bg-weak-50' />
      <div className='h-4 w-52 rounded-full bg-bg-weak-50' />
      <div className='h-11 w-full max-w-sm rounded-10 bg-bg-weak-50' />
      <div className='h-40 w-full rounded-2xl bg-bg-weak-50' />
    </div>
  );
}

function MissingAttempt() {
  return (
    <div className='flex flex-col items-center gap-4 py-16 text-center'>
      <h1 className='text-title-h5 text-text-strong-950'>Attempt not found</h1>
      <p className='max-w-sm text-paragraph-sm text-text-sub-600'>
        History lives in this browser&apos;s storage, so an attempt from another
        device or a cleared browser cannot be opened here.
      </p>
      <Button.Root asChild variant='neutral' mode='stroke' className='h-11'>
        <Link href='/history'>
          <Button.Icon as={RiArrowLeftLine} />
          Back to history
        </Link>
      </Button.Root>
    </div>
  );
}

export function ResultsScreen({ attemptId }: { attemptId: string | null }) {
  const [state, setState] = React.useState<LoadState>(
    attemptId ? { status: 'loading' } : { status: 'missing' },
  );
  const [gradeError, setGradeError] = React.useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = React.useState<ReviewFilter>('all');

  const stateRef = React.useRef(state);
  stateRef.current = state;

  // The ungraded items can sit anywhere in a 50-question review. Filter to them and jump,
  // rather than asking the user to thumb past 47 cards hunting for three badges.
  const showUngraded = React.useCallback(() => {
    setReviewFilter('ungraded');
    document.getElementById('review')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Free text is never auto-graded and a mock reveals nothing until submit, so this is the
  // first and only place the user can settle a worked_problem. Persist it: the score, the
  // topic stats and the miss queue all read from the stored attempt.
  const handleSelfGrade = React.useCallback(
    (questionId: string, correct: boolean) => {
      const current = stateRef.current;
      if (current.status !== 'ready') return;

      const responses = current.attempt.responses.map((response) =>
        response.questionId === questionId
          ? { ...response, correct, selfGraded: true, skipped: false }
          : response,
      );
      const next: Attempt = {
        ...current.attempt,
        responses,
        score: scoreOf(responses),
      };

      setGradeError(null);
      setState({ status: 'ready', attempt: next });

      void saveAttempt(next).catch((error: unknown) => {
        console.error('[results] could not persist the grade:', error);
        setGradeError(
          'That grade could not be saved, so it will be lost when you leave this page.',
        );
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!attemptId) {
      setState({ status: 'missing' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getAttempt(attemptId)
      .then((attempt) => {
        if (cancelled) return;
        setState(attempt ? { status: 'ready', attempt } : { status: 'missing' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : 'Could not read storage.';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const attempt = state.status === 'ready' ? state.attempt : null;

  const rows = React.useMemo<ReviewRow[]>(() => {
    if (!attempt) return [];
    const responseById = new Map(
      attempt.responses.map((response) => [response.questionId, response]),
    );
    return replayQuestions(attempt).flatMap((question) => {
      const response = responseById.get(question.id);
      return response ? [{ question, response }] : [];
    });
  }, [attempt]);

  if (state.status === 'loading') {
    return (
      <div className='mx-auto w-full max-w-2xl px-4 md:px-6'>
        <ResultsSkeleton />
      </div>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className='mx-auto w-full max-w-2xl px-4 md:px-6'>
        <MissingAttempt />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className='mx-auto w-full max-w-2xl px-4 py-8 md:px-6'>
        <Alert.Root variant='lighter' status='error' size='small'>
          <Alert.Icon as={RiErrorWarningLine} />
          Could not load this attempt: {state.message}
        </Alert.Root>
      </div>
    );
  }

  const readyAttempt = state.attempt;

  const graded = readyAttempt.responses.map((response) => ({
    response,
    verdict: verdictOf(getQuestionById(response.questionId), response),
  }));

  const correctCount = graded.filter((row) => row.verdict === 'correct').length;
  const wrongCount = graded.filter((row) => row.verdict === 'wrong').length;
  const skippedCount = graded.filter((row) => row.verdict === 'skipped').length;
  const ungradedCount = graded.filter((row) => row.verdict === 'ungraded').length;

  // Only genuinely wrong answers are worth re-drilling. An ungraded item is not a miss yet.
  const drillIds = graded
    .filter((row) => row.verdict === 'wrong')
    .map((row) => row.response.questionId)
    .filter((id) => getQuestionById(id) !== undefined);

  const missingFromBank = readyAttempt.questionIds.length - rows.length;

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8 md:px-6 md:py-12'>
      <div>
        <Link
          href='/history'
          className='inline-flex min-h-11 items-center gap-1.5 text-label-sm text-text-sub-600 outline-none hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base'
        >
          <RiArrowLeftLine className='size-4' />
          History
        </Link>
      </div>

      <ScoreSummary
        attempt={readyAttempt}
        correctCount={correctCount}
        wrongCount={wrongCount}
        skippedCount={skippedCount}
        drillIds={drillIds}
      />

      {ungradedCount > 0 && (
        <button
          type='button'
          onClick={showUngraded}
          className='min-h-11 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-base'
        >
          <Alert.Root variant='lighter' status='warning' size='small'>
            <Alert.Icon as={RiErrorWarningLine} />
            {ungradedCount} written {pluralize(ungradedCount, 'answer')} below{' '}
            {ungradedCount === 1 ? 'is' : 'are'} not graded yet. Your score counts{' '}
            {ungradedCount === 1 ? 'it' : 'them'} as wrong until you do. Tap to review{' '}
            {ungradedCount === 1 ? 'it' : 'them'}.
          </Alert.Root>
        </button>
      )}

      {gradeError && (
        <Alert.Root variant='lighter' status='error' size='small'>
          <Alert.Icon as={RiErrorWarningLine} />
          {gradeError}
        </Alert.Root>
      )}

      <Divider.Root />

      <TopicBreakdown rows={rows} />

      <Divider.Root />

      {missingFromBank > 0 && (
        <Alert.Root variant='lighter' status='warning' size='small'>
          <Alert.Icon as={RiErrorWarningLine} />
          {missingFromBank} {pluralize(missingFromBank, 'question')} from this
          attempt {missingFromBank === 1 ? 'is' : 'are'} no longer in the bank
          and cannot be shown.
        </Alert.Root>
      )}

      <QuestionReview
        rows={rows}
        totalInAttempt={readyAttempt.questionIds.length}
        onSelfGrade={handleSelfGrade}
        filter={reviewFilter}
        onFilterChange={setReviewFilter}
      />
    </div>
  );
}

export default ResultsScreen;
