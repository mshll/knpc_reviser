'use client';

import * as React from 'react';

import {
  DEFAULT_SETTINGS,
  getAllAttempts,
  getAllResponses,
  getSettings,
  type Settings,
} from '@/lib/db';
import { computeStats, type Stats } from '@/lib/stats';
import type { Attempt } from '@/lib/types';

export interface HomeData {
  loading: boolean;
  stats: Stats | null;
  lastAttempt: Attempt | null;
  settings: Settings;
}

const INITIAL: HomeData = {
  loading: true,
  stats: null,
  lastAttempt: null,
  settings: DEFAULT_SETTINGS,
};

export function useHomeStats(): HomeData {
  const [data, setData] = React.useState<HomeData>(INITIAL);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [attempts, responses, settings] = await Promise.all([
          getAllAttempts(),
          getAllResponses(),
          getSettings(),
        ]);
        if (cancelled) return;
        setData({
          loading: false,
          stats: computeStats({ attempts, responses }),
          lastAttempt: attempts.find((a) => a.finishedAt !== null) ?? null,
          settings,
        });
      } catch {
        if (!cancelled) setData({ ...INITIAL, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return data;
}
