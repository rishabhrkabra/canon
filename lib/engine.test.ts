import { describe, it, expect } from 'vitest';
import { applyCandidates, buildFacts, isValidCandidate } from './engine';
import type { Candidate } from './types';

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

describe('supersede', () => {
  it('closes the old value at the new date and links both ways', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
    ]);
    const jay = facts.find((f) => f.value === 'Jay')!;
    const neha = facts.find((f) => f.value === 'Neha')!;

    expect(jay.status).toBe('superseded');
    expect(jay.validFrom).toBe('2026-07-01');
    expect(jay.validUntil).toBe('2026-07-28'); // exclusive
    expect(jay.supersededBy).toBe(neha.id);

    expect(neha.status).toBe('active');
    expect(neha.validFrom).toBe('2026-07-28');
    expect(neha.validUntil).toBeUndefined();
    expect(neha.supersedes).toBe(jay.id);
  });

  it('handles a three-step chain with exactly one active fact', () => {
    const { facts } = buildFacts([
      c('Atlas', 'launch', '2026-08-15', '2026-07-01', 1),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
      c('Atlas', 'launch', '2026-09-19', '2026-08-02', 3),
    ]);
    expect(facts.filter((f) => f.status === 'active')).toHaveLength(1);
    expect(facts.find((f) => f.status === 'active')!.value).toBe('2026-09-19');
    expect(facts.find((f) => f.value === '2026-08-15')!.validUntil).toBe('2026-07-20');
    expect(facts.find((f) => f.value === '2026-09-05')!.validUntil).toBe('2026-08-02');
  });

  it('is order-independent: shuffled input produces the same truth', () => {
    const lines = [
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 3),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
    ];
    const forward = buildFacts(lines).facts;
    const shuffled = buildFacts([lines[2], lines[0], lines[1]]).facts;
    const shape = (fs: typeof forward) =>
      fs.map((f) => `${f.property}=${f.value}:${f.status}:${f.validFrom}-${f.validUntil ?? ''}`).sort();
    expect(shape(shuffled)).toEqual(shape(forward));
  });
});

describe('conflict', () => {
  it('marks BOTH sides conflicted when values clash on the same day', () => {
    const { facts, records } = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-25', 4),
      c('Atlas', 'status', 'red', '2026-07-25', 5),
    ]);
    expect(facts).toHaveLength(2);
    expect(facts.every((f) => f.status === 'conflicted')).toBe(true);
    expect(facts[0].conflictsWith).toContain(facts[1].id);
    expect(facts[1].conflictsWith).toContain(facts[0].id);
    expect(records.at(-1)!.outcome).toBe('conflict');
  });

  it('does not conflict with a value that was already superseded', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
      c('Atlas', 'owner', 'Priya', '2026-07-28', 3), // clashes with Neha only
    ]);
    expect(facts.find((f) => f.value === 'Jay')!.status).toBe('superseded');
    expect(facts.find((f) => f.value === 'Neha')!.status).toBe('conflicted');
    expect(facts.find((f) => f.value === 'Priya')!.status).toBe('conflicted');
  });
});

describe('backfill — late evidence about the past', () => {
  // Within ONE paste, candidates are sorted chronologically first, so an
  // out-of-order line is simply applied in order and supersedes normally.
  // Backfill is specifically the CROSS-PASTE case: state already exists, and
  // new evidence describes a time before it. That is the case that must not
  // disturb the present.
  it('within a single paste, an out-of-order line still supersedes correctly', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Neha', '2026-07-28', 1),
      c('Atlas', 'owner', 'Jay', '2026-07-01', 2),
    ]);
    expect(facts.find((f) => f.value === 'Jay')!.validUntil).toBe('2026-07-28');
    expect(facts.find((f) => f.value === 'Neha')!.status).toBe('active');
  });

  it('inserts closed history without disturbing the present', () => {
    const first = buildFacts([c('Atlas', 'owner', 'Neha', '2026-07-28', 1)]).facts;
    const { facts, records } = applyCandidates(first, [
      c('Atlas', 'owner', 'Jay', '2026-07-01', 2), // learned later, happened earlier
    ]);
    const jay = facts.find((f) => f.value === 'Jay')!;
    const neha = facts.find((f) => f.value === 'Neha')!;

    expect(records.at(-1)!.outcome).toBe('backfilled');
    expect(jay.status).toBe('superseded');    // born closed
    expect(jay.validFrom).toBe('2026-07-01');
    expect(jay.validUntil).toBe('2026-07-28');
    expect(jay.supersededBy).toBe(neha.id);
    expect(neha.status).toBe('active');       // present untouched
    expect(neha.validUntil).toBeUndefined();
    expect(neha.supersedes).toBe(jay.id);
  });
});

describe('duplicate', () => {
  it('corroborates instead of inserting a second copy', () => {
    const { facts, records } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'jay', '2026-07-14', 2), // same value, different case
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].corroborations).toBe(2);
    expect(records.at(-1)!.outcome).toBe('duplicate');
  });
});

describe('validation and purity', () => {
  it('rejects malformed model output before it reaches truth state', () => {
    expect(isValidCandidate({ ...c('A', 'b', 'v', '2026-07-01'), observedAt: '20 July' })).toBe(false);
    expect(isValidCandidate({ ...c('A', 'b', 'v', '2026-07-01'), entity: '' })).toBe(false);
    expect(isValidCandidate(null)).toBe(false);
    const { facts } = buildFacts([
      { entity: 'Atlas', property: 'owner', value: 'Jay', observedAt: 'yesterday', sourceSpan: '', sourceLine: 1 } as never,
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe('Neha');
  });

  it('does not mutate the fact table it was given', () => {
    const first = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts;
    const snapshot = JSON.stringify(first);
    applyCandidates(first, [c('Atlas', 'owner', 'Neha', '2026-07-28', 2)]);
    expect(JSON.stringify(first)).toBe(snapshot);
  });

  it('produces stable ids across runs', () => {
    const a = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts[0].id;
    const b = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts[0].id;
    expect(a).toBe(b);
  });
});
