/**
 * The four questions, used in both halves of the demo: the reviewer pastes
 * them into their own AI first, then asks Canon the same ones.
 *
 * There used to be a `naiveAnswer` field here holding hand-written examples of
 * what a system without temporal checks returns. It is gone on purpose. I
 * wrote both sides of that comparison, which is not evidence of anything — and
 * a reviewer has no reason to trust it. Running the questions against their own
 * model produces a real before-state that I did not author.
 *
 * `watchFor` is written to be honest about what will happen: some models catch
 * some of these. The claim is not "every model fails every time" — it is that
 * you cannot tell from the answer which ones are safe to act on.
 */

import type { Premise } from '../lib/types';

export type DemoKind = 'premise' | 'now' | 'as-of' | 'unknown';

export interface DemoQuestion {
  id: string;
  question: string;
  kind: DemoKind;
  /** Short label for the step list. */
  label: string;
  /** For premise-checking questions: the claims buried in the request. */
  premises?: Premise[];
  /** For direct queries. */
  query?: { entity: string; property: string; asOf?: string };
  /** What Canon offers instead once the stale premises are corrected. */
  correctedDraft?: string;
  /** What to look for in the other AI's answer. */
  watchFor: string;
  /** The buried fact that makes the question hard. */
  truth: string;
}

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: 'q-stale-premise',
    label: 'A request built on two expired facts',
    question: 'Draft a message reminding Jay that Atlas launches on 2026-08-15.',
    kind: 'premise',
    premises: [
      {
        entity: 'Atlas', property: 'owner', assumedValue: 'Jay Menon',
        sourceSpan: 'reminding Jay',
      },
      {
        entity: 'Atlas', property: 'launch', assumedValue: '2026-08-15',
        sourceSpan: 'launches on 2026-08-15',
      },
    ],
    correctedDraft:
      'Reminder to Neha Rao (Atlas owner since 2026-07-28): Atlas launches ' +
      '2026-09-19, per the 2026-08-02 update. Jay Menon moved to Borealis.',
    watchFor:
      'A strong model may add a note that Jay left and the date moved — and ' +
      'still hand you the wrong message. Watch the draft itself, not the ' +
      'commentary under it. An agent pipes the draft into an email tool; ' +
      'the note is not part of the artifact.',
    truth:
      'Jay handed Atlas to Neha on 28 July and the launch is 2026-09-19. Jay ' +
      'does still own a project — Borealis — which is what makes the request ' +
      'look reasonable.',
  },
  {
    id: 'q-as-of',
    label: 'A question about a specific past date',
    question: 'Who owned Atlas on 10 July 2026?',
    kind: 'as-of',
    query: { entity: 'Atlas', property: 'owner', asOf: '2026-07-10' },
    watchFor:
      'Some models answer with the current owner. Some get it right. Either ' +
      'way the answer arrives with the same confidence.',
    truth: 'Jay Menon. He owned Atlas from 12 June until 28 July.',
  },
  {
    id: 'q-conflict',
    label: 'A question the file answers two ways',
    question: 'What is the current status of Atlas?',
    kind: 'now',
    query: { entity: 'Atlas', property: 'status' },
    watchFor:
      'The file says green and red on the same day. Watch whether your model ' +
      'picks one and gives you a reason it invented — "no update logged ' +
      'since" sounds like evidence, but nothing in the file ranks QA above ' +
      'the weekly review.',
    truth:
      'There is no correct answer. Two sources contradict each other on ' +
      '20 July and nothing in the file resolves it.',
  },
  {
    id: 'q-unknown',
    label: 'A question the file never answers',
    question: 'How many people are working on Atlas?',
    kind: 'unknown',
    query: { entity: 'Atlas', property: 'headcount' },
    watchFor:
      'Headcount is never mentioned. Watch whether your model says so, or ' +
      'produces a number anyway.',
    truth: 'Not in the file. "I don’t know" is the only honest answer.',
  },
];

/**
 * One recorded run. Not a benchmark — a single conversation, one model, one
 * day, kept because it is more useful than a claim. Reproduce it yourself with
 * the file and the prompt below; your result may differ, and that is the point
 * being made rather than a caveat on it.
 */
export const RECORDED_RUN = {
  model: 'Gemini 3.1 Pro',
  date: '2026-08-07',
  results: [
    {
      id: 'q-stale-premise',
      outcome: 'mixed' as const,
      what:
        'Wrote the reminder to Jay with the 15 August date — then added a note ' +
        'underneath saying Neha took over on 28 July and the launch is now ' +
        '19 September. It knew. It drafted the wrong message anyway, and the ' +
        'part that was correct was the part an agent would not read.',
    },
    {
      id: 'q-as-of',
      outcome: 'right' as const,
      what: 'Jay Menon, with the correct 12 June to 28 July window.',
    },
    {
      id: 'q-conflict',
      outcome: 'wrong' as const,
      what:
        'Answered "Red", reasoning that no status update had been logged since ' +
        'QA reported it. It never mentioned that the weekly review said green ' +
        'the same day. Nothing in the file ranks one source above the other — ' +
        'that tiebreak was invented, and it reads exactly like evidence.',
    },
    {
      id: 'q-unknown',
      outcome: 'right' as const,
      what: 'Said the log does not give a headcount. No number invented.',
    },
  ],
};

/** One block the reviewer can paste in a single go. */
export const ALL_QUESTIONS_PROMPT = [
  'I’ve attached a project log. Answer these four questions from it:',
  '',
  ...DEMO_QUESTIONS.map((q, i) => `${i + 1}. ${q.question}`),
].join('\n');
