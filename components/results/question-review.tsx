'use client';

import * as React from 'react';
import {
  RiCheckLine,
  RiCloseLine,
  RiQuestionLine,
  RiSkipForwardLine,
} from '@remixicon/react';

import * as Badge from '@/components/ui/badge';
import * as SegmentedControl from '@/components/ui/segmented-control';
import QuestionView from '@/components/question-view';
import type { ReviewRow } from '@/components/results/topic-breakdown';
import { verdictOf, type Verdict } from '@/components/results/verdict';
import { formatDuration } from '@/lib/format';
import { isFreeText } from '@/lib/quiz';

export type ReviewFilter = 'all' | 'wrong' | 'skipped' | 'ungraded';

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (verdict === 'correct') {
    return (
      <Badge.Root variant='lighter' color='green' size='medium'>
        <Badge.Icon as={RiCheckLine} />
        Correct
      </Badge.Root>
    );
  }
  if (verdict === 'wrong') {
    return (
      <Badge.Root variant='lighter' color='red' size='medium'>
        <Badge.Icon as={RiCloseLine} />
        Wrong
      </Badge.Root>
    );
  }
  if (verdict === 'ungraded') {
    return (
      <Badge.Root variant='lighter' color='orange' size='medium'>
        <Badge.Icon as={RiQuestionLine} />
        Needs grading
      </Badge.Root>
    );
  }
  return (
    <Badge.Root variant='lighter' color='gray' size='medium'>
      <Badge.Icon as={RiSkipForwardLine} />
      Skipped
    </Badge.Root>
  );
}

const EMPTY_FILTER_COPY: Record<Exclude<ReviewFilter, 'all'>, string> = {
  wrong: 'Nothing wrong in this attempt. Clean sweep.',
  skipped: 'Nothing was skipped in this attempt.',
  ungraded: 'Every written answer in this attempt has been graded.',
};

interface NumberedRow extends ReviewRow {
  /** 1-based position in the original attempt, stable across filters. */
  number: number;
}

export interface QuestionReviewProps {
  rows: readonly ReviewRow[];
  totalInAttempt: number;
  /** Settles a free-text item the user has not graded yet. Omit to keep the review read-only. */
  onSelfGrade?: (questionId: string, correct: boolean) => void;
  /** Controlled by the results screen, so its "N answers need grading" alert can jump here. */
  filter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
}

/** The full question-by-question review, filterable to wrong / skipped / ungraded. */
export function QuestionReview({
  rows,
  totalInAttempt,
  onSelfGrade,
  filter,
  onFilterChange,
}: QuestionReviewProps) {
  const numbered = React.useMemo<NumberedRow[]>(
    () => rows.map((row, index) => ({ ...row, number: index + 1 })),
    [rows],
  );

  const wrongCount = numbered.filter(
    (row) => verdictOf(row.question, row.response) === 'wrong',
  ).length;
  const skippedCount = numbered.filter(
    (row) => verdictOf(row.question, row.response) === 'skipped',
  ).length;
  const ungradedCount = numbered.filter(
    (row) => verdictOf(row.question, row.response) === 'ungraded',
  ).length;

  const visible = numbered.filter((row) => {
    if (filter === 'all') return true;
    return verdictOf(row.question, row.response) === filter;
  });

  return (
    <section
      id='review'
      aria-label='Question review'
      className='flex scroll-mt-4 flex-col gap-4'
    >
      <h2 className='text-label-lg text-text-strong-950'>Review</h2>

      <SegmentedControl.Root
        value={filter}
        onValueChange={(value) => onFilterChange(value as ReviewFilter)}
      >
        <SegmentedControl.List>
          <SegmentedControl.Trigger value='all' className='h-9'>
            All ({numbered.length})
          </SegmentedControl.Trigger>
          <SegmentedControl.Trigger value='wrong' className='h-9'>
            Wrong ({wrongCount})
          </SegmentedControl.Trigger>
          <SegmentedControl.Trigger value='skipped' className='h-9'>
            Skipped ({skippedCount})
          </SegmentedControl.Trigger>
          {/* Only shown when there is something to grade: on a 390px phone a fourth
              permanent tab would crush the other three for nothing. It stays while it is
              the active tab, so grading the last item does not pull the selected tab out
              from under the user. */}
          {(ungradedCount > 0 || filter === 'ungraded') && (
            <SegmentedControl.Trigger value='ungraded' className='h-9'>
              Ungraded ({ungradedCount})
            </SegmentedControl.Trigger>
          )}
        </SegmentedControl.List>

        <SegmentedControl.Content value={filter} className='mt-4 focus:outline-none'>
          {visible.length === 0 && filter !== 'all' ? (
            <p className='rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4 text-center text-paragraph-sm text-text-sub-600'>
              {EMPTY_FILTER_COPY[filter]}
            </p>
          ) : (
            <ul className='flex flex-col gap-4'>
              {visible.map((row) => {
                const verdict = verdictOf(row.question, row.response);
                const gradable = onSelfGrade && isFreeText(row.question);
                return (
                  <li
                    key={row.question.id}
                    className='flex flex-col gap-4 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 md:p-5'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <span className='text-label-sm text-text-sub-600'>
                        Question {row.number} of {totalInAttempt}
                      </span>
                      <div className='flex items-center gap-2'>
                        {row.response.timeSpentSec > 0 && (
                          <span className='text-paragraph-xs text-text-soft-400'>
                            {formatDuration(row.response.timeSpentSec)}
                          </span>
                        )}
                        <VerdictBadge verdict={verdict} />
                      </div>
                    </div>

                    <QuestionView
                      question={row.question}
                      selected={row.response.selected}
                      reveal
                      text={row.response.text ?? ''}
                      selfGraded={
                        row.response.selfGraded ? row.response.correct : null
                      }
                      onSelfGrade={
                        gradable
                          ? (correct) => onSelfGrade(row.question.id, correct)
                          : undefined
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </SegmentedControl.Content>
      </SegmentedControl.Root>
    </section>
  );
}

export default QuestionReview;
