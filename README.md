# Canon

**Stop your agent acting on facts that stopped being true.**

Agents don't only make things up. They act — confidently, fluently, with
citations — on facts that *used to be* true. Nothing about that output looks
like a hallucination, which is why it survives most checks.

Canon is not a memory store. It's the linter you bolt onto one. A language model
nominates candidate facts; a deterministic engine owns what is true; assumptions
that have expired get rejected with the evidence that replaced them.

> Built independently for the Razorpay AI Builders challenge, using synthetic
> data and no employer materials. "Project Atlas", "Project Borealis" and
> everyone in them are invented.

---

## See it break first

The deployed page opens with a two-minute experiment rather than a pitch:
download `public/project-atlas-log.md`, upload it to whichever AI you already
use, and ask four questions. Then ask Canon the same four.

The comparison is deliberately **not** something I wrote. An earlier version of
this page had a "without Canon" column filled with hand-written examples of what
a naive system returns — I wrote both sides of that, which is not evidence of
anything. Running the questions against your own model produces a before-state
I did not author, and the file you upload is byte-identical to the one the app
analyses (there is a test that fails if they ever drift apart).

Being straight about what you'll see: **some models get some of these right.**
That isn't the claim. The claim is that a right answer and a wrong one arrive
looking identical — fluent, sourced, confident — and nothing in the reply tells
you which are safe to act on.

### One recorded run — Gemini 3.1 Pro, 2026-08-07

One conversation, one model, one day. Not a benchmark. Kept because a real
result is worth more than an assertion, and it is reproducible with the file
and prompt above.

| Question | Result |
|---|---|
| Draft the reminder to Jay | **Knew, and did it anyway.** Wrote the message with the 15 August date, then added a note below saying Neha took over on 28 July and the launch is 19 September. |
| Who owned Atlas on 10 July | Right — Jay Menon, correct window. |
| Current status | **Wrong.** Answered "Red", reasoning no update had been logged since QA reported it. Never mentioned the weekly review said green the same day. Nothing in the file ranks one source over the other; the tiebreak was invented and reads exactly like evidence. |
| Headcount | Right — said the log doesn't give one. |

The first row is the one that matters, and it argues for this product better
than the failures do. The model *had* the right answer. It put it below the
draft, in prose. A human reading the whole reply catches it; an agent asked to
"draft this message" takes the message and drops the commentary. **A verdict is
machine-readable. A caveat is not.** That is the difference between a note and
a gate.

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

**Where Canon sits, stated accurately.** An earlier draft of this README
claimed that existing memory layers only solve recall and that temporal
validity was the differentiator. That was wrong, and worth correcting rather
than quietly deleting: [Zep](https://help.getzep.com/concepts) and
[Graphiti](https://github.com/getzep/graphiti) already model bi-temporal
validity, edge invalidation, and point-in-time queries. Building a temporal
store is not a novel claim.

What Canon does that a store does not is **gate an action**. A store answers
"what is true about Atlas." Canon takes the thing you are about to *do* —
"remind Jay about the 15 August launch" — pulls the claims hiding inside it,
checks each one against when it was true, and returns `ALLOW`,
`BLOCK_STALE`, `BLOCK_CONFLICT` or `NEEDS_EVIDENCE` with the receipt that
settles it. The temporal engine is the substrate; the verdict is the product.
It is a linter you point at an agent's next move, not a database you query.

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

## The gate

```
proposed action:  "Remind Jay that Atlas launches on 15 August."
   ↓  find the claims hiding inside it
premises:         Atlas.owner = "Jay Menon"   Atlas.launch = "2026-08-15"
   ↓  check each against WHEN it was true
verdict:          BLOCK_STALE
                  owner replaced 2026-07-28 by line 11 → Neha Rao
                  launch moved twice, now 2026-09-19 → line 12
corrected:        "Remind Neha Rao that Atlas launches on 2026-09-19."
```

| Verdict | When |
|---|---|
| `ALLOW` | Every claim still holds, each with its receipt |
| `BLOCK_STALE` | Something was true and has been replaced |
| `BLOCK_CONFLICT` | The evidence contradicts itself; no value can be confirmed |
| `NEEDS_EVIDENCE` | Nothing here is on record — silence isn't agreement |

The gate runs **entirely in the browser with no model and no network**. It finds
claims by matching values already on record, including dates written the way
people write them ("15 August", "Aug 15", "15/08/2026"). When an action names a
project, only that project's record is checked — so someone who changed teams
isn't flagged on the project they actually run now.

Its honest limit, stated in the UI as well as here: it cannot read an
assumption that never names anything on record. "Chase the usual person about
this" returns `NEEDS_EVIDENCE`, not approval. A language model widens what gets
*spotted*; it never decides the verdict.

## How the engine works

```
timeline text
   ↓  (LLM — nominate only)
candidates {entity, property, value, observedAt, sourceSpan, sourceLine}
   ↓  shape validation — malformed candidates dropped, never coerced
   ↓  receipt verification — line exists, quote is on it, date matches
deterministic engine
   ↓
fact table with half-open validity intervals [validFrom, validUntil)
   ↓
queries: now · as-of <date> · premise checks · the gate
```

**The model's entire job is to nominate candidates.** It never decides what is
true, what supersedes what, or what conflicts.

One rule decides everything: **an observation of value V on date D is a claim
about what held on D**, so it is judged against whatever the engine already
believes held on D — never against whatever happens to be current.

| Situation on D | Outcome |
|---|---|
| Nothing known for that pair | **add** |
| The fact in force on D has value V | **duplicate** — corroborate, don't insert |
| A fact starts exactly on D with a different value | **conflict** — both suspect, refuse |
| The fact in force on D has a different value | **supersede** — it closes on D, V takes over |
| D precedes everything known | **backfill** — insert history, born closed |

Supersede and backfill are the same operation seen from different points on the
timeline: a value starts on D and runs until the next thing already known.
Writing them as one rule is what makes late-arriving evidence safe.

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

## Three bugs an audit found, and what they were

An adversarial audit broke the engine three ways. Each was reproduced as a
failing test *before* anything was changed, and each now has a regression test.
They shared one root cause, which is why the fix was a reframing rather than
three patches: the engine judged a candidate against **the live fact** instead
of **the fact in force on that candidate's own date**.

1. **A value returning to an earlier value was silently swallowed.**
   Jay → Neha → Jay left Neha current, because the second Jay observation
   matched the old superseded Jay fact and was counted as corroboration.
2. **Two backfills produced overlapping intervals.** Importing 28 July, then
   1 July, then 15 July left two different values both claiming 20 July.
   A backfill closed at the *current* fact's start instead of at the next thing
   known.
3. **A resolved conflict poisoned the present forever.** Green and red clash on
   20 July, yellow settles it on 21 July — and "what is the status now" still
   answered `conflicted`, because any historical conflict counted.

Two more, in the same pass: `2026-02-30` passed date validation (regex shape,
no calendar check), and receipts were type-checked but never verified against
the source text.

## Works with no API key

The deployed demo is **fully functional with zero environment variables and
makes zero network calls**. The gate, every query, the time travel and the
conflict bin are all deterministic; the demo log's candidates are pre-extracted
into `fixtures/`.

This is a design requirement, not a convenience. The model is a replaceable
front-end to the engine, so nothing a reviewer needs to see should depend on it
being reachable. Exactly one feature needs `GEMINI_API_KEY` — reading *new*
prose you paste — and without it the UI says so plainly instead of implying an
outage.

Model calls go to `gemini-3.5-flash-lite` through AI SDK with a free-tier
Google AI Studio key. An earlier version routed through Vercel AI Gateway; that
was reverted because the gateway rejects every request without a card on file,
and this project has a hard no-spend rule. `Output.json()` only proves the
response parses as JSON — structure, receipts and meaning are still decided by
the validators and the engine.

Both model-backed routes are rate limited (8/min per caller). That limiter is
in-process, so it is a speed bump rather than a quota system — a real
deployment moves it to Redis. Written down rather than left implied.

## Running it

```bash
npm install
npm test        # 61 tests: engine, queries, the gate, demo end-to-end
npm run dev
```

Optional, for reading your own text — a free key from
[Google AI Studio](https://aistudio.google.com/apikey), no billing account
required:

```bash
echo "GEMINI_API_KEY=your-key" > .env.local
```

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
