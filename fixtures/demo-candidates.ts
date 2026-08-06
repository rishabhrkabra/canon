/**
 * Pre-extracted candidates for DEMO_TIMELINE — exactly the shape the model
 * returns from `/api/extract`, captured once so the demo path needs no API key
 * and makes no network call.
 *
 * This is a deliberate product requirement, not a convenience: a reviewer
 * opening the deployed URL with no env vars configured must still see the
 * engine work. The model is a replaceable front-end to the engine, so the demo
 * should not depend on it being reachable.
 */

import type { Candidate } from '../lib/types';

const line = (n: number, text: string) => ({ sourceLine: n, sourceSpan: text });

export const DEMO_CANDIDATES: Candidate[] = [
  {
    entity: 'Atlas', property: 'owner', value: 'Jay Menon',
    observedAt: '2026-06-12',
    ...line(1, 'Project Atlas owner is Jay Menon'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-08-15',
    observedAt: '2026-06-12',
    ...line(1, 'Target launch 2026-08-15'),
  },
  {
    entity: 'Atlas', property: 'budget', value: '40L',
    observedAt: '2026-06-28',
    ...line(2, 'Atlas budget approved at 40L'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-09-05',
    observedAt: '2026-07-02',
    ...line(3, 'Atlas launch moved to 2026-09-05 after the vendor slipped'),
  },
  {
    // Same value again — corroboration, not a second fact.
    entity: 'Atlas', property: 'launch', value: '2026-09-05',
    observedAt: '2026-07-14',
    ...line(4, 'Jay confirms Atlas is still tracking to 2026-09-05'),
  },
  {
    entity: 'Atlas', property: 'status', value: 'green',
    observedAt: '2026-07-20',
    ...line(5, 'Weekly review: Atlas status green'),
  },
  {
    // Same day, opposite claim. Nothing in the evidence orders these.
    entity: 'Atlas', property: 'status', value: 'red',
    observedAt: '2026-07-20',
    ...line(6, 'QA reports Atlas status red, two blocking defects'),
  },
  {
    entity: 'Atlas', property: 'owner', value: 'Neha Rao',
    observedAt: '2026-07-28',
    ...line(7, 'Neha Rao takes over as Atlas owner'),
  },
  {
    entity: 'Atlas', property: 'launch', value: '2026-09-19',
    observedAt: '2026-08-02',
    ...line(8, 'Atlas launch pushed again to 2026-09-19'),
  },
  {
    entity: 'Atlas', property: 'budget', value: '52L',
    observedAt: '2026-08-04',
    ...line(9, 'Atlas budget revised to 52L'),
  },
];
