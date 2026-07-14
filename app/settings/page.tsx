'use client';

import * as React from 'react';

import * as Divider from '@/components/ui/divider';
import { AboutBankSection } from '@/components/settings/about-bank-section';
import { AppearanceSection } from '@/components/settings/appearance-section';
import { DataSection } from '@/components/settings/data-section';
import { QuizDefaultsSection } from '@/components/settings/quiz-defaults-section';
import { StorageWarning } from '@/components/settings/storage-warning';

export default function SettingsPage() {
  const [refreshKey, setRefreshKey] = React.useState(0);

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-8'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-title-h4 text-text-strong-950'>Settings</h1>
        <p className='text-paragraph-sm text-text-sub-600'>
          Everything stays on this device. There is no account and no server.
        </p>
      </header>

      <StorageWarning />

      <AppearanceSection />
      <Divider.Root />
      <QuizDefaultsSection key={refreshKey} />
      <Divider.Root />
      <DataSection onDataChanged={() => setRefreshKey((key) => key + 1)} />
      <Divider.Root />
      <AboutBankSection />
    </div>
  );
}
