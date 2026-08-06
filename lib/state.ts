/**
 * The entire client state, as one reducer over the engine.
 *
 * Everything here is pure and synchronous: network calls happen in the
 * component and only their *results* are dispatched. That keeps the UI a thin
 * shell over `engine.ts` — and makes the shell testable without a browser.
 */

import { applyCandidates } from './engine';
import type { ApplyRecord, Candidate, Fact, IsoDate } from './types';
import { DEMO_CANDIDATES } from '../fixtures/demo-candidates';
import { DEMO_TIMELINE } from '../fixtures/demo-timeline';

export type ExtractStatus = 'idle' | 'working' | 'no-key' | 'error';

export interface State {
  timeline: string;
  facts: Fact[];
  records: ApplyRecord[];
  /** Date the facts table is being viewed at; empty string = now. */
  asOf: IsoDate | '';
  selectedQuestionId: string | null;
  extract: ExtractStatus;
  message: string | null;
}

export type Action =
  | { type: 'setTimeline'; timeline: string }
  | { type: 'loadDemo' }
  | { type: 'apply'; candidates: readonly Candidate[] }
  | { type: 'setAsOf'; date: IsoDate | '' }
  | { type: 'selectQuestion'; id: string | null }
  | { type: 'extractStart' }
  | { type: 'extractFailed'; status: 'no-key' | 'error'; message: string }
  | { type: 'reset' };

export const initialState: State = {
  timeline: '',
  facts: [],
  records: [],
  asOf: '',
  selectedQuestionId: null,
  extract: 'idle',
  message: null,
};

/** The demo packet, applied with zero network. This is the default view. */
export function demoState(): State {
  const { facts, records } = applyCandidates([], DEMO_CANDIDATES);
  return {
    ...initialState,
    timeline: DEMO_TIMELINE,
    facts,
    records,
    selectedQuestionId: 'q-stale-premise',
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTimeline':
      return { ...state, timeline: action.timeline };

    case 'loadDemo':
      return demoState();

    case 'apply': {
      // New evidence folds into existing state — it does not replace it. That
      // is what makes a second paste a backfill rather than a fresh start.
      const { facts, records } = applyCandidates(state.facts, action.candidates);
      return {
        ...state,
        facts,
        records: [...state.records, ...records],
        extract: 'idle',
        message: null,
      };
    }

    case 'setAsOf':
      return { ...state, asOf: action.date };

    case 'selectQuestion':
      return { ...state, selectedQuestionId: action.id };

    case 'extractStart':
      return { ...state, extract: 'working', message: null };

    case 'extractFailed':
      return { ...state, extract: action.status, message: action.message };

    case 'reset':
      return initialState;
  }
}
