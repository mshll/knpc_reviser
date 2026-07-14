'use client';

import * as React from 'react';

import * as ProgressBar from '@/components/ui/progress-bar';
import { accuracyBarColor } from '@/components/results/accuracy';
import { formatScore, pluralize, topicLabel } from '@/lib/format';
import type { Question, Response, Topic } from '@/lib/types';

export interface ReviewRow {
  question: Question;
  response: Response;
}

interface TopicRow {
  topic: Topic;
  total: number;
  correct: number;
  skipped: number;
}

function buildTopicRows(rows: readonly ReviewRow[]): TopicRow[] {
  const byTopic = new Map<Topic, TopicRow>();

  for (const { question, response } of rows) {
    const entry = byTopic.get(question.topic) ?? {
      topic: question.topic,
      total: 0,
      correct: 0,
      skipped: 0,
    };
    entry.total += 1;
    if (response.skipped) entry.skipped += 1;
    else if (response.correct) entry.correct += 1;
    byTopic.set(question.topic, entry);
  }

  return [...byTopic.values()].sort(
    (a, b) => a.correct / a.total - b.correct / b.total,
  );
}

/** Per-topic score for one attempt: what carried it and what sank it, worst first. */
export function TopicBreakdown({ rows }: { rows: readonly ReviewRow[] }) {
  const topicRows = React.useMemo(() => buildTopicRows(rows), [rows]);

  if (topicRows.length === 0) return null;

  return (
    <section aria-label='Score by topic' className='flex flex-col gap-4'>
      <h2 className='text-label-lg text-text-strong-950'>By topic</h2>
      <ul className='flex flex-col gap-4'>
        {topicRows.map((row) => {
          const accuracy = row.total > 0 ? row.correct / row.total : 0;
          return (
            <li key={row.topic} className='flex flex-col gap-1.5'>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='text-label-sm text-text-strong-950'>
                  {topicLabel(row.topic)}
                </span>
                <span className='text-label-sm tabular-nums text-text-sub-600'>
                  {formatScore(row.correct, row.total)}
                </span>
              </div>
              <ProgressBar.Root
                value={accuracy * 100}
                color={accuracyBarColor(accuracy)}
                aria-label={`${topicLabel(row.topic)}: ${row.correct} of ${row.total} correct`}
              />
              {row.skipped > 0 && (
                <span className='text-paragraph-xs text-text-soft-400'>
                  {row.skipped} {pluralize(row.skipped, 'question')} skipped
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default TopicBreakdown;
