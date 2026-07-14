'use client';

import * as React from 'react';

/**
 * Registers /sw.js for offline support. Production-only: a stale service worker
 * during `next dev` serves yesterday's chunks and makes development miserable.
 */
export function RegisterServiceWorker(): null {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('[sw] registration failed:', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

export default RegisterServiceWorker;
