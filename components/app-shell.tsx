'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import {
  RiHistoryLine,
  RiHome5Line,
  RiPlayCircleLine,
  RiSettings3Line,
  type RemixiconComponentType,
} from '@remixicon/react';

import { ensureStorageReady, getStorageStatus, subscribeStorageStatus, type StorageStatus } from '@/lib/db';
import { cn } from '@/utils/cn';

const ThemeSwitch = dynamic(() => import('@/components/theme-switch'), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Chrome visibility. A quiz route renders <HideChrome /> and the nav gets out of
// the way for as long as that route is mounted.
// ---------------------------------------------------------------------------

interface ChromeContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const ChromeContext = React.createContext<ChromeContextValue | null>(null);

export function useChrome(): ChromeContextValue {
  const context = React.useContext(ChromeContext);
  if (!context) {
    throw new Error('useChrome must be used inside <AppShell>.');
  }
  return context;
}

/** Hides the nav for as long as the calling component is mounted. */
export function useHideChrome(): void {
  const { setHidden } = useChrome();
  React.useEffect(() => {
    setHidden(true);
    return () => setHidden(false);
  }, [setHidden]);
}

/** Declarative form of `useHideChrome`. Drop `<HideChrome />` anywhere in a quiz route. */
export function HideChrome(): null {
  useHideChrome();
  return null;
}

// ---------------------------------------------------------------------------
// Storage status, for the "history will not be saved" warning.
// ---------------------------------------------------------------------------

export function useStorageStatus(): StorageStatus {
  const [status, setStatus] = React.useState<StorageStatus>(getStorageStatus);

  React.useEffect(() => {
    const unsubscribe = subscribeStorageStatus(setStatus);
    void ensureStorageReady().then(setStatus);
    return unsubscribe;
  }, []);

  return status;
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: RemixiconComponentType;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home', icon: RiHome5Line },
  { href: '/quiz', label: 'Practice', icon: RiPlayCircleLine },
  { href: '/history', label: 'History', icon: RiHistoryLine },
  { href: '/settings', label: 'Settings', icon: RiSettings3Line },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TopBar({ pathname }: { pathname: string }) {
  return (
    <header className='sticky top-0 z-40 hidden border-b border-stroke-soft-200 bg-bg-white-0/80 pt-[env(safe-area-inset-top)] backdrop-blur-md md:block'>
      <div className='mx-auto flex h-14 w-full max-w-3xl items-center gap-6 px-6'>
        <Link
          href='/'
          className='text-label-md font-extrabold text-text-strong-950 outline-none focus-visible:ring-2 focus-visible:ring-primary-base'
        >
          KNPC Reviser
        </Link>

        <nav className='flex flex-1 items-center gap-1'>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-10 px-3 text-label-sm outline-none transition duration-200 ease-out',
                  'focus-visible:ring-2 focus-visible:ring-primary-base',
                  active
                    ? 'bg-bg-weak-50 text-text-strong-950'
                    : 'text-text-sub-600 hover:bg-bg-weak-50 hover:text-text-strong-950',
                )}
              >
                <item.icon className='size-4' />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <ThemeSwitch />
      </div>
    </header>
  );
}

function BottomBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label='Primary'
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-stroke-soft-200 bg-bg-white-0/95 backdrop-blur-md md:hidden',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className='mx-auto flex max-w-lg items-stretch'>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[3.75rem] flex-1 flex-col items-center justify-center gap-1 px-2 py-2',
                'outline-none transition duration-200 ease-out',
                'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-base',
                active ? 'text-text-strong-950' : 'text-text-soft-400 active:bg-bg-weak-50',
              )}
            >
              <item.icon className='size-6' />
              <span className='text-label-xs'>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hidden, setHidden] = React.useState(false);

  const value = React.useMemo<ChromeContextValue>(
    () => ({ hidden, setHidden }),
    [hidden],
  );

  return (
    <ChromeContext.Provider value={value}>
      <div className='flex min-h-[100dvh] flex-col bg-bg-white-0'>
        {!hidden && <TopBar pathname={pathname} />}

        <main
          className={cn(
            'flex flex-1 flex-col',
            // Clear the bottom bar on phones. During a quiz there is no bar to clear.
            !hidden && 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0',
          )}
        >
          {children}
        </main>

        {!hidden && <BottomBar pathname={pathname} />}
      </div>
    </ChromeContext.Provider>
  );
}

export default AppShell;
