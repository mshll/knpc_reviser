'use client';

import * as React from 'react';
import {
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiExternalLinkLine,
  RiSparkling2Line,
  RiZoomInLine,
} from '@remixicon/react';

import * as Badge from '@/components/ui/badge';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import * as Tag from '@/components/ui/tag';
import * as Textarea from '@/components/ui/textarea';
import * as Tooltip from '@/components/ui/tooltip';
import { isFreeText } from '@/lib/quiz';
import { flagLabel, optionLetter, sourceLabel, topicLabel } from '@/lib/format';
import type { Option, Question } from '@/lib/types';
import { cn } from '@/utils/cn';

const UNVERIFIED_TOOLTIP =
  'This question came from a crowd-sourced recall of the exam. Its answer key could not be confirmed. Treat it with suspicion.';

/** Flags worth showing next to a question. The rest are pipeline bookkeeping. */
const VISIBLE_FLAGS = new Set(['legacy', 'hedged_option']);

/** `stemFigure` and `option.figure` are paths under /figures. Accept all three spellings. */
function figureSrc(path: string): string {
  if (path.startsWith('/')) return path;
  if (path.startsWith('figures/')) return `/${path}`;
  return `/figures/${path}`;
}

export interface QuestionViewProps {
  question: Question;
  /** Option labels the user has picked. Use `option.label`, never the display letter. */
  selected: string[];
  /** Fires with `option.label`. Omit to render read-only. */
  onSelect?: (label: string) => void;
  /** Show the answer key, the explanation and the correct/wrong treatments. */
  reveal?: boolean;
  /** Lock interaction without dimming into a disabled-looking state. */
  disabled?: boolean;

  /** short_answer / worked_problem only: the user's free text. */
  text?: string;
  onTextChange?: (text: string) => void;
  /** short_answer / worked_problem only: the user's own verdict. null means ungraded. */
  selfGraded?: boolean | null;
  onSelfGrade?: (correct: boolean) => void;

  className?: string;
}

// ---------------------------------------------------------------------------

function UnverifiedBadge() {
  const [open, setOpen] = React.useState(false);

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <button
          type='button'
          onClick={() => setOpen((previous) => !previous)}
          aria-label={`Answer unverified. ${UNVERIFIED_TOOLTIP}`}
          className='rounded-full outline-none focus-visible:ring-2 focus-visible:ring-warning-base'
        >
          <Badge.Root variant='light' color='orange' size='medium'>
            <Badge.Icon as={RiAlertLine} />
            Answer unverified
          </Badge.Root>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content size='medium' className='max-w-72 text-left'>
        {UNVERIFIED_TOOLTIP}
      </Tooltip.Content>
    </Tooltip.Root>
  );
}

function ZoomableFigure({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <Modal.Root>
      <Modal.Trigger asChild>
        <button
          type='button'
          aria-label={`${alt}. Tap to zoom.`}
          className={cn(
            'group relative block w-full overflow-hidden rounded-10 border border-stroke-soft-200 bg-bg-white-0 p-2',
            'outline-none transition duration-200 ease-out',
            'focus-visible:ring-2 focus-visible:ring-primary-base',
            className,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={figureSrc(src)}
            alt={alt}
            className='mx-auto block h-auto max-h-80 w-auto max-w-full object-contain'
          />
          <span className='absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-bg-white-0/90 text-text-sub-600 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200'>
            <RiZoomInLine className='size-4' />
          </span>
        </button>
      </Modal.Trigger>

      <Modal.Content className='max-w-[min(56rem,calc(100vw-2rem))] p-2'>
        <Modal.Title className='sr-only'>{alt}</Modal.Title>
        <div className='max-h-[80vh] overflow-auto rounded-2xl bg-bg-white-0 p-2'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={figureSrc(src)}
            alt={alt}
            className='mx-auto block h-auto w-auto max-w-none object-contain'
          />
        </div>
      </Modal.Content>
    </Modal.Root>
  );
}

interface OptionRowProps {
  option: Option;
  index: number;
  isSelected: boolean;
  reveal: boolean;
  disabled: boolean;
  multi: boolean;
  onSelect?: (label: string) => void;
}

function OptionRow({
  option,
  index,
  isSelected,
  reveal,
  disabled,
  multi,
  onSelect,
}: OptionRowProps) {
  const isCorrect = option.isCorrect;
  const showCorrect = reveal && isCorrect;
  const showWrong = reveal && isSelected && !isCorrect;
  const interactive = Boolean(onSelect) && !disabled && !reveal;

  const letter = optionLetter(index);

  return (
    <button
      type='button'
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={isSelected}
      disabled={!interactive}
      onClick={interactive ? () => onSelect?.(option.label) : undefined}
      className={cn(
        'flex w-full min-h-[3.5rem] items-start gap-3 rounded-10 border p-3 text-left',
        'outline-none transition duration-200 ease-out',
        'focus-visible:ring-2 focus-visible:ring-primary-base',
        // resting
        'border-stroke-soft-200 bg-bg-white-0',
        interactive && 'hover:border-stroke-sub-300 hover:bg-bg-weak-50 active:scale-[0.995]',
        // picked, answer still hidden
        isSelected &&
          !reveal &&
          'border-primary-base bg-primary-alpha-10 ring-1 ring-inset ring-primary-base',
        // revealed
        showCorrect && 'border-success-base bg-success-lighter ring-1 ring-inset ring-success-base',
        showWrong && 'border-error-base bg-error-lighter ring-1 ring-inset ring-error-base',
        reveal && !showCorrect && !showWrong && 'opacity-70',
        !interactive && 'cursor-default',
      )}
    >
      <span
        aria-hidden='true'
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-label-xs',
          'bg-bg-weak-50 text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200',
          isSelected && !reveal && 'bg-primary-base text-static-white ring-primary-base',
          showCorrect && 'bg-success-base text-static-white ring-success-base',
          showWrong && 'bg-error-base text-static-white ring-error-base',
        )}
      >
        {showCorrect ? (
          <RiCheckLine className='size-4' />
        ) : showWrong ? (
          <RiCloseLine className='size-4' />
        ) : (
          letter
        )}
      </span>

      <span className='flex min-w-0 flex-1 flex-col gap-2 pt-0.5'>
        {option.text.trim().length > 0 && (
          <span
            className={cn(
              'text-paragraph-md text-text-strong-950',
              showCorrect && 'text-success-dark',
              showWrong && 'text-error-dark',
            )}
          >
            {option.text}
          </span>
        )}
        {option.figure && (
          <span className='block'>
            <ZoomableFigure
              src={option.figure}
              alt={`Option ${letter} figure`}
              className='max-w-sm'
            />
          </span>
        )}
      </span>

      {/* Icon, not colour alone: this has to read for a colour-blind user. */}
      {reveal && (showCorrect || showWrong) && (
        <span
          className={cn(
            'shrink-0 pt-0.5',
            showCorrect ? 'text-success-base' : 'text-error-base',
          )}
        >
          {showCorrect ? (
            <RiCheckLine className='size-5' aria-label='Correct answer' />
          ) : (
            <RiCloseLine className='size-5' aria-label='Your answer, incorrect' />
          )}
        </span>
      )}
    </button>
  );
}

function FreeTextAnswer({
  question,
  text,
  onTextChange,
  reveal,
  disabled,
  selfGraded,
  onSelfGrade,
}: {
  question: Question;
  text: string;
  onTextChange?: (text: string) => void;
  reveal: boolean;
  disabled: boolean;
  selfGraded?: boolean | null;
  onSelfGrade?: (correct: boolean) => void;
}) {
  return (
    <div className='flex flex-col gap-4'>
      {!reveal && (
        <Textarea.Root
          simple
          value={text}
          disabled={disabled || !onTextChange}
          onChange={(event) => onTextChange?.(event.target.value)}
          placeholder='Work it out here. Nothing is auto-graded: you mark yourself when the model answer appears.'
          aria-label='Your answer'
          className='min-h-32'
        />
      )}

      {reveal && (
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='flex flex-col gap-2'>
            <span className='text-subheading-xs uppercase text-text-soft-400'>
              Your answer
            </span>
            <div className='min-h-24 whitespace-pre-wrap rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-3 text-paragraph-sm text-text-strong-950'>
              {text.trim().length > 0 ? (
                text
              ) : (
                <span className='text-text-soft-400'>You left this blank.</span>
              )}
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <span className='text-subheading-xs uppercase text-text-soft-400'>
              Model answer
            </span>
            <div className='min-h-24 whitespace-pre-wrap rounded-10 border border-success-base bg-success-lighter p-3 text-paragraph-sm text-text-strong-950'>
              {question.answerText}
            </div>
            {/* The paper's own worked solution: a truth table or waveform the prose cannot
                reproduce. Several answerText values literally say "see the figure". */}
            {question.answerFigure && (
              <ZoomableFigure
                src={question.answerFigure}
                alt='Model answer figure'
              />
            )}
          </div>
        </div>
      )}

      {reveal && onSelfGrade && (
        <div className='flex flex-col gap-2'>
          <span className='text-paragraph-sm text-text-sub-600'>
            Mark it yourself. Free text is never auto-graded.
          </span>
          <div className='flex gap-3'>
            <Button.Root
              type='button'
              variant='neutral'
              mode={selfGraded === true ? 'filled' : 'stroke'}
              onClick={() => onSelfGrade(true)}
              disabled={disabled}
              className='h-11 flex-1'
            >
              <Button.Icon as={RiCheckLine} />
              I got it
            </Button.Root>
            <Button.Root
              type='button'
              variant='error'
              mode={selfGraded === false ? 'filled' : 'stroke'}
              onClick={() => onSelfGrade(false)}
              disabled={disabled}
              className='h-11 flex-1'
            >
              <Button.Icon as={RiCloseLine} />
              I missed it
            </Button.Root>
          </div>
        </div>
      )}
    </div>
  );
}

function Explanation({ question }: { question: Question }) {
  if (!question.explanation && !question.referenceUrl) return null;

  const fromSource = question.explanationSource === 'source';
  const label = fromSource
    ? 'Model answer (from the paper)'
    : 'AI-generated explanation';

  return (
    <div className='flex flex-col gap-3 rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4'>
      <div className='flex items-center gap-2 text-subheading-xs uppercase text-text-sub-600'>
        {!fromSource && <RiSparkling2Line className='size-4 shrink-0 text-text-soft-400' />}
        {label}
      </div>

      {question.explanation && (
        <p className='whitespace-pre-wrap text-paragraph-sm text-text-sub-600'>
          {question.explanation}
        </p>
      )}

      {question.referenceUrl && (
        <a
          href={question.referenceUrl}
          target='_blank'
          rel='noreferrer noopener'
          className='inline-flex items-center gap-1.5 text-label-sm text-primary-base underline-offset-2 hover:underline'
        >
          Reference
          <RiExternalLinkLine className='size-4' />
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function QuestionView({
  question,
  selected,
  onSelect,
  reveal = false,
  disabled = false,
  text = '',
  onTextChange,
  selfGraded = null,
  onSelfGrade,
  className,
}: QuestionViewProps) {
  const freeText = isFreeText(question);
  const multi = question.answerOptionLabels.length > 1;
  const visibleFlags = question.flags.filter((flag) => VISIBLE_FLAGS.has(flag));

  return (
    <article className={cn('flex w-full flex-col gap-6', className)}>
      <div className='flex flex-wrap items-center gap-2'>
        <Tag.Root variant='gray'>{topicLabel(question.topic)}</Tag.Root>
        <Tag.Root variant='stroke'>{sourceLabel(question.source)}</Tag.Root>
        {visibleFlags.map((flag) => (
          <Tag.Root key={flag} variant='stroke' className='text-text-soft-400'>
            {flagLabel(flag)}
          </Tag.Root>
        ))}
        {question.keyVerified === false && <UnverifiedBadge />}
      </div>

      <div className='flex flex-col gap-4'>
        <h2 className='text-balance text-title-h6 text-text-strong-950 md:text-title-h5'>
          {question.stem}
        </h2>

        {question.stemCode && (
          // Whitespace is load-bearing. Never reformat, never re-indent, never wrap.
          <pre className='overflow-x-auto rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4 [white-space:pre]'>
            <code className='font-mono text-paragraph-sm text-text-strong-950'>
              {question.stemCode}
            </code>
          </pre>
        )}

        {question.stemFigure && (
          <ZoomableFigure src={question.stemFigure} alt='Question figure' />
        )}

        {multi && !freeText && (
          <p className='text-paragraph-sm text-text-sub-600'>
            Pick {question.answerOptionLabels.length} answers.
          </p>
        )}
      </div>

      {freeText ? (
        <FreeTextAnswer
          question={question}
          text={text}
          onTextChange={onTextChange}
          reveal={reveal}
          disabled={disabled}
          selfGraded={selfGraded}
          onSelfGrade={onSelfGrade}
        />
      ) : (
        <div
          role={multi ? 'group' : 'radiogroup'}
          aria-label='Options'
          className='flex flex-col gap-3'
        >
          {question.options.map((option, index) => (
            <OptionRow
              key={option.label}
              option={option}
              index={index}
              isSelected={selected.includes(option.label)}
              reveal={reveal}
              disabled={disabled}
              multi={multi}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {reveal && <Explanation question={question} />}
    </article>
  );
}

export default QuestionView;
