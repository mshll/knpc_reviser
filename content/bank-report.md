# KNPC Reviser - Final Bank Report

**650 questions ship. 88 are quarantined. 0 need your eyes.**

Generated after: two independent blind solves of every gold/practice item, a 4-judge panel
(first-principles / distractor-analysis / skeptic / source-archaeologist) on every contested item, a
full explanation audit, the free-response split (SPEC rule 10), a **stem/option repair pass** that
took 36 triaged items back to the original PDFs and page images, and - most recently - a
**blank-restoration + duplicate-option pass** (§2.5, §2.6) that put back one fill-in-the-blank marker
the source PDF had eaten and settled the duplicate-option rule that §7.9 used to complain about.

Read [§7 What you should not trust](#7-what-you-should-not-trust) before you rely on this bank.

---

## 1. Final counts

### By tier

| Tier | Count | Default in quizzes |
|---|---:|---|
| `gold` | 200 | ON |
| `practice` | 121 | ON |
| `bank` | 329 | **OFF** (opt-in) |
| **Total served** | **650** | |
| Quarantined (never served) | 88 | |
| **Pool total** | **738** | |

Default experience = **321 high-signal questions** (gold + practice).

### By verificationLevel - the honest badge

| Level | Count | What it means |
|---|---:|---|
| `double` | 298 | A source key existed and **two independent blind solves both agreed**. The strongest thing in the bank. |
| `single` | 318 | A source key existed and **one** solve agreed. All 318 are `bank` tier: scraped, least representative, worst keys. |
| `derived` | 34 | **No source key existed at all.** A panel derived the answer. Trust the reasoning, not a paper. |
| `disputed` | **0** | Every disputed item is now quarantined. Nothing served carries `needsReview`. |

Cross-tabulated against where the key came from:

| Level | inline_bold | answer_page | compiled | derived |
|---|---:|---:|---:|---:|
| `double` | 151 | 145 | 2 | - |
| `single` | 263 | 55 | - | - |
| `derived` | - | - | - | 34 |

### By type

Only `mcq` and `true_false` are servable (SPEC rule 10), so the served bank contains nothing else.

| Type | Count |
|---|---:|
| `mcq` | 625 |
| `true_false` | 25 |

### By topic

| Topic | Count | Topic | Count |
|---|---:|---|---:|
| networking | 104 | data-structures-algorithms | 49 |
| general-it | 96 | computer-architecture | 48 |
| hardware-memory | 90 | digital-logic | 36 |
| databases | 70 | misc | 29 |
| operating-systems | 52 | programming | 23 |
| | | number-systems | 19 |
| | | software-engineering | 17 |
| | | cloud-computing | 17 |

### By source

| Exam | Count | Years |
|---|---:|---|
| KOC | 112 | 2012 |
| KNPC | 56 | 2016 / 2018 / 2021 |
| K-Companies `[CE]` | 57 | 2016 |
| mock | 67 | 2018 |
| bank (scraped) | 358 | - |

### Flags on served items

| Flag | Count |
|---|---:|
| `legacy` | 46 |
| `off_syllabus` | 28 |
| `hedged_option` | 1 |

No served item carries `missing_figure` or `unanswerable` (SPEC rule 8).

---

## 2. The stem/option repair pass - every item I touched

This is the section to spot-check. 36 items were triaged as possibly-mangled and sent back to the
original PDFs and page images. The verdicts live in `content/audit/repair-000.json` …
`repair-007.json`.

| Verdict | Count | What happened |
|---|---:|---|
| `not-a-defect` | 29 | The garble is **printed in the paper**. Our extraction was byte-faithful. Left exactly as shipped. |
| `fixed` | 2 | Our **encoding** mangled the text. Repaired. |
| `quarantine` | 5 | **Broken at source** beyond repair. Moved out of the served bank. |

### 2.1 Stems repaired: **none**

**No stem in the bank was rewritten.** Every one of the 36 verdicts returned `correctedStem: null`.
That is the honest headline of this pass: the triage suspected mangled stems, and the archaeologist
found that in **every** case the stem we ship is already character-for-character what the paper
prints. The two `fixed` verdicts corrected **option text only**, and both are encoding bugs on our
side, not transcription errors.

If you were expecting a list of repaired stems, the reason it is empty is that there was nothing to
repair - not that the pass skipped them. All 29 `not-a-defect` verdicts are itemised in §2.4.

> **Still true, with one exception since recorded.** A later pass restored a lost **fill-in-the-blank
> marker** to one stem (`dbbank-q012`, §2.5). That is not a rewrite: no word was added, removed,
> changed or reordered - only the `______` the PDF text layer had swallowed was put back. The
> "no stem rewritten" guarantee holds in the sense that matters: **no stem in this bank says anything
> the paper did not say.**

### 2.2 Options repaired (2 items, 4 option texts)

#### `mock2018-q029` - practice - digital logic - **3 option texts rewritten**

Stem (unchanged, verbatim): *"Which of the following Boolean equations describes the action of Fig.
2.5.2?"*

| Label | Before (as shipped) | After (repaired) |
|---|---|---|
| A ← **key** | `X = (A̅ ̅•̅ ̅B̅) + (B • C)` | `X = NOT(A • B) + (B • C)` |
| B | `X = (A • B) • (B + C)` | *(unchanged)* |
| C | `X = (A̅ • B̅) + (B • C)` | `X = (NOT(A) • NOT(B)) + (B • C)` |
| D | `X = (A̅ ̅•̅ ̅B̅) + C` | `X = NOT(A • B) + C` |

**What was broken:** ours, not the paper's. The paper prints a **group overbar** in A and D - one
continuous stroke spanning `A • B` - and **separate per-letter bars** in C. We stored both as U+0305
combining macrons smeared across the spaces and the bullet (`A̅ ̅•̅ ̅B̅`). Any renderer that drops or
normalises combining marks collapses A and C into look-alikes, which destroys the De Morgan trap that
*is* the question.

**Source evidence:** `Test 3.zip`, `IMG_9103` (paper page 6, section "Digital Logic:"), verified at 3x
zoom: the bar in A and D is one continuous stroke spanning A, the dot and B; in C there are two short
strokes, one per letter. Option A is circled in red = the paper's key.

**Key untouched.** Still `A`, still the only `isCorrect`.

#### `bank-a-q072` - bank - hardware/memory - **1 option text rewritten**

Stem (unchanged, verbatim): *"Refer to the given figures (a) and (b). A logic analyzer is used to
check the circuit in figure (a) …"*

| Label | Before (as shipped) | After (repaired) |
|---|---|---|
| C | `The circuit is in the ______ mode and should be writing the contents of the selected address to Q0–Q3.` (six literal spaces where the word should be) | `The circuit is in the WRITE mode and should be writing the contents of the selected address to Q0–Q3.` |

**What was broken:** ours. The PDF text layer failed to emit the **overlined WRITE** token (active-low
`WRITE`), leaving a six-space hole. The overbar cannot be carried in plain text, so it is restored as
plain `WRITE`, paralleling option B's "READ mode".

**Source evidence:** `exam noooow.pdf`, p.26 (rendered image). Option C prints verbatim: *"C. THE
CIRCUIT IS IN THE WRITE MODE AND SHOULD BE WRITING THE CONTENTS OF THE SELECTED ADDRESS TO Q0–Q3."* -
where WRITE carries an overbar matching the overlined WRITE pin label on the `RAM 256 X 4` block in
figure (a). The page also prints "ANSWER OPTION A".

**Key untouched.** Still `A` (the keyed option is A, not the repaired C), still the only `isCorrect`.

### 2.3 Newly quarantined (5 items) - broken at source

All five are **faithful extractions of broken paper**. Nothing here could be repaired without
inventing option text, which SPEC rule 1 forbids. They stay browsable in `/bank` with their reasons.

| id | Tier | What is broken | Source evidence |
|---|---|---|---|
| `mock2018-q010` | practice | **Duplicate options.** A and D both print `2ᵏ − 1`. | `Test 3.zip`, `IMG_9100.HEIC` p.3, Q10. Key B (`2ᵏ⁺¹ − 1`) is circled and is correct - but two identical distractors make the item unservable. |
| `bank-a-q099` | bank | **Duplicate options + a false printed key.** C = "Magnetic disk", D = "Magnetic disc". The paper keys `Ans. (c)` = Magnetic disk **for a CD-ROM**. | `exam noooow.pdf` p.33. We keyed A (Optical disk); the paper's own key is provably wrong. Was "rescued" from quarantine in an earlier pass (§4) - this pass puts it back. |
| `bank-a-q159` | bank | **No defensible option.** The keyed option a) says "Dept_id should not be used in group by clause", but the printed query has **no Dept_id column**. The real error (ID selected without aggregation) is described by the paper's own explanation and is **not on the ballot**. | `exam noooow.pdf` pp.48-49. Query: `SELECT dept_name, ID, avg (salary) FROM instructor GROUP BY dept_name;` Answer A. |
| `bank-b-q050` | bank | **Broken stem + fused options.** The paper lost a clause from its own premise ("Suppose that you have a the maintenance package identifies…") and fused two distractors into option C ("Follow the same procedure as in ays replace the system board first…"). | `Computer Engineering K-Companies Exam - Questions.pdf`, p.17, Q15. |
| `bank-b-q058` | bank | **Duplicate options.** c. "IBM 1402" and d. "IBM1402" - the same distractor, differing by one space. | `Computer Engineering K-Companies Exam - Questions.pdf`, p.19, Q8. Key B (IBM 1401) is still uniquely correct, but the duplicate is a source defect. |

### 2.4 Confirmed source-faithful - 29 `not-a-defect` verdicts

Each of these looked mangled and **is** mangled - **in the printed paper**. The archaeologist rendered
the page and confirmed our text matches character for character. Per the fidelity rule they ship
verbatim. Grouped by what the triage suspected:

**The paper's own typos** (kept verbatim - "the typo is the question"):

| id | The paper literally prints | Where |
|---|---|---|
| `knpc2016-q029` | "why is IP used that ether net address?" / "a) Hieratical" | `KOC 2012 EXAM (2).pdf` p.32 |
| `knpc2016-q113` | "DDCMP does not need special hardware to **final** the beginning of a message" (the keyed option) | p.35 |
| `knpc2016-q101` | "The **papers** required to be brought **is** a given page request" | p.33 |
| `koc2012-q091` | "Minimize disk I/O **connection**" (not "contention") - the keyed option | p.20 |
| `bank-a-q002` | "A permanent memory, which **halls** data and instruction…" | `exam noooow.pdf` p.1 |
| `bank-a-q004` | "(B) **AXILLARY**" (not AUXILIARY) - so B is not a synonym of A and the item is not double-keyed | p.2 |
| `bank-a-q022` | "Data gathering in computer means, they allow to use.........data." | p.8 |
| `bank-a-q115` | "…on the mother board **1** through:" - the stray numeral is in the paper | p.37 |
| `bank-a-q210` | "D. Both a and **d** above" - self-referential misprint; the page is fully legible | p.62 |
| `bank-a-q212` | "C. both **and** b above" - missing 'a'; Q24 on the same page prints the construction correctly | p.63 |
| `bank-b-q090` | "A **small** or intelligent device…" (not "smart") - printed twice, including on the answer page | K-Companies p.33 |
| `mock2018-q005` | "d. 2^n != O(n**k**)" - the paper dropped the superscript on k. Read literally, d is still true, so B remains the unique false statement and the key is unaffected. | `Test 3.zip` `IMG_9099` |
| `mock2018-q070` | "A. 18.**8** %" - verified at 3x zoom. The student's own red pen wrote "18.4" next to it, i.e. the examinee noticed too. | `IMG_9110` |

**Bare / truncated stems that are bare in the source** (no blank, no ellipsis, nothing dropped):

| id | The paper's stem, in full | Where |
|---|---|---|
| `knpc2021-q013` | "When a software keeps changing during its development" | `KOC 2012 EXAM (2).pdf` p.42. Q12 above it is printed in the same fragment style. |
| `knpc2021-q004` | "max signed decimal number represented in 6 bits 1s complement?" - the word "range" really is absent while the options really are ranges. The mismatch is the paper's. | p.39 |
| `mock2018-q019` | "Time complexity of Depth First Traversal of is" - no blank was printed. Q14 on the same page prints a real blank, so blanks are visible when present. | `Test 3.zip` `IMG_9101` |
| `mock2018-q022` | "All possible spanning trees of graph G" - bare fragment; and option B's doubled "and but" is the paper's. | `IMG_9102` |
| `dbbank-q012` | "Unlike filters queries can be saved as in a database." - **no underscore, no gap** in the source. The blank was lost upstream of us: `Data.pdf` is a screenshot of a web quiz whose underscore never rendered. | `Data.pdf` p.19 |
| `dbbank-q014` | "External database is" - the source item really is this terse. | `Data.pdf` p.19 |

**Option lists that look truncated but are complete in the source:**

| id | Why it looks wrong | The truth |
|---|---|---|
| `knpc2021-q027` | Only 3 options | The paper's list ends at C, followed by "Reference:" and a slide image. Nothing was dropped. |
| `knpc2016-q105` | Only 2 options | The paper prints exactly two. (Q9 on the same page also has two.) |
| `bank-a-q110` | Only 2 options | "DVD stands for : (a) Digital Video Disk (b) Digital Versatile Disk / Ans. (b)". Nothing between (b) and the answer line. |
| `knpc2016-q010` | Option d reads "I don't remember" | **That is printed in the paper.** The recollector could not recall distractor d. Already flagged `hedged_option`. |

**Weird option lettering - the paper's, not ours:**

| id | The paper prints | Note |
|---|---|---|
| `koc2012-q025` | options lettered **C / D / E** (no A/B) | Surrounding items label A/B/C normally. Nothing precedes "C." on the page. |
| `bank-b-q104` | options lettered **a / e / f / g** | Q13 on the same page is a/b/c/d. ⚠️ **This item's explanation currently blames "an OCR artifact in the source" - that claim is wrong** and should be corrected by the explanation pass. |
| `bank-b-q108` | options lettered **b / c / d / e** (no a) | The paper's *answer page* letters the correct option `b` while its *question page* letters that same option `c` - i.e. the b-e run is the paper's own lettering typo. Our text and key match the answer page's **text** ("Voice response unit"). Renumbering to A-D would move `answerOptionLabels`, which this pass does not own. |

**Structural defects in the paper that still leave a unique answer** (kept, not quarantined):

| id | Defect | Why it still ships |
|---|---|---|
| `koc2012-q111` | Stem says "two purposes" but only one option is keyed; no "(Choose two)" marker exists on the page | A corrupted rendition of the CCNA original. A is bold+underlined and uniquely correct. |
| `dbbank-q018` | Options C and D do not grammatically follow the stem | The paper prints them exactly so, and still yields exactly one defensible answer (B), which it keys. |

*`koc2012-q094` used to sit in this table. It no longer ships - see §2.6.*

### 2.5 Blanks restored (1 stem)

**This is the section to spot-check without opening a PDF.** Both columns are printed in full, so the
diff is visible on its own terms.

Some source PDFs print a fill-in-the-blank rule (`_____`) that the text layer does not emit, leaving a
stem that reads as ungrammatical prose with a word apparently missing. Each candidate was put to a
three-criteria test - **(1)** ungrammatical as written, **(2)** exactly one hole, **(3)** every option
slots into that hole cleanly - and only stems passing all three were restored.

A restoration inserts `______` and **nothing else**. It is machine-checked: strip every underscore
from the "after" text and the surviving word sequence must be *identical* to the "before" text. Any
restoration that added, dropped, changed or reordered a word is rejected outright - a corrupted stem
is worse than the hole it was fixing. **1 restoration was applied; 0 were rejected; 0 were skipped.**

| id | Tier | Before (as shipped) | After (restored) |
|---|---|---|---|
| `dbbank-q012` | practice | `Unlike filters queries can be saved as in a database.` | `Unlike filters queries can be saved as ______ in a database.` |

**Why this one qualified.** "…saved as in a database" is not English: `as` is left dangling with no
complement before the prepositional phrase. There is exactly one hole (between `as` and `in`) and
every option slots in cleanly - "saved as **objects** / **filters** / **database** in a database" are
all well-formed, with `Objects` the keyed correct one. The stem also terminates in a full stop, so it
is a complete declarative sentence with a word missing from the middle, not a sentence-completion
fragment (which is why the bare fragments in §2.4 - `mock2018-q019`, `mock2018-q022`,
`knpc2021-q013` - were **not** touched: they fail criterion 1).

**Options and key untouched.** Still `C` (`Objects`), still the only `isCorrect`.

### 2.6 The duplicate-option rule, settled (1 item quarantined)

§7.9 of the previous report flagged that this rule was being applied inconsistently:
`mock2018-q010` and `bank-b-q058` were quarantined for printing the same option text twice, while
`koc2012-q094` - **options A and C both read "1 AND 1 is 0"** - was ruled `not-a-defect` because its
keyed answer (D) was still uniquely correct. Same defect, same mitigation, opposite treatment.

**The rule now, applied to every served item:** if two options have identical text (case- and
whitespace-insensitive), the item is **defective and quarantined**. The uniqueness of the correct
answer does not rescue it. A candidate looking at two identical choices cannot tell whether they have
misread the paper, and loses confidence in the whole thing - which is a cost the paper imposes on
every question, not just the broken one.

All 650 served items were swept. **Exactly one match**, now quarantined:

| id | Tier | Defect | Source |
|---|---|---|---|
| `koc2012-q094` | gold | Options **A** and **C** both print `1 AND 1 is 0`. | `KOC 2012 EXAM (2).pdf`, Q94. D (`1 AND 1 is 1`) is bold+underlined and correct - the key was never in doubt. |

The sweep is now **enforced, not observed**: `scripts/validate-bank.ts` used to emit this as a
*warning* (the loophole that let `koc2012-q094` ship), and now emits it as a **failure**. A served
item with two identical options fails the build. `koc2012-q094` was added to the script's
expected-quarantined regression list alongside the other five.

*(`ce2016-q062`, the other byte-identical-options item, was already quarantined - as `key_disputed`,
for an unrelated reason. It stays where it is.)*

---

## 3. Quarantine - 88 items, never served

Loaded into `/bank` for the record, never shown in a quiz. **Nothing here was invented to rescue an
item.**

| Why | Count |
|---|---:|
| **Free-response type** - not auto-gradable (SPEC rule 10) | 56 |
| The paper never recorded an answer and none could be derived | 15 |
| Key disputed - the blind re-answer disagreed with the source key (SPEC rule 5) | 11 |
| **Source defect found by the stem-repair pass** (§2.3) | 5 |
| **Duplicate options** - caught by the rule settled in §2.6 | 1 |
| **Total** | **88** |

*Rows are counted in the first category that applies. 4 items also carry `missing_figure`
(`knpc2021-q009`, `-q020`, `-q030`, `-q024`).*

By type: 39 `short_answer`, 32 `mcq`, 17 `worked_problem`.
By tier: 61 `gold`, 14 `practice`, 13 `bank`.

**The 56 free-response items are not junk** - 39 of them are real KNPC/[CE] past-paper material (the
written half of KNPC 2021, KNPC 2018, several [CE] 2016 items). They are kept and browsable with their
model answers (`answerText` / `answerFigure`) precisely because they are real. The app simply cannot
*mark* them, and a score you award yourself is not a score.

---

## 4. Where the EXTRACTION was wrong - the archaeologist's finds

7 items, from the earlier key-recovery pass. **Five of the seven tell the same story: the pipeline
dropped a printed key, and the printed key turned out to be wrong anyway.**

| id | What the extractor did | What the paper actually says | What we did |
|---|---|---|---|
| `bank-a-q083` | Recorded `keyProvenance: none`; quarantined as "source marks no key" | `exam noooow.pdf` p.30 **does** print `Ans. (b)`. The extractor silently dropped the `Ans.` line. | **Rescued.** Ships `C` (integrated circuit), 4/4 unanimous. Printed key `(b)` **not** imported. |
| `bank-a-q095` | Same - `none`, quarantined | p.32 prints `Ans. (b)`. | **Rescued.** Ships `D` (Modem), 4/4 at 0.97-0.99. The printed key `(b)` = **"Blue cord"** - self-evidently corrupt, and the cleanest proof that these printed `Ans.` letters are unreliable. |
| `bank-a-q099` | Same - `none`, quarantined | p.33 prints `Ans. (c)` = "Magnetic disk", for a CD-ROM. | Rescued then, **re-quarantined now** (§2.3): options C/D are duplicates *and* the printed key is false. |
| `ce2016-q057` | Recorded `keyProvenance: none` | **`[CE] solutions.pdf` was never joined to `[CE] questions.pdf`.** Row 57 reads `B. 11110111`, and **the letter and the value contradict each other**. | **Rescued.** Ships `C` (11110111), 4/4. The *value* is right; the *letter* is a typo. |
| `sample1-q007` | Reported no answer key | `Sample-1.pdf` p.3 prints an answer table (tofu-font) reading `7 → C`. | Key recovered, **deliberately not adopted**. `key_disputed` → now quarantined. |
| `sample2-q010` | Reported `no_answer_key` - **false** | `Sample -2.pdf` p.3 keys Q10 as `A` = **WAN** - for a question asking which network covers *a home or small office*. | **Rescued**, key **overridden**. Ships `C` (LAN), 4/4. The paper's key is simply wrong. |
| `code-q008` | Claimed `keyProvenance: answer_page`, source `2.pdf` | **The item is not in its cited source and its provenance is fabricated.** No numbered MCQ list, no Q26, no answer page anywhere in `2.pdf`. Stock text from a generic online C++ quiz. | **QUARANTINED.** The only fabricated-provenance item found in the corpus. |

**The lesson.** We recovered five printed answer keys the pipeline had missed. On inspection, **four of
the five were wrong**. This is SPEC rule 9: *a recovered source key is evidence, not an override.*

---

## 5. KEY_CONTRADICTED items

**There are none. Zero.** The audit only ever emitted `ok` and `rewritten`. No items were invented to
fill this section.

What *does* exist is the near-miss: **five explanations were rewritten because the explanation
contradicted the item's own key - and in every case the key was right and the explanation was stale.**
Those five were actively dangerous - they told you to distrust correct answers. They are fixed.

---

## 6. Invariants verified after the repair pass

All pass on the shipped files. Re-checked with the app's own `validateBank` / `validateQuarantine` /
`isServable` (`bun run scripts/validate-bank.ts`), not a reimplementation:

- valid JSON; flat array; 2-space pretty-printed
- **650** unique ids served; **88** unique ids quarantined; **zero overlap** between the two files
- pool conserved: 656 + 82 = 738 in → 650 + 88 = 738 out. **Nothing was deleted.**
- `validateBank` drops **0** rows; `validateQuarantine` drops **0** rows
- every served item is `mcq` or `true_false`, `keyVerified: true`, `needsReview: false`
- every served item has a non-empty stem and **≥2 options**
- every served item's keyed label exists among its options and is the **only** `isCorrect` option
- **no served item prints the same option text twice** (case- and whitespace-insensitive) - §2.6.
  Now a **build failure**, not a warning
- `options[].isCorrect` agrees with `answerOptionLabels` on every single item
- no served item carries `unanswerable` or `missing_figure`
- every `stemFigure` / `answerFigure` / option `figure` resolves to a real file in `public/figures/`
- `verificationLevel === 'disputed'` iff `needsReview` - and **both are empty on the served bank**
- no duplicate `dedupeHash` in the served bank
- served bank still sorted by tier (gold, practice, bank) → `source.year` desc → `id`
- every one of the 88 quarantine records carries a non-empty `quarantineReasons`
- the 1 restored stem (§2.5) differs from its pre-restoration text by **inserted underscores only** -
  machine-checked, word sequence identical
- `bun test` (104 pass / 0 fail), `bun run lint` (clean), `bun run build` (12/12 static pages) all green

---

## 7. What you should not trust

This is the honest part. Read it.

1. **The 318 `single` items (all `bank` tier) are the weakest thing here.** One solver agreed with a
   scraped key. That is all `single` means. They are OFF by default and should stay off until you have
   exhausted gold and practice. `single` is not `double`.

2. **`derived` (34 items) means no paper ever said this.** The reasoning is good and usually unanimous,
   but there is no source key behind it. If a `derived` item contradicts your textbook, **the textbook
   wins.**

3. **The sources' own printed answer keys are demonstrably unreliable.** We recovered five printed keys
   the extractor had missed; **four were wrong** (§4) - including one that keys a home-network question
   as "WAN" and one that keys a modem question as "Blue cord". **"It's in the PDF" is not evidence.**

4. **The `bank` tier has never been audited item by item.** The repair pass sampled it; it did not
   sweep it. `bank-a-q159` and `bank-b-q050` - both genuinely unanswerable as printed - were found by
   looking at 36 items out of 738. **There are almost certainly more like them among the 329 bank
   items.**

5. **74 served items are `legacy` (46) or `off_syllabus` (28)** - floppy disks, Windows 2000, and a
   block of cognitive-psychology questions that have no business in a CE exam. Flagged but still
   served. Filter them out if they waste your time.

6. **Explanations are AI-written.** 40 items still claim `explanationSource: 'source'`. Every
   explanation renders behind the "AI-generated" label. **An explanation is a study aid, not
   evidence.** One known-stale explanation: `bank-b-q104`'s blames "an OCR artifact in the source" for
   the A/E/F/G lettering, which the archaeologist proved is genuinely printed in the paper (§2.4).
   That sentence is false and the explanation pass should strike it.

7. **Only gold and practice got a second blind solve.** The `bank` tier never did. The `double` badge
   cannot exist there, by construction.

8. **A "faithful extraction" is not a good question.** 29 items in §2.4 are provably what the paper
   prints - and several of them are still barely parseable English (`knpc2016-q029`: "why is IP used
   that ether net address?"). Fidelity was the goal; readability was not. Do not assume a served item
   is *well-formed* just because it is *correct*.

9. ~~**The duplicate-option rule is applied inconsistently.**~~ **RESOLVED (§2.6).** The previous
   report flagged that `koc2012-q094` (options A and C both "1 AND 1 is 0") was ruled `not-a-defect`
   and still shipped, while `mock2018-q010` and `bank-b-q058` were quarantined for exactly the same
   defect - the "but the keyed answer is still unique" excuse being equally true of all three. One
   rule now covers every served item: **identical option text (case- and whitespace-insensitive) =
   quarantine**, regardless of whether the key survives. `koc2012-q094` is quarantined; a full sweep
   of the served bank found no other match; and `scripts/validate-bank.ts` now **fails the build**
   on any recurrence rather than emitting a warning nobody reads.

10. **The six quarantined source-defect items are held out of quizzes by file placement alone.** They
    are `mcq`, `keyVerified: true`, and have ≥2 options and a valid key - so `isServable()` would wave
    all six straight through on their **fields**. They never reach a quiz because `loadBank()` builds
    the servable pool from `questions.json` *alone*, which is the structural guarantee the SPEC
    documents. But no `Flag` in the union means "the source printed two identical distractors", so
    nothing on the row itself says *never serve me*. **If you want defence-in-depth, the `Flag` union
    needs a `source_defect` member** - which is a contract change, and this pass does not own the
    contract. The `validate-bank.ts` duplicate-option check (§2.6) is a partial mitigation: it cannot
    stop such a row being served, but it *can* stop it being committed.

11. **The blank-restoration pass looked only at stems already triaged as suspect.** It restored one
    (`dbbank-q012`, §2.5) under a deliberately strict three-criteria test. That test is conservative
    by design - it refuses any stem that merely *reads* like a fragment (§2.4's `mock2018-q019`,
    `mock2018-q022`, `knpc2021-q013` are bare fragments **in the paper** and were left alone). The
    risk it does not cover: a stem whose blank the PDF ate *and* which still happens to read as
    grammatical prose would not trip criterion 1, and nothing here would have caught it. **The bank
    tier in particular was never swept for this.**
