import type {
  ExamName,
  Flag,
  KeyProvenance,
  QuizMode,
  SourceTier,
  Topic,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/** The quiz timer. "09:41", and "1:09:41" once it passes an hour. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** Prose duration for history rows. "42s", "6m 12s", "1h 4m". */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  if (safe < 60) return `${safe}s`;

  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${pad(seconds)}s`;
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(timestamp: number): string {
  return DATE_FORMAT.format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${DATE_FORMAT.format(date)}, ${TIME_FORMAT.format(date)}`;
}

/** "just now", "12m ago", "3h ago", "yesterday", "4d ago", then the date. */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return formatDate(timestamp);
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/** Takes a 0..1 ratio. `formatPercent(0.8421)` is "84%". */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  if (!Number.isFinite(ratio)) return '-';
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

export function formatScore(score: number, total: number): string {
  return `${score}/${total}`;
}

/** Display letter for an option, by position. Option identity is `option.label`, not this. */
export function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const TOPIC_LABELS: Record<Topic, string> = {
  'digital-logic': 'Digital Logic',
  'computer-architecture': 'Computer Architecture',
  'operating-systems': 'Operating Systems',
  networking: 'Networking',
  databases: 'Databases',
  'data-structures-algorithms': 'Data Structures and Algorithms',
  programming: 'Programming',
  'number-systems': 'Number Systems',
  'software-engineering': 'Software Engineering',
  'cloud-computing': 'Cloud Computing',
  'hardware-memory': 'Hardware and Memory',
  'general-it': 'General IT',
  misc: 'Misc',
};

/** For tight spots: bottom bars, chart axes, tags. */
export const TOPIC_SHORT_LABELS: Record<Topic, string> = {
  'digital-logic': 'Logic',
  'computer-architecture': 'Architecture',
  'operating-systems': 'OS',
  networking: 'Networking',
  databases: 'Databases',
  'data-structures-algorithms': 'DS and Algo',
  programming: 'Programming',
  'number-systems': 'Number Systems',
  'software-engineering': 'Software Eng',
  'cloud-computing': 'Cloud',
  'hardware-memory': 'Hardware',
  'general-it': 'General IT',
  misc: 'Misc',
};

export function topicLabel(topic: Topic): string {
  return TOPIC_LABELS[topic];
}

export const TIER_LABELS: Record<SourceTier, string> = {
  gold: 'Past papers',
  practice: 'Practice sets',
  bank: 'General bank',
};

export const TIER_DESCRIPTIONS: Record<SourceTier, string> = {
  gold: 'Recalled KNPC and KOC papers, and the K-Companies placement exam.',
  practice: 'Mock exams, question banks and code-trace items close to the real paper.',
  bank: 'Scraped general IT trivia. The largest set, the least representative, the worst answer keys.',
};

export function tierLabel(tier: SourceTier): string {
  return TIER_LABELS[tier];
}

export const MODE_LABELS: Record<QuizMode, string> = {
  mock: 'Mock Exam',
  practice: 'Practice',
  drill: 'Drill',
};

export const MODE_DESCRIPTIONS: Record<QuizMode, string> = {
  mock: 'Timed, no feedback until you submit. Exam conditions.',
  practice: 'Untimed, with the answer and explanation right after each question.',
  drill: 'Weighted toward the topics you keep getting wrong.',
};

export function modeLabel(mode: QuizMode): string {
  return MODE_LABELS[mode];
}

export const FLAG_LABELS: Record<Flag, string> = {
  legacy: 'Legacy',
  off_syllabus: 'Off syllabus',
  hedged_option: 'Hedged option',
  missing_figure: 'Missing figure',
  no_distractors: 'No distractors',
  key_disputed: 'Key disputed',
  unanswerable: 'Unanswerable',
};

export const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  legacy: 'This question is from the Office 2003 / Windows 2000 era. It may still show up.',
  off_syllabus: 'This question sits outside the Computer Engineering syllabus.',
  hedged_option:
    'One of the distractors is a non-answer, transcribed verbatim from the recalled paper.',
  missing_figure: 'The figure this question refers to is missing from the source.',
  no_distractors: 'The source shipped this item with only the correct option.',
  key_disputed: 'The source answer key and the blind re-answer pass disagree.',
  unanswerable:
    'The source never recorded an answer and none could be derived. Quarantined, never served.',
};

export function flagLabel(flag: Flag): string {
  return FLAG_LABELS[flag];
}

export const EXAM_LABELS: Record<ExamName, string> = {
  KNPC: 'KNPC',
  KOC: 'KOC',
  'K-Companies': 'K-Companies',
  mock: 'Mock exam',
  bank: 'Question bank',
};

export const KEY_PROVENANCE_LABELS: Record<KeyProvenance, string> = {
  inline_bold: 'Marked in the source paper',
  answer_page: 'From the model-answer page',
  docx_asterisk: 'Marked in the source document',
  compiled: 'Derived by compiling and running the code',
  derived: 'Solved independently; no key in the source',
  none: 'No key in the source, and the solvers disagreed',
};

/** "KNPC 2021", "K-Companies", "Question bank". */
export function sourceLabel(source: { exam: ExamName; year?: number }): string {
  const exam = EXAM_LABELS[source.exam];
  return source.year ? `${exam} ${source.year}` : exam;
}
