# knpc_reviser

Client-side study app for the KNPC Computer Engineering hiring exam. Read `docs/SPEC.md` first -
it is the settled product and data contract.

## Stack

- Next.js 14 (App Router) + TypeScript, static export (`output: 'export'`)
- AlignUI component kit in `components/ui/` (compound components: `import * as Button from '@/components/ui/button'`)
- Tailwind v3 with AlignUI's two-layer CSS-variable token system. **Use the semantic classes**
  (`bg-bg-white-0`, `text-text-strong-950`, `border-stroke-soft-200`, `text-label-md`) - never raw
  hex or raw Tailwind palette colours, or dark mode breaks.
- `bun` for everything. Never npm or yarn.
- Dark mode via `next-themes`, `.dark` class strategy.
- State: IndexedDB (via a typed wrapper in `lib/db.ts`). No backend, no server actions, no API routes.

## Non-negotiables

- **Never invent a quiz question, option, or answer.** Every item is verbatim from a source paper.
  The pipeline transcribes; it does not author.
- Explanations are the only AI-written content, and they must always render behind a visible
  "AI-generated" label.
- `content/questions.json` is the single source of truth for the bank. Its shape is fixed by
  `docs/SPEC.md`. Do not add fields to it without updating the spec.
- **Every served question is auto-graded, so only `mcq` and `true_false` are servable.** `isServable`
  rejects `short_answer` and `worked_problem` **by type** - not because of which file they sit in, so
  a pipeline run that drops one back into `questions.json` still cannot serve it. The 49 free-response
  items (39 of them real past-paper questions) live in `content/quarantine.json`: browsable in `/bank`
  with their model answers, never quizzed. There is no self-grading UI anywhere in a quiz.
  Results and `/bank` resolve questions from the FULL pool (`getQuestionById` / `getQuestionsByIds`),
  so an old attempt holding a free-text response still replays. Anything about to put a question in
  front of the user to ANSWER uses the servable pool (`servableQuestionsByIds`, `selectQuestions`).
- Items flagged `missing_figure` are never served in a quiz.
- Items with `keyVerified: false` are **never served in a quiz**, full stop. There is no opt-in:
  the "Include unverified answers" toggle was retired along with the seven disputed items, which
  now live in `content/quarantine.json`. `isServable` enforces this as a hard filter.
  The amber "answer unverified" badge in `question-view.tsx` stays: nothing triggers it today,
  but it is the safety net if a future pipeline run ships a disputed item.
- Never assume an MCQ has 4 options. The corpus has 2-, 3-, 4- and 5-option items.
- `stemCode` whitespace is load-bearing - render it monospace, `white-space: pre`, never reformat it.
- No emojis in the UI.
- Never use the `fable` model for any agent, subagent or workflow on this project. Use `opus` or
  `sonnet`.

## Commands

```
bun run dev        # next dev
bun run build      # next build (static export -> out/)
bun run lint
bun run format:write
```
