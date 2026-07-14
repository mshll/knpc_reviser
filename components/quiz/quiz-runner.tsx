'use client';

import * as React from 'react';
import {
  RiArrowLeftSLine,
  RiArrowRightLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiLayoutGridLine,
  RiTimerLine,
} from '@remixicon/react';

import * as Button from '@/components/ui/button';
import * as Kbd from '@/components/ui/kbd';
import * as Modal from '@/components/ui/modal';
import { HideChrome } from '@/components/app-shell';
import QuestionView from '@/components/question-view';
import { QuestionMap } from '@/components/quiz/question-map';
import { clearSession, saveSession } from '@/components/quiz/session-store';
import { saveAttempt } from '@/lib/db';
import { formatClock, pluralize } from '@/lib/format';
import {
  currentQuestion,
  currentResponse,
  isAnswered,
  isFreeText,
  isRevealed,
  quizReducer,
  toAttempt,
  type QuizState,
} from '@/lib/quiz';
import type { Attempt } from '@/lib/types';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// The quiz runner. One question on screen, actions in thumb reach, and the
// whole session mirrored to localStorage on every change so a killed tab
// never costs an attempt.
// ---------------------------------------------------------------------------

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'] as const;

export interface QuizRunnerProps {
  initialState: QuizState;
  /** Epoch ms when the timer expires, or null when untimed. Survives screen locks. */
  deadlineAt: number | null;
  onFinished: (attempt: Attempt) => void;
  /** `discarded` true means the user chose to throw the attempt away. */
  onExit: (discarded: boolean) => void;
}

export function QuizRunner({ initialState, deadlineAt, onFinished, onExit }: QuizRunnerProps) {
  const [state, dispatch] = React.useReducer(quizReducer, initialState);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [exitOpen, setExitOpen] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saveRetry, setSaveRetry] = React.useState(0);

  const stateRef = React.useRef(state);
  stateRef.current = state;

  const dialogsOpenRef = React.useRef(false);
  dialogsOpenRef.current = mapOpen || submitOpen || exitOpen;

  const question = currentQuestion(state);
  const response = currentResponse(state);
  const total = state.questions.length;
  const revealed = isRevealed(state, state.index);
  const freeText = question ? isFreeText(question) : false;
  const isLast = state.index === total - 1;
  const isMock = state.mode === 'mock';
  const active = state.status === 'active';

  // -------------------------------------------------------------------------
  // Clock. The deadline is a wall-clock timestamp, so a phone that spends five
  // minutes locked loses five minutes of exam time, exactly like a real exam.
  // The reducer only understands ticks, so each sync converts wall-clock drift
  // into one catch-up tick. The reducer auto-submits when it reaches zero.
  // -------------------------------------------------------------------------

  const lastTickRef = React.useRef(Date.now());

  const syncClock = React.useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'active') return;

    let deltaSec = 0;
    if (deadlineAt !== null && current.remainingSec !== null) {
      const trueRemaining = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      deltaSec = current.remainingSec - trueRemaining;
    } else {
      const now = Date.now();
      deltaSec = Math.floor((now - lastTickRef.current) / 1000);
      if (deltaSec >= 1) lastTickRef.current += deltaSec * 1000;
    }
    if (deltaSec >= 1) dispatch({ type: 'tick', deltaSec });
  }, [deadlineAt]);

  React.useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(syncClock, 1000);
    const onWake = () => syncClock();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [active, syncClock]);

  // A restored session whose deadline already passed submits immediately.
  React.useEffect(() => {
    if (active && deadlineAt !== null && state.remainingSec === 0) {
      dispatch({ type: 'submit' });
    }
  }, [active, deadlineAt, state.remainingSec]);

  // -------------------------------------------------------------------------
  // Crash safety: mirror every state change to localStorage.
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    if (state.status === 'active') saveSession(state, deadlineAt);
  }, [state, deadlineAt]);

  // -------------------------------------------------------------------------
  // Submit -> persist -> results. The stored session is only cleared once the
  // attempt is safely inside IndexedDB.
  // -------------------------------------------------------------------------

  const finishingRef = React.useRef(false);

  React.useEffect(() => {
    if (state.status !== 'submitted' || finishingRef.current) return;
    finishingRef.current = true;
    const attempt = toAttempt(state);
    void (async () => {
      try {
        await saveAttempt(attempt);
        clearSession();
        onFinished(attempt);
      } catch (error) {
        finishingRef.current = false;
        console.error('[quiz] failed to save the attempt:', error);
        setSaveError(
          'The attempt could not be saved. Your answers are still safe on this device.',
        );
      }
    })();
  }, [state, onFinished, saveRetry]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const unansweredCount = React.useMemo(() => {
    return state.responses.reduce((count, entry, index) => {
      if (isAnswered(state, index)) return count;
      const item = state.questions[index];
      // A mock free-text item with typed work is engaged, even though it can
      // only be graded after submit.
      if (item && isFreeText(item) && entry.text && entry.text.trim().length > 0) {
        return count;
      }
      return count + 1;
    }, 0);
  }, [state]);

  const requestSubmit = React.useCallback(() => {
    if (stateRef.current.status !== 'active') return;
    if (unansweredCount > 0) {
      setSubmitOpen(true);
    } else {
      dispatch({ type: 'submit' });
    }
  }, [unansweredCount]);

  const showAnswerAction = !isMock && freeText && !revealed;
  const skippable = active && !revealed && !isAnswered(state, state.index);

  const primaryLabel = showAnswerAction
    ? 'Show answer'
    : isLast
      ? isMock
        ? 'Submit'
        : 'Finish'
      : 'Next';

  const handlePrimary = React.useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'active') return;
    const item = current.questions[current.index];
    const itemRevealed = isRevealed(current, current.index);
    if (current.mode !== 'mock' && item && isFreeText(item) && !itemRevealed) {
      dispatch({ type: 'reveal' });
      return;
    }
    if (current.index === current.questions.length - 1) {
      requestSubmit();
      return;
    }
    dispatch({ type: 'next' });
  }, [requestSubmit]);

  // Same guard the Skip button enforces by hiding itself (see `skippable`). Without the
  // isAnswered half, the 'S' shortcut would skip a question the user had already answered
  // and wipe their pick - a mock never reveals, so isRevealed alone never stops it.
  const handleSkip = React.useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'active') return;
    if (isRevealed(current, current.index)) return;
    if (isAnswered(current, current.index)) return;
    dispatch({ type: 'skip' });
  }, []);

  const handlePrimaryRef = React.useRef(handlePrimary);
  handlePrimaryRef.current = handlePrimary;
  const handleSkipRef = React.useRef(handleSkip);
  handleSkipRef.current = handleSkip;

  // -------------------------------------------------------------------------
  // Keyboard: 1-5 / A-E select, Enter advances, S skips, arrows move.
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (dialogsOpenRef.current) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const current = stateRef.current;
      if (current.status !== 'active') return;

      const key = event.key.toLowerCase();
      const item = current.questions[current.index];

      if (key === 'enter') {
        // A focused button keeps its own Enter behaviour.
        if (target?.closest('button, a')) return;
        event.preventDefault();
        handlePrimaryRef.current();
        return;
      }
      if (key === 's') {
        event.preventDefault();
        handleSkipRef.current();
        return;
      }
      if (key === 'arrowleft') {
        event.preventDefault();
        dispatch({ type: 'prev' });
        return;
      }
      if (key === 'arrowright') {
        event.preventDefault();
        dispatch({ type: 'next' });
        return;
      }

      if (!item || isFreeText(item)) return;
      if (isRevealed(current, current.index)) return;

      let optionIndex = -1;
      if (key >= '1' && key <= '9') optionIndex = Number(key) - 1;
      const letterIndex = (OPTION_KEYS as readonly string[]).indexOf(key);
      if (letterIndex !== -1) optionIndex = letterIndex;

      if (optionIndex >= 0 && optionIndex < item.options.length) {
        event.preventDefault();
        dispatch({ type: 'answer', label: item.options[optionIndex].label });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // Timer display
  // -------------------------------------------------------------------------

  const timeLimit = state.config.timeLimitSec;
  const lowTime =
    timeLimit !== null &&
    state.remainingSec !== null &&
    state.remainingSec <= Math.ceil(timeLimit * 0.2);

  const positionRatio = total === 0 ? 0 : (state.index + 1) / total;

  if (!question || !response) {
    return null;
  }

  return (
    <div className='flex min-h-[100dvh] flex-col'>
      <HideChrome />

      <header className='sticky top-0 z-30 border-b border-stroke-soft-200 bg-bg-white-0/90 pt-[env(safe-area-inset-top)] backdrop-blur-md'>
        <div className='mx-auto flex h-14 w-full max-w-2xl items-center gap-1 px-2'>
          <button
            type='button'
            onClick={() => setExitOpen(true)}
            aria-label='End quiz'
            className={cn(
              'flex size-11 items-center justify-center rounded-10 text-text-sub-600',
              'outline-none transition duration-200 ease-out',
              'hover:bg-bg-weak-50 hover:text-text-strong-950',
              'focus-visible:ring-2 focus-visible:ring-primary-base',
            )}
          >
            <RiCloseLine className='size-5' />
          </button>

          <div className='flex-1 text-center'>
            <span className='text-label-md tabular-nums text-text-strong-950'>
              {state.index + 1}
              <span className='text-text-soft-400'> / {total}</span>
            </span>
          </div>

          <div
            className={cn(
              'flex items-center gap-1.5 px-1 text-label-sm tabular-nums',
              timeLimit !== null
                ? lowTime
                  ? 'text-warning-base'
                  : 'text-text-sub-600'
                : 'text-text-soft-400',
            )}
            aria-label={timeLimit !== null ? 'Time remaining' : 'Time elapsed'}
          >
            <RiTimerLine className='size-4' aria-hidden='true' />
            {formatClock(timeLimit !== null ? (state.remainingSec ?? 0) : state.elapsedSec)}
          </div>

          <button
            type='button'
            onClick={() => setMapOpen(true)}
            aria-label='Open question map'
            className={cn(
              'flex size-11 items-center justify-center rounded-10 text-text-sub-600',
              'outline-none transition duration-200 ease-out',
              'hover:bg-bg-weak-50 hover:text-text-strong-950',
              'focus-visible:ring-2 focus-visible:ring-primary-base',
            )}
          >
            <RiLayoutGridLine className='size-5' />
          </button>
        </div>

        <div className='h-1 w-full bg-bg-soft-200' aria-hidden='true'>
          <div
            className='h-full bg-primary-base transition-all duration-300 ease-out'
            style={{ width: `${positionRatio * 100}%` }}
          />
        </div>
      </header>

      <main className='mx-auto w-full max-w-2xl flex-1 px-4 py-6 md:py-10'>
        <QuestionView
          key={question.id}
          question={question}
          selected={response.selected}
          onSelect={active ? (label) => dispatch({ type: 'answer', label }) : undefined}
          reveal={revealed}
          disabled={!active}
          text={response.text ?? ''}
          onTextChange={active ? (text) => dispatch({ type: 'setText', text }) : undefined}
          selfGraded={response.selfGraded ? response.correct : null}
          onSelfGrade={
            active ? (correct) => dispatch({ type: 'selfGrade', correct }) : undefined
          }
        />
      </main>

      {saveError && (
        <div className='mx-auto w-full max-w-2xl px-4 pb-3'>
          <div className='flex items-start gap-3 rounded-10 border border-error-base bg-error-lighter p-3'>
            <RiErrorWarningLine className='size-5 shrink-0 text-error-base' aria-hidden='true' />
            <div className='flex-1 text-paragraph-sm text-text-strong-950'>{saveError}</div>
            <Button.Root
              type='button'
              variant='error'
              mode='stroke'
              size='xsmall'
              onClick={() => {
                setSaveError(null);
                setSaveRetry((count) => count + 1);
              }}
            >
              Retry
            </Button.Root>
          </div>
        </div>
      )}

      <footer className='sticky bottom-0 z-30 border-t border-stroke-soft-200 bg-bg-white-0/95 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md'>
        <div className='mx-auto flex w-full max-w-2xl items-center gap-3 px-4'>
          <Button.Root
            type='button'
            variant='neutral'
            mode='ghost'
            onClick={() => dispatch({ type: 'prev' })}
            disabled={!active || state.index === 0}
            aria-label='Previous question'
            className='size-11 shrink-0 px-0'
          >
            <Button.Icon as={RiArrowLeftSLine} />
          </Button.Root>

          {skippable && (
            <Button.Root
              type='button'
              variant='neutral'
              mode='stroke'
              onClick={handleSkip}
              className='h-11 flex-1'
            >
              Skip
            </Button.Root>
          )}

          <Button.Root
            type='button'
            variant='primary'
            mode='filled'
            onClick={handlePrimary}
            disabled={!active}
            className='h-11 flex-[2]'
          >
            {active ? primaryLabel : 'Saving...'}
            {primaryLabel === 'Next' && <Button.Icon as={RiArrowRightLine} />}
          </Button.Root>
        </div>

        <div className='hidden items-center justify-center gap-4 pt-2.5 md:flex'>
          <span className='flex items-center gap-1.5 text-paragraph-xs text-text-soft-400'>
            <Kbd.Root>1-5</Kbd.Root> select
          </span>
          <span className='flex items-center gap-1.5 text-paragraph-xs text-text-soft-400'>
            <Kbd.Root>Enter</Kbd.Root> {primaryLabel.toLowerCase()}
          </span>
          <span className='flex items-center gap-1.5 text-paragraph-xs text-text-soft-400'>
            <Kbd.Root>S</Kbd.Root> skip
          </span>
          <span className='flex items-center gap-1.5 text-paragraph-xs text-text-soft-400'>
            <Kbd.Root>&larr;</Kbd.Root>
            <Kbd.Root>&rarr;</Kbd.Root> move
          </span>
        </div>
      </footer>

      <QuestionMap
        open={mapOpen}
        onOpenChange={setMapOpen}
        state={state}
        onJump={(index) => dispatch({ type: 'jumpTo', index })}
      />

      <Modal.Root open={submitOpen} onOpenChange={setSubmitOpen}>
        <Modal.Content showClose={false} className='max-w-[calc(100vw-2rem)] sm:max-w-[400px]'>
          <Modal.Header
            icon={RiErrorWarningLine}
            title='Submit this attempt?'
            description={`You have ${unansweredCount} unanswered ${pluralize(unansweredCount, 'question')}. ${
              unansweredCount === 1 ? 'It' : 'They'
            } will be marked as skipped.`}
          />
          <Modal.Footer>
            <Button.Root
              type='button'
              variant='neutral'
              mode='stroke'
              onClick={() => setSubmitOpen(false)}
              className='h-11 flex-1'
            >
              Keep going
            </Button.Root>
            <Button.Root
              type='button'
              variant='primary'
              mode='filled'
              onClick={() => {
                setSubmitOpen(false);
                dispatch({ type: 'submit' });
              }}
              className='h-11 flex-1'
            >
              Submit
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={exitOpen} onOpenChange={setExitOpen}>
        <Modal.Content showClose={false} className='max-w-[calc(100vw-2rem)] sm:max-w-[400px]'>
          <Modal.Header
            title='Leave the quiz?'
            description='Your progress is saved on this device, so you can resume later from this exact question.'
          />
          <Modal.Body className='flex flex-col gap-2'>
            <Button.Root
              type='button'
              variant='neutral'
              mode='stroke'
              onClick={() => setExitOpen(false)}
              className='h-11 w-full'
            >
              Keep going
            </Button.Root>
            <Button.Root
              type='button'
              variant='primary'
              mode='filled'
              onClick={() => onExit(false)}
              className='h-11 w-full'
            >
              Save and exit
            </Button.Root>
            <Button.Root
              type='button'
              variant='error'
              mode='ghost'
              onClick={() => {
                clearSession();
                onExit(true);
              }}
              className='h-11 w-full'
            >
              Discard attempt
            </Button.Root>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}

export default QuizRunner;
