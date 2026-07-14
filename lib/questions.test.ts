import { describe, expect, test } from 'bun:test';

import rawBank from '@/content/questions.json';
import {
  EMPTY_HISTORY,
  allQuestions,
  crossReferencesOptions,
  getQuestionById,
  isServable,
  orderedOptions,
  replayQuestions,
  selectQuestions,
  selectQuestionsByIds,
  servableQuestions,
  validateBank,
} from '@/lib/questions';
import type { Attempt, Question, QuizConfig } from '@/lib/types';

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;

/**
 * Deliberately written independently of the implementation's regexes: an option that reads as
 * an aggregate of the ones above it, however the source spells it.
 */
const AGGREGATE =
  /^\s*(all|none|any|both)\b[\s\S]*\b(above|these|them|mentioned|following)\b\s*[.!]?\s*$/i;

function rawMcq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'q1',
    type: 'mcq',
    topic: 'networking',
    stem: 'A stem.',
    options: [
      { label: 'A', text: 'Right', isCorrect: true },
      { label: 'B', text: 'Wrong', isCorrect: false },
    ],
    answerOptionLabels: ['A'],
    source: { file: 'f.pdf', exam: 'KNPC', tier: 'gold' },
    keyProvenance: 'inline_bold',
    keyVerified: true,
    verificationLevel: 'double',
    needsReview: false,
    flags: [],
    dedupeHash: 'h1',
    ...overrides,
  };
}

function config(overrides: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode: 'mock',
    topics: 'all',
    tiers: ['gold', 'practice'],
    count: 10,
    timeLimitSec: null,
    onlyMissed: false,
    shuffleOptions: false,
    ...overrides,
  };
}

describe('validateBank', () => {
  test('accepts a well-formed row', () => {
    const { questions, problems } = validateBank([rawMcq()]);
    expect(problems).toEqual([]);
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('q1');
  });

  test('drops a row instead of throwing, and says why', () => {
    const { questions, problems } = validateBank([
      rawMcq(),
      rawMcq({ id: 'q2', topic: 'astrology' }),
      rawMcq({ id: 'q3', type: 'essay' }),
      rawMcq({ id: 'q4', answerOptionLabels: ['Z'] }),
      rawMcq({ id: 'q5', stem: '' }),
      rawMcq({ id: 'q6', flags: ['made_up_flag'] }),
      'not an object',
      null,
    ]);

    expect(questions.map((question) => question.id)).toEqual(['q1']);
    expect(problems).toHaveLength(7);
    expect(problems[0].reason).toContain('astrology');
    expect(problems[2].reason).toContain('not one of the options');
  });

  test('drops an item whose isCorrect flags disagree with its answer key', () => {
    const { problems } = validateBank([
      rawMcq({
        options: [
          { label: 'A', text: 'Right', isCorrect: false },
          { label: 'B', text: 'Wrong', isCorrect: true },
        ],
        answerOptionLabels: ['A'],
      }),
    ]);
    expect(problems[0].reason).toBe('isCorrect flags disagree with answerOptionLabels');
  });

  test('drops a duplicate id, keeping the first', () => {
    const { questions, problems } = validateBank([
      rawMcq({ stem: 'first' }),
      rawMcq({ stem: 'second' }),
    ]);
    expect(questions).toHaveLength(1);
    expect(questions[0].stem).toBe('first');
    expect(problems[0].reason).toBe('duplicate id');
  });

  test('a free-text item needs a model answer, and needs no options', () => {
    const ok = validateBank([
      rawMcq({
        type: 'worked_problem',
        options: [],
        answerOptionLabels: [],
        answerText: '62 hosts',
      }),
    ]);
    expect(ok.problems).toEqual([]);
    expect(ok.questions[0].options).toEqual([]);

    const bad = validateBank([
      rawMcq({ type: 'short_answer', options: [], answerOptionLabels: [] }),
    ]);
    expect(bad.problems[0].reason).toBe('a free-text question with no answerText');
  });

  test('a non-array bank is a problem, not a crash', () => {
    expect(validateBank({ nope: true }).questions).toEqual([]);
    expect(validateBank(null).problems).toHaveLength(1);
  });

  test('keeps answerFigure: the paper\'s own worked solution is not optional decoration', () => {
    // Several answerText values literally read "see the model-answer figure". Dropping the
    // figure leaves the user grading themselves against a reference the app never showed.
    const { questions, problems } = validateBank([
      rawMcq({
        type: 'worked_problem',
        options: [],
        answerOptionLabels: [],
        answerText: 'See the model-answer figure.',
        answerFigure: '/figures/ce2016-q076-answer.png',
      }),
    ]);
    expect(problems).toEqual([]);
    expect(questions[0].answerFigure).toBe('/figures/ce2016-q076-answer.png');
  });

  test('every answerFigure in the real bank survives validation', () => {
    const raw = (rawBank as Array<Record<string, unknown>>).filter(
      (row) => typeof row.answerFigure === 'string',
    );
    const byId = new Map(allQuestions().map((question) => [question.id, question]));

    for (const row of raw) {
      expect(byId.get(row.id as string)?.answerFigure).toBe(row.answerFigure as string);
    }
  });

  test('accepts 2, 3 and 5 option items alike', () => {
    const five = rawMcq({
      options: [
        { label: 'A', text: 'a', isCorrect: false },
        { label: 'B', text: 'b', isCorrect: true },
        { label: 'C', text: 'c', isCorrect: false },
        { label: 'D', text: 'd', isCorrect: false },
        { label: 'E', text: 'None of these', isCorrect: false },
      ],
      answerOptionLabels: ['B'],
    });
    const three = rawMcq({
      id: 'q3',
      options: [
        { label: 'A', text: 'a', isCorrect: false },
        { label: 'B', text: 'b', isCorrect: false },
        { label: 'C', text: 'c', isCorrect: true },
      ],
      answerOptionLabels: ['C'],
    });
    const { questions, problems } = validateBank([five, three]);
    expect(problems).toEqual([]);
    expect(questions.map((question) => question.options.length)).toEqual([5, 3]);
  });
});

describe('isServable', () => {
  test('a missing_figure item is quarantined', () => {
    const [question] = validateBank([rawMcq({ flags: ['missing_figure'] })]).questions;
    expect(isServable(question)).toBe(false);
  });

  test('a choice item with a single option cannot be answered, so it is not served', () => {
    const [question] = validateBank([
      rawMcq({
        options: [{ label: 'A', text: 'Only', isCorrect: true }],
        answerOptionLabels: ['A'],
        flags: ['no_distractors'],
      }),
    ]).questions;
    expect(isServable(question)).toBe(false);
  });

  // A hard rule, not a setting. The "include unverified answers" opt-in was retired with the
  // items themselves; this is the backstop if a future pipeline run ships a disputed key.
  test('an item whose key could not be confirmed is never servable', () => {
    const [question] = validateBank([
      rawMcq({
        keyVerified: false,
        needsReview: true,
        verificationLevel: 'disputed',
        flags: ['key_disputed'],
      }),
    ]).questions;
    expect(question).toBeDefined();
    expect(isServable(question)).toBe(false);
  });

  test('an ordinary item is served', () => {
    const [question] = validateBank([rawMcq({ flags: ['legacy'] })]).questions;
    expect(isServable(question)).toBe(true);
  });

  // Scoring is 100% automatic, so a question the app cannot mark is unservable BY TYPE. This
  // must not depend on the item sitting in quarantine.json: these rows are well-formed, valid,
  // key-verified members of the served bank, and they must still be rejected.
  test('a free-response item is never servable, whatever else the row says', () => {
    for (const type of ['short_answer', 'worked_problem']) {
      const [question] = validateBank([
        rawMcq({
          id: `free-${type}`,
          type,
          options: [],
          answerOptionLabels: [],
          answerText: 'A model answer the app cannot mark.',
          keyVerified: true,
          needsReview: false,
          flags: [],
        }),
      ]).questions;
      expect(question).toBeDefined();
      expect(isServable(question)).toBe(false);
    }
  });
});

describe('orderedOptions', () => {
  const [question] = validateBank([
    rawMcq({
      options: [
        { label: 'A', text: 'a', isCorrect: false },
        { label: 'B', text: 'b', isCorrect: true },
        { label: 'C', text: 'c', isCorrect: false },
        { label: 'D', text: 'None of these', isCorrect: false },
      ],
      answerOptionLabels: ['B'],
    }),
  ]).questions;

  test('returns the source order untouched when shuffle is off', () => {
    expect(orderedOptions(question, 'seed', false)).toBe(question.options);
  });

  test('is deterministic in (attemptId, question id)', () => {
    const first = orderedOptions(question, 'attempt-1', true).map((option) => option.label);
    const second = orderedOptions(question, 'attempt-1', true).map((option) => option.label);
    const other = orderedOptions(question, 'attempt-2', true).map((option) => option.label);
    expect(first).toEqual(second);
    expect(first.sort()).toEqual(other.sort());
  });

  test('pins "None of these" last', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const order = orderedOptions(question, seed, true);
      expect(order[order.length - 1].label).toBe('D');
    }
  });

  test('never drops or duplicates an option', () => {
    const order = orderedOptions(question, 'seed', true);
    expect(order).toHaveLength(4);
    expect(new Set(order.map((option) => option.label)).size).toBe(4);
  });

  test('pins the aggregate spellings the corpus actually uses, not just "None of these"', () => {
    // Every one of these appears in content/questions.json. Shuffled into position A, each
    // one refers to options that are now below it, and the item becomes unanswerable.
    const spellings = [
      'All the above',
      'All of above',
      'None of above',
      'None of the mentioned.',
      'None of the above!',
      'Any of the above',
      'All of them',
    ];

    for (const text of spellings) {
      const [item] = validateBank([
        rawMcq({
          options: [
            { label: 'A', text: 'a', isCorrect: false },
            { label: 'B', text: 'b', isCorrect: false },
            { label: 'C', text: 'c', isCorrect: false },
            { label: 'D', text, isCorrect: true },
          ],
          answerOptionLabels: ['D'],
        }),
      ]).questions;

      for (const seed of SEEDS) {
        const order = orderedOptions(item, seed, true);
        expect(order[order.length - 1].text).toBe(text);
      }
    }
  });
});

describe('cross-referencing options', () => {
  // The UI renders the POSITIONAL letter, so an option that names another option by letter is
  // only true in the source order. Pinning cannot save it: "Both C and D" is wrong the moment
  // C and D move. Such a question must not be shuffled at all.
  function itemWith(texts: string[]): Question {
    const labels = ['A', 'B', 'C', 'D', 'E'];
    return validateBank([
      rawMcq({
        options: texts.map((text, index) => ({
          label: labels[index],
          text,
          isCorrect: index === 0,
        })),
        answerOptionLabels: ['A'],
      }),
    ]).questions[0];
  }

  test('detects the corpus spellings', () => {
    const crossReferencing = [
      ['Right', 'Wrong', 'Both (a) & (b)', 'Other'],
      ['Right', 'Wrong', 'Both (A) and (B).', 'Neither (A) nor (B).'],
      ['Right', 'Wrong', 'Other', 'Both C and D'],
      ['Right', 'Wrong', 'Other', '1 and 2'],
      ['Right', 'Wrong', 'Other', 'Both 1 and 2.'],
      ['Right', 'Wrong', '(A) and (B)both', 'Other'],
      ['Right', 'Wrong', 'Other', 'Both a and d above'],
      ['Right', 'Wrong', 'both and b above', 'Other'],
      ['Right', 'Wrong', 'Both of the above', 'None of the above'],
    ];
    for (const texts of crossReferencing) {
      expect(crossReferencesOptions(itemWith(texts))).toBe(true);
    }
  });

  test('leaves ordinary prose alone, so real items still shuffle', () => {
    const innocent = [
      // Genuine content in the bank that merely contains "both" / "either" / letters.
      ['Right', 'Wrong', 'Both sequentially and parallel', 'All of above'],
      ['read', 'write', 'read and write', 'either read or write'],
      ['1 AND 1 is 0', '1 AND 0 is 1', '1 AND 1 is 1', '0 AND 0 is 0'],
      ['A = 1, B = 1, C = 0', 'A = 0, B = 0, C = 0', 'A = 1, B = 1, C = 1', 'x'],
      ['0, 1, 2, 3, 4, 5', '5', '1, 2, 3, 4', '6'],
      ['Each device is free to work as either a client or a server.', 'b', 'c', 'd'],
    ];
    for (const texts of innocent) {
      expect(crossReferencesOptions(itemWith(texts))).toBe(false);
    }
  });

  test('a cross-referencing question is served in source order, never shuffled', () => {
    const item = itemWith(['HTTP', 'SMTP', 'TCP', 'FTP', 'Both C and D']);
    for (const seed of SEEDS) {
      expect(orderedOptions(item, seed, true)).toBe(item.options);
    }
  });
});

describe('the real bank never renders an incoherent option list', () => {
  // These run against content/questions.json itself. The pipeline overwrites that file, so
  // these are the guard that a rewrite cannot silently reintroduce an unpinned aggregate or
  // an unlocked cross-reference. They assert on shape, never on a specific id or count.

  test('every aggregate option trails every concrete one, under every seed', () => {
    const violations: string[] = [];

    for (const question of servableQuestions()) {
      // A locked question is served exactly as the paper printed it, warts and all - that is
      // the whole point of locking, and the source's own layout is not ours to second-guess.
      if (crossReferencesOptions(question)) continue;
      for (const seed of SEEDS) {
        const order = orderedOptions(question, seed, true);
        const firstAggregate = order.findIndex((option) => AGGREGATE.test(option.text));
        if (firstAggregate === -1) continue;

        const stranded = order
          .slice(firstAggregate)
          .filter((option) => !AGGREGATE.test(option.text));
        for (const option of stranded) {
          violations.push(`${question.id}: "${option.text}" renders below an aggregate`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('an aggregate option never renders first, above nothing at all', () => {
    const violations: string[] = [];

    for (const question of servableQuestions()) {
      if (question.options.length < 2) continue;
      for (const seed of SEEDS) {
        const [first] = orderedOptions(question, seed, true);
        // A source that puts the aggregate first is the source's problem, not the shuffle's.
        if (AGGREGATE.test(first.text) && !AGGREGATE.test(question.options[0].text)) {
          violations.push(`${question.id}: "${first.text}" was shuffled into position A`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('no option that names another option by letter is ever moved', () => {
    const crossReferencing = servableQuestions().filter(crossReferencesOptions);

    for (const question of crossReferencing) {
      for (const seed of SEEDS) {
        expect(orderedOptions(question, seed, true)).toEqual(question.options);
      }
    }
  });
});

describe('only auto-gradable questions are ever served', () => {
  // The product rule: every question a quiz asks is scored by the app, never by the user. These
  // run against the real content/ files, so a pipeline run that reintroduced a free-response item
  // into the served bank fails here.

  const freeResponse = allQuestions().filter(
    (question) =>
      question.type === 'short_answer' || question.type === 'worked_problem',
  );

  // Real KNPC/[CE] past-paper material. Deleting it is the failure this test guards against:
  // the items are excluded from quizzes by being unservable, never by being thrown away.
  test('the corpus still HAS free-response items, with their model answers', () => {
    expect(freeResponse.length).toBeGreaterThan(0);
    const answered = freeResponse.filter(
      (question) => question.answerText || question.answerFigure,
    );
    expect(answered.length).toBeGreaterThan(0);
  });

  test('the servable pool is mcq and true_false, and nothing else', () => {
    const types = new Set(servableQuestions().map((question) => question.type));
    expect([...types].sort()).toEqual(['mcq', 'true_false']);
  });

  test('none of them is servable', () => {
    expect(freeResponse.some(isServable)).toBe(false);
  });

  test('selectQuestions never returns one, under any config or seed', () => {
    const served = new Set<string>();
    for (const seed of SEEDS) {
      for (const mode of ['mock', 'practice', 'drill'] as const) {
        const questions = selectQuestions(
          config({ mode, count: 10_000, tiers: ['gold', 'practice', 'bank'] }),
          EMPTY_HISTORY,
          `attempt-${seed}`,
        );
        for (const question of questions) {
          served.add(question.id);
          expect(question.type === 'mcq' || question.type === 'true_false').toBe(true);
        }
      }
    }
    expect(freeResponse.some((question) => served.has(question.id))).toBe(false);
  });

  test('selectQuestionsByIds cannot smuggle one in through an explicit id list', () => {
    const ids = freeResponse.map((question) => question.id);
    expect(selectQuestionsByIds(ids, 'a')).toEqual([]);
  });

  // The subtle one: an attempt sat before free text left the quiz pool must still replay. Its
  // questions now live in quarantine.json, so the replay path has to read the FULL pool.
  test('an old attempt holding one still replays, question and model answer intact', () => {
    const question = freeResponse.find((entry) => entry.answerText !== undefined);
    if (!question) throw new Error('no free-response item carries a model answer');
    expect(getQuestionById(question.id)?.stem).toBe(question.stem);

    const attempt: Attempt = {
      id: 'old-attempt',
      mode: 'mock',
      config: config({ count: 1 }),
      startedAt: 1,
      finishedAt: 2,
      questionIds: [question.id],
      responses: [
        {
          questionId: question.id,
          selected: [],
          correct: true,
          skipped: false,
          timeSpentSec: 30,
          text: 'What the user typed back then.',
          selfGraded: true,
        },
      ],
      score: 1,
      total: 1,
      durationSec: 1,
    };

    const replayed = replayQuestions(attempt);
    expect(replayed.map((entry) => entry.id)).toEqual([question.id]);
    expect(replayed[0].answerText ?? replayed[0].answerFigure).toBeTruthy();
  });
});

describe('selectQuestions', () => {
  // The real bank is imported, so these assert on behaviour, not on specific ids.
  test('is deterministic in the attempt id', () => {
    const first = selectQuestions(config({ count: 5 }), EMPTY_HISTORY, 'attempt-1');
    const second = selectQuestions(config({ count: 5 }), EMPTY_HISTORY, 'attempt-1');
    expect(first.map((question) => question.id)).toEqual(
      second.map((question) => question.id),
    );
  });

  test('never repeats an item inside one attempt', () => {
    const questions = selectQuestions(
      config({ count: 500, tiers: ['gold', 'practice', 'bank'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
  });

  test('never pads: asking for more than exists returns what exists', () => {
    const questions = selectQuestions(
      config({ count: 10_000, tiers: ['gold', 'practice', 'bank'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    expect(questions.length).toBeLessThan(10_000);
    expect(questions.length).toBeGreaterThan(0);
  });

  test('honours the tier filter', () => {
    const questions = selectQuestions(
      config({ count: 500, tiers: ['gold'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    expect(questions.every((question) => question.source.tier === 'gold')).toBe(true);
  });

  // The opt-in is gone: an unconfirmed key is not an answer, so it is never served, whatever
  // the config says. The only unverified items left in the app are quarantine records.
  test('never serves an item whose key could not be confirmed', () => {
    const questions = selectQuestions(
      config({ count: 10_000, tiers: ['gold', 'practice', 'bank'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    expect(questions.every((question) => question.keyVerified)).toBe(true);

    const unverified = allQuestions().filter((question) => question.keyVerified === false);
    expect(unverified.length).toBeGreaterThan(0);
    const served = new Set(questions.map((question) => question.id));
    expect(unverified.some((question) => served.has(question.id))).toBe(false);
  });

  test('never serves a quarantined item', () => {
    const questions: Question[] = selectQuestions(
      config({ count: 10_000, tiers: ['gold', 'practice', 'bank'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    expect(questions.every((question) => !question.flags.includes('missing_figure'))).toBe(
      true,
    );
  });

  test('onlyMissed restricts to the miss queue', () => {
    const all = selectQuestions(
      config({ count: 500, tiers: ['gold', 'practice', 'bank'] }),
      EMPTY_HISTORY,
      'attempt-1',
    );
    const target = all[0].id;
    const questions = selectQuestions(
      config({ count: 10, onlyMissed: true, tiers: ['gold', 'practice', 'bank'] }),
      { missedQuestionIds: [target], topicStats: [] },
      'attempt-1',
    );
    expect(questions.map((question) => question.id)).toEqual([target]);
  });
});

describe('selectQuestionsByIds', () => {
  // Behaviour only: the bank is the real one and gets replaced under us.
  test('serves exactly the ids asked for', () => {
    const ids = servableQuestions()
      .slice(0, 3)
      .map((question) => question.id);
    const picked = selectQuestionsByIds(ids, 'attempt-1');
    expect(picked.map((question) => question.id).sort()).toEqual([...ids].sort());
  });

  test('ignores the tier filter, so a bank-tier miss stays re-drillable', () => {
    const bankTier = servableQuestions().filter(
      (question) => question.source.tier === 'bank',
    );
    if (bankTier.length === 0) return;
    const ids = bankTier.slice(0, 2).map((question) => question.id);
    expect(selectQuestionsByIds(ids, 'a')).toHaveLength(ids.length);
  });

  test('drops ids that have left the bank rather than padding', () => {
    const real = servableQuestions()[0].id;
    const picked = selectQuestionsByIds([real, 'gone-from-the-bank'], 'a');
    expect(picked.map((question) => question.id)).toEqual([real]);
  });

  test('de-duplicates a repeated id', () => {
    const id = servableQuestions()[0].id;
    expect(selectQuestionsByIds([id, id, id], 'a')).toHaveLength(1);
  });

  test('never serves a quarantined item', () => {
    const quarantined = allQuestions().filter((question) => !isServable(question));
    if (quarantined.length === 0) return;
    const ids = quarantined.map((question) => question.id);
    expect(selectQuestionsByIds(ids, 'a')).toHaveLength(0);
  });

  test('is deterministic in the attempt id', () => {
    const ids = servableQuestions()
      .slice(0, 5)
      .map((question) => question.id);
    expect(selectQuestionsByIds(ids, 'x').map((q) => q.id)).toEqual(
      selectQuestionsByIds(ids, 'x').map((q) => q.id),
    );
  });

  test('an empty id list yields an empty quiz, never a fallback quiz', () => {
    expect(selectQuestionsByIds([], 'a')).toEqual([]);
  });
});
