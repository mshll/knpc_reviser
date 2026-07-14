'use client';

import * as React from 'react';
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiSearchLine,
} from '@remixicon/react';

import * as Badge from '@/components/ui/badge';
import * as Button from '@/components/ui/button';
import * as Input from '@/components/ui/input';
import * as Pagination from '@/components/ui/pagination';
import * as Select from '@/components/ui/select';
import QuestionView from '@/components/question-view';
import { allQuestions, isServable } from '@/lib/questions';
import {
  FLAG_LABELS,
  KEY_PROVENANCE_LABELS,
  TIER_LABELS,
  TOPIC_LABELS,
  TOPIC_SHORT_LABELS,
  pluralize,
  sourceLabel,
} from '@/lib/format';
import {
  FLAGS,
  SOURCE_TIERS,
  TOPICS,
  type Flag,
  type Question,
  type QuestionType,
  type SourceTier,
  type Topic,
} from '@/lib/types';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'Multiple choice',
  true_false: 'True or false',
  short_answer: 'Short answer',
  worked_problem: 'Worked problem',
};

type KeyStatusFilter = 'all' | 'verified' | 'unverified';

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function searchText(question: Question): string {
  return [
    question.stem,
    question.stemCode ?? '',
    question.subtopic ?? '',
    question.options.map((option) => option.text).join(' '),
    question.answerText ?? '',
    question.id,
    sourceLabel(question.source),
  ]
    .join(' ')
    .toLowerCase();
}

function pageWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, total]);
  for (let page = current - 1; page <= current + 1; page++) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous > 0 && page - previous > 1) out.push('gap');
    out.push(page);
    previous = page;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function SourceDetails({ question }: { question: Question }) {
  const details: Array<{ term: string; value: string }> = [
    {
      term: 'Source',
      value:
        sourceLabel(question.source) +
        (question.source.originalNumber != null
          ? `, question ${question.source.originalNumber}`
          : ''),
    },
    { term: 'Source file', value: question.source.file },
    { term: 'Tier', value: TIER_LABELS[question.source.tier] },
    { term: 'Answer key', value: KEY_PROVENANCE_LABELS[question.keyProvenance] },
    {
      term: 'Verification',
      value: question.keyVerified
        ? 'Blind re-answer agreed with the key'
        : 'Key not confirmed, treat with suspicion',
    },
  ];

  return (
    <dl className='grid grid-cols-1 gap-x-6 gap-y-3 rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4 sm:grid-cols-2'>
      {details.map((detail) => (
        <div key={detail.term} className='flex min-w-0 flex-col gap-0.5'>
          <dt className='text-subheading-2xs uppercase text-text-soft-400'>
            {detail.term}
          </dt>
          <dd className='break-words text-paragraph-sm text-text-strong-950'>
            {detail.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BankRow({
  question,
  expanded,
  onToggle,
}: {
  question: Question;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = [
    sourceLabel(question.source) +
      (question.source.originalNumber != null
        ? ` Q${question.source.originalNumber}`
        : ''),
    TOPIC_SHORT_LABELS[question.topic],
    ...(question.type !== 'mcq' ? [TYPE_LABELS[question.type]] : []),
  ].join(' · ');

  const excluded = !isServable(question);
  const otherFlags = question.flags.filter((flag) => flag !== 'missing_figure');
  const hasBadges = question.needsReview || excluded || otherFlags.length > 0;

  return (
    <li className='overflow-hidden rounded-10 border border-stroke-soft-200 bg-bg-white-0'>
      <button
        type='button'
        aria-expanded={expanded}
        onClick={onToggle}
        className={cn(
          'flex w-full items-start gap-3 p-4 text-left outline-none',
          'transition duration-200 ease-out',
          'hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-base',
        )}
      >
        <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <span className='text-paragraph-xs text-text-soft-400'>{meta}</span>
          <span className='line-clamp-2 text-paragraph-sm text-text-strong-950'>
            {question.stem}
          </span>
          {hasBadges && (
            <span className='flex flex-wrap items-center gap-1.5 pt-0.5'>
              {question.needsReview && (
                <Badge.Root variant='light' color='orange' size='medium'>
                  <Badge.Icon as={RiAlertLine} />
                  Needs review
                </Badge.Root>
              )}
              {excluded && (
                <Badge.Root variant='lighter' color='gray' size='medium'>
                  Excluded from quizzes
                </Badge.Root>
              )}
              {otherFlags.map((flag) => (
                <Badge.Root key={flag} variant='stroke' color='gray' size='medium'>
                  {FLAG_LABELS[flag]}
                </Badge.Root>
              ))}
            </span>
          )}
        </span>
        <RiArrowDownSLine
          aria-hidden='true'
          className={cn(
            'mt-1 size-5 shrink-0 text-text-soft-400 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <div className='flex flex-col gap-6 border-t border-stroke-soft-200 p-4 pt-5'>
          <QuestionView question={question} selected={[]} reveal />
          <SourceDetails question={question} />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BankPage() {
  const questions = React.useMemo(() => allQuestions(), []);
  const haystacks = React.useMemo(() => {
    return new Map(questions.map((question) => [question.id, searchText(question)]));
  }, [questions]);

  const [query, setQuery] = React.useState('');
  const [topic, setTopic] = React.useState<'all' | Topic>('all');
  const [tier, setTier] = React.useState<'all' | SourceTier>('all');
  const [flag, setFlag] = React.useState<'all' | Flag>('all');
  const [keyStatus, setKeyStatus] = React.useState<KeyStatusFilter>('all');
  const [excludedOnly, setExcludedOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const deferredQuery = React.useDeferredValue(query);

  const excludedCount = React.useMemo(
    () => questions.filter((question) => !isServable(question)).length,
    [questions],
  );

  const topicOptions = React.useMemo(() => {
    const counts = new Map<Topic, number>();
    for (const question of questions) {
      counts.set(question.topic, (counts.get(question.topic) ?? 0) + 1);
    }
    return TOPICS.filter((candidate) => (counts.get(candidate) ?? 0) > 0);
  }, [questions]);

  const tierOptions = React.useMemo(() => {
    const present = new Set(questions.map((question) => question.source.tier));
    return SOURCE_TIERS.filter((candidate) => present.has(candidate));
  }, [questions]);

  const flagOptions = React.useMemo(() => {
    const present = new Set(questions.flatMap((question) => question.flags));
    return FLAGS.filter((candidate) => present.has(candidate));
  }, [questions]);

  const filtered = React.useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return questions.filter((question) => {
      if (topic !== 'all' && question.topic !== topic) return false;
      if (tier !== 'all' && question.source.tier !== tier) return false;
      if (flag !== 'all' && !question.flags.includes(flag)) return false;
      if (keyStatus === 'verified' && !question.keyVerified) return false;
      if (keyStatus === 'unverified' && question.keyVerified) return false;
      if (excludedOnly && isServable(question)) return false;
      if (needle.length > 0 && !haystacks.get(question.id)?.includes(needle)) {
        return false;
      }
      return true;
    });
  }, [questions, haystacks, deferredQuery, topic, tier, flag, keyStatus, excludedOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const filtersActive =
    query.length > 0 ||
    topic !== 'all' ||
    tier !== 'all' ||
    flag !== 'all' ||
    keyStatus !== 'all' ||
    excludedOnly;

  React.useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [deferredQuery, topic, tier, flag, keyStatus, excludedOnly]);

  const skipScrollRef = React.useRef(true);
  React.useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [safePage]);

  function clearFilters() {
    setQuery('');
    setTopic('all');
    setTier('all');
    setFlag('all');
    setKeyStatus('all');
    setExcludedOnly(false);
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 1), totalPages));
    setExpandedId(null);
  }

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-title-h4 text-text-strong-950'>Question bank</h1>
        <p className='text-paragraph-sm text-text-sub-600'>
          The whole corpus: {questions.length}{' '}
          {pluralize(questions.length, 'question')}, including items a quiz never
          serves. Expand any row to see the answer and explanation.
        </p>
      </header>

      <div className='flex flex-col gap-3'>
        <Input.Root>
          <Input.Wrapper>
            <Input.Icon as={RiSearchLine} />
            <Input.Input
              type='search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='Search stems, code, options'
              aria-label='Search the question bank'
            />
            {query.length > 0 && (
              <button
                type='button'
                onClick={() => setQuery('')}
                aria-label='Clear search'
                className='flex size-8 shrink-0 items-center justify-center rounded-md text-text-soft-400 outline-none transition duration-200 ease-out hover:text-text-sub-600 focus-visible:ring-2 focus-visible:ring-primary-base'
              >
                <RiCloseLine className='size-5' />
              </button>
            )}
          </Input.Wrapper>
        </Input.Root>

        <button
          type='button'
          aria-pressed={excludedOnly}
          onClick={() => setExcludedOnly((value) => !value)}
          className={cn(
            'inline-flex h-11 items-center justify-center gap-2 rounded-10 px-4 text-label-sm',
            'outline-none transition duration-200 ease-out',
            'focus-visible:ring-2 focus-visible:ring-warning-base',
            excludedOnly
              ? 'bg-warning-base text-static-white'
              : 'bg-bg-white-0 text-warning-base ring-1 ring-inset ring-warning-base hover:bg-warning-lighter',
          )}
        >
          <RiAlertLine className='size-5' />
          Excluded from quizzes ({excludedCount})
        </button>

        <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>
          <Select.Root
            size='small'
            value={topic}
            onValueChange={(value) => setTopic(value as 'all' | Topic)}
          >
            <Select.Trigger aria-label='Filter by topic'>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value='all'>All topics</Select.Item>
              {topicOptions.map((option) => (
                <Select.Item key={option} value={option}>
                  {TOPIC_LABELS[option]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root
            size='small'
            value={tier}
            onValueChange={(value) => setTier(value as 'all' | SourceTier)}
          >
            <Select.Trigger aria-label='Filter by source tier'>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value='all'>All sources</Select.Item>
              {tierOptions.map((option) => (
                <Select.Item key={option} value={option}>
                  {TIER_LABELS[option]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root
            size='small'
            value={flag}
            onValueChange={(value) => setFlag(value as 'all' | Flag)}
          >
            <Select.Trigger aria-label='Filter by flag'>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value='all'>All flags</Select.Item>
              {flagOptions.map((option) => (
                <Select.Item key={option} value={option}>
                  {FLAG_LABELS[option]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Select.Root
            size='small'
            value={keyStatus}
            onValueChange={(value) => setKeyStatus(value as KeyStatusFilter)}
          >
            <Select.Trigger aria-label='Filter by answer key status'>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value='all'>Any key status</Select.Item>
              <Select.Item value='verified'>Verified keys</Select.Item>
              <Select.Item value='unverified'>Unverified keys</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <div className='flex min-h-5 items-center justify-between gap-3'>
          <p className='text-paragraph-xs text-text-sub-600' aria-live='polite'>
            {filtered.length === questions.length
              ? `${questions.length} ${pluralize(questions.length, 'question')}`
              : `${filtered.length} of ${questions.length} ${pluralize(questions.length, 'question')} match`}
          </p>
          {filtersActive && (
            <button
              type='button'
              onClick={clearFilters}
              className='text-label-xs text-text-sub-600 underline underline-offset-2 outline-none transition duration-200 ease-out hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base'
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className='flex flex-col items-center gap-3 rounded-10 border border-stroke-soft-200 px-6 py-16 text-center'>
          <RiSearchLine className='size-6 text-text-soft-400' aria-hidden='true' />
          <div className='flex flex-col gap-1'>
            <p className='text-label-md text-text-strong-950'>No questions match</p>
            <p className='text-paragraph-sm text-text-sub-600'>
              Try a different search, or drop one of the filters.
            </p>
          </div>
          {filtersActive && (
            <Button.Root
              variant='neutral'
              mode='stroke'
              size='small'
              onClick={clearFilters}
            >
              Clear filters
            </Button.Root>
          )}
        </div>
      ) : (
        <>
          <ul className='flex flex-col gap-3'>
            {pageItems.map((question) => (
              <BankRow
                key={question.id}
                question={question}
                expanded={expandedId === question.id}
                onToggle={() =>
                  setExpandedId((current) =>
                    current === question.id ? null : question.id,
                  )
                }
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label='Question bank pages'
              className='flex flex-col items-center gap-2'
            >
              <Pagination.Root>
                <Pagination.NavButton
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1}
                  aria-label='Previous page'
                  className='size-10 disabled:pointer-events-none disabled:text-text-disabled-300'
                >
                  <Pagination.NavIcon as={RiArrowLeftSLine} />
                </Pagination.NavButton>

                {pageWindow(safePage, totalPages).map((item, index) =>
                  item === 'gap' ? (
                    <span
                      key={`gap-${index}`}
                      aria-hidden='true'
                      className='px-1 text-label-sm text-text-soft-400'
                    >
                      ...
                    </span>
                  ) : (
                    <Pagination.Item
                      key={item}
                      current={item === safePage}
                      aria-label={`Page ${item}`}
                      aria-current={item === safePage ? 'page' : undefined}
                      onClick={() => goToPage(item)}
                      className='h-10 min-w-10'
                    >
                      {item}
                    </Pagination.Item>
                  ),
                )}

                <Pagination.NavButton
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  aria-label='Next page'
                  className='size-10 disabled:pointer-events-none disabled:text-text-disabled-300'
                >
                  <Pagination.NavIcon as={RiArrowRightSLine} />
                </Pagination.NavButton>
              </Pagination.Root>

              <p className='text-paragraph-xs text-text-soft-400'>
                Showing {rangeStart}-{rangeEnd} of {filtered.length}
              </p>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
