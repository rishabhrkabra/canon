/**
 * AsOf — the deterministic truth engine.
 *
 * THIS FILE IS THE PRODUCT. The language model's entire job is to nominate
 * candidate observations from text. Every decision about what is *true* — what
 * supersedes what, what is merely history, what is genuinely contradictory —
 * happens here, in code you can read and test. No model output reaches truth
 * state without passing through these rules.
 *
 * The four rules, for one (entity, property) pair:
 *
 *   same value                    → DUPLICATE   corroborate, don't insert
 *   different value, later date   → SUPERSEDE   old closes at the new date
 *   different value, same date    → CONFLICT    both suspect; refuse to answer
 *   different value, earlier date → BACKFILL    insert into history, born closed
 *
 * The last one is the rule most systems get wrong. Evidence does not arrive in
 * chronological order. Learning on Tuesday what was true last Monday must
 * change *history*, not the present.
 */

import type {
  ApplyRecord,
  ApplyResult,
  Candidate,
  Fact,
  IsoDate,
} from './types';

/** FNV-1a. Deterministic ids: same input, same id, every run and every reload. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function factId(c: Candidate): string {
  return `f_${hash(`${c.entity}|${c.property}|${c.value}|${c.observedAt}`)}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(v: unknown): v is IsoDate {
  return typeof v === 'string' && ISO.test(v);
}

/** Case- and whitespace-insensitive key. Entity names are canonical by design. */
function key(entity: string, property: string): string {
  return `${entity.trim().toLowerCase()}::${property.trim().toLowerCase()}`;
}

function sameValue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Reject anything malformed BEFORE it can touch truth state. The model is
 * untrusted input, exactly like a form post — schema-constrained output is a
 * strong hint, not a guarantee.
 */
export function isValidCandidate(v: unknown): v is Candidate {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.entity === 'string' && c.entity.trim().length > 0 &&
    typeof c.property === 'string' && c.property.trim().length > 0 &&
    typeof c.value === 'string' && c.value.trim().length > 0 &&
    isIsoDate(c.observedAt) &&
    typeof c.sourceSpan === 'string' &&
    typeof c.sourceLine === 'number' && Number.isFinite(c.sourceLine)
  );
}

function newFact(c: Candidate, over: Partial<Fact> = {}): Fact {
  return {
    id: factId(c),
    entity: c.entity.trim(),
    property: c.property.trim(),
    value: c.value.trim(),
    observedAt: c.observedAt,
    validFrom: c.observedAt,
    status: 'active',
    corroborations: 1,
    sourceSpan: c.sourceSpan,
    sourceLine: c.sourceLine,
    ...over,
  };
}

/**
 * Apply candidates to a fact table, returning a NEW table plus a record of
 * every decision. Pure: same inputs, same outputs, no clock, no randomness —
 * which is what makes the whole thing testable and replayable.
 *
 * Candidates are sorted by observedAt first so a paste containing out-of-order
 * lines produces the same state as the same lines pasted chronologically.
 * Order of evidence arrival must not change what is true.
 */
export function applyCandidates(
  existing: readonly Fact[],
  candidates: readonly Candidate[],
): ApplyResult {
  const facts: Fact[] = existing.map((f) => ({ ...f }));
  const records: ApplyRecord[] = [];

  const ordered = [...candidates]
    .filter(isValidCandidate)
    .sort((a, b) =>
      a.observedAt === b.observedAt
        ? a.sourceLine - b.sourceLine
        : a.observedAt < b.observedAt ? -1 : 1,
    );

  for (const c of ordered) {
    const k = key(c.entity, c.property);
    const siblings = facts.filter((f) => key(f.entity, f.property) === k);

    // ---- DUPLICATE: the same claim again. Corroboration, not a new fact.
    const same = siblings.find((f) => sameValue(f.value, c.value));
    if (same) {
      same.corroborations += 1;
      records.push({
        outcome: 'duplicate',
        candidate: c,
        relatedFactId: same.id,
        reason: `Already recorded from line ${same.sourceLine}; counted as corroboration (${same.corroborations} observations).`,
      });
      continue;
    }

    // ---- CONFLICT: a different value observed on the SAME day.
    // Nothing in the evidence orders these, so the engine refuses to pick.
    // Note it checks live (non-superseded) siblings only — a value that was
    // already replaced cannot newly conflict with anything.
    const sameDay = siblings.find(
      (f) => f.observedAt === c.observedAt && f.status !== 'superseded',
    );
    if (sameDay) {
      const created = newFact(c, {
        status: 'conflicted',
        conflictsWith: [sameDay.id],
      });
      sameDay.status = 'conflicted';
      sameDay.conflictsWith = [...(sameDay.conflictsWith ?? []), created.id];
      facts.push(created);
      records.push({
        outcome: 'conflict',
        candidate: c,
        factId: created.id,
        relatedFactId: sameDay.id,
        reason: `Line ${c.sourceLine} says "${c.value}" but line ${sameDay.sourceLine} says "${sameDay.value}", both observed ${c.observedAt}. Nothing orders them, so neither is treated as true.`,
      });
      continue;
    }

    // The newest thing we currently believe for this (entity, property).
    const live = siblings
      .filter((f) => f.status === 'active')
      .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];

    // ---- SUPERSEDE: a different, later value replaces the live one.
    if (live && c.observedAt > live.validFrom) {
      const created = newFact(c, { supersedes: live.id });
      live.status = 'superseded';
      live.validUntil = c.observedAt; // exclusive: not true on the changeover day
      live.supersededBy = created.id;
      facts.push(created);
      records.push({
        outcome: 'superseded',
        candidate: c,
        factId: created.id,
        relatedFactId: live.id,
        reason: `"${live.value}" held from ${live.validFrom} until ${c.observedAt}, when line ${c.sourceLine} replaced it with "${c.value}".`,
      });
      continue;
    }

    // ---- BACKFILL: evidence about the PAST, arriving late.
    // It is inserted already closed — it was true then, and the value we
    // already hold took over at its own start date. History changes; now does not.
    if (live && c.observedAt < live.validFrom) {
      const created = newFact(c, {
        status: 'superseded',
        validUntil: live.validFrom,
        supersededBy: live.id,
      });
      live.supersedes = created.id;
      facts.push(created);
      records.push({
        outcome: 'backfilled',
        candidate: c,
        factId: created.id,
        relatedFactId: live.id,
        reason: `Line ${c.sourceLine} describes ${c.observedAt}, earlier than what we already knew. Recorded as history: "${c.value}" held until ${live.validFrom}. The current value is unchanged.`,
      });
      continue;
    }

    // ---- ADD: first thing we have ever heard about this pair.
    const created = newFact(c);
    facts.push(created);
    records.push({
      outcome: 'added',
      candidate: c,
      factId: created.id,
      reason: `First observation of ${c.entity} · ${c.property}, from line ${c.sourceLine}.`,
    });
  }

  return { facts, records };
}

/** Convenience for building state from scratch (fixtures, tests, first paste). */
export function buildFacts(candidates: readonly Candidate[]): ApplyResult {
  return applyCandidates([], candidates);
}
