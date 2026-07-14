import rawQuarantine from '@/content/quarantine.json';
import rawQuestions from '@/content/questions.json';
import {
  DEFAULT_TIERS,
  EXAM_NAMES,
  FLAGS,
  KEY_PROVENANCES,
  QUARANTINE_FLAGS,
  QUESTION_TYPES,
  SERVABLE_QUESTION_TYPES,
  SOURCE_TIERS,
  TOPICS,
  VERIFICATION_LEVELS,
  type Attempt,
  type ExamName,
  type Flag,
  type KeyProvenance,
  type Option,
  type Question,
  type QuestionSource,
  type QuestionType,
  type QuizConfig,
  type SourceTier,
  type Topic,
  type TopicStat,
  type VerificationLevel,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Seeded PRNG. Anything that must replay identically (option order, question
// order on the results screen) is seeded from the attempt id, never Math.random.
// ---------------------------------------------------------------------------

/** FNV-1a. Turns an attempt id into a 32-bit seed. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, good enough, and reproducible across runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates against a seeded PRNG. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Weighted sample without replacement (Efraimidis-Spirakis keys). Deterministic given `rand`. */
function weightedSample<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rand: () => number,
): T[] {
  const keyed = items.map((item) => {
    const weight = Math.max(weightOf(item), 1e-6);
    const u = Math.max(rand(), 1e-12);
    return { item, key: Math.pow(u, 1 / weight) };
  });
  keyed.sort((a, b) => b.key - a.key);
  return keyed.map((entry) => entry.item);
}

// ---------------------------------------------------------------------------
// Validation. A bad row must never white-screen a study session: drop it, warn,
// carry on.
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isMemberOf<T extends string>(
  value: unknown,
  members: readonly T[],
): value is T {
  return typeof value === 'string' && (members as readonly string[]).includes(value);
}

function validateOption(value: unknown): Option | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.label)) return null;
  if (typeof value.text !== 'string') return null;
  if (typeof value.isCorrect !== 'boolean') return null;
  if (!isOptionalString(value.figure)) return null;
  // An option must carry something renderable: text, or a figure.
  if (value.text.trim().length === 0 && !isNonEmptyString(value.figure)) return null;

  const option: Option = {
    label: value.label,
    text: value.text,
    isCorrect: value.isCorrect,
  };
  if (typeof value.figure === 'string') option.figure = value.figure;
  return option;
}

function validateSource(value: unknown): QuestionSource | null {
  if (!isRecord(value)) return null;
  if (typeof value.file !== 'string') return null;
  if (!isMemberOf<ExamName>(value.exam, EXAM_NAMES)) return null;
  if (!isMemberOf<SourceTier>(value.tier, SOURCE_TIERS)) return null;
  if (value.year !== undefined && typeof value.year !== 'number') return null;
  if (value.originalNumber !== undefined && typeof value.originalNumber !== 'number') {
    return null;
  }

  const source: QuestionSource = {
    file: value.file,
    exam: value.exam,
    tier: value.tier,
  };
  if (typeof value.year === 'number') source.year = value.year;
  if (typeof value.originalNumber === 'number') {
    source.originalNumber = value.originalNumber;
  }
  return source;
}

function validateFlags(value: unknown): Flag[] | null {
  if (!Array.isArray(value)) return null;
  const flags: Flag[] = [];
  for (const entry of value) {
    if (!isMemberOf<Flag>(entry, FLAGS)) return null;
    flags.push(entry);
  }
  return flags;
}

function sameLabelSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const label of left) {
    if (!right.has(label)) return false;
  }
  return true;
}

/** Returns the validated Question, or a reason string explaining why it was dropped. */
function validateQuestion(value: unknown, rules: RowRules): Question | string {
  if (!isRecord(value)) return 'not an object';
  if (!isNonEmptyString(value.id)) return 'missing id';
  if (!isMemberOf<QuestionType>(value.type, QUESTION_TYPES)) {
    return `unknown type "${String(value.type)}"`;
  }
  if (!isMemberOf<Topic>(value.topic, TOPICS)) {
    return `unknown topic "${String(value.topic)}"`;
  }
  if (!isNonEmptyString(value.stem)) return 'empty stem';
  if (!isOptionalString(value.subtopic)) return 'bad subtopic';
  if (!isOptionalString(value.stemCode)) return 'bad stemCode';
  if (!isOptionalString(value.stemFigure)) return 'bad stemFigure';
  if (!isOptionalString(value.explanation)) return 'bad explanation';
  if (!isOptionalString(value.referenceUrl)) return 'bad referenceUrl';
  if (!isOptionalString(value.answerText)) return 'bad answerText';
  if (!isOptionalString(value.answerFigure)) return 'bad answerFigure';
  if (value.explanationSource !== undefined && value.explanationSource !== 'source') {
    return `unknown explanationSource "${String(value.explanationSource)}"`;
  }
  if (!isMemberOf<KeyProvenance>(value.keyProvenance, KEY_PROVENANCES)) {
    return `unknown keyProvenance "${String(value.keyProvenance)}"`;
  }
  if (typeof value.keyVerified !== 'boolean') return 'bad keyVerified';
  if (!isMemberOf<VerificationLevel>(value.verificationLevel, VERIFICATION_LEVELS)) {
    return `unknown verificationLevel "${String(value.verificationLevel)}"`;
  }
  if (typeof value.needsReview !== 'boolean') return 'bad needsReview';
  // SPEC rule 7: the badge and the review flag are two views of one fact and may not drift apart.
  // Enforced on the served bank only - a quarantine record is preserved exactly as the pipeline
  // left it, contradictions included, because that is what a record is for.
  if (
    rules.requireAnswerKey &&
    (value.verificationLevel === 'disputed') !== value.needsReview
  ) {
    return 'verificationLevel "disputed" disagrees with needsReview';
  }
  if (typeof value.dedupeHash !== 'string') return 'bad dedupeHash';

  const flags = validateFlags(value.flags);
  if (flags === null) return 'bad flags';

  const source = validateSource(value.source);
  if (source === null) return 'bad source';

  if (!Array.isArray(value.options)) return 'options is not an array';
  const options: Option[] = [];
  for (const entry of value.options) {
    const option = validateOption(entry);
    if (option === null) return 'bad option';
    options.push(option);
  }

  const labels = options.map((option) => option.label);
  if (new Set(labels).size !== labels.length) return 'duplicate option labels';

  if (!Array.isArray(value.answerOptionLabels)) return 'answerOptionLabels is not an array';
  const answerOptionLabels: string[] = [];
  for (const entry of value.answerOptionLabels) {
    if (typeof entry !== 'string') return 'bad answerOptionLabels entry';
    answerOptionLabels.push(entry);
  }

  const isChoice = value.type === 'mcq' || value.type === 'true_false';
  if (isChoice) {
    if (options.length === 0) return 'a choice question with no options';
    if (rules.requireAnswerKey && answerOptionLabels.length === 0) {
      return 'a choice question with no answer key';
    }
    for (const label of answerOptionLabels) {
      if (!labels.includes(label)) {
        return `answer label "${label}" is not one of the options`;
      }
    }
    // The two representations of the key must agree, or the item cannot be graded. A keyless
    // record has neither representation, so there is nothing to disagree.
    const correctLabels = options
      .filter((option) => option.isCorrect)
      .map((option) => option.label);
    if (!sameLabelSet(correctLabels, answerOptionLabels)) {
      return 'isCorrect flags disagree with answerOptionLabels';
    }
  } else if (rules.requireAnswerKey) {
    // short_answer / worked_problem are self-graded against a model answer.
    if (!isNonEmptyString(value.answerText)) {
      return 'a free-text question with no answerText';
    }
  }

  const question: Question = {
    id: value.id,
    type: value.type,
    topic: value.topic,
    stem: value.stem,
    options,
    answerOptionLabels,
    source,
    keyProvenance: value.keyProvenance,
    keyVerified: value.keyVerified,
    verificationLevel: value.verificationLevel,
    needsReview: value.needsReview,
    flags,
    dedupeHash: value.dedupeHash,
  };
  if (typeof value.subtopic === 'string') question.subtopic = value.subtopic;
  if (typeof value.stemCode === 'string') question.stemCode = value.stemCode;
  if (typeof value.stemFigure === 'string') question.stemFigure = value.stemFigure;
  if (typeof value.answerText === 'string') question.answerText = value.answerText;
  if (typeof value.answerFigure === 'string') question.answerFigure = value.answerFigure;
  if (typeof value.explanation === 'string') question.explanation = value.explanation;
  if (value.explanationSource === 'source') question.explanationSource = 'source';
  if (typeof value.referenceUrl === 'string') question.referenceUrl = value.referenceUrl;

  return question;
}

export interface BankProblem {
  index: number;
  id: string;
  reason: string;
}

export interface BankLoadReport {
  total: number;
  valid: number;
  dropped: number;
  quarantined: number;
  servable: number;
  problems: BankProblem[];
}

interface LoadedBank {
  /** The served bank plus the quarantine record. What /bank browses. */
  all: Question[];
  servable: Question[];
  byId: Map<string, Question>;
  /** The one authority on "may this id be served". Quarantine records are absent by construction. */
  servableById: Map<string, Question>;
  report: BankLoadReport;
}

/**
 * Whether a quiz is allowed to serve this item. Every exclusion here is a hard rule, not a
 * preference the user can switch off:
 *
 * - Only `mcq` and `true_false` can be marked by the app. Every served question is graded
 *   automatically, so a free-response item is unservable BY TYPE, whatever else its row says.
 *   The 49 free-response items (the KNPC 2021 written half, KNPC 2018, some [CE] 2016) are real
 *   past-paper material and are kept in `content/quarantine.json` for /bank to browse with their
 *   model answers. This check is the invariant, not the file split: a pipeline run that dropped
 *   a short_answer row back into questions.json must still never reach a quiz.
 * - `missing_figure` / `unanswerable` are quarantined by SPEC rules 4 and 8.
 * - An unconfirmed key is not an answer. Items whose blind re-answer disagreed with the source
 *   were dropped from the bank entirely, and this is the backstop that keeps a future pipeline
 *   run from quietly serving a disputed item.
 * - An item with fewer than two options, or with no key at all, cannot be answered or graded
 *   (the corpus has a handful, flagged `no_distractors`).
 *
 * Unservable items stay in the bank for the record. They are browsable and never quizzed.
 */
export function isServable(question: Question): boolean {
  if (!SERVABLE_QUESTION_TYPES.includes(question.type)) return false;
  if (question.flags.some((flag) => QUARANTINE_FLAGS.includes(flag))) return false;
  if (question.keyVerified === false) return false;
  if (question.options.length < 2) return false;
  if (question.answerOptionLabels.length === 0) return false;
  return true;
}

/**
 * A served item must be gradable, so it must carry an answer key and must satisfy SPEC rule 7.
 * A quarantine record must not: it is the record of the items that could NOT be keyed, and
 * demanding a key would drop exactly the rows the file exists to preserve. Safety never rests
 * on this flag - quarantine records are kept out of the servable pool structurally.
 */
interface RowRules {
  requireAnswerKey: boolean;
}

function validateRows(
  rows: unknown,
  rules: RowRules,
  what: string,
): { questions: Question[]; problems: BankProblem[] } {
  if (!Array.isArray(rows)) {
    return {
      questions: [],
      problems: [{ index: -1, id: '-', reason: `${what} is not an array` }],
    };
  }

  const questions: Question[] = [];
  const problems: BankProblem[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row: unknown, index: number) => {
    const result = validateQuestion(row, rules);
    const id = isRecord(row) && typeof row.id === 'string' ? row.id : `<row ${index}>`;

    if (typeof result === 'string') {
      problems.push({ index, id, reason: result });
      return;
    }
    if (seenIds.has(result.id)) {
      problems.push({ index, id, reason: 'duplicate id' });
      return;
    }
    seenIds.add(result.id);
    questions.push(result);
  });

  return { questions, problems };
}

/**
 * Validates a raw bank. Bad rows are dropped with a reason, never thrown over: one
 * corrupt row must not white-screen a study session. Pure, so it is testable without
 * touching content/questions.json.
 */
export function validateBank(rows: unknown): {
  questions: Question[];
  problems: BankProblem[];
} {
  return validateRows(rows, { requireAnswerKey: true }, 'questions.json');
}

/** The quarantine record: items kept for the record, browsable, never served. */
export function validateQuarantine(rows: unknown): {
  questions: Question[];
  problems: BankProblem[];
} {
  return validateRows(rows, { requireAnswerKey: false }, 'quarantine.json');
}

let bank: LoadedBank | null = null;

function loadBank(): LoadedBank {
  if (bank) return bank;

  const bankRows: unknown = rawQuestions;
  const quarantineRows: unknown = rawQuarantine;

  const { questions, problems } = validateBank(bankRows);
  const { questions: quarantined, problems: quarantineProblems } =
    validateQuarantine(quarantineRows);

  // The servable pool is built from content/questions.json ALONE. A quarantine record can
  // therefore never reach a quiz whatever its own fields happen to say - two records still
  // carry `keyVerified: true`, and a field-by-field test would wave them straight through.
  const servable = questions.filter(isServable);

  const byId = new Map(questions.map((question) => [question.id, question]));
  const all = [...questions];
  for (const record of quarantined) {
    if (byId.has(record.id)) {
      quarantineProblems.push({
        index: -1,
        id: record.id,
        reason: 'id also present in questions.json',
      });
      continue;
    }
    byId.set(record.id, record);
    all.push(record);
  }

  const allProblems = [...problems, ...quarantineProblems];
  const total =
    (Array.isArray(bankRows) ? bankRows.length : 0) +
    (Array.isArray(quarantineRows) ? quarantineRows.length : 0);

  if (allProblems.length > 0) {
    console.warn(
      `[questions] dropped ${allProblems.length} of ${total} rows from content/:`,
      allProblems,
    );
  }

  bank = {
    all,
    servable,
    byId,
    servableById: new Map(servable.map((question) => [question.id, question])),
    report: {
      total,
      valid: all.length,
      dropped: allProblems.length,
      quarantined: all.length - servable.length,
      servable: servable.length,
      problems: allProblems,
    },
  };
  return bank;
}

/** Every item that survived validation, including quarantined ones. For the record, not for quizzes. */
export function allQuestions(): Question[] {
  return loadBank().all;
}

/** Every item a quiz is allowed to serve. Quarantined items are already gone. */
export function servableQuestions(): Question[] {
  return loadBank().servable;
}

export function getBankReport(): BankLoadReport {
  return loadBank().report;
}

export function getQuestionById(id: string): Question | undefined {
  return loadBank().byId.get(id);
}

/**
 * Preserves the order of `ids`. Silently skips ids that are no longer in the bank.
 *
 * Reads the FULL pool, quarantine included, because a stored attempt must still render: a past
 * attempt may hold responses to items that have since been quarantined (the free-response items
 * were), and looking them up in the servable pool would replay those rows as blanks.
 */
export function getQuestionsByIds(ids: readonly string[]): Question[] {
  const byId = loadBank().byId;
  const out: Question[] = [];
  for (const id of ids) {
    const question = byId.get(id);
    if (question) out.push(question);
  }
  return out;
}

/**
 * The same lookup restricted to the servable pool, for anything that is about to put questions
 * in front of the user to ANSWER (a fresh drill, a restored session). Order is preserved; an id
 * that is not servable is dropped, so a stale session or a hand-written link cannot smuggle a
 * quarantined item into the runner.
 */
export function servableQuestionsByIds(ids: readonly string[]): Question[] {
  const servableById = loadBank().servableById;
  const out: Question[] = [];
  for (const id of ids) {
    const question = servableById.get(id);
    if (question) out.push(question);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Counts, for the quiz-config screen
// ---------------------------------------------------------------------------

export interface BankFilter {
  tiers?: readonly SourceTier[];
  topics?: readonly Topic[] | 'all';
}

function matchesFilter(question: Question, filter: BankFilter): boolean {
  const tiers = filter.tiers ?? DEFAULT_TIERS;
  if (!tiers.includes(question.source.tier)) return false;

  const topics = filter.topics ?? 'all';
  if (topics !== 'all' && !topics.includes(question.topic)) return false;

  return true;
}

export interface TopicCount {
  topic: Topic;
  count: number;
}

/** Servable items per topic, under `filter`. Topics with zero matches are omitted. */
export function topicCounts(filter: BankFilter = {}): TopicCount[] {
  const counts = new Map<Topic, number>();
  for (const question of servableQuestions()) {
    if (!matchesFilter(question, filter)) continue;
    counts.set(question.topic, (counts.get(question.topic) ?? 0) + 1);
  }
  return TOPICS.filter((topic) => (counts.get(topic) ?? 0) > 0).map((topic) => ({
    topic,
    count: counts.get(topic) ?? 0,
  }));
}

export interface SourceCount {
  tier: SourceTier;
  exam: ExamName;
  year: number | null;
  count: number;
}

/** Servable items per (tier, exam, year), under `filter`. Sorted by tier then year. */
export function sourceCounts(filter: BankFilter = {}): SourceCount[] {
  const counts = new Map<string, SourceCount>();
  for (const question of servableQuestions()) {
    if (!matchesFilter(question, filter)) continue;
    const { tier, exam } = question.source;
    const year = question.source.year ?? null;
    const key = `${tier}|${exam}|${year ?? '-'}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { tier, exam, year, count: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => {
    const tierDelta = SOURCE_TIERS.indexOf(a.tier) - SOURCE_TIERS.indexOf(b.tier);
    if (tierDelta !== 0) return tierDelta;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

export function tierCounts(): Array<{ tier: SourceTier; count: number }> {
  return SOURCE_TIERS.map((tier) => ({
    tier,
    count: servableQuestions().filter((question) => question.source.tier === tier).length,
  }));
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface SelectionHistory {
  /** Ids the user has answered wrong at least once. Drives `config.onlyMissed`. */
  missedQuestionIds: readonly string[];
  /** Drives the weak-topic weighting in `drill` mode. Ignored by `mock` and `practice`. */
  topicStats: readonly TopicStat[];
}

export const EMPTY_HISTORY: SelectionHistory = {
  missedQuestionIds: [],
  topicStats: [],
};

/**
 * Drill weight for a topic: an unattempted topic sits at the neutral 1.0, and a topic
 * you get wrong every time reaches 1 + DRILL_WEIGHT_STRENGTH. A topic with only a
 * couple of data points is pulled back toward neutral so one unlucky question does not
 * hijack the whole session.
 */
const DRILL_WEIGHT_STRENGTH = 3;
const DRILL_CONFIDENCE_SEEN = 5;

function drillWeight(topic: Topic, statsByTopic: Map<Topic, TopicStat>): number {
  const stat = statsByTopic.get(topic);
  if (!stat || stat.seen === 0) return 1;
  const confidence = Math.min(stat.seen / DRILL_CONFIDENCE_SEEN, 1);
  return 1 + (1 - stat.accuracy) * DRILL_WEIGHT_STRENGTH * confidence;
}

/**
 * An aggregate option ("None of the above", "All of these") is only coherent at the end of the
 * list, so it is pinned there rather than shuffled into the middle. The corpus spells it a
 * dozen ways - "All the above", "All of above", "None of the mentioned.", "None of the above!" -
 * and a spelling this misses is a spelling that gets shuffled to position A, above nothing.
 *
 * "Both of the above" is deliberately NOT here: it names a *count* of the options above it, so
 * pinning it last in a four-option item makes it claim three. It is a cross-reference, and
 * `crossReferencesOptions` locks the whole question instead.
 */
const TRAILING_OPTION =
  /^\s*(none|all|any)\s+(of\s+)?(the\s+)?(above|these|them|mentioned|following)\s*[.!]?\s*$/i;

/** A reference to another option: a bare letter or index, bracketed or not. `(a)`, `B`, `3`. */
const OPTION_REF = String.raw`\(?\s*[a-e1-5]\s*\)?`;

/**
 * An option that names other options: "Both (a) & (b)", "1 and 3", "Neither (A) nor (B).",
 * "(A) and (B)both", "Both a and d above". The whole text must be the reference expression, so
 * a truth-table row ("1 AND 1 is 0") and a program output ("1, 2, 3, 4") are left alone.
 */
const CROSS_REFERENCE = new RegExp(
  String.raw`^\s*(?:both|neither|either)?\s*${OPTION_REF}\s*(?:&|and|or|nor)\s*${OPTION_REF}\s*(?:both)?\s*(?:above)?\s*[.!]?\s*$`,
  'i',
);

/** "Both of the above", and the corpus's garbled "both and b above". Positional by construction. */
const BOTH_ABOVE = /^\s*both\b.*\babove\b\s*[.!]?\s*$/i;

/**
 * True when any option's text points at another option by letter or position. The UI renders the
 * POSITIONAL letter (question-view: optionLetter(index)), so shuffling such a question leaves the
 * option naming whichever choices happen to have landed in those slots - and when that option is
 * the key, the app confidently reveals a self-referential or plainly wrong answer.
 *
 * Pinning cannot save these: "Both C and D" is still wrong once C and D have moved. The only
 * correct thing to do is serve the source order untouched. It is a pure function of the question,
 * so the quiz screen and `replayQuestions` reach the same verdict without persisting anything.
 */
export function crossReferencesOptions(question: Question): boolean {
  return question.options.some(
    (option) => CROSS_REFERENCE.test(option.text) || BOTH_ABOVE.test(option.text),
  );
}

/**
 * Display order for a question's options. Deterministic in (attemptId, question.id), so the
 * quiz screen and the results screen always agree. Option identity is `option.label`, which
 * never moves - only the order changes. Question-view renders the positional letter.
 */
export function orderedOptions(
  question: Question,
  attemptId: string,
  shuffle: boolean,
): Option[] {
  if (!shuffle || question.options.length < 2) return question.options;
  if (crossReferencesOptions(question)) return question.options;

  const movable = question.options.filter((option) => !TRAILING_OPTION.test(option.text));
  const pinned = question.options.filter((option) => TRAILING_OPTION.test(option.text));
  const rand = mulberry32(hashString(`${attemptId}:opt:${question.id}`));
  return [...seededShuffle(movable, rand), ...pinned];
}

function withOrderedOptions(
  question: Question,
  attemptId: string,
  shuffle: boolean,
): Question {
  if (!shuffle) return question;
  const options = orderedOptions(question, attemptId, shuffle);
  if (options === question.options) return question;
  return { ...question, options };
}

/**
 * The question set for one attempt.
 *
 * - `attemptId` seeds every random decision, so an attempt always replays identically.
 * - Weak-topic weighting applies to `drill` only. `mock` and `practice` are uniform.
 * - If fewer questions match than `config.count` asks for, you get what exists. It never
 *   pads and never repeats an item inside one attempt. Check `.length` and tell the user.
 */
export function selectQuestions(
  config: QuizConfig,
  history: SelectionHistory,
  attemptId: string,
): Question[] {
  const tiers = config.tiers.length > 0 ? config.tiers : DEFAULT_TIERS;
  const missed = new Set(history.missedQuestionIds);

  const pool = servableQuestions().filter((question) => {
    if (!tiers.includes(question.source.tier)) return false;
    if (config.topics !== 'all' && !config.topics.includes(question.topic)) return false;
    if (config.onlyMissed && !missed.has(question.id)) return false;
    return true;
  });

  const rand = mulberry32(hashString(attemptId));

  let ordered: Question[];
  if (config.mode === 'drill') {
    const statsByTopic = new Map(history.topicStats.map((stat) => [stat.topic, stat]));
    ordered = weightedSample(pool, (question) => drillWeight(question.topic, statsByTopic), rand);
  } else {
    ordered = seededShuffle(pool, rand);
  }

  const count = Math.max(0, Math.min(config.count, ordered.length));
  return ordered
    .slice(0, count)
    .map((question) => withOrderedOptions(question, attemptId, config.shuffleOptions));
}

/**
 * The question set for an explicit id list - "re-drill exactly these", which is what the
 * results screen's "drill the ones I got wrong" needs and `selectQuestions` cannot express.
 *
 * Deliberately bypasses the tier and topic filters: if you missed a `bank` item while that tier
 * was on, you must still be able to re-drill it after turning the tier off. It does honour
 * quarantine - it reads the servable pool, so a hand-written `?ids=` cannot reach a quarantined
 * item - de-duplicates, drops ids that have left the bank, and seeds its order off `attemptId`
 * exactly like every other attempt.
 */
export function selectQuestionsByIds(
  ids: readonly string[],
  attemptId: string,
  options: { shuffleOptions?: boolean } = {},
): Question[] {
  const picked = servableQuestionsByIds([...new Set(ids)]);
  const rand = mulberry32(hashString(attemptId));
  return seededShuffle(picked, rand).map((question) =>
    withOrderedOptions(question, attemptId, options.shuffleOptions ?? true),
  );
}

/** How many questions `config` would actually yield. For the "N questions match" line. */
export function countMatching(config: QuizConfig, history: SelectionHistory): number {
  const tiers = config.tiers.length > 0 ? config.tiers : DEFAULT_TIERS;
  const missed = new Set(history.missedQuestionIds);
  return servableQuestions().filter((question) => {
    if (!tiers.includes(question.source.tier)) return false;
    if (config.topics !== 'all' && !config.topics.includes(question.topic)) return false;
    if (config.onlyMissed && !missed.has(question.id)) return false;
    return true;
  }).length;
}

/**
 * Rebuild the exact question objects a finished attempt was sat with: same order, same
 * option order. The results screen uses this instead of re-running selection.
 */
export function replayQuestions(attempt: Attempt): Question[] {
  return getQuestionsByIds(attempt.questionIds).map((question) =>
    withOrderedOptions(question, attempt.id, attempt.config.shuffleOptions),
  );
}

/** Cryptographically random where available, seeded PRNG nowhere - this is an identity, not a replay. */
export function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
