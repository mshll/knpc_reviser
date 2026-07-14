'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import ResultsScreen from '@/components/results/results-screen';

function ResultsWithParams() {
  const searchParams = useSearchParams();
  return <ResultsScreen attemptId={searchParams.get('id')} />;
}

export default function ResultsPage() {
  return (
    <React.Suspense fallback={null}>
      <ResultsWithParams />
    </React.Suspense>
  );
}
