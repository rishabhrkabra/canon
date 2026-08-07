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
  /**
   * A second date to answer alongside. Some questions only make their point
   * with two answers side by side — "what was it then, and what is it now"
   * has a different shape for each date, and showing one hides the finding.
   */
  alsoOn?: string;
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
    id: 'q-resolved',
    label: 'A contradiction that was settled later',
    question: 'What was the Borealis status on 1 August 2026, and what is it now?',
    kind: 'now',
    query: { entity: 'Borealis', property: 'status' },
    alsoOn: '2026-08-01',
    watchFor:
      'Two answers are needed, and they are different. On 1 August the log ' +
      'contradicted itself; by now it does not. Watch whether your model ' +
      'gives one answer for both dates, or picks a side for the 1st.',
    truth:
      'On 1 August it was genuinely contested — the weekly review said green ' +
      'and Ops said red, both on 30 July, and nothing resolved it until the ' +
      '3rd. Now it is amber. A settled contradiction is history; the Atlas ' +
      'one above is still open. Telling those apart is the whole job.',
  },
];

/**
 * Three recorded runs, same file, same four questions.
 *
 * The fourth question was added after the first round, once it was clear the
 * first three were not separating anything: two were solved by every model.
 * It was tested before being put here — the whole point of testing first is
 * being willing to throw a question away, and two of the three candidates
 * were thrown away.
 *
 * Not a benchmark — three conversations, no retries, no prompt tuning. Kept
 * because a real result beats an assertion, and because the pattern in it is
 * more useful than a win/loss tally: two of these questions are now reliably
 * answered by frontier models, one is closing, and one is not.
 *
 * Reproduce it with the file and prompt above. Your results may differ. That
 * is the point being made, not a caveat on it.
 */
export type RunOutcome = 'right' | 'partial' | 'wrong';

export const RECORDED_RUNS = {
  date: '2026-08-07',
  models: ['Gemini 3.1 Pro', 'GPT-5 (Extra High)', 'Claude Fable 5'] as const,
  rows: [
    {
      id: 'q-stale-premise',
      verdict: 'closing' as const,
      results: [
        {
          outcome: 'partial' as RunOutcome,
          what:
            'Wrote the reminder to Jay with the 15 August date, then added a ' +
            'note underneath saying Neha took over and the launch is now ' +
            '19 September. It knew, and drafted the wrong message anyway.',
        },
        {
          outcome: 'partial' as RunOutcome,
          what:
            'Refused the date outright — "the log does not support saying ' +
            'Atlas launches on August 15" — and corrected it to 19 September. ' +
            'Then addressed the draft "Hi Jay", who handed Atlas over on ' +
            '28 July. One premise caught, one missed.',
        },
        {
          outcome: 'right' as RunOutcome,
          what:
            'Caught both before answering: a reminder to Jay about a 15 August ' +
            'launch "would be wrong on both the date and the recipient". ' +
            'Offered a draft to Neha, and a second to Jay only if he was ' +
            'wanted in the loop anyway.',
        },
      ],
    },
    {
      id: 'q-as-of',
      verdict: 'solved' as const,
      results: [
        { outcome: 'right' as RunOutcome, what: 'Jay Menon, correct 12 June – 28 July window.' },
        { outcome: 'right' as RunOutcome, what: 'Jay Menon, with the handover date.' },
        { outcome: 'right' as RunOutcome, what: 'Jay Menon, kickoff to 28 July.' },
      ],
    },
    {
      id: 'q-conflict',
      verdict: 'unsolved' as const,
      results: [
        {
          outcome: 'wrong' as RunOutcome,
          what:
            'Answered "Red", reasoning no status update had been logged since ' +
            'QA reported it. Never mentioned the weekly review said green the ' +
            'same day.',
        },
        {
          outcome: 'wrong' as RunOutcome,
          what:
            '"The latest explicit status recorded is red." Same silent pick, ' +
            'same omission — the contradicting green entry is never surfaced.',
        },
        {
          outcome: 'partial' as RunOutcome,
          what:
            'The only one to disclose it: "genuinely ambiguous in the log" — ' +
            'weekly review green, QA red, same day, nothing resolves it. Then ' +
            'leaned red anyway. Disclosure is not refusal.',
        },
      ],
    },
    {
      id: 'q-resolved',
      verdict: 'unsolved' as const,
      results: [
        {
          outcome: 'wrong' as RunOutcome,
          what:
            'Not run on the original four; added after the first round. See ' +
            'the GPT-5 and Claude columns — the pattern held.',
        },
        {
          outcome: 'wrong' as RunOutcome,
          what:
            '"Borealis status on 1 August 2026: Red — the latest update by ' +
            'then." Picked a side again, from two entries dated the same day, ' +
            'and again never mentioned the one it discarded. Second instance ' +
            'of the same failure, on a different project.',
        },
        {
          outcome: 'right' as RunOutcome,
          what:
            'Both halves. "On August 1 the record was genuinely conflicting … ' +
            'the honest reading was contested: green per the weekly review, ' +
            'red per Ops." Then: settled amber on the 3rd.',
        },
      ],
    },
  ],
};

/** One block the reviewer can paste in a single go. */
export const ALL_QUESTIONS_PROMPT = [
  'I’ve attached a project log. Answer these four questions from it:',
  '',
  ...DEMO_QUESTIONS.map((q, i) => `${i + 1}. ${q.question}`),
].join('\n');
