'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { RiCloseLine } from '@remixicon/react';

import * as CompactButton from '@/components/ui/compact-button';
import { isAnswered, isRevealed, type QuizState } from '@/lib/quiz';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// The exam-paper map: every question as a numbered cell, tap to jump. A bottom
// sheet on phones, a centered card at md+. Built straight on Radix Dialog
// because the AlignUI drawer is a right-hand panel and its slide animation is
// baked in.
// ---------------------------------------------------------------------------

type CellStatus = 'current' | 'correct' | 'wrong' | 'answered' | 'skipped' | 'open';

const STATUS_LABEL: Record<CellStatus, string> = {
  current: 'current question',
  correct: 'answered correctly',
  wrong: 'answered incorrectly',
  answered: 'answered',
  skipped: 'skipped',
  open: 'not answered yet',
};

function cellStatus(state: QuizState, index: number): CellStatus {
  if (index === state.index) return 'current';
  const response = state.responses[index];
  const answered = isAnswered(state, index);

  // Practice mode has already shown the verdict, so the map can show it too.
  // Mock mode must not leak anything before submit: answered is just answered.
  if (answered && isRevealed(state, index)) {
    return response?.correct ? 'correct' : 'wrong';
  }
  if (answered) return 'answered';
  if (response?.skipped) return 'skipped';
  return 'open';
}

const CELL_CLASS: Record<CellStatus, string> = {
  current: 'bg-bg-white-0 text-text-strong-950 ring-2 ring-inset ring-primary-base',
  correct: 'bg-success-lighter text-success-dark ring-1 ring-inset ring-success-base',
  wrong: 'bg-error-lighter text-error-dark ring-1 ring-inset ring-error-base',
  answered: 'bg-primary-base text-static-white ring-1 ring-inset ring-primary-base',
  skipped: 'border border-dashed border-stroke-sub-300 bg-bg-weak-50 text-text-sub-600',
  open: 'bg-bg-white-0 text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200',
};

function LegendSwatch({ status, label }: { status: CellStatus; label: string }) {
  return (
    <span className='flex items-center gap-1.5 text-paragraph-xs text-text-sub-600'>
      <span
        aria-hidden='true'
        className={cn('block size-3.5 rounded', CELL_CLASS[status])}
      />
      {label}
    </span>
  );
}

export interface QuestionMapProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: QuizState;
  onJump: (index: number) => void;
}

export function QuestionMap({ open, onOpenChange, state, onJump }: QuestionMapProps) {
  const revealVerdicts = state.responses.some(
    (_response, index) => isAnswered(state, index) && isRevealed(state, index),
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-overlay backdrop-blur-[10px]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            // phone: bottom sheet
            'fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto',
            'rounded-t-20 border-t border-stroke-soft-200 bg-bg-white-0 shadow-regular-md',
            'pb-[env(safe-area-inset-bottom)] focus:outline-none',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-1/2 data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-1/2 data-[state=closed]:fade-out-0 data-[state=closed]:duration-200',
            // desktop: centered card
            'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md',
            'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-20 md:border',
            'md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=open]:zoom-in-95',
            'md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=closed]:zoom-out-95',
          )}
        >
          <div className='flex items-center gap-3 px-5 pb-2 pt-5'>
            <DialogPrimitive.Title className='flex-1 text-label-lg text-text-strong-950'>
              Questions
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <CompactButton.Root variant='ghost' size='large' aria-label='Close question map'>
                <CompactButton.Icon as={RiCloseLine} />
              </CompactButton.Root>
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description className='px-5 text-paragraph-sm text-text-sub-600'>
            Tap a number to jump to that question.
          </DialogPrimitive.Description>

          <div className='grid grid-cols-5 gap-2 p-5 min-[420px]:grid-cols-6 sm:grid-cols-8'>
            {state.questions.map((question, index) => {
              const status = cellStatus(state, index);
              return (
                <button
                  key={question.id}
                  type='button'
                  onClick={() => {
                    onJump(index);
                    onOpenChange(false);
                  }}
                  aria-label={`Question ${index + 1}, ${STATUS_LABEL[status]}`}
                  aria-current={status === 'current' ? 'true' : undefined}
                  className={cn(
                    'flex min-h-11 items-center justify-center rounded-10 text-label-sm tabular-nums',
                    'outline-none transition duration-200 ease-out',
                    'focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2 focus-visible:ring-offset-bg-white-0',
                    CELL_CLASS[status],
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <div className='flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stroke-soft-200 px-5 py-4'>
            <LegendSwatch status='current' label='Current' />
            {revealVerdicts ? (
              <>
                <LegendSwatch status='correct' label='Correct' />
                <LegendSwatch status='wrong' label='Wrong' />
              </>
            ) : (
              <LegendSwatch status='answered' label='Answered' />
            )}
            <LegendSwatch status='skipped' label='Skipped' />
            <LegendSwatch status='open' label='Open' />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default QuestionMap;
