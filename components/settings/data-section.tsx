'use client';

import * as React from 'react';
import {
  RiCheckboxCircleLine,
  RiDeleteBin6Line,
  RiDownload2Line,
  RiErrorWarningLine,
  RiUpload2Line,
} from '@remixicon/react';

import * as Alert from '@/components/ui/alert';
import * as Button from '@/components/ui/button';
import * as Modal from '@/components/ui/modal';
import { SettingsSection } from '@/components/settings/section';
import { clearSession } from '@/components/quiz/session-store';
import { BackupError, exportBackup, importBackup } from '@/lib/backup';
import { clearAll } from '@/lib/db';
import { pluralize } from '@/lib/format';

interface Feedback {
  kind: 'success' | 'error';
  text: string;
}

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  return (
    <Alert.Root
      variant='lighter'
      status={feedback.kind === 'success' ? 'success' : 'error'}
      size='small'
      role='status'
    >
      <Alert.Icon
        as={feedback.kind === 'success' ? RiCheckboxCircleLine : RiErrorWarningLine}
      />
      {feedback.text}
    </Alert.Root>
  );
}

export function DataSection({ onDataChanged }: { onDataChanged: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetArmed, setResetArmed] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleExport() {
    setBusy(true);
    setFeedback(null);
    try {
      const { filename } = await exportBackup();
      setFeedback({
        kind: 'success',
        text: `Backup downloaded as ${filename}. Keep it somewhere safe, or import it on your other device.`,
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        text:
          error instanceof BackupError
            ? error.message
            : 'Export failed. Nothing was written.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await importBackup(file);
      const parts = [
        `Added ${result.attemptsAdded} ${pluralize(result.attemptsAdded, 'attempt')}`,
        `skipped ${result.attemptsSkipped} already present`,
        `added ${result.responsesAdded} ${pluralize(result.responsesAdded, 'response')}`,
      ];
      const settingsNote = result.settingsApplied
        ? ' Settings from the backup were applied.'
        : '';
      setFeedback({ kind: 'success', text: `${parts.join(', ')}.${settingsNote}` });
      onDataChanged();
    } catch (error) {
      setFeedback({
        kind: 'error',
        text:
          error instanceof BackupError
            ? `${error.message} Nothing was imported.`
            : 'That file could not be read. Nothing was imported.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setFeedback(null);
    try {
      await clearAll();
      // The in-progress quiz lives in localStorage, not IndexedDB. Leaving it behind would
      // offer to resume a quiz belonging to the history the user just deleted.
      clearSession();
      setResetOpen(false);
      setResetArmed(false);
      setFeedback({ kind: 'success', text: 'All history and settings were deleted.' });
      onDataChanged();
    } catch {
      setFeedback({ kind: 'error', text: 'Reset failed. Your history is untouched.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection
      title='Your data'
      description='Your history lives in this browser only. Clearing browser data, or switching to your phone, loses it. Export a backup and import it on the other device.'
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <Button.Root
            variant='neutral'
            mode='stroke'
            disabled={busy}
            onClick={() => void handleExport()}
            className='h-11 flex-1'
          >
            <Button.Icon as={RiDownload2Line} />
            Export backup
          </Button.Root>

          <Button.Root
            variant='neutral'
            mode='stroke'
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className='h-11 flex-1'
          >
            <Button.Icon as={RiUpload2Line} />
            Import backup
          </Button.Root>

          <input
            ref={fileInputRef}
            type='file'
            accept='application/json,.json'
            aria-label='Choose a backup file to import'
            className='sr-only'
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleImport(file);
            }}
          />
        </div>

        <p className='text-paragraph-xs text-text-sub-600'>
          Importing merges: attempts already on this device are kept, never overwritten.
          A malformed file is rejected outright, so a bad import can never eat your
          history.
        </p>

        {feedback && <FeedbackAlert feedback={feedback} />}

        <Modal.Root
          open={resetOpen}
          onOpenChange={(open) => {
            setResetOpen(open);
            if (!open) setResetArmed(false);
          }}
        >
          <Modal.Trigger asChild>
            <Button.Root
              variant='error'
              mode='stroke'
              disabled={busy}
              className='h-11 sm:self-start'
            >
              <Button.Icon as={RiDeleteBin6Line} />
              Reset all history
            </Button.Root>
          </Modal.Trigger>

          <Modal.Content>
            <Modal.Header
              icon={RiDeleteBin6Line}
              title='Delete all history?'
              description='Every attempt, response and setting on this device is wiped. This is irreversible.'
            />
            <Modal.Body>
              <p className='text-paragraph-sm text-text-sub-600'>
                If any of this matters, export a backup first. Once deleted there is no
                undo, and nothing to recover.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close asChild>
                <Button.Root variant='neutral' mode='stroke' className='h-11 flex-1'>
                  Cancel
                </Button.Root>
              </Modal.Close>
              <Button.Root
                variant='error'
                mode={resetArmed ? 'filled' : 'stroke'}
                disabled={busy}
                onClick={() => {
                  if (resetArmed) {
                    void handleReset();
                  } else {
                    setResetArmed(true);
                  }
                }}
                className='h-11 flex-1'
              >
                {resetArmed ? 'Tap again to delete' : 'Delete everything'}
              </Button.Root>
            </Modal.Footer>
          </Modal.Content>
        </Modal.Root>
      </div>
    </SettingsSection>
  );
}
