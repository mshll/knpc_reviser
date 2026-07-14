'use client';

import * as React from 'react';

import * as Switch from '@/components/ui/switch';
import { SettingsRow, SettingsSection } from '@/components/settings/section';
import {
  DEFAULT_SETTINGS,
  getSettings,
  setSetting,
  type Settings,
} from '@/lib/db';
import { tierCounts } from '@/lib/questions';
import { TIER_DESCRIPTIONS, TIER_LABELS } from '@/lib/format';
import { SOURCE_TIERS, type SourceTier } from '@/lib/types';

const SAVE_ERROR = 'Could not save that change. Storage may be unavailable.';

export function QuizDefaultsSection() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const byTier = new Map(tierCounts().map((entry) => [entry.tier, entry.count]));
    return (tier: SourceTier) => byTier.get(tier) ?? 0;
  }, []);

  React.useEffect(() => {
    let active = true;
    getSettings()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch(() => {
        if (active) setSettings(DEFAULT_SETTINGS);
      });
    return () => {
      active = false;
    };
  }, []);

  const tiers = settings?.defaultTiers ?? DEFAULT_SETTINGS.defaultTiers;

  async function persist<K extends keyof Settings>(key: K, value: Settings[K]) {
    setError(null);
    try {
      await setSetting(key, value);
    } catch {
      setError(SAVE_ERROR);
    }
  }

  function toggleTier(tier: SourceTier, checked: boolean) {
    if (!settings) return;
    if (!checked && tiers.length === 1 && tiers.includes(tier)) {
      setError('At least one source has to stay on.');
      return;
    }
    const next = SOURCE_TIERS.filter((candidate) =>
      candidate === tier ? checked : tiers.includes(candidate),
    );
    setSettings({ ...settings, defaultTiers: next });
    void persist('defaultTiers', next);
  }

  return (
    <SettingsSection
      title='Quiz defaults'
      description='Pre-fills quiz setup. You can still change everything per quiz.'
    >
      <div className='divide-y divide-stroke-soft-200'>
        {SOURCE_TIERS.map((tier) => (
          <SettingsRow
            key={tier}
            htmlFor={`tier-${tier}`}
            label={TIER_LABELS[tier]}
            labelSuffix={`${counts(tier)} questions`}
            description={TIER_DESCRIPTIONS[tier]}
          >
            <Switch.Root
              id={`tier-${tier}`}
              checked={tiers.includes(tier)}
              disabled={!settings}
              onCheckedChange={(checked) => toggleTier(tier, checked)}
            />
          </SettingsRow>
        ))}
      </div>

      {error && (
        <p role='alert' className='mt-2 text-paragraph-xs text-error-base'>
          {error}
        </p>
      )}
    </SettingsSection>
  );
}
