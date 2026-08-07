/**
 * End-to-end over the demo packet: candidates → engine → every preset answer.
 *
 * These assertions are the contract behind the reviewer's two-minute path. If
 * one breaks, the deployed demo is lying, so they are pinned exactly.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { buildFacts } from '../lib/engine';
import { checkPremises, hasBlockingPremise, queryAsOf, queryNow } from '../lib/query';
import { DEMO_CANDIDATES } from './demo-candidates';
import { DEMO_QUESTIONS } from './demo-questions';
import { DEMO_TIMELINE, DEMO_TIMELINE_LINES, DOWNLOAD_FILENAME } from './demo-timeline';

const { facts, records } = buildFacts(DEMO_CANDIDATES);
const q = (id: string) => DEMO_QUESTIONS.find((x) => x.id === id)!;

describe('the downloadable file', () => {
  it('is byte-identical to the timeline the app analyses', () => {
    // The reviewer uploads this file to their own AI and then compares the
    // answers to ours. If the two ever drift apart, the comparison is
    // meaningless and the demo is quietly dishonest — so it is a test, not a
    // convention.
    const onDisk = readFileSync(
      new URL(`../public/${DOWNLOAD_FILENAME}`, import.meta.url),
      'utf8',
    );
    expect(onDisk).toContain(DEMO_TIMELINE);
  });
});

describe('demo state', () => {
  it('every candidate cites a line that exists in the timeline', () => {
    for (const c of DEMO_CANDIDATES) {
      const line = DEMO_TIMELINE_LINES[c.sourceLine - 1];
      expect(line, `line ${c.sourceLine} missing`).toBeDefined();
      expect(line.startsWith(c.observedAt)).toBe(true);
    }
  });

  it('every candidate quotes text that really appears on its line', () => {
    // Guards the receipts: a citation that does not appear in the source is
    // the same failure the product exists to prevent.
    for (const c of DEMO_CANDIDATES) {
      const line = DEMO_TIMELINE_LINES[c.sourceLine - 1];
      expect(line.includes(c.sourceSpan), `"${c.sourceSpan}" not on line ${c.sourceLine}`)
        .toBe(true);
    }
  });

  it('fires all four engine rules on one paste', () => {
    const outcomes = new Set(records.map((r) => r.outcome));
    expect(outcomes).toContain('added');
    expect(outcomes).toContain('superseded');
    expect(outcomes).toContain('duplicate');
    expect(outcomes).toContain('conflict');
  });

  it('settles both projects, leaving only Atlas status unresolved', () => {
    const active = facts
      .filter((f) => f.status === 'active')
      .map((f) => `${f.entity}.${f.property}`)
      .toSorted();
    expect(active).toEqual([
      'Atlas.budget', 'Atlas.launch', 'Atlas.owner',
      'Borealis.budget', 'Borealis.launch', 'Borealis.owner',
      'Borealis.status',   // settled on 2026-08-03; Atlas status never is
    ]);
  });

  it('corroborates the repeated launch date instead of duplicating it', () => {
    const sep5 = facts.find((f) => f.value === '2026-09-05')!;
    expect(sep5.corroborations).toBe(2);
  });

  it('keeps Jay current on Borealis while stale on Atlas — the trap', () => {
    // The whole demo turns on this: "remind Jay" looks reasonable because Jay
    // really does own a project. Just not this one.
    expect(queryNow(facts, 'Borealis', 'owner').value).toBe('Jay Menon');
    expect(queryNow(facts, 'Atlas', 'owner').value).toBe('Neha Rao');
  });
});

describe('the four demo answers', () => {
  it('q-stale-premise: both premises rejected, with receipts', () => {
    const checks = checkPremises(facts, q('q-stale-premise').premises!, '2026-08-08');
    expect(checks.map((c) => c.verdict)).toEqual(['stale', 'stale']);
    expect(hasBlockingPremise(checks)).toBe(true);

    const [owner, launch] = checks;
    expect(owner.currentValue).toBe('Neha Rao');
    expect(owner.supersededBy!.sourceLine).toBe(11);
    expect(launch.currentValue).toBe('2026-09-19');
    expect(launch.supersededBy!.sourceLine).toBe(14);
    // Launch moved twice, so the explanation must name the middle rung.
    expect(launch.explanation).toContain('2026-09-05');
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
    expect(r.citations.map((c) => c.value).toSorted()).toEqual(['green', 'red']);
  });

  it('q-resolved: settled now, contested on the day it was contested', () => {
    // The pair that matters. Atlas status is still open; Borealis was open and
    // is not any more. A system that cannot tell those apart either refuses
    // forever or answers a live contradiction with a guess.
    const { query } = q('q-resolved');
    const now = queryNow(facts, query!.entity, query!.property);
    expect(now.verdict).toBe('known');
    expect(now.value).toBe('amber');

    const onFirst = queryAsOf(facts, query!.entity, query!.property, '2026-08-01');
    expect(onFirst.verdict).toBe('conflicted');
    expect(onFirst.citations.map((c) => c.value).toSorted()).toEqual(['green', 'red']);

    // Atlas, by contrast, is still unresolved today.
    expect(queryNow(facts, 'Atlas', 'status').verdict).toBe('conflicted');
  });
});
