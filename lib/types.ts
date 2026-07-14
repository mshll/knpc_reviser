// Data contract: docs/SPEC.md. The pipeline and the app both depend on this shape.
// Do not add a field here without updating the spec.

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'worked_problem';

export type Topic =
  | 'digital-logic'
  | 'computer-architecture'
  | 'operating-systems'
  | 'networking'
  | 'databases'
  | 'data-structures-algorithms'
  | 'programming'
  | 'number-systems'
  | 'software-engineering'
  | 'cloud-computing'
  | 'hardware-memory'
  | 'general-it'
  | 'misc';

export type SourceTier = 'gold' | 'practice' | 'bank';

export type KeyProvenance =
  | 'inline_bold'
  | 'answer_page'
  | 'docx_asterisk'
  | 'compiled'
  | 'derived'
  | 'none';

export type Flag =
  | 'legacy'
  | 'off_syllabus'
  | 'hedged_option'
  | 'missing_figure'
  | 'no_distractors'
  | 'key_disputed'
  /** Quarantine-only: no answer in the source and none derivable. Never on a served item. */
  | 'unanswerable';

/**
 * How hard the key was checked. Orthogonal to KeyProvenance (which says where the key came from).
 * The UI must grade its confidence badge off THIS, not off `keyVerified` - a scraped bank item that
 * one solver waved through and a KNPC item two solvers confirmed are both `keyVerified: true`.
 */
export type VerificationLevel =
  /** gold/practice: a source key existed and two independent blind solves both agreed. */
  | 'double'
  /** bank: a source key existed and one blind solve agreed. Scraped origin, worst keys. */
  | 'single'
  /** No source key existed at all; a panel derived the answer. */
  | 'derived'
  /** Solvers/panel could not agree. Always exactly equivalent to `needsReview`. */
  | 'disputed';

export type ExamName = 'KNPC' | 'KOC' | 'K-Companies' | 'mock' | 'bank';

export interface Option {
  label: string;
  text: string;
  figure?: string;
  isCorrect: boolean;
}

export interface QuestionSource {
  file: string;
  exam: ExamName;
  year?: number;
  tier: SourceTier;
  originalNumber?: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  topic: Topic;
  subtopic?: string;

  stem: string;
  stemCode?: string;
  stemFigure?: string;

  options: Option[];
  answerOptionLabels: string[];
  answerText?: string;
  /** The source's own worked solution (K-map, filled truth table). Shown only after reveal. */
  answerFigure?: string;

  explanation?: string;
  explanationSource?: 'source';
  referenceUrl?: string;

  source: QuestionSource;

  keyProvenance: KeyProvenance;
  keyVerified: boolean;
  verificationLevel: VerificationLevel;
  needsReview: boolean;

  flags: Flag[];
  dedupeHash: string;
}

export const QUESTION_TYPES: readonly QuestionType[] = [
  'mcq',
  'true_false',
  'short_answer',
  'worked_problem',
];

export const TOPICS: readonly Topic[] = [
  'digital-logic',
  'computer-architecture',
  'operating-systems',
  'networking',
  'databases',
  'data-structures-algorithms',
  'programming',
  'number-systems',
  'software-engineering',
  'cloud-computing',
  'hardware-memory',
  'general-it',
  'misc',
];

export const SOURCE_TIERS: readonly SourceTier[] = ['gold', 'practice', 'bank'];

export const KEY_PROVENANCES: readonly KeyProvenance[] = [
  'inline_bold',
  'answer_page',
  'docx_asterisk',
  'compiled',
  'derived',
  'none',
];

export const FLAGS: readonly Flag[] = [
  'legacy',
  'off_syllabus',
  'hedged_option',
  'missing_figure',
  'no_distractors',
  'key_disputed',
  'unanswerable',
];

export const VERIFICATION_LEVELS: readonly VerificationLevel[] = [
  'double',
  'single',
  'derived',
  'disputed',
];

export const EXAM_NAMES: readonly ExamName[] = [
  'KNPC',
  'KOC',
  'K-Companies',
  'mock',
  'bank',
];

/** Tiers that are switched on by default. `bank` is opt-in (SPEC: source tiers table). */
export const DEFAULT_TIERS: readonly SourceTier[] = ['gold', 'practice'];

/** SPEC rules 4 and 8: these items load into the bank for the record but are never served. */
export const QUARANTINE_FLAGS: readonly Flag[] = ['missing_figure', 'unanswerable'];

/**
 * The only types a quiz may serve. Scoring is 100% automatic, and these are the only two the
 * app can mark on its own: a free-response item (`short_answer`, `worked_problem`) can be
 * checked against its model answer by a human and by nobody else. Those items live in
 * `content/quarantine.json` - browsable in /bank with their model answers, never quizzed.
 */
export const SERVABLE_QUESTION_TYPES: readonly QuestionType[] = ['mcq', 'true_false'];

// ---------------------------------------------------------------------------
// App types (not part of the data contract)
// ---------------------------------------------------------------------------

export type QuizMode = 'mock' | 'practice' | 'drill';

export const QUIZ_MODES: readonly QuizMode[] = ['mock', 'practice', 'drill'];

export interface QuizConfig {
  mode: QuizMode;
  topics: Topic[] | 'all';
  tiers: SourceTier[];
  count: number;
  timeLimitSec: number | null;
  onlyMissed: boolean;
  shuffleOptions: boolean;
}

export interface Response {
  questionId: string;
  /** Option labels the user picked. Empty for a skip or an unanswered free-text item. */
  selected: string[];
  correct: boolean;
  skipped: boolean;
  timeSpentSec: number;
  /** Epoch ms at which the answer was revealed to the user. Absent while still hidden. */
  revealedAt?: number;
  /** Free text the user typed, for short_answer / worked_problem. Never auto-graded. */
  text?: string;
  /** True once the user has self-graded a free-text item. `correct` then holds their verdict. */
  selfGraded?: boolean;
}

/** Alias, for call sites where the DOM `Response` is also in scope. */
export type QuizResponse = Response;

export interface Attempt {
  id: string;
  mode: QuizMode;
  config: QuizConfig;
  startedAt: number;
  finishedAt: number | null;
  questionIds: string[];
  responses: Response[];
  score: number;
  total: number;
  durationSec: number;
}

export interface TopicStat {
  topic: Topic;
  seen: number;
  correct: number;
  /** correct / seen, in 0..1. Zero when `seen` is zero. */
  accuracy: number;
  /** Epoch ms of the most recent attempt that touched this topic, or null. */
  lastSeenAt: number | null;
}
