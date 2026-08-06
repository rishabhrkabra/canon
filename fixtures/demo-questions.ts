/**
 * The preset questions, precomputed so the demo path runs offline.
 *
 * A note on `naiveAnswer`, kept deliberately blunt because the alternative is
 * a dishonest benchmark: these are **hand-written illustrations of the standard
 * failure mode**, not measured output from a running RAG baseline. They show
 * what a system that retrieves by similarity and has no notion of validity
 * intervals typically returns. Nothing here is presented as a benchmark
 * result, and the UI says so on the panel itself.
 */

import type { Premise } from '../lib/types';

export type DemoKind = 'premise' | 'now' | 'as-of' | 'unknown';

export interface DemoQuestion {
  id: string;
  question: string;
  kind: DemoKind;
  /** For premise-checking questions: the claims buried in the request. */
  premises?: Premise[];
  /** For direct queries. */
  query?: { entity: string; property: string; asOf?: string };
  /** Illustration of the failure mode — see the file header. */
  naiveAnswer: string;
  /** What AsOf offers instead once the stale premises are corrected. */
  correctedDraft?: string;
  /** Why this question is in the demo at all. */
  point: string;
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: 'q-stale-premise',
    question: 'Remind Jay that Atlas launches on 2026-08-15.',
    kind: 'premise',
    premises: [
      {
        entity: 'Atlas', property: 'owner', assumedValue: 'Jay Menon',
        sourceSpan: 'Remind Jay',
      },
      {
        entity: 'Atlas', property: 'launch', assumedValue: '2026-08-15',
        sourceSpan: 'launches on 2026-08-15',
      },
    ],
    naiveAnswer:
      'Sure — sending Jay a reminder that Atlas launches on 2026-08-15.',
    correctedDraft:
      'Reminder to Neha Rao (owner since 2026-07-28): Atlas launches on ' +
      '2026-09-19, per the 2026-08-02 update. Jay Menon moved to Borealis.',
    point:
      'Both assumptions in the request expired weeks ago. The request is ' +
      'fluent, retrievable, and wrong — nothing about it looks like a ' +
      'hallucination, which is exactly why it survives most checks.',
  },
  {
    id: 'q-as-of',
    question: 'Who owned Atlas on 10 July 2026?',
    kind: 'as-of',
    query: { entity: 'Atlas', property: 'owner', asOf: '2026-07-10' },
    naiveAnswer: 'Neha Rao owns Atlas.',
    point:
      'A store that overwrites on update cannot answer this at all — the ' +
      'old value is gone. Superseded is history, not garbage.',
  },
  {
    id: 'q-conflict',
    question: 'What is the current status of Atlas?',
    kind: 'now',
    query: { entity: 'Atlas', property: 'status' },
    naiveAnswer: 'Atlas is green.',
    point:
      'Two sources said opposite things on the same day. Picking the ' +
      'higher-ranked chunk invents a resolution the evidence does not ' +
      'contain. Refusing, with both receipts shown, is the correct answer.',
  },
  {
    id: 'q-unknown',
    question: 'What is the headcount on Atlas?',
    kind: 'unknown',
    query: { entity: 'Atlas', property: 'headcount' },
    naiveAnswer: 'Atlas has a team of about 6 people.',
    point:
      'Never observed. "Unknown" is a real answer, and it is different from ' +
      '"knew, and it expired" — the panel above distinguishes the two.',
  },
];
