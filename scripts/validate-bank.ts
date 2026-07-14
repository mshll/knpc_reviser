import rawQuarantine from '@/content/quarantine.json';
import rawQuestions from '@/content/questions.json';
import {
  allQuestions,
  getBankReport,
  isServable,
  servableQuestions,
  validateBank,
  validateQuarantine,
} from '@/lib/questions';
import { SERVABLE_QUESTION_TYPES, type Question } from '@/lib/types';

const failures: string[] = [];

const bank = validateBank(rawQuestions);
const quarantine = validateQuarantine(rawQuarantine);

if (bank.problems.length > 0) {
  failures.push(`validateBank dropped ${bank.problems.length} rows: ${JSON.stringify(bank.problems)}`);
}
if (quarantine.problems.length > 0) {
  failures.push(
    `validateQuarantine dropped ${quarantine.problems.length} rows: ${JSON.stringify(quarantine.problems)}`,
  );
}

const served = servableQuestions();
const all = allQuestions();

for (const question of bank.questions) {
  const where = `${question.id}`;

  if (!isServable(question)) {
    failures.push(`${where}: sits in questions.json but isServable() says no`);
  }
  if (!SERVABLE_QUESTION_TYPES.includes(question.type)) {
    failures.push(`${where}: type ${question.type} is not servable`);
  }
  if (question.keyVerified !== true) failures.push(`${where}: keyVerified is not true`);
  if (question.needsReview !== false) failures.push(`${where}: needsReview is true`);
  if (question.verificationLevel === 'disputed') failures.push(`${where}: verificationLevel disputed`);
  if (question.stem.trim().length === 0) failures.push(`${where}: empty stem`);
  if (question.options.length < 2) failures.push(`${where}: fewer than 2 options`);

  const labels = question.options.map((option) => option.label);
  const correct = question.options.filter((option) => option.isCorrect).map((option) => option.label);

  if (question.answerOptionLabels.length === 0) failures.push(`${where}: no answerOptionLabels`);
  for (const label of question.answerOptionLabels) {
    if (!labels.includes(label)) failures.push(`${where}: keyed label "${label}" is not an option`);
  }
  if (correct.length !== 1) {
    failures.push(`${where}: ${correct.length} options carry isCorrect (expected exactly 1)`);
  }
  if (correct.join(',') !== [...question.answerOptionLabels].sort().join(',')) {
    failures.push(`${where}: isCorrect ${correct} disagrees with key ${question.answerOptionLabels}`);
  }
  if (new Set(labels).size !== labels.length) failures.push(`${where}: duplicate option labels`);

  // A served item may never print the same option text twice, case- and whitespace-insensitively.
  // The uniqueness of the keyed answer does not rescue it: a candidate who sees two identical
  // choices cannot tell whether they have misread the paper. Such items are quarantined.
  const texts = question.options
    .map((option) => option.text.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((text) => text.length > 0);
  if (new Set(texts).size !== texts.length) {
    failures.push(`${where}: two options carry identical text`);
  }
  for (const flag of question.flags) {
    if (flag === 'missing_figure' || flag === 'unanswerable') {
      failures.push(`${where}: served item carries the quarantine flag "${flag}"`);
    }
  }
}

const bankIds = new Set(bank.questions.map((question) => question.id));
for (const record of quarantine.questions) {
  if (bankIds.has(record.id)) failures.push(`${record.id}: present in BOTH questions.json and quarantine.json`);
}

// quarantineReasons is not part of the Question contract, so validateQuarantine strips it.
// Check the raw rows.
for (const row of rawQuarantine as ReadonlyArray<{ id: string; quarantineReasons?: unknown }>) {
  if (!Array.isArray(row.quarantineReasons) || row.quarantineReasons.length === 0) {
    failures.push(`${row.id}: quarantine record has no quarantineReasons`);
  }
}

const quarantinedIds = new Set(quarantine.questions.map((question) => question.id));
for (const id of ['mock2018-q010', 'bank-a-q099', 'bank-a-q159', 'bank-b-q050', 'bank-b-q058', 'koc2012-q094']) {
  if (!quarantinedIds.has(id)) failures.push(`${id}: expected to be quarantined, is not`);
  if (bankIds.has(id)) failures.push(`${id}: expected to be gone from questions.json, is not`);
}

const byId = new Map(all.map((question: Question) => [question.id, question]));
const q029 = byId.get('mock2018-q029');
if (q029?.options.find((option) => option.label === 'A')?.text !== 'X = NOT(A • B) + (B • C)') {
  failures.push('mock2018-q029: option A was not repaired');
}
if (q029?.answerOptionLabels.join(',') !== 'A') failures.push('mock2018-q029: key drifted');
const q072 = byId.get('bank-a-q072');
if (q072?.options.find((option) => option.label === 'C')?.text.includes('      ')) {
  failures.push('bank-a-q072: option C still carries the six-space hole');
}
if (q072?.answerOptionLabels.join(',') !== 'A') failures.push('bank-a-q072: key drifted');

const report = getBankReport();
const tiers = served.reduce<Record<string, number>>((acc, question) => {
  acc[question.source.tier] = (acc[question.source.tier] ?? 0) + 1;
  return acc;
}, {});

console.log(
  JSON.stringify(
    {
      servedRows: (rawQuestions as unknown[]).length,
      quarantineRows: (rawQuarantine as unknown[]).length,
      validated: bank.questions.length,
      servable: served.length,
      all: all.length,
      report,
      tiers,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} problems`);
  process.exit(1);
}
console.log('\nOK: bank is valid, every served item is servable.');
