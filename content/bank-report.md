# KNPC Reviser - Final Bank Report

**712 questions ship. 26 are quarantined. 7 need your eyes.**

Generated at final reassembly, after: two independent blind solves of every gold/practice item,
a 4-judge panel (first-principles / distractor-analysis / skeptic / source-archaeologist) on every
contested item, and a full explanation audit.

Read [§6 What you should not trust](#6-what-you-should-not-trust) before you rely on this bank.

---

## 1. Final counts

### By tier

| Tier | Count | Default in quizzes |
|---|---:|---|
| `gold` | 243 | ON |
| `practice` | 134 | ON |
| `bank` | 335 | **OFF** (opt-in) |
| **Total shipped** | **712** | |
| Quarantined (never served) | 26 | |

Default experience = **377 high-signal questions** (gold + practice).

### By verificationLevel - the honest badge

| Level | Count | What it means |
|---|---:|---|
| `double` | 340 | A source key existed and **two independent blind solves both agreed**. The strongest thing in the bank. |
| `single` | 321 | A source key existed and **one** solve agreed. All 321 are `bank` tier: scraped, least representative, worst keys. |
| `derived` | 44 | **No source key existed at all.** A panel derived the answer. Trust the reasoning, not a paper. |
| `disputed` | 7 | Solvers/panel could not agree. `needsReview: true`, amber badge. Listed in full in §2. |

`verificationLevel` is `disputed` exactly when `needsReview` is true. The 8 `compiled` items (code we
actually ran) count as `double`: machine-executed *and* confirmed by both blind solves.

Cross-tabulated against where the key came from:

| Level | inline_bold | answer_page | compiled | derived |
|---|---:|---:|---:|---:|
| `double` | 157 | 175 | 8 | - |
| `single` | 265 | 56 | - | - |
| `derived` | - | - | - | 44 |
| `disputed` | 1 | - | - | 6 |

### By type

| Type | Count |
|---|---:|
| `mcq` | 637 |
| `short_answer` | 35 |
| `true_false` | 25 |
| `worked_problem` | 15 |

### By topic

| Topic | Count | Topic | Count |
|---|---:|---|---:|
| networking | 116 | computer-architecture | 50 |
| general-it | 98 | digital-logic | 49 |
| hardware-memory | 92 | programming | 32 |
| databases | 74 | misc | 30 |
| data-structures-algorithms | 58 | number-systems | 23 |
| operating-systems | 54 | software-engineering | 18 |
| | | cloud-computing | 18 |

### By source

| Exam | Count | Years |
|---|---:|---|
| KOC | 113 | 2012 |
| KNPC | 81 | 2016 / 2018 / 2021 |
| K-Companies `[CE]` | 74 | 2016 |
| mock | 69 | 2018 |
| bank (scraped) | 375 | - |

---

## 2. Hand-adjudication worklist - the 7 `needsReview` items

These ship with an amber badge. Each is a real disagreement, not a data-quality nit. For each: what
shipped, what the disagreement was, what each judge said, and what I recommend.

---

### 2.1 `ce2016-q062` - gold - FDDI acronym

> **FDDI stands for ______________________ .**
> A. Fiber Distributed Data Interface  ← **shipped**
> B. Fiber Data Distributed Interface
> C. Fiber Dual Distributed Interface
> D. Fiber Distributed Data Interface  ← **identical to A**

**The disagreement:** not about the fact - about whether the item is *gradable*. Options A and D are
byte-identical, so two labels are simultaneously correct.

- **Blind solve #2:** answered `[A, D]`, conf 0.95, marked *defective* - "options A and D are byte-identical, so the item as printed has no unique key."
- **First-principles / distractor-analysis / archaeologist (3 of 4):** `A` alone.
- **Skeptic:** dissents with `[A, D]`. That is a defect claim, not an unanswerability claim, so the item ships badged rather than quarantined.
- **Source-archaeologist:** rendered `[CE] questions.pdf` p.7 - **the A==D duplication is real in the printed paper** (the Q62 option block is even typeset in a different font, suggesting a paste error). Then read `[CE] solutions.pdf` p.2, Model Answer row 62 → `A. Fiber Distributed Data Interface`, row alignment verified against neighbours 58/59/61/63. No extraction error.

**Verdict:** the content is certain (FDDI = Fiber **Distributed Data** Interface, ANSI X3.139-1987).
The paper is broken, not the pipeline.
**Recommendation:** replace option D with a genuine distractor. **Never change the key.** A student who
marks D has the right text and must not be scored wrong.

---

### 2.2 `mock2018-q024` - practice - binary search worst case

> **What is the worst-case run-time complexity of binary search algorithm?**
> A. O(n²)   B. O(n log n)   C. O(n³)   D. O(n) ← **shipped**

**The disagreement:** the true answer, **O(log n), is not on the ballot.**

- **Blind solve #2:** `D`, conf 0.50, marked *defective* - "worst-case binary search is O(log n), which is not among the options. O(n) is the tightest of the four listed upper bounds."
- **First-principles (0.78) / distractor-analysis (0.72) / archaeologist (0.90):** `D`.
- **Skeptic:** *unanswerable*, 0.80. Quarantine did not trigger - it requires the skeptic's unanswerable **and** a second judge below 0.6, and the lowest agreeing confidence was 0.72.
- **Source-archaeologist:** instrumented it (n=1024 → 11 comparisons; n=1048576 → 21, i.e. Θ(log n)). Confirmed on the paper (`Test 3/IMG_9102.HEIC` p.5) that the printed options really are O(n²)/O(n log n)/O(n³)/O(n) - **nothing was dropped in extraction** - and that the printed key (`IMG_9112.HEIC`, row 24) really does read `D`.

**Verdict:** `D` is the only defensible bubble (big-O is an upper bound; log n ∈ O(n), and O(n) is the
tightest offered). The shipped explanation's original reasoning ("compares all the n values") is
**false for binary search** - that is the worst case for a *skewed BST*, almost certainly the question
the author meant to print.
**Recommendation:** memorise the fact - **binary search worst case = O(log n)** - not the paper's
reasoning. Replace a distractor with O(log n), or retire the item.

---

### 2.3 `knpc2021-q014` - gold - identifying ER relationships

> **In database ER diagram, how do we uniquely identify relationships?**
> A. Primary key of participating entities ← **shipped**
> B. Primary key of the relation itself
> C. By its attributes
> D. Relationships cannot be uniquely identified

**The disagreement:** **the only physical key in the corpus says `D`; we ship `A` anyway.** You should
know that.

- **First-principles (0.85) / distractor-analysis (0.80) / skeptic (0.75):** `A`.
- **Source-archaeologist:** `D` at **0.45**, and explicitly asked not to let it outvote a well-argued `A`. Their `D` comes from a **third-party tutor key** (`Data.pdf` p.18, footer "ENG. MOHANNAD") where option D is yellow-highlighted. That is a tutor's opinion, not the exam's key. The archaeologist confirmed the actual recall paper prints Q14 with **no answer marking at all** - the pipeline's empty key was a faithful extraction.
- **Theory:** a relationship set has no key of its own; the union of the participating entities' primary keys is a superkey of the relationship set (Silberschatz; Elmasri/Navathe). This is exactly why an M:N junction table's PK is the composite of the participants' FKs. B is the designed trap (relation/relationship word collision) and collapses into A. D is flatly false.

**Verdict:** ships `A`, badged, because the disagreeing key is a tutor's, is low-confidence, and is
contradicted by standard theory.
**Recommendation:** accept `A`. The tutor is most likely wrong.

---

### 2.4 `sample1-q007` - practice - community vs public cloud

> **Which cloud is shared among multiple organizations?**
> A. Private   B. Hybrid   C. Public   D. Community ← **shipped**

**The disagreement:** **the paper's own printed key says `C`. We override it to `D`.** A live two-horse
item, and an extraction error (§3).

- **All four judges:** `D` - but *every one* is at or below 0.78 (0.78 / 0.78 / 0.75 / 0.55). Nobody is comfortable.
- **Source-archaeologist:** found the answer table the extractor had dropped from `Sample-1.pdf` p.3. It reads `7 → C` = **Public Cloud**. Option order confirmed against the render, so there is no letter-shift artefact.
- **Why we did not adopt C:** (1) the stem is a near-quote of the NIST SP 800-145 *community* cloud definition - "provisioned for exclusive use by a specific community of consumers from **organizations** that have shared concerns" - whereas *public* is defined by its **audience** ("open use by the general public"); an examiner who intended C would not have put D on the ballot. (2) The same author's key in `Sample -2.pdf` contains a flatly impossible cell (Q10 keyed WAN for a home network), so this key mis-keys roughly one item in ten and cannot arbitrate a contested cell.
- **The counter-case is real:** many introductory decks *do* gloss public cloud as "multi-tenant / shared among multiple organizations" - exactly the reading the printed key took.

**Recommendation:** learn the **distinction**, not the letter. Community = a specific set of
organizations with shared concerns; public = open to anyone. A student who answered C is not ignorant.

---

### 2.5 `knpc2021-q036` - gold - `short_answer` - types of search trees

> **What are the types of search trees?**  *(no options; open taxonomy question)*

**The disagreement:** not the content - **whether the item can be scored at all.**

- **Three judges:** answer with the standard taxonomy, but *all three* sit at or below 0.6 (0.55 / 0.50 / 0.60).
- **Source-archaeologist:** dissents - **unanswerable at 0.80**. Established and uncontested: `KOC 2012 EXAM (2).pdf` p.47 prints "Q36: What are the types of search trees?" followed by **roughly four lines of deliberate white space**, then Q37 - while every neighbouring short-answer item (Q32-Q35, Q37, Q38) carries a bulleted answer. The same blank appears in the standalone copy. **There is no lost key to recover.**
- Quarantine did not fire because the dissenter-on-unanswerability is the archaeologist, not the skeptic (the skeptic ruled it answerable).

**Verdict:** the shipped taxonomy (binary family: BST, AVL, red-black, splay; multi-way family: 2-3,
B-tree, B+ tree) is standard and no marker would reject it. What is unrecoverable is *which*
enumeration the examiner wanted.
**Recommendation:** study as a **flashcard**, not a scored item. Convert it.

---

### 2.6 `bank-a-q061` - bank - `off_syllabus`

> **Lansdale and Baguley (2008) argue that memory dilution occurs because...**
> D. the memory becomes less temporally distinctive ← **shipped** (`inline_bold`)

**The disagreement:** the round-1 single blind solve disagreed with the source key. **There is no panel
ruling** - this is bank tier, and the panel budget went to gold/practice.
**Verdict:** this is **cognitive psychology**, not computer engineering. It is `off_syllabus` and only
loads if you opt into the bank tier.
**Recommendation:** ignore it. It will not be on a CE exam. Delete it if it annoys you.

---

### 2.7 `bank-a-q200` - bank - subnet mask

> **The IP network 192.168.50.0 is to be divided into 10 equal sized subnets. Which of the following subnet masks can be used?**
> A. 255.243.240 ← **shipped**   B. 255.255.0.0   C. 255.255.0   D. 255.255.255

**The disagreement:** round-1 single solve disputed the key. No panel ruling (bank tier).
**Verdict: every option is malformed.** A, C and D are not even dotted-quads (three octets), and A's
"243" cannot come from a contiguous mask. The correct answer for 10 subnets of a /24 is
`255.255.255.240` (/28 - four borrowed bits gives 16 subnets), which **is not on the ballot**. The item
is garbage in the source.
**Recommendation:** **delete this item.** Do not learn from it. The invariants did not catch it because
nothing *structural* is wrong - the content is just wrong. Flagged here so you see it.

---

## 3. Where the EXTRACTION was wrong - the archaeologist's finds

7 items. The source-archaeologist went back to the original PDFs and rendered the pages. These are the
most interesting failures in the corpus, and **five of the seven tell the same story: the pipeline
dropped a printed key, and the printed key turned out to be wrong anyway.**

| id | What the extractor did | What the paper actually says | What we did |
|---|---|---|---|
| `bank-a-q083` | Recorded `keyProvenance: none`; quarantined as "source marks no key" | `exam noooow.pdf` p.30 **does** print `Ans. (b)` beneath the options. The extractor silently dropped the `Ans.` line. | **Rescued from quarantine.** Ships `C` (integrated circuit), 4/4 unanimous. Printed key `(b)` **not** imported. |
| `bank-a-q095` | Same - `none`, quarantined | p.32 prints `Ans. (b)`. | **Rescued.** Ships `D` (Modem), 4/4 at 0.97-0.99. The printed key `(b)` = **"Blue cord"** - self-evidently corrupt, and the cleanest proof in the bank that these printed `Ans.` letters are unreliable. |
| `bank-a-q099` | Same - `none`, quarantined | p.33 prints `Ans. (c)`. | **Rescued.** Ships `A` (Optical disk), 4/4. Printed key `(c)` = "Magnetic disk" is provably wrong - and options C/D are semantic duplicates ("Magnetic disk" / "Magnetic disc"). |
| `ce2016-q057` | Recorded `keyProvenance: none` | **`[CE] solutions.pdf` was never joined to `[CE] questions.pdf`** - a key existed the whole time. Row 57 reads literally `B. 11110111`, and **the letter and the value contradict each other**: the paper's own option B is `11110110`; `11110111` is option **C**. | **Rescued.** Ships `C` (11110111), 4/4 unanimous. The *value* is right; the *letter* is a typo. |
| `sample1-q007` | Reported no answer key | `Sample-1.pdf` p.3 prints an answer table (tofu-font, likely why it was missed) reading `7 → C`. | Key recovered but **deliberately not adopted**. Ships `D`, badged `key_disputed`. See §2.4. |
| `sample2-q010` | Reported `no_answer_key` - **false** | `Sample -2.pdf` p.3 prints a Question/Answer table. The printed key for Q10 is `A` = **WAN** - for a question asking which network covers *a home or small office*. | **Rescued**, key **overridden**. Ships `C` (LAN), 4/4 at 0.94-0.96. The paper's key is simply wrong. |
| `code-q008` | Claimed `keyProvenance: answer_page`, `originalNumber: 26`, source `2.pdf` | **The item is not in its cited source and its provenance is fabricated.** `2.pdf` is an 18-page *study pack* - screenshots, typed notes, handwritten Big-O working. There is no numbered MCQ list, no Q26, and **no answer page anywhere in the file**. A full-text grep for "types of loop" across every source PDF returns **zero hits**. The stem, options and explanation are stock text from a generic online C++ quiz, given a false KNPC provenance in `content/raw/code-trace.json`. | **QUARANTINED.** This is not a KNPC question. It is the only fabricated-provenance item found in the corpus. |

**The lesson.** We recovered five printed answer keys the pipeline had missed. On inspection, **four of
the five were wrong** ("Blue cord"; "Magnetic disk"; WAN-for-a-home-network; and a letter/value
contradiction). This is the strongest possible vindication of the SPEC's founding decision to blind
re-answer everything and never trust a source key. It is now SPEC rule 9: *a recovered source key is
evidence, not an override.*

---

## 4. KEY_CONTRADICTED items

**There are none. Zero.**

The string `KEY_CONTRADICTED` does not appear anywhere in the explanation audit, or anywhere else under
`content/`. The audit only ever emitted `ok` (286) and `rewritten` (85).

The merge implements the rule regardless - any `KEY_CONTRADICTED` verdict sets `keyVerified: false`,
`needsReview: true` and adds `key_disputed` - and it matched 0 items. **No items were invented to fill
this section.**

What *does* exist is the near-miss, and it is worth knowing: **five explanations were rewritten because
the explanation contradicted the item's own key - and in every case the key was right and the
explanation was stale.** That is the exact opposite of the failure this section was meant to catch.

| id | The stale explanation said | Reality |
|---|---|---|
| `koc2012-q117` | "Answer unverified: the key says C... expect B on merits" | The item's key **is already B**. The explanation described a key/review conflict that does not exist in the data, and would have made you distrust a correct key. |
| `koc2012-q066` | "the printed key marks True... treat the printed key as wrong" | The item's key **is already B (False)**, which is the factually correct answer. The hedging would have pushed you into answering True. |
| `knpc2016-q102` | "Answer unverified: the source key marks D" | The item's key is **B**. Rewritten to justify B and to note that the printed PDF key is the thing that is wrong. |
| `mock2018-q054` | self-contradictory - "not really a good choice, although it is considered one of the techniques" | Never justified the "All of the mentioned" key at all. |
| `knpc2016-q018` | stated the no-distractor caveat twice across five sentences | Genuinely ambiguous stem; condensed, warning kept. *(The panel later quarantined this item.)* |

These five were **actively dangerous** - they told you to distrust correct answers. They are fixed.

---

## 5. Quarantine - 26 items, never served

Loaded into the bank for the record, never shown in a quiz. **Nothing here was invented to rescue an
item.**

### The paper never recorded an answer (18 items)

No key in the source, and no panel could derive one. Rule 1 forbids inventing one.

| id | Tier | Why |
|---|---|---|
| `knpc2021-q001` | gold | The recall dump captured three options and no answer. The term the stem actually describes - a *product-line / off-the-shelf* program - **is not among the options at all**, which is the tell that the recall is corrupted. |
| `knpc2021-q011` | gold | 3x8 decoder. Two judges independently read the decoder tree as X→Z→Y (matching the figure's own handwritten choice) - but **the stored options do not contain that ordering**. |
| `knpc2021-q040` | gold | "Binary number convert it to decimal (**i think it was** 100102...)" - the recaller is not sure what the number was. `hedged_option`. |
| `knpc2021-q045` | gold | Open OS question about a thread in a "read" state; no answer recorded. |
| `knpc2018-q010` | gold | 3x8 decoder input ordering; no key. |
| `knpc2018-q011` | gold | "Which flip flop is represented by the given truth table?"; no key. |
| `knpc2016-q001` | gold | Windows 2000 server question. `legacy` + `hedged_option`; no key. |
| `knpc2016-q027` | gold | "UDP covers how many ft?" - the question is incoherent (UDP has no range). No answer. |
| `knpc2016-q031` | gold | "When to use FDDI?" - **only one option survived the recall.** Nothing to choose between. `no_distractors`. |
| `ce2016-q051` | gold | `worked_problem` - "What is the minimized function represented below?" - with **no answer text** in the source. |
| `ce2016-q071` | gold | `worked_problem` - "Find the function representation for the following circuit" - no answer text. |
| `bank-a-q009` | bank | "The contents of memory into blocks of the same size is called as:" - key never made it into the source text. |
| `bank-a-q017` | bank | "Flash is ................" - no key. |
| `bank-a-q035` | bank | "What is the capacity of super computers floppy disc?" - no key, and `legacy` nonsense besides. |
| `bank-a-q079` | bank | "RAM is an example of:" - no key. |
| `bank-a-q161` | bank | "Which of the following is a feature of DBMS?" - no key. |
| `bank-a-q023` | bank | "The process to copy the software in hard disk from secondary storage media" - solver disputed the key and no answer could be established. |
| `bank-a-q062` | bank | "Which element was NOT found to alter accounts of the 'War of the Ghosts' story?" - `off_syllabus` cognitive psychology; no answer established. |

### Figure referenced, but the figure does not exist (4 items)

SPEC rule 4. These are literally unanswerable without an image we do not have.

| id | Why |
|---|---|
| `knpc2021-q009` | "Given a figure, what does it represent?" - **there is no figure.** The four options differ only in edge-vs-level triggering and clock polarity, so it cannot be guessed. |
| `knpc2021-q020` | K-map described in prose only; the map itself is missing. |
| `knpc2021-q024` | 4x1 mux; the wiring diagram is missing. |
| `knpc2021-q030` | "Given a truth table, what is the function?" - there is no truth table. |

### Panel-ordered quarantine (4 items)

The panel pulled these **out of the shipping bank**:

| id | Why |
|---|---|
| `code-q008` | **Fabricated provenance.** Not a KNPC question at all - stock text from an online C++ quiz with a false source. See §3. |
| `knpc2021-q012` | No source key exists (the archaeologist confirmed the paper's bold+underline answer convention is simply absent on Q12). The previously-shipped answer `B` **was manufactured by an earlier panel, not read off the paper.** Removed. |
| `knpc2016-q014` | "Safest way to connect to a secure network through public network" - the extraction is faithful but the **source is broken**: one distractor literally reads *"I don't remember"*. |
| `knpc2016-q018` | "Datagram is which layer?" - genuinely ambiguous. Datagram is the network-layer PDU by the dominant convention, but the paper's single recalled line says Transport, and items 15-17 are missing entirely. |

---

## 6. What you should not trust

This is the honest part. Read it.

1. **The 321 `single` items (all `bank` tier) are the weakest thing here.** One solver agreed with a
   scraped key. That is all `single` means. They are OFF by default and should stay off until you have
   exhausted gold and practice. Do not let a green badge fool you - `single` is not `double`.

2. **`derived` (44 items) means no paper ever said this.** The reasoning is good and usually unanimous,
   but there is no source key behind it. If a `derived` item contradicts your textbook, **the textbook
   wins.**

3. **The sources' own printed answer keys are demonstrably unreliable.** We recovered five printed keys
   the extractor had missed; **four were wrong** (§3) - including one that keys a home-network question
   as "WAN" and one that keys a modem question as "Blue cord". Where this bank disagrees with a paper's
   printed key, that is usually deliberate and usually right. But it means **"it's in the PDF" is not
   evidence.**

4. **`bank-a-q200` is garbage and I still shipped it** (badged). Every option is a malformed subnet mask
   and the correct answer is not on the ballot. It survived because the invariants check *structure*,
   not whether option text is *sensible*. **There are probably more like it among the 335 bank items -
   the bank tier has never been audited item by item.**

5. **75 shipped items are `legacy` (46) or `off_syllabus` (29)** - floppy disks, Windows 2000, and a
   block of cognitive-psychology questions that have no business in a CE exam. They are flagged but
   still served. Filter them out if they waste your time.

6. **Explanations are AI-written.** 85 were rewritten in the final audit. 61 of those had previously
   been mislabelled `explanationSource: 'source'` - i.e. "verbatim from the paper" - **while carrying
   AI-rewritten text.** That label is now stripped; only 42 items still claim a source-verbatim
   explanation. Every explanation must render behind the "AI-generated" label. **An explanation is a
   study aid, not evidence.**

7. **Only gold and practice got a second blind solve.** The `bank` tier never did. The `double` badge
   cannot exist there, by construction.

8. **Six of the seven `needsReview` items are defects in the source paper, not open questions.** Two have
   duplicate options, one has an answer that is not on the ballot, one has no options at all. Fixing them
   means *repairing the item*, not *picking a letter*.

---

## 7. Invariants verified at write time

All pass on the shipped file:

- valid JSON; flat array; 2-space pretty-printed
- 712 unique ids; 26 unique ids in quarantine; **zero overlap** between the two files
- pool conserved: 703 + 35 in → 712 + 26 out = 738
- every `topic` / `type` / `tier` / `keyProvenance` / `verificationLevel` is in its SPEC union
- every `mcq` / `true_false` has ≥2 options, a non-empty answer, and every answer label exists among its options
- `options[].isCorrect` agrees with `answerOptionLabels` on every single item
- every `short_answer` / `worked_problem` has non-empty `answerText`
- no served item carries `unanswerable` or `missing_figure`
- every `stemFigure` / `answerFigure` / option `figure` resolves to a real file in `public/figures/`
- `keyVerified && needsReview` is never both true; `verificationLevel === 'disputed'` iff `needsReview`
- no duplicate `dedupeHash` in the shipped bank
- sorted by tier (gold, practice, bank) → `source.year` desc (nulls last) → `id`
