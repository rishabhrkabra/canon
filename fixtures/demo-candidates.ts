/**
 * Pre-extracted candidates for DEMO_TIMELINE — exactly the shape the model
 * returns from `/api/extract`, captured once so the demo path needs no API key
 * and makes no network call.
 *
 * This is a deliberate product requirement, not a convenience: a reviewer
 * opening the deployed URL with no env vars configured must still see the
 * engine work. The model is a replaceable front-end to the engine, so the demo
 * should not depend on it being reachable.
 *
 * Lines 2 and 10 produce nothing on purpose — they carry prose, not a claim
 * about an entity's property.
 */

import type { Candidate } from '../lib/types';

const at = (n: number, text: string) => ({ sourceLine: n, sourceSpan: text });

export const DEMO_CANDIDATES: Candidate[] = [
  {
    entity: 'Atlas', property: 'owner', value: 'Jay Menon',
    observedAt: '2026-06-12', ...at(1, 'Jay Menon owns it'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-08-15',
    observedAt: '2026-06-12', ...at(1, 'Target launch 2026-08-15'),
  },
  {
    entity: 'Atlas', property: 'budget', value: '40L',
    observedAt: '2026-06-28', ...at(3, 'Atlas budget approved at 40L'),
  },
  {
    entity: 'Borealis', property: 'owner', value: 'Priya Nair',
    observedAt: '2026-07-01', ...at(4, 'Priya Nair owns Borealis'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-09-05',
    observedAt: '2026-07-02',
    ...at(5, 'Atlas launch moved to 2026-09-05 after the vendor slipped'),
  },
  {
    entity: 'Borealis', property: 'budget', value: '18L',
    observedAt: '2026-07-08', ...at(6, 'Borealis budget approved at 18L'),
  },
  {
    // Same value again — corroboration, not a second fact.
    entity: 'Atlas', property: 'launch', value: '2026-09-05',
    observedAt: '2026-07-14',
    ...at(7, 'Jay confirms Atlas is still tracking to 2026-09-05'),
  },
  {
    entity: 'Atlas', property: 'status', value: 'green',
    observedAt: '2026-07-20', ...at(8, 'Weekly review: Atlas status green'),
  },
  {
    // Same day, opposite claim. Nothing in the evidence orders these.
    entity: 'Atlas', property: 'status', value: 'red',
    observedAt: '2026-07-20',
    ...at(9, 'QA reports Atlas status red, two blocking defects'),
  },
  {
    entity: 'Atlas', property: 'owner', value: 'Neha Rao',
    observedAt: '2026-07-28', ...at(11, 'Neha Rao takes over as Atlas owner'),
  },
  {
    // The trap: Jay is still a current owner — just not of Atlas.
    entity: 'Borealis', property: 'owner', value: 'Jay Menon',
    observedAt: '2026-07-28', ...at(11, 'Jay Menon moves to Borealis'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-09-19',
    observedAt: '2026-08-02', ...at(14, 'Atlas launch pushed again to 2026-09-19'),
  },
  {
    entity: 'Atlas', property: 'budget', value: '52L',
    observedAt: '2026-08-04', ...at(16, 'Atlas budget revised to 52L'),
  },
  {
    entity: 'Borealis', property: 'launch', value: '2026-11-10',
    observedAt: '2026-08-05', ...at(17, 'Borealis launch target set to 2026-11-10'),
  },
  // Same shape as the Atlas status clash — except this one gets settled.
  {
    entity: 'Borealis', property: 'status', value: 'green',
    observedAt: '2026-07-30', ...at(12, 'Weekly review: Borealis status green'),
  },
  {
    entity: 'Borealis', property: 'status', value: 'red',
    observedAt: '2026-07-30', ...at(13, 'Ops reports Borealis status red, integration blocked'),
  },
  {
    entity: 'Borealis', property: 'status', value: 'amber',
    observedAt: '2026-08-03', ...at(15, 'Borealis status confirmed amber after triage'),
  },
];
