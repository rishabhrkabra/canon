/**
 * End-to-end over the demo packet: candidates → engine → every preset answer.
 *
 * These assertions are the contract behind the reviewer's two-minute path. If
 * one breaks, the deployed demo is lying, so they are pinned exactly.
 */

import { describe, it, expect } from 'vitest';
import { buildFacts } from '../lib/engine';
import { checkPremises, hasBlockingPremise, queryAsOf, queryNow } from '../lib/query';
import { DEMO_CANDIDATES } from './demo-candidates';
import { DEMO_QUESTIONS } from './demo-questions';
import { DEMO_TIMELINE_LINES } from './demo-timeline';

const { facts, records } = buildFacts(DEMO_CANDIDATES);
const q = (id: string) => DEMO_QUESTIONS.find((x) => x.id === id)!;

describe('demo state', () => {
  it('every candidate cites a line that exists in the timeline', () => {
    for (const c of DEMO_CANDIDATES) {
      const line = DEMO_TIMELINE_LINES[c.sourceLine - 1];
      expect(line, `line ${c.sourceLine} missing`).toBeDefined();
      expect(line.startsWith(c.observedAt)).toBe(true);
    }
  });

  it('fires all four engine rules on one paste', () => {
    const outcomes = new Set(records.map((r) => r.outcome));
    expect(outcomes).toContain('added');
    expect(outcomes).toContain('superseded');
    expect(outcomes).toContain('duplicate');
    expect(outcomes).toContain('conflict');
  });

  it('leaves exactly one active fact per settled property', () => {
    const active = facts.filter((f) => f.status === 'active');
    const props = active.map((f) => f.property).sort();
    expect(props).toEqual(['budget', 'launch', 'owner']); // status is conflicted
  });

  it('corroborates the repeated launch date instead of duplicating it', () => {
    const sep5 = facts.find((f) => f.value === '2026-09-05')!;
    expect(sep5.corroborations).toBe(2);
  });
});

describe('the four demo answers', () => {
  it('q-stale-premise: both premises rejected, with receipts', () => {
    const checks = checkPremises(facts, q('q-stale-premise').premises!);
    expect(checks.map((c) => c.verdict)).toEqual(['stale', 'stale']);
    expect(hasBlockingPremise(checks)).toBe(true);

    const [owner, launch] = checks;
    expect(owner.currentValue).toBe('Neha Rao');
    expect(owner.supersededBy!.sourceLine).toBe(7);
    expect(launch.currentValue).toBe('2026-09-19');
    expect(launch.supersededBy!.sourceLine).toBe(8);
  });

  it('q-as-of: 10 July returns Jay, not the current owner', () => {
    const { query } = q('q-as-of');
    const r = queryAsOf(facts, query!.entity, query!.property, query!.asOf!);
    expect(r.verdict).toBe('known');
    expect(r.value).toBe('Jay Menon');
    expect(r.citations[0].validUntil).toBe('2026-07-28');
  });

  it('q-conflict: refuses, and shows both sides', () => {
    const { query } = q('q-conflict');
    const r = queryNow(facts, query!.entity, query!.property);
    expect(r.verdict).toBe('conflicted');
    expect(r.value).toBeUndefined();
    expect(r.citations.map((c) => c.value).sort()).toEqual(['green', 'red']);
  });

  it('q-unknown: never observed, and no citation is invented', () => {
    const { query } = q('q-unknown');
    const r = queryNow(facts, query!.entity, query!.property);
    expect(r.verdict).toBe('unknown');
    expect(r.citations).toEqual([]);
  });
});
