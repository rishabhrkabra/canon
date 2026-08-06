/**
 * AsOf — temporal queries and premise checking.
 *
 * Three answers, not two. Most systems can say "X" or "I don't know". The one
 * that matters here is the third: **"I had evidence, and it is no longer
 * usable"** — stale, or contradicted. A system that cannot distinguish
 * "never knew" from "knew, and it expired" will confidently act on expired
 * facts, which is the entire failure this product exists to catch.
 *
 * Every answer carries its citations. An answer without a receipt is a guess.
 */

import type {
  Fact,
  IsoDate,
  Premise,
  PremiseCheck,
  QueryResult,
} from './types';

function key(entity: string, property: string): string {
  return `${entity.trim().toLowerCase()}::${property.trim().toLowerCase()}`;
}

function siblingsOf(facts: readonly Fact[], entity: string, property: string): Fact[] {
  const k = key(entity, property);
  return facts.filter((f) => key(f.entity, f.property) === k);
}

/**
 * Does a fact hold on `date`? Half-open interval `[validFrom, validUntil)`.
 * The exclusivity is deliberate: a value replaced on the 20th is NOT true on
 * the 20th. Both boundary cases are pinned in query.test.ts.
 */
export function holdsOn(fact: Fact, date: IsoDate): boolean {
  if (date < fact.validFrom) return false;
  if (fact.validUntil !== undefined && date >= fact.validUntil) return false;
  return true;
}

/** What is true now, per the evidence we hold. */
export function queryNow(
  facts: readonly Fact[],
  entity: string,
  property: string,
): QueryResult {
  const siblings = siblingsOf(facts, entity, property);
  const base = { entity, property } as const;

  if (siblings.length === 0) {
    return {
      ...base,
      verdict: 'unknown',
      citations: [],
      explanation: `No evidence recorded for ${entity} · ${property}.`,
    };
  }

  const conflicted = siblings.filter((f) => f.status === 'conflicted');
  if (conflicted.length > 0) {
    return {
      ...base,
      verdict: 'conflicted',
      citations: conflicted,
      explanation:
        `Contradictory evidence, all observed ${conflicted[0].observedAt}: ` +
        conflicted.map((f) => `"${f.value}" (line ${f.sourceLine})`).join(' vs ') +
        `. Nothing in the evidence resolves this, so no value is reported.`,
    };
  }

  const active = siblings.filter((f) => f.status === 'active');
  if (active.length === 0) {
    // Everything we knew has been closed and nothing replaced it — the
    // "knew, and it expired" case that a two-answer system cannot express.
    const latest = [...siblings].sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
    return {
      ...base,
      verdict: 'unknown',
      citations: [latest],
      explanation:
        `Last known value was "${latest.value}", which stopped applying on ` +
        `${latest.validUntil}. Nothing has replaced it, so the current value is unknown.`,
    };
  }

  const current = active.sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
  return {
    ...base,
    verdict: 'known',
    value: current.value,
    citations: [current],
    explanation:
      `"${current.value}" since ${current.validFrom}` +
      (current.corroborations > 1 ? `, corroborated ${current.corroborations}×` : '') +
      ` (line ${current.sourceLine}).`,
  };
}

/**
 * What was true on a given date. Answering this correctly — without
 * overwriting history — is the difference between a memory store and a
 * temporal one.
 */
export function queryAsOf(
  facts: readonly Fact[],
  entity: string,
  property: string,
  date: IsoDate,
): QueryResult {
  const siblings = siblingsOf(facts, entity, property);
  const base = { entity, property } as const;

  if (siblings.length === 0) {
    return {
      ...base,
      verdict: 'unknown',
      citations: [],
      explanation: `No evidence recorded for ${entity} · ${property}.`,
    };
  }

  const holding = siblings.filter((f) => holdsOn(f, date));

  const conflicted = holding.filter((f) => f.status === 'conflicted');
  if (conflicted.length > 0) {
    return {
      ...base,
      verdict: 'conflicted',
      citations: conflicted,
      explanation:
        `On ${date} the evidence contradicts itself: ` +
        conflicted.map((f) => `"${f.value}" (line ${f.sourceLine})`).join(' vs ') + '.',
    };
  }

  if (holding.length === 0) {
    const earliest = [...siblings].sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))[0];
    return {
      ...base,
      verdict: 'unknown',
      citations: [earliest],
      explanation:
        date < earliest.validFrom
          ? `No evidence covers ${date}; the earliest observation is ${earliest.validFrom}.`
          : `No recorded value covers ${date}.`,
    };
  }

  const at = holding.sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
  return {
    ...base,
    verdict: 'known',
    value: at.value,
    citations: [at],
    explanation:
      `On ${date}, "${at.value}" — held from ${at.validFrom}` +
      (at.validUntil ? ` until ${at.validUntil}` : ' and still current') +
      ` (line ${at.sourceLine}).`,
  };
}

/**
 * Check the assumptions buried inside a question.
 *
 * This is the linter's sharp end. "Remind Jay to ship Atlas by Aug 15" carries
 * two claims — Jay owns it, the date is Aug 15 — and a naive agent will act on
 * both without noticing either. Each premise gets checked against truth state,
 * and a stale one is rejected WITH the fact that replaced it.
 */
export function checkPremise(facts: readonly Fact[], premise: Premise): PremiseCheck {
  const now = queryNow(facts, premise.entity, premise.property);
  const matches = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

  if (now.verdict === 'conflicted') {
    return {
      premise,
      verdict: 'conflicted',
      citations: now.citations,
      explanation:
        `"${premise.assumedValue}" cannot be confirmed — the evidence for ` +
        `${premise.entity} · ${premise.property} contradicts itself.`,
    };
  }

  if (now.verdict === 'unknown') {
    return {
      premise,
      verdict: 'unknown',
      explanation:
        `No usable current evidence for ${premise.entity} · ${premise.property}, ` +
        `so "${premise.assumedValue}" cannot be confirmed.`,
    };
  }

  if (matches(now.value!, premise.assumedValue)) {
    return {
      premise,
      verdict: 'current',
      currentValue: now.value,
      explanation: `Still true: ${now.explanation}`,
    };
  }

  // The headline case: the question assumes something that USED to be true.
  const assumed = siblingsOf(facts, premise.entity, premise.property).find((f) =>
    matches(f.value, premise.assumedValue),
  );
  const replacement = now.citations[0];

  return {
    premise,
    verdict: 'stale',
    currentValue: now.value,
    supersededBy: replacement,
    explanation: assumed
      ? `"${premise.assumedValue}" was true from ${assumed.validFrom} until ` +
        `${assumed.validUntil}, when line ${replacement.sourceLine} changed it to ` +
        `"${now.value}". Acting on the old value would be wrong.`
      : `The evidence says "${now.value}" (line ${replacement.sourceLine}), not ` +
        `"${premise.assumedValue}".`,
  };
}

export function checkPremises(
  facts: readonly Fact[],
  premises: readonly Premise[],
): PremiseCheck[] {
  return premises.map((p) => checkPremise(facts, p));
}

/** True if any premise is unsafe to act on — the gate before drafting anything. */
export function hasBlockingPremise(checks: readonly PremiseCheck[]): boolean {
  return checks.some((c) => c.verdict !== 'current');
}
