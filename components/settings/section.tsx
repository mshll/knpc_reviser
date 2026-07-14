import * as React from 'react';

import { cn } from '@/utils/cn';

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col', className)}>
      <h2 className='text-label-lg text-text-strong-950'>{title}</h2>
      {description && (
        <p className='mt-1 text-paragraph-sm text-text-sub-600'>{description}</p>
      )}
      <div className='mt-4'>{children}</div>
    </section>
  );
}

export function SettingsRow({
  htmlFor,
  label,
  labelSuffix,
  description,
  children,
}: {
  htmlFor?: string;
  label: string;
  labelSuffix?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className='flex min-h-11 items-start justify-between gap-4 py-3'>
      <label htmlFor={htmlFor} className='flex min-w-0 cursor-pointer flex-col gap-0.5'>
        <span className='text-label-sm text-text-strong-950'>
          {label}
          {labelSuffix && (
            <span className='ml-1.5 text-paragraph-xs text-text-soft-400'>
              {labelSuffix}
            </span>
          )}
        </span>
        {description && (
          <span className='text-paragraph-xs text-text-sub-600'>{description}</span>
        )}
      </label>
      <div className='shrink-0 pt-0.5'>{children}</div>
    </div>
  );
}
