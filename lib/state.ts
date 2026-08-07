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
import { DEMO_TIMELINE, DEMO_TODAY } from '../fixtures/demo-timeline';

export type ExtractStatus = 'idle' | 'working' | 'no-key' | 'error';

export interface State {
  timeline: string;
  facts: Fact[];
  records: ApplyRecord[];
  /** True while the state is the untouched demo packet. */
  isDemo: boolean;
  /** The effective date every query and gate check runs against. */
  today: IsoDate;
  /**
   * Extracted candidates awaiting explicit confirmation. Model output NEVER
   * applies directly — the receipt verifier narrows what a misbehaving model
   * can claim, but only a person can read "is not compromised" and know the
   * difference. Truth state changes on confirm, and nowhere else.
   */
  proposal: {
    candidates: Candidate[];
    rejected: { line: number; value: string; reason: string }[];
    mode: 'merge' | 'replace';
    today?: IsoDate;
  } | null;
  /** Date the facts table is being viewed at; empty string = now. */
  asOf: IsoDate | '';
  selectedQuestionId: string | null;
  extract: ExtractStatus;
  message: string | null;
}

export type Action =
  | { type: 'setTimeline'; timeline: string }
  | { type: 'loadDemo' }
  /**
   * `merge` folds new evidence into what is already there — the right choice
   * for a follow-up paste about the same project. `replace` starts a fresh
   * memory. Making the caller say which prevents the quiet failure where
   * someone pastes their own data and it silently mixes with the demo's.
   */
  | {
      type: 'propose';
      candidates: Candidate[];
      rejected: { line: number; value: string; reason: string }[];
      mode: 'merge' | 'replace';
      /** Real today, read in the event handler. Only replace supplies it. */
      today?: IsoDate;
    }
  | { type: 'discardProposal' }
  | { type: 'rejectCandidate'; index: number }
  | { type: 'confirmProposal' }
  | { type: 'setAsOf'; date: IsoDate | '' }
  | { type: 'selectQuestion'; id: string | null }
  | { type: 'extractStart' }
  | { type: 'extractFailed'; status: 'no-key' | 'error'; message: string }
  | { type: 'reset' };

export const initialState: State = {
  timeline: '',
  facts: [],
  records: [],
  isDemo: false,
  today: DEMO_TODAY,
  proposal: null,
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
    isDemo: true,
    today: DEMO_TODAY,
    selectedQuestionId: 'q-stale-premise',
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setTimeline':
      return { ...state, timeline: action.timeline };

    case 'loadDemo':
      return demoState();

    case 'propose':
      return { ...state, proposal: action, extract: 'idle', message: null };

    case 'discardProposal':
      return { ...state, proposal: null };

    case 'rejectCandidate': {
      if (!state.proposal) return state;
      const kept = state.proposal.candidates.filter((_, i) => i !== action.index);
      return { ...state, proposal: { ...state.proposal, candidates: kept } };
    }

    case 'confirmProposal': {
      // The one door into truth state for extracted text.
      const p = state.proposal;
      if (!p || p.candidates.length === 0) return { ...state, proposal: null };
      const base = p.mode === 'replace' ? [] : state.facts;
      const { facts, records } = applyCandidates(base, p.candidates);
      return {
        ...state,
        facts,
        records: p.mode === 'replace' ? records : [...state.records, ...records],
        isDemo: p.mode === 'replace' ? false : state.isDemo,
        today: p.mode === 'replace' && p.today ? p.today : state.today,
        proposal: null,
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
