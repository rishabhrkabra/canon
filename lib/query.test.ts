import { describe, it, expect } from 'vitest';
import { buildFacts } from './engine';
import {
  checkPremise,
  hasBlockingPremise,
  holdsOn,
  queryAsOf,
  queryNow,
} from './query';
import type { Candidate, Premise } from './types';

const c = (
  entity: string,
  property: string,
  value: string,
  observedAt: string,
  sourceLine = 1,
): Candidate => ({
  entity, property, value, observedAt, sourceLine,
  sourceSpan: `${observedAt}: ${entity} ${property} ${value}`,
});

const p = (entity: string, property: string, assumedValue: string): Premise => ({
  entity, property, assumedValue, sourceSpan: `assumes ${assumedValue}`,
});

/** Jay owned Atlas from 01 Jul; Neha took over 28 Jul. */
const owners = buildFacts([
  c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
  c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
]).facts;

describe('holdsOn — half-open [validFrom, validUntil)', () => {
  const jay = owners.find((f) => f.value === 'Jay')!;

  it('includes the start date', () => {
    expect(holdsOn(jay, '2026-07-01')).toBe(true);
  });

  it('EXCLUDES the end date — a value replaced on the 28th is not true on the 28th', () => {
    expect(holdsOn(jay, '2026-07-27')).toBe(true);
    expect(holdsOn(jay, '2026-07-28')).toBe(false);
  });

  it('excludes dates before it began', () => {
    expect(holdsOn(jay, '2026-06-30')).toBe(false);
  });

  it('an open interval holds forever forward', () => {
    const neha = owners.find((f) => f.value === 'Neha')!;
    expect(holdsOn(neha, '2027-01-01')).toBe(true);
  });
});

describe('queryNow', () => {
  it('returns the live value with a citation', () => {
    const r = queryNow(owners, 'Atlas', 'owner');
    expect(r.verdict).toBe('known');
    expect(r.value).toBe('Neha');
    expect(r.citations).toHaveLength(1);
    expect(r.citations[0].sourceLine).toBe(2);
  });

  it('matches entity and property case-insensitively', () => {
    expect(queryNow(owners, 'atlas', 'OWNER').value).toBe('Neha');
  });

  it('says unknown — with no citation — for something never observed', () => {
    const r = queryNow(owners, 'Atlas', 'budget');
    expect(r.verdict).toBe('unknown');
    expect(r.citations).toEqual([]);
  });

  it('refuses to pick a side when evidence conflicts, and cites both', () => {
    const facts = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-25', 4),
      c('Atlas', 'status', 'red', '2026-07-25', 5),
    ]).facts;
    const r = queryNow(facts, 'Atlas', 'status');
    expect(r.verdict).toBe('conflicted');
    expect(r.value).toBeUndefined();     // no value is reported
    expect(r.citations).toHaveLength(2); // both sides shown
    expect(r.explanation).toContain('green');
    expect(r.explanation).toContain('red');
  });
});

describe('queryAsOf — history is preserved, not overwritten', () => {
  it('answers a past date with the value that held then', () => {
    const r = queryAsOf(owners, 'Atlas', 'owner', '2026-07-10');
    expect(r.verdict).toBe('known');
    expect(r.value).toBe('Jay');           // not Neha — this is the whole point
    expect(r.citations[0].validUntil).toBe('2026-07-28');
  });

  it('is exclusive at the changeover: the 28th is already Neha', () => {
    expect(queryAsOf(owners, 'Atlas', 'owner', '2026-07-27').value).toBe('Jay');
    expect(queryAsOf(owners, 'Atlas', 'owner', '2026-07-28').value).toBe('Neha');
  });

  it('returns unknown before any evidence exists, and says why', () => {
    const r = queryAsOf(owners, 'Atlas', 'owner', '2026-06-01');
    expect(r.verdict).toBe('unknown');
    expect(r.explanation).toContain('2026-07-01');
  });

  it('walks a three-step chain to the right rung', () => {
    const launch = buildFacts([
      c('Atlas', 'launch', '2026-08-15', '2026-07-01', 1),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
      c('Atlas', 'launch', '2026-09-19', '2026-08-02', 3),
    ]).facts;
    expect(queryAsOf(launch, 'Atlas', 'launch', '2026-07-05').value).toBe('2026-08-15');
    expect(queryAsOf(launch, 'Atlas', 'launch', '2026-07-25').value).toBe('2026-09-05');
    expect(queryNow(launch, 'Atlas', 'launch').value).toBe('2026-09-19');
  });
});

describe('checkPremise — the linter', () => {
  it('passes a premise that still holds', () => {
    const r = checkPremise(owners, p('Atlas', 'owner', 'Neha'));
    expect(r.verdict).toBe('current');
    expect(r.currentValue).toBe('Neha');
  });

  it('REJECTS a stale premise and cites the fact that replaced it', () => {
    const r = checkPremise(owners, p('Atlas', 'owner', 'Jay'));
    expect(r.verdict).toBe('stale');
    expect(r.currentValue).toBe('Neha');
    expect(r.supersededBy!.value).toBe('Neha');
    expect(r.explanation).toContain('2026-07-28'); // when it stopped being true
  });

  it('names the fact that actually replaced it, not merely the current one', () => {
    // Three-step chain: the assumed value was replaced by the MIDDLE rung, and
    // the chain moved on again after that. Describing the last rung as the
    // thing that closed the first would be a false account of the handover —
    // the exact error this product exists to catch.
    const launch = buildFacts([
      c('Atlas', 'launch', '2026-08-15', '2026-07-01', 1),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
      c('Atlas', 'launch', '2026-09-19', '2026-08-02', 3),
    ]).facts;
    const r = checkPremise(launch, p('Atlas', 'launch', '2026-08-15'));

    expect(r.verdict).toBe('stale');
    expect(r.currentValue).toBe('2026-09-19');
    // The handover it describes: closed on 07-20 by line 2, value 2026-09-05.
    expect(r.explanation).toContain('until 2026-07-20');
    expect(r.explanation).toContain('line 2 replaced it with "2026-09-05"');
    // And it must still surface where things stand today.
    expect(r.explanation).toContain('changed again');
    expect(r.explanation).toContain('"2026-09-19"');
    // What it must NOT claim: that line 3 was the one that closed 2026-08-15.
    expect(r.explanation).not.toContain('line 3 replaced it');
  });

  it('cites the most recent stint when a value held more than once', () => {
    // A -> B -> A -> C. The assumption "A" almost certainly refers to the
    // recent stint; dating it to the first one describes a period that ended
    // three weeks earlier and reads as a different claim entirely.
    const repeated = buildFacts([
      c('Atlas', 'owner', 'A', '2026-07-01', 1),
      c('Atlas', 'owner', 'B', '2026-07-10', 2),
      c('Atlas', 'owner', 'A', '2026-07-20', 3),
      c('Atlas', 'owner', 'C', '2026-07-30', 4),
    ]).facts;
    const r = checkPremise(repeated, p('Atlas', 'owner', 'A'));
    expect(r.verdict).toBe('stale');
    expect(r.explanation).toContain('2026-07-20');
    expect(r.explanation).toContain('until 2026-07-30');
    expect(r.explanation).not.toContain('from 2026-07-01');
  });

  it('separates "never knew" from "knew, and it expired"', () => {
    const never = checkPremise(owners, p('Atlas', 'budget', '10L'));
    expect(never.verdict).toBe('unknown');
    expect(never.supersededBy).toBeUndefined();

    const expired = checkPremise(owners, p('Atlas', 'owner', 'Jay'));
    expect(expired.verdict).toBe('stale');
    expect(expired.supersededBy).toBeDefined();
  });

  it('will not validate a premise sitting on contradictory evidence', () => {
    const facts = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-25', 4),
      c('Atlas', 'status', 'red', '2026-07-25', 5),
    ]).facts;
    expect(checkPremise(facts, p('Atlas', 'status', 'green')).verdict).toBe('conflicted');
  });

  it('blocks the draft if ANY premise is unsafe', () => {
    const allGood = [checkPremise(owners, p('Atlas', 'owner', 'Neha'))];
    const oneStale = [...allGood, checkPremise(owners, p('Atlas', 'owner', 'Jay'))];
    expect(hasBlockingPremise(allGood)).toBe(false);
    expect(hasBlockingPremise(oneStale)).toBe(true);
  });
});
