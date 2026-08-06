# AsOf

**A temporal memory linter for AI agents.**

Agents don't only make things up. They act — confidently, fluently, with
citations — on facts that *used to be* true. Nothing about that output looks
like a hallucination, which is why it survives most checks.

AsOf is not a memory store. It's the linter you bolt onto one. A language model
nominates candidate facts; a deterministic engine owns what is true; assumptions
that have expired get rejected with the evidence that replaced them.

> Built independently for the Razorpay AI Builders challenge, using synthetic
> data and no employer materials. "Project Atlas" and everyone in it are
> invented.

---

## See it break first

The deployed page opens with a two-minute experiment rather than a pitch:
download `public/project-atlas-log.md`, upload it to whichever AI you already
use, and ask four questions. Then ask AsOf the same four.

The comparison is deliberately **not** something I wrote. An earlier version of
this page had a "without AsOf" column filled with hand-written examples of what
a naive system returns — I wrote both sides of that, which is not evidence of
anything. Running the questions against your own model produces a before-state
I did not author, and the file you upload is byte-identical to the one the app
analyses (there is a test that fails if they ever drift apart).

Being straight about what you'll see: **some models get some of these right.**
That isn't the claim. The claim is that a right answer and a wrong one arrive
looking identical — fluent, sourced, confident — and nothing in the reply tells
you which are safe to act on.

## The problem

Give an assistant a project history and ask it to "remind Jay that Atlas
launches on 2026-08-15." Two things in that sentence expired weeks ago: Jay
handed the project to Neha on 28 July, and the launch moved twice, landing on
2026-09-19. A retrieval system will happily find the chunk that says
2026-08-15, because it exists and it matches. Then the agent sends the wrong
reminder to the wrong person.

This is a measured weakness, not a hypothetical one:

- **[STALE (arXiv 2605.06527)](https://arxiv.org/abs/2605.06527v1)** benchmarks
  agents on time-sensitive knowledge conflicts. Best accuracy: **55.2%**.
- **[Microsoft STATE-Bench](https://opensource.microsoft.com/blog/2026/05/19/introducing-state-bench-a-benchmark-for-ai-agent-memory/)**
  targets the same gap — agent memory that tracks state over time rather than
  storing facts as if they were permanent.

Existing memory layers (Graphiti, Zep, and the rest of that category) are
*stores*. They solve recall. AsOf solves **validity**: not "what do I know
about Atlas" but "is what I know still usable, and how would I know if it
weren't."

## Three answers, not two

Most systems can return a value or say "I don't know." The third answer is the
product:

| Verdict | Meaning |
|---|---|
| `known` | A value holds, with the observation it rests on |
| `unknown` | Never observed — and no citation is invented |
| `stale` | Was true, has since been replaced (cites what replaced it) |
| `conflicted` | Contradicted by equally-dated evidence; no value is reported |

A system that can't tell *never knew* from *knew, and it expired* will act on
expired facts with full confidence. That distinction is the whole design.

## How it works

```
timeline text
   ↓  (LLM — nominate only)
candidates {entity, property, value, observedAt, sourceSpan, sourceLine}
   ↓  (validation — malformed candidates are dropped, never coerced)
deterministic engine
   ↓
fact table with half-open validity intervals [validFrom, validUntil)
   ↓
queries: now · as-of <date> · premise checks
```

**The model's entire job is to nominate candidates.** It never decides what is
true, what supersedes what, or what conflicts. Those are four rules in tested
code, applied per `(entity, property)` pair:

| Incoming candidate | Outcome |
|---|---|
| Same value | **duplicate** — corroborate, don't insert |
| Different value, later date | **supersede** — old value closes at the new date |
| Different value, same date | **conflict** — both suspect, refuse to answer |
| Different value, earlier date | **backfill** — insert into history, born closed |

The last rule is the one most systems get wrong. Evidence doesn't arrive in
chronological order. Learning on Tuesday what was true last Monday must change
*history*, not the present.

## Design decisions

**Dates are ISO `YYYY-MM-DD` strings, never `Date` objects.** Lexicographic
comparison equals chronological comparison for that format, so there's no date
library and no timezone that can shift a fact onto the wrong day. A temporal
linter that gets days wrong is worse than no linter.

**Intervals are half-open `[validFrom, validUntil)`.** A value replaced on the
28th is not also true on the 28th. Both boundary cases are pinned by tests.

**The engine is pure.** No clock, no randomness, no network — same input, same
output, every run. That's what makes it testable and replayable, and why a
wrong answer here is a bug rather than a temperature setting.

**The UI is a thin shell.** All client state is one reducer over the engine
(`lib/state.ts`). No component computes truth; they only display it.

**Stale explanations name the fact that actually replaced the assumption**, not
whatever happens to be current. On a multi-step chain those differ, and pairing
an assumed fact's end date with the current fact's line number describes a
handover that never happened. Caught during browser verification; pinned by a
test.

## Works with no API key

The deployed demo is **fully functional with zero environment variables and
makes zero network calls**. Candidates for the demo timeline are pre-extracted
into `fixtures/`, so every panel — facts table, time-travel, conflict bin,
premise checks, comparison — runs offline.

This is a design requirement, not a convenience. The model is a replaceable
front-end to the engine, so the demo shouldn't depend on it being reachable.
Live extraction of *novel* text needs `GEMINI_API_KEY`; without it the UI says
so plainly and everything else keeps working.

## Running it

```bash
npm install
npm test        # 37 tests: engine, queries, demo end-to-end
npm run dev
```

Optional, for live extraction of your own text:

```bash
echo "GEMINI_API_KEY=your-key" > .env.local
```

The key is read server-side only and sent in an `x-goog-api-key` header — never
in a query string, never under a `NEXT_PUBLIC_` name. There are no retries:
free-tier limits are unpublished, and a retry storm is the fastest way to lose
the key mid-demo.

## What I deliberately cut

- **No entity resolution.** Names normalise (case, whitespace) but nothing
  fuzzy-matches. A wrong merge corrupts truth state silently, and silent
  corruption is worse than a missed link.
- **No conflict auto-resolution.** No source-priority heuristic, no recency
  tiebreak on same-day claims. The evidence doesn't order them, so neither does
  the engine.
- **No persistence.** The engine is a pure function over a fact table, so
  storage is a deployment decision, not a design one.
- **Single-turn premise extraction.** No multi-hop reasoning over chained
  assumptions.

## Known limitations

- Observation date is taken from the line, conflating *when it was recorded*
  with *when it became true*. A full bitemporal model separates those; this one
  collapses them — fine for timelines, wrong for backdated records.
- Corroboration is a count, not a weight. Ten copies of one rumour outrank one
  primary source.
- A genuinely multi-valued property (two owners at once) reads as a conflict.

## Layout

```
lib/engine.ts      the four rules — this file is the product
lib/query.ts       now / as-of / premise checking
lib/state.ts       the single reducer the UI renders
lib/gemini.ts      model client, server-only, no retries
lib/prompts.ts     both prompts — narrow on purpose
fixtures/          synthetic demo packet, pre-extracted
components/        presentational only
```

## Stack

Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript 5.9, Vitest 4.1.
No CSS framework, no UI library, no date library.
