import { describe, it, expect } from 'vitest';
import { demoState, reducer } from './state';
import type { Candidate } from './types';

const c = (
  entity: string,
  property: string,
  value: string,
  observedAt: string,
  sourceLine = 1,
): Candidate => ({
  entity, property, value, observedAt, sourceLine,
  sourceSpan: `${entity} ${property} ${value}`,
});

/**
 * The confirmation boundary. An audit proved the receipt verifier alone is not
 * a guarantee — "Atlas status is not compromised" contains the word
 * "compromised", and no string check reads negation. So extraction output is a
 * PROPOSAL, and these tests pin the only door into truth state.
 */
describe('proposals', () => {
  const propose = (mode: 'merge' | 'replace' = 'merge') =>
    reducer(demoState(), {
      type: 'propose',
      candidates: [c('Zephyr', 'owner', 'Mira Shah', '2026-08-06', 1)],
      rejected: [],
      mode,
    });

  it('proposing changes nothing in truth state', () => {
    const before = demoState();
    const after = propose();
    expect(after.facts).toEqual(before.facts);
    expect(after.proposal?.candidates).toHaveLength(1);
  });

  it('discarding leaves no trace', () => {
    const s = reducer(propose(), { type: 'discardProposal' });
    expect(s.proposal).toBeNull();
    expect(s.facts).toEqual(demoState().facts);
  });

  it('rejecting a single candidate removes only that row', () => {
    const two = reducer(demoState(), {
      type: 'propose',
      candidates: [
        c('Zephyr', 'owner', 'Mira Shah', '2026-08-06', 1),
        c('Zephyr', 'status', 'compromised', '2026-08-06', 2), // the injected one
      ],
      rejected: [],
      mode: 'merge',
    });
    const s = reducer(two, { type: 'rejectCandidate', index: 1 });
    expect(s.proposal?.candidates.map((x) => x.value)).toEqual(['Mira Shah']);
  });

  it('only confirmation applies — and applies exactly what survived review', () => {
    const s = reducer(propose(), { type: 'confirmProposal' });
    expect(s.proposal).toBeNull();
    expect(s.facts.some((f) => f.value === 'Mira Shah')).toBe(true);
  });

  it('confirming an emptied proposal applies nothing', () => {
    const emptied = reducer(propose(), { type: 'rejectCandidate', index: 0 });
    const s = reducer(emptied, { type: 'confirmProposal' });
    expect(s.proposal).toBeNull();
    expect(s.facts).toEqual(demoState().facts);
  });

  it('replace mode adopts the supplied local date on confirm', () => {
    const p = reducer(demoState(), {
      type: 'propose',
      candidates: [c('Zephyr', 'owner', 'Mira Shah', '2026-08-06', 1)],
      rejected: [],
      mode: 'replace',
      today: '2026-08-08',
    });
    const s = reducer(p, { type: 'confirmProposal' });
    expect(s.today).toBe('2026-08-08');
    expect(s.isDemo).toBe(false);
    expect(s.facts).toHaveLength(1);
  });
});
