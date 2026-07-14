# KNPC Reviser - Product & Data Spec

A client-side study app for the KNPC (Kuwait National Petroleum Company) Computer Engineering
hiring exam. Quizzes the user on verbatim questions from real past papers, tracks history,
and surfaces weak topics.

## Hard product decisions (settled - do not relitigate)

| Decision | Choice |
|---|---|
| Question source | **Verbatim from real past papers only.** Zero invented questions. |
| Explanations | **Claude-authored, always visually labelled as AI-written.** Question/options/answer stay verbatim. |
| Answer keys | Sources are unreliable. Every item is **blind re-answered** by independent agents that never see the source key; disagreements are flagged, never silently resolved. |
| Storage | **IndexedDB**, plus JSON export/import for backup and cross-device transfer. No backend. |
| Figures | Cropped from source as PNG, shipped in `public/figures/`. |
| Deployment | Static export (`output: 'export'`), **mobile-first**, deployed to Vercel. |
| Modes | **Mock Exam** and **Practice** are co-equal entry points. |
| Grading | **100% automatic.** Only `mcq` and `true_false` are ever served, because they are the only types the app can mark. Self-grading is gone. |
| History | Attempt log + per-topic mastery + a "questions I keep missing" re-drill queue. |
| Scope | Technical CE only. The English grammar material is out of scope. |
| Design | Minimal-neutral. Near-white canvas, one accent, heavy whitespace, the question is the only thing on screen. Dark mode. |
| Timeline | ~2 weeks to exam. Extraction quality beats feature count. |

## Content decisions

**Ingest** (~770 items):

| Source file | Items | Tier | Method |
|---|---|---|---|
| `KOC 2012 EXAM (2).pdf` | ~192 | `gold` | text (`pdftohtml -xml`, bold = key) |
| `computer engineering 2016 - extra.docx` | +3, and key cross-check | `gold` | text |
| `[CE] questions.pdf` + `[CE] solutions.pdf` | 76 | `gold` | 58 text / 18 vision |
| `Test 3.zip` | 70 | `practice` | vision |
| `Data.pdf` pp.18-22 | 30 | `practice` | vision |
| `Sample-1/-2/-3.pdf` | 30 | `practice` | text |
| `2.pdf` + `[CE] Lecture.pdf` Subject 8 | 25 | `practice` | vision + **compile to derive answers** |
| `exam noooow.pdf` | ~200 | `bank` | text + vision on 7 pages |
| `Computer Engineering K-Companies Exam - Questions.pdf` | ~100 | `bank` | vision only (45 pp; tesseract fails) |
| `Test 4.zip` | ~60 net | `bank` | vision, dedupe-first |

`KOC 2012 EXAM (2).pdf` is a **merged bundle** of four separate recall dumps. Page ranges stamp
`source.exam` / `source.year`:

- pp.1-27 -> KOC 2012 (117 items, all keyed - the cleanest block in the corpus)
- pp.28-35 -> KNPC 2016 (41 items; 8 ship with only the correct option, no distractors)
- pp.36-38 -> KNPC 2018 (11 items; 3 are bare topic placeholders)
- pp.39-50 -> KNPC 2021 (46 items; **17 have no answer**, ~7 reference missing figures)

**Do NOT ingest** (verified duplicates or out of scope):

- `KNPC 2016/2018/2021 EXAM.pdf`, `KOC 2012 EXAM.pdf` - strict subsets of the merged bundle
- `Test 1.zip` - photographs of `[CE] questions.pdf`
- `Test 2.zip` - photographs of `[CE] Lecture.pdf`
- `1.pdf` - digital logic, but figure-heavy with inconsistent keys; **explicitly cut by the user**
- `EXAM 1/2/3.pdf` + `DOC-2023*.pdf` - English grammar, out of scope
- `3 (2).pdf` - handwritten Arabic notebook photos, illegible
- All lecture slides, textbooks, summaries - no questions

## Source tiers -> app behaviour

| Tier | Meaning | Default in quizzes |
|---|---|---|
| `gold` | Real recalled KNPC/KOC papers + the [CE] K-companies placement exam | **ON** |
| `practice` | 2018 mock exam, DB question bank, cloud samples, code-trace items | **ON** |
| `bank` | Scraped IndiaBIX/general-IT trivia. Largest, least representative, worst keys. | **OFF** (user can toggle on) |

The served pool (`content/questions.json`) holds **650** items: 200 `gold`, 121 `practice`, 329
`bank`. Every one is `mcq` or `true_false` and auto-gradable. The default experience is therefore
321 high-signal questions, with `bank` available as an opt-in.

`content/quarantine.json` holds **88** items that `/bank` browses and no quiz ever serves: items with
unconfirmed keys, missing figures or no answer in the source; the **56 free-response items** (39
`short_answer`, 17 `worked_problem`) moved out when grading went fully automatic; the **5 items
the stem-repair pass found broken at source** (duplicate distractors, a lost stem clause, no
defensible option - see `content/bank-report.md` §2.3); and **1 item carrying two identical options**
(`koc2012-q094` - see rule 11 below and `bank-report.md` §2.6). 39 of the free-response items are real
past-paper material - the written half of KNPC 2021, KNPC 2018, and several [CE] 2016 items - which is
exactly why they are kept and browsable with their model answers rather than deleted.

## Canonical question object

`content/questions.json` is a flat array of these. This is the contract between the extraction
pipeline and the app - neither side changes it unilaterally.

```ts
// Only 'mcq' and 'true_false' are SERVABLE (see rule 10). The two free-response types remain in
// the contract because the corpus contains them and the bank browses them - not because a quiz
// can ever serve one.
type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'worked_problem'

type Topic =
  | 'digital-logic' | 'computer-architecture' | 'operating-systems' | 'networking'
  | 'databases' | 'data-structures-algorithms' | 'programming' | 'number-systems'
  | 'software-engineering' | 'cloud-computing' | 'hardware-memory' | 'general-it' | 'misc'

type SourceTier = 'gold' | 'practice' | 'bank'

type KeyProvenance =
  | 'inline_bold'      // bold/underline in the source PDF
  | 'answer_page'      // a separate model-answer table
  | 'docx_asterisk'    // the ** markers in the .docx
  | 'compiled'         // we compiled and ran the code to get the answer
  | 'derived'          // no source key; agents solved it unanimously
  | 'none'             // no key, agents disagreed -> unverified

// HOW HARD the key was checked. Orthogonal to KeyProvenance (which says WHERE the key came from).
type VerificationLevel =
  | 'double'    // gold/practice: a source key existed and TWO independent blind solves both agreed
  | 'single'    // bank: a source key existed and ONE blind solve agreed. Scraped origin, worst keys.
  | 'derived'   // no source key existed at all; a panel derived the answer. Trust the reasoning, not a paper.
  | 'disputed'  // solvers/panel could not agree -> needsReview is true. Always === needsReview.

interface Option {
  label: string          // 'A', 'B', ...
  text: string           // verbatim. may be '' if the option is purely a figure
  figure?: string        // path under /figures, for truth-table / circuit options
  isCorrect: boolean
}

interface Question {
  id: string                    // e.g. 'knpc2021-q06'
  type: QuestionType
  topic: Topic
  subtopic?: string

  stem: string                  // verbatim prose
  stemCode?: string             // code block, VERBATIM incl. whitespace (a stray `;` is often the trap)
  stemFigure?: string           // path under /figures

  options: Option[]             // VARIABLE length: 2, 3, 4, or 5 ('E: None of these'). Never assume 4.
  answerOptionLabels: string[]  // array - multi-select is rare but real
  answerText?: string           // for short_answer / worked_problem
  answerFigure?: string         // WHY: some source answers are a worked K-map / filled truth table /
                                // circuit that prose cannot reproduce without inventing content, and
                                // rule 1 forbids inventing. So we ship the source's own solution image.
                                // Path under /figures; shown only after the answer is revealed.

  explanation?: string          // Claude-authored unless explanationSource is set
  explanationSource?: 'source'  // present => the explanation is verbatim from the paper, not AI
  referenceUrl?: string         // several KNPC 2021 items carry one natively

  source: {
    file: string
    exam: 'KNPC' | 'KOC' | 'K-Companies' | 'mock' | 'bank'
    year?: number
    tier: SourceTier
    originalNumber?: number
  }

  keyProvenance: KeyProvenance
  keyVerified: boolean          // true only if the blind re-answer pass AGREED with the source key
  verificationLevel: VerificationLevel
                                // WHY: keyVerified is one bit and it lies by omission - it cannot
                                // distinguish a KNPC 2021 item two independent solvers confirmed from
                                // a scraped IndiaBIX item one solver waved through. Both were `true`.
                                // This field stops the 332 bank items wearing the same green badge as
                                // gold, and the UI must grade its confidence signal off THIS, not
                                // off keyVerified.
  needsReview: boolean          // surfaced in the UI as an amber "unverified answer" badge

  flags: Flag[]
  dedupeHash: string            // sha1 of the normalized stem
}

type Flag =
  | 'legacy'          // Office 2003 / Windows 2000 / floppy-era (~28 items)
  | 'off_syllabus'    // e.g. the cognitive-psychology block in exam noooow
  | 'hedged_option'   // a distractor that literally reads "i don't remember"
  | 'missing_figure'  // references a figure absent from the source -> QUARANTINED, never served
  | 'no_distractors'  // only the correct option was recalled. Never fabricate distractors: such an
                      // item is re-typed 'short_answer' (options: [], answerText = the recalled
                      // option) and served as a recall card. The flag stays for provenance.
  | 'key_disputed'    // blind re-answer disagreed with the source key
  | 'unanswerable'    // QUARANTINE-ONLY. The source never recorded an answer and no panel could
                      // derive one. Rule 1 forbids inventing one, so the item is kept for the record
                      // and never served. A served item may NEVER carry this flag.
```

### Rules the pipeline must honour

1. **Never invent a question, an option, or an answer.** Transcribe. If it is not in the source, it does not exist.
2. **Whitespace in `stemCode` is load-bearing.** `for (i=0; i<10; i++);` - that trailing semicolon IS the question.
3. **Ignore handwriting.** `Test 3`/`Test 4` carry a student's red-pen circles. The key comes only from the printed model-answer table. A pen circle is not an answer key.
4. **`missing_figure` items are quarantined** - they load into the bank for the record but are never served in a quiz.
5. Any item where the blind re-answer disagrees with the source key gets `keyVerified: false`, `needsReview: true`, `key_disputed`, and is **quarantined**: it moves to `content/quarantine.json`, stays browsable in `/bank` for the record, and is **never served in a quiz**. There is no opt-in. The seven items this fired on were removed from the served bank at the user's request, and the "include unverified answers" toggle was retired with them - an unconfirmed key is not an answer, and offering it as a setting only invited the user to study a guess.
   The amber "answer unverified" badge stays in the UI: nothing triggers it while the bank holds no `keyVerified: false` item, but it is the visible warning required the moment a pipeline run ships one.
6. Explanations are AI-authored by default and MUST render behind a visible "AI-generated explanation" label.
   `explanationSource: 'source'` may only survive while the text is still **verbatim** from the paper.
   If any later pass rewrites that text, the field MUST be dropped - otherwise AI prose ships wearing
   the source's authority. (This fired on 61 items in the final merge.)
7. `verificationLevel === 'disputed'` if and only if `needsReview === true`. `keyVerified` and
   `needsReview` may never both be true.
8. A served item may not carry `unanswerable` or `missing_figure`, and every `stemFigure`/
   `answerFigure`/option `figure` must resolve to a real file in `public/figures/`.
9. **A recovered source key is evidence, not an override.** Several papers print a key that is
   provably wrong (see `bank-report.md`). When the archaeologist recovers a printed key that the
   panel judges false, the panel's answer ships and the paper's key is recorded in the reasoning.
   Provenance becomes `derived` - never claim `answer_page` for a key we declined to use.
10. **Only `mcq` and `true_false` may be served.** Scoring is 100% automatic, and those are the
    only two types the app can mark. A `short_answer` or `worked_problem` has no options to tick;
    grading it means a human comparing prose to a model answer, which is what the retired "I got
    it / I missed it" self-grading UI did - and a score the user awards themselves is not a score.
    So the 49 free-response items (34 `short_answer`, 15 `worked_problem`) live in
    `content/quarantine.json`: browsable in `/bank` with their stems, code, figures, model answers
    (`answerText` / `answerFigure`) and explanations, and unreachable from any quiz.
    They are **not deleted** - 39 of them are real KNPC/[CE] past-paper questions.
    `isServable` enforces this **by type**, not by which file the row happens to sit in: if a
    future pipeline run drops a `short_answer` back into `questions.json`, it still never reaches
    a quiz. `lib/types.ts` names the rule once, as `SERVABLE_QUESTION_TYPES`.
    The results screen and the bank loader still resolve questions from the **full** pool
    (served + quarantined), so an attempt sat before this change - which may hold a self-graded
    free-text response - still replays with its question, its answer and its verdict intact.
11. **A served item may never print the same option text twice** (compared case- and
    whitespace-insensitively). Such an item is **defective and quarantined**, and the uniqueness of
    the keyed answer does **not** rescue it: a candidate looking at two identical choices cannot tell
    whether they have misread the paper, and the doubt that creates is not confined to the broken
    question. This rule is absolute precisely because it was once applied by taste - two items were
    quarantined for it while `koc2012-q094` shipped with A and C both reading "1 AND 1 is 0", on the
    reasoning that D was still uniquely correct. That reasoning was equally available for the
    quarantined two. `scripts/validate-bank.ts` enforces this as a **build failure**, so the
    inconsistency cannot recur. (This is a *pipeline* rule, not an `isServable` field check - it
    constrains what may be committed to `questions.json`, and the row itself carries no flag saying
    so. See `bank-report.md` §7.10.)
12. **A fill-in-the-blank stem whose `______` the PDF text layer swallowed may have it restored** -
    and *only* it. A restoration inserts underscores and changes nothing else: strip every underscore
    from the restored stem and the surviving word sequence must be **identical** to the original. Any
    restoration that adds, drops, changes or reorders a word is a **rewrite**, which rule 1 forbids -
    a corrupted stem is worse than the hole it was fixing. A stem qualifies only if it is (1)
    ungrammatical as written, (2) has exactly one hole, and (3) takes every option cleanly into that
    hole. Bare sentence-fragment stems are **printed that way in the papers** and are left alone.
