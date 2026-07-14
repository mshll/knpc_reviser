'use client';

import { RiErrorWarningLine } from '@remixicon/react';

import * as Alert from '@/components/ui/alert';
import { useStorageStatus } from '@/components/app-shell';

export function StorageWarning() {
  const status = useStorageStatus();

  if (!status.degraded) return null;

  return (
    <Alert.Root variant='lighter' status='warning' size='small' role='alert'>
      <Alert.Icon as={RiErrorWarningLine} />
      History will not be saved. This browser refused permanent storage, likely
      because of private browsing, so attempts and settings vanish when the tab
      closes. Export a backup before you leave if anything here matters.
    </Alert.Root>
  );
}
