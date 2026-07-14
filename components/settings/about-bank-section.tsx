'use client';

import * as React from 'react';
import Link from 'next/link';
import { RiArrowRightLine } from '@remixicon/react';

import * as Button from '@/components/ui/button';
import { SettingsSection } from '@/components/settings/section';
import { allQuestions, getBankReport, isServable, tierCounts } from '@/lib/questions';
import { TIER_LABELS, pluralize } from '@/lib/format';

export function AboutBankSection() {
  const { report, tiers, excluded } = React.useMemo(() => {
    return {
      report: getBankReport(),
      tiers: tierCounts().filter((entry) => entry.count > 0),
      excluded: allQuestions().filter((question) => !isServable(question)).length,
    };
  }, []);

  return (
    <SettingsSection title='About the question bank'>
      <div className='flex flex-col gap-4'>
        <dl className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <div className='flex flex-col gap-0.5 rounded-10 border border-stroke-soft-200 p-3'>
            <dt className='text-paragraph-xs text-text-sub-600'>Total questions</dt>
            <dd className='text-label-lg text-text-strong-950'>{report.servable}</dd>
          </div>
          {tiers.map((entry) => (
            <div
              key={entry.tier}
              className='flex flex-col gap-0.5 rounded-10 border border-stroke-soft-200 p-3'
            >
              <dt className='text-paragraph-xs text-text-sub-600'>
                {TIER_LABELS[entry.tier]}
              </dt>
              <dd className='text-label-lg text-text-strong-950'>{entry.count}</dd>
            </div>
          ))}
        </dl>

        <p className='text-paragraph-sm text-text-sub-600'>
          Every item here is a crowd-sourced recollection of a past paper, transcribed
          verbatim. None of it is official material, and recall quality varies. Answer keys
          were re-checked by independent solvers, and an item whose key they could not
          confirm is excluded from quizzes outright - there is no way to switch it back on.
          A quiz only serves multiple-choice and true/false items, so every question you sit
          is scored automatically.
          {excluded > 0 &&
            ` ${excluded} ${pluralize(excluded, 'item')} - free-response questions the app cannot mark, unconfirmed keys, missing figures, or no answer in the source at all - ${excluded === 1 ? 'is' : 'are'} kept in the browser for the record, with ${excluded === 1 ? 'its' : 'their'} model ${pluralize(excluded, 'answer')}, and never served in a quiz.`}
        </p>

        <Button.Root variant='neutral' mode='stroke' asChild className='h-11 sm:self-start'>
          <Link href='/bank'>
            Browse the question bank
            {excluded > 0 && (
              <span className='text-paragraph-xs text-warning-base'>
                {excluded} excluded
              </span>
            )}
            <Button.Icon as={RiArrowRightLine} />
          </Link>
        </Button.Root>
      </div>
    </SettingsSection>
  );
}
