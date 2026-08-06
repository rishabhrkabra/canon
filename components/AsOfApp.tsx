'use client';

import { useReducer } from 'react';
import { demoState, reducer } from '../lib/state';
import { isValidCandidate } from '../lib/engine';
import { ComparePanel } from './ComparePanel';
import { ConflictBin } from './ConflictBin';
import { FactsTable } from './FactsTable';
import { QueryPanel } from './QueryPanel';
import { TimelineInput } from './TimelineInput';

/**
 * The only stateful component. Everything below it is a pure render of the
 * engine's output — no component computes truth, they only display it.
 *
 * State is initialised to the demo packet, so the page is fully working before
 * any network call and on a deployment with no API key at all.
 */
export function AsOfApp() {
  const [state, dispatch] = useReducer(reducer, undefined, demoState);

  async function extract() {
    dispatch({ type: 'extractStart' });
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeline: state.timeline }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // One shot, no retry loop — free-tier limits are unpublished and a
        // retry storm is the fastest way to lose the key for the demo.
        dispatch({
          type: 'extractFailed',
          status: body?.code === 'NO_KEY' ? 'no-key' : 'error',
          message: body?.error ?? `Extraction failed (${res.status}).`,
        });
        return;
      }

      const candidates = Array.isArray(body?.candidates)
        ? body.candidates.filter(isValidCandidate)
        : [];
      if (candidates.length === 0) {
        dispatch({
          type: 'extractFailed',
          status: 'error',
          message: 'No usable observations found in that text.',
        });
        return;
      }
      dispatch({ type: 'apply', candidates });
    } catch {
      dispatch({
        type: 'extractFailed',
        status: 'error',
        message: 'Could not reach the extraction endpoint.',
      });
    }
  }

  return (
    <>
      <TimelineInput
        timeline={state.timeline}
        status={state.extract}
        message={state.message}
        records={state.records}
        onChange={(timeline) => dispatch({ type: 'setTimeline', timeline })}
        onExtract={extract}
        onLoadDemo={() => dispatch({ type: 'loadDemo' })}
      />

      <FactsTable
        facts={state.facts}
        asOf={state.asOf}
        onAsOf={(date) => dispatch({ type: 'setAsOf', date })}
      />

      <div className="grid2">
        <QueryPanel
          facts={state.facts}
          selectedId={state.selectedQuestionId}
          onSelect={(id) => dispatch({ type: 'selectQuestion', id })}
        />
        <ConflictBin facts={state.facts} />
      </div>

      <ComparePanel facts={state.facts} />
    </>
  );
}
