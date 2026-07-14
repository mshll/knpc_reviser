'use client';

import * as React from 'react';

import { formatDate, formatPercent } from '@/lib/format';
import type { TrendPoint } from '@/lib/stats';

const WIDTH = 320;
const HEIGHT = 96;
const PAD_X = 6;
const PAD_Y = 8;

/**
 * Accuracy across recent finished attempts, oldest first. Hand-rolled SVG,
 * no charting library. Below 3 points a trend is noise, so we say so instead.
 */
export function TrendChart({ trend }: { trend: readonly TrendPoint[] }) {
  if (trend.length < 3) {
    return (
      <p className='rounded-10 border border-stroke-soft-200 bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600'>
        A trend needs at least 3 finished attempts. You have{' '}
        {trend.length === 0 ? 'none' : trend.length} so far.
      </p>
    );
  }

  const x = (index: number) =>
    PAD_X + (index * (WIDTH - 2 * PAD_X)) / (trend.length - 1);
  const y = (accuracy: number) => PAD_Y + (1 - accuracy) * (HEIGHT - 2 * PAD_Y);

  const points = trend
    .map((point, index) => `${x(index).toFixed(1)},${y(point.accuracy).toFixed(1)}`)
    .join(' ');

  const first = trend[0];
  const last = trend[trend.length - 1];

  return (
    <figure className='flex flex-col gap-2'>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio='none'
        className='h-24 w-full'
        role='img'
        aria-label={`Accuracy across the last ${trend.length} finished attempts, from ${formatPercent(first.accuracy)} to ${formatPercent(last.accuracy)}.`}
      >
        {[1, 0.5, 0].map((level) => (
          <line
            key={level}
            x1={PAD_X}
            x2={WIDTH - PAD_X}
            y1={y(level)}
            y2={y(level)}
            className='stroke-stroke-soft-200'
            strokeWidth={1}
            strokeDasharray={level === 0.5 ? '3 3' : undefined}
            vectorEffect='non-scaling-stroke'
          />
        ))}

        <polyline
          points={points}
          fill='none'
          className='stroke-primary-base'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          vectorEffect='non-scaling-stroke'
        />

        {trend.map((point, index) => (
          <circle
            key={point.attemptId}
            cx={x(index)}
            cy={y(point.accuracy)}
            r={index === trend.length - 1 ? 4 : 2.5}
            className='fill-primary-base'
          />
        ))}
      </svg>

      <figcaption className='flex items-baseline justify-between text-paragraph-xs text-text-soft-400'>
        <span>
          {formatDate(first.startedAt)}: {formatPercent(first.accuracy)}
        </span>
        <span className='text-label-xs text-text-sub-600'>
          {formatDate(last.startedAt)}: {formatPercent(last.accuracy)}
        </span>
      </figcaption>
    </figure>
  );
}

export default TrendChart;
