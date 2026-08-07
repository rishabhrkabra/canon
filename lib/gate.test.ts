import { describe, it, expect } from 'vitest';
import { buildFacts } from './engine';
import { gateAction, scanForPremises } from './gate';
import { DEMO_CANDIDATES } from '../fixtures/demo-candidates';

const facts = buildFacts(DEMO_CANDIDATES).facts;

describe('scanForPremises', () => {
  it('finds a claim from a name the action never explains', () => {
    const found = scanForPremises(facts, 'Send the launch checklist to Jay Menon.');
    expect(
      found.some(
        (p) => p.entity === 'Atlas' && p.property === 'owner' && p.assumedValue === 'Jay Menon',
      ),
    ).toBe(true);
  });

  it('scopes to the project the action names', () => {
    // Jay is stale on Atlas but current on Borealis. Naming Borealis must keep
    // Atlas history out of it, or every mention of a person who ever moved
    // teams becomes a false alarm.
    const found = scanForPremises(facts, 'Ask Jay Menon for the Borealis update.');
    expect(found.map((p) => p.entity)).toEqual(['Borealis']);
  });

  it('reads human date formats, not just ISO', () => {
    for (const written of ['15 August', 'Aug 15', 'August 15', '15/08/2026']) {
      const found = scanForPremises(facts, `Atlas ships on ${written}.`);
      expect(found.some((p) => p.assumedValue === '2026-08-15'), written).toBe(true);
    }
  });

  it('does not match a name inside a longer word', () => {
    expect(scanForPremises(facts, 'Ask Jayanti about the schedule.')).toHaveLength(0);
  });

  it('resolves an unambiguous first name to the person on record', () => {
    // Real drafts say "Hi Jay", not "Hi Jay Menon". Missing that misses the
    // wrong-recipient error, which is the costly half of a stale premise.
    const found = scanForPremises(facts, 'Hi Jay, checking in on Atlas.');
    expect(
      found.some((p) => p.property === 'owner' && p.assumedValue === 'Jay Menon'),
    ).toBe(true);
  });

  it('refuses an ambiguous first name rather than guessing', () => {
    const two = buildFacts([
      { entity: 'X', property: 'owner', value: 'Jay Menon', observedAt: '2026-07-01',
        sourceLine: 1, sourceSpan: 'Jay Menon' },
      { entity: 'X', property: 'lead', value: 'Jay Patel', observedAt: '2026-07-01',
        sourceLine: 2, sourceSpan: 'Jay Patel' },
    ]).facts;
    expect(scanForPremises(two, 'Ask Jay about X.')).toHaveLength(0);
  });

  it('finds nothing when the action names nothing on record', () => {
    expect(scanForPremises(facts, 'Book a meeting room for Thursday.')).toHaveLength(0);
  });
});

describe('gateAction', () => {
  it('BLOCK_STALE on the headline case, and rewrites the action', () => {
    const r = gateAction(facts, 'Remind Jay Menon that Atlas launches on 2026-08-15.');
    expect(r.verdict).toBe('BLOCK_STALE');
    expect(r.checks.filter((c) => c.verdict === 'stale')).toHaveLength(2);
    expect(r.corrected).toContain('Neha Rao');
    expect(r.corrected).toContain('2026-09-19');
    expect(r.corrected).not.toContain('Jay Menon');
    expect(r.corrected).not.toContain('2026-08-15');
  });

  it('BLOCK_CONFLICT outranks a stale value in the same action', () => {
    // Atlas status is an unresolved same-day contradiction in the demo data.
    const r = gateAction(facts, 'Tell Jay Menon that Atlas is green.');
    expect(r.verdict).toBe('BLOCK_CONFLICT');
  });

  it('ALLOW when every claim still holds', () => {
    const r = gateAction(facts, 'Send the Atlas plan to Neha Rao for 2026-09-19.');
    expect(r.verdict).toBe('ALLOW');
    expect(r.checks.every((c) => c.verdict === 'current')).toBe(true);
  });

  it('does not confuse the two projects — Jay is current on Borealis', () => {
    const r = gateAction(facts, 'Ask Jay Menon for the Borealis update.');
    expect(r.verdict).toBe('ALLOW');
  });

  it('NEEDS_EVIDENCE rather than silent approval when nothing is on record', () => {
    const r = gateAction(facts, 'Book a room for the retro.');
    expect(r.verdict).toBe('NEEDS_EVIDENCE');
    expect(r.checks).toHaveLength(0);
  });

  it('judges the stale value when an action names both old and new', () => {
    const r = gateAction(facts, 'Neha Rao took over from Jay Menon on Atlas.');
    expect(r.verdict).toBe('BLOCK_STALE');
  });

  it('blocks a real model draft on both premises', () => {
    // Verbatim from Gemini 3.1 Pro, 2026-08-07, given the demo log. Wrong
    // recipient and a superseded date, in fluent prose with a subject line.
    const r = gateAction(
      facts,
      'Hi Jay, I wanted to check in with you regarding Project Atlas and the ' +
        'original launch target date of August 15, 2026.',
    );
    expect(r.verdict).toBe('BLOCK_STALE');
    const flagged = r.checks.filter((c) => c.verdict === 'stale').map((c) => c.premise.property);
    expect(flagged.toSorted()).toEqual(['launch', 'owner']);
    expect(r.corrected).toContain('Neha Rao');
    expect(r.corrected).toContain('2026-09-19');
  });

  it('replaces the longest matching form, leaving no orphan fragments', () => {
    const r = gateAction(facts, 'Atlas launches on August 15, 2026.');
    expect(r.corrected).toBe('Atlas launches on 2026-09-19.');
    expect(r.corrected).not.toContain(', 2026.');
  });

  it('is empty-safe', () => {
    expect(gateAction(facts, '   ').verdict).toBe('NEEDS_EVIDENCE');
  });
});
