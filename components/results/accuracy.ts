export type AccuracyBarColor = 'green' | 'orange' | 'red';

/** One scale everywhere: green is safe, orange is shaky, red is a problem. */
export function accuracyBarColor(accuracy: number): AccuracyBarColor {
  if (accuracy >= 0.75) return 'green';
  if (accuracy >= 0.5) return 'orange';
  return 'red';
}
