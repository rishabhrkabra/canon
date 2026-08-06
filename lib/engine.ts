/**
 * Canon — the deterministic truth engine.
 *
 * THIS FILE IS THE PRODUCT. The language model's entire job is to nominate
 * candidate observations from text. Every decision about what is *true* — what
 * supersedes what, what is merely history, what is genuinely contradictory —
 * happens here, in code you can read and test. No model output reaches truth
 * state without passing through these rules.
 *
 * The model in one sentence: **an observation of value V on date D is a claim
 * about what held on D**, so it is judged against whatever the engine already
 * believes held on D — not against whatever happens to be current.
 *
 * That one framing decides all five outcomes:
 *
 *   nothing known for that pair        → ADD
 *   the fact in force on D has value V → DUPLICATE   corroborate, don't insert
 *   a fact starts exactly on D, V≠     → CONFLICT    both suspect; refuse
 *   the fact in force on D has V′≠V    → SUPERSEDE   it closes on D, V takes over
 *   D precedes everything we know      → BACKFILL    insert history, born closed
 *
 * Supersede and backfill are the same operation seen from different points on
 * the timeline: a value starts on D and runs until the next thing we know
 * about. Writing them as one rule is what makes late-arriving evidence safe —
 * and an earlier version of this file, which reasoned about "the live fact"
 * instead of "the fact in force on D", got three cases wrong because of it:
 * a value returning to a previous value was silently swallowed as
 * corroboration, and two backfills in a row left overlapping intervals.
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

const ISO_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A real calendar day, not merely digits in the right places. `2026-02-30`
 * matches the shape and does not exist; letting it through would put a fact on
 * a day that never happened.
 *
 * This is the one place a Date object is allowed. It is used to count days in
 * a month, never to compare or render — comparison stays lexicographic on the
 * string, so no timezone can shift a fact onto the wrong day.
 */
export function isIsoDate(v: unknown): v is IsoDate {
  if (typeof v !== 'string') return false;
  const m = ISO_SHAPE.exec(v);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
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
    // A receipt must actually cite something. An empty span and a line number
    // of 0, -3 or 1.5 are all "well-formed" to a loose check and all name no
    // evidence — which is the failure this product exists to prevent.
    typeof c.sourceSpan === 'string' && c.sourceSpan.trim().length > 0 &&
    typeof c.sourceLine === 'number' && Number.isInteger(c.sourceLine) &&
    c.sourceLine > 0
  );
}

/**
 * Prove each receipt actually exists in the source text.
 *
 * Type-checking `sourceLine` and `sourceSpan` only proves the model returned
 * strings of the right shape. It does not prove the line exists, or that the
 * quoted words appear on it. A citation that cannot be found in the source is
 * the same failure this product exists to prevent — so candidates that fail
 * are dropped, with a reason, rather than displayed as evidence.
 */
export function verifyReceipts(
  candidates: readonly Candidate[],
  sourceText: string,
): { verified: Candidate[]; rejected: { candidate: Candidate; reason: string }[] } {
  const lines = sourceText.split('\n');
  const verified: Candidate[] = [];
  const rejected: { candidate: Candidate; reason: string }[] = [];
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

  for (const c of candidates) {
    const line = lines[c.sourceLine - 1];
    if (line === undefined) {
      rejected.push({ candidate: c, reason: `cites line ${c.sourceLine}, which does not exist` });
      continue;
    }
    if (!c.sourceSpan.trim()) {
      rejected.push({ candidate: c, reason: 'cites no text at all' });
      continue;
    }
    if (!norm(line).includes(norm(c.sourceSpan))) {
      rejected.push({
        candidate: c,
        reason: `quotes "${c.sourceSpan}", which does not appear on line ${c.sourceLine}`,
      });
      continue;
    }
    if (!line.trimStart().startsWith(c.observedAt)) {
      rejected.push({
        candidate: c,
        reason: `dated ${c.observedAt}, but line ${c.sourceLine} is not that date`,
      });
      continue;
    }
    verified.push(c);
  }
  return { verified, rejected };
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
    const D = c.observedAt;

    // ---- ADD: nothing has ever been claimed about this pair.
    if (siblings.length === 0) {
      const created = newFact(c);
      facts.push(created);
      records.push({
        outcome: 'added',
        candidate: c,
        factId: created.id,
        reason: `First observation of ${c.entity} · ${c.property}, from line ${c.sourceLine}.`,
      });
      continue;
    }

    // ---- Same-day claims. Nothing in the evidence orders these.
    const sameDay = siblings.filter((f) => f.validFrom === D);
    if (sameDay.length > 0) {
      const agrees = sameDay.find((f) => sameValue(f.value, c.value));
      if (agrees) {
        agrees.corroborations += 1;
        records.push({
          outcome: 'duplicate',
          candidate: c,
          relatedFactId: agrees.id,
          reason: `Already recorded from line ${agrees.sourceLine}; counted as corroboration (${agrees.corroborations} observations).`,
        });
        continue;
      }
      const created = newFact(c, {
        status: 'conflicted',
        validUntil: sameDay[0].validUntil,
        conflictsWith: sameDay.map((f) => f.id),
      });
      for (const f of sameDay) {
        f.status = 'conflicted';
        f.conflictsWith = [...(f.conflictsWith ?? []), created.id];
      }
      facts.push(created);
      records.push({
        outcome: 'conflict',
        candidate: c,
        factId: created.id,
        relatedFactId: sameDay[0].id,
        reason: `Line ${c.sourceLine} says "${c.value}" but line ${sameDay[0].sourceLine} says "${sameDay[0].value}", both observed ${D}. Nothing orders them, so neither is treated as true.`,
      });
      continue;
    }

    // ---- What the engine currently believes held on D. More than one only
    // when D falls inside an unresolved conflict, which is why this is a list.
    const inForce = siblings.filter(
      (f) => f.validFrom < D && (f.validUntil === undefined || D < f.validUntil),
    );

    // Repeating one side of an unresolved contradiction is NOT corroboration —
    // it is a resolution. If the record says both green and red on the 20th,
    // then "green" on the 21st settles the present; treating it as another
    // vote for the historical green leaves the pair conflicted forever.
    const unresolvedConflict =
      inForce.length > 1 || inForce.some((f) => f.status === 'conflicted');

    const agrees = unresolvedConflict
      ? undefined
      : inForce.find((f) => sameValue(f.value, c.value));
    if (agrees) {
      agrees.corroborations += 1;
      records.push({
        outcome: 'duplicate',
        candidate: c,
        relatedFactId: agrees.id,
        reason: `Same value as line ${agrees.sourceLine}, still holding on ${D}; counted as corroboration (${agrees.corroborations} observations).`,
      });
      continue;
    }

    // The next thing we already know about, if any. The new value runs until
    // then — this is what makes a second backfill land in the right slot
    // instead of overlapping the first.
    const laterStarts = siblings
      .filter((f) => f.validFrom > D)
      .map((f) => f.validFrom)
      .sort();
    const successorStart: IsoDate | undefined = laterStarts[0];
    const successors = successorStart
      ? siblings.filter((f) => f.validFrom === successorStart)
      : [];

    const created = newFact(c, {
      status: successorStart ? 'superseded' : 'active',
      validUntil: successorStart,
      supersedes: inForce[0]?.id,
      supersededBy: successors[0]?.id,
    });

    // Everything that used to cover D now stops there.
    for (const f of inForce) {
      f.validUntil = D;
      if (f.status !== 'conflicted') f.status = 'superseded';
      f.supersededBy = created.id;
    }
    for (const s of successors) s.supersedes = created.id;

    facts.push(created);

    if (inForce.length === 0) {
      records.push({
        outcome: 'backfilled',
        candidate: c,
        factId: created.id,
        relatedFactId: successors[0]?.id,
        reason: `Line ${c.sourceLine} describes ${D}, earlier than anything already recorded. Filed as history: "${c.value}" held until ${successorStart}. The current value is unchanged.`,
      });
    } else if (successorStart) {
      records.push({
        outcome: 'backfilled',
        candidate: c,
        factId: created.id,
        relatedFactId: inForce[0].id,
        reason: `Line ${c.sourceLine} describes ${D}, which falls inside what we already knew. "${inForce[0].value}" now ends on ${D}, "${c.value}" runs until ${successorStart}, and the current value is unchanged.`,
      });
    } else if (unresolvedConflict) {
      records.push({
        outcome: 'superseded',
        candidate: c,
        factId: created.id,
        relatedFactId: inForce[0].id,
        reason: `Line ${c.sourceLine} observed "${c.value}" on ${D}, after the unresolved ${inForce[0].validFrom} contradiction (${inForce.map((f) => `"${f.value}"`).join(' vs ')}). That settles the present as "${c.value}"; the contradiction stays on the record as history.`,
      });
    } else {
      records.push({
        outcome: 'superseded',
        candidate: c,
        factId: created.id,
        relatedFactId: inForce[0].id,
        reason: `"${inForce[0].value}" held from ${inForce[0].validFrom} until ${D}, when line ${c.sourceLine} replaced it with "${c.value}".`,
      });
    }
  }

  return { facts, records };
}

/** Convenience for building state from scratch (fixtures, tests, first paste). */
export function buildFacts(candidates: readonly Candidate[]): ApplyResult {
  return applyCandidates([], candidates);
}
