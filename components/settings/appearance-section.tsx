'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { RiComputerLine, RiMoonLine, RiSunLine } from '@remixicon/react';

import * as SegmentedControl from '@/components/ui/segmented-control';
import { SettingsSection } from '@/components/settings/section';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: RiSunLine },
  { value: 'dark', label: 'Dark', icon: RiMoonLine },
  { value: 'system', label: 'System', icon: RiComputerLine },
] as const;

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <SettingsSection title='Appearance'>
      {mounted ? (
        <SegmentedControl.Root value={theme ?? 'system'} onValueChange={setTheme}>
          <SegmentedControl.List aria-label='Theme'>
            {THEME_OPTIONS.map((option) => (
              <SegmentedControl.Trigger
                key={option.value}
                value={option.value}
                className='h-9 gap-2'
              >
                <option.icon className='size-4' />
                {option.label}
              </SegmentedControl.Trigger>
            ))}
          </SegmentedControl.List>
        </SegmentedControl.Root>
      ) : (
        <div
          aria-hidden='true'
          className='h-11 w-full animate-pulse rounded-10 bg-bg-weak-50'
        />
      )}
    </SettingsSection>
  );
}
