import { Suspense } from 'react';

import { QuizScreen } from '@/components/quiz/quiz-screen';

export const metadata = {
  title: 'Quiz - KNPC Reviser',
};

export default function QuizPage() {
  // useSearchParams inside QuizScreen requires a Suspense boundary on a static export.
  return (
    <Suspense fallback={null}>
      <QuizScreen />
    </Suspense>
  );
}
