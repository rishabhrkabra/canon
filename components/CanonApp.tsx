'use client';

import { useReducer } from 'react';

/** The user's calendar date, from local time components. */
function localToday(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
import { demoState, reducer } from '../lib/state';
import { isValidCandidate } from '../lib/engine';
import { ActionGate } from './ActionGate';
import { AgentLoop } from './AgentLoop';
import { ConflictBin } from './ConflictBin';
import { FactsTable } from './FactsTable';
import { QueryPanel } from './QueryPanel';
import { TimelineInput } from './TimelineInput';
import { TryItYourself } from './TryItYourself';

/**
 * The only stateful component. Everything below it is a pure render of the
 * engine's output — no component computes truth, they only display it.
 *
 * Order is the argument. The gate comes first because it is the product:
 * something a reviewer can type into and get a verdict from in ten seconds,
 * with no key and no setup. The proof they run in their own AI comes second.
 * The machinery is last, for anyone who wants to check the working.
 */
export function CanonApp() {
  const [state, dispatch] = useReducer(reducer, undefined, demoState);

  async function extract(mode: 'merge' | 'replace') {
    dispatch({ type: 'extractStart' });
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ timeline: state.timeline }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        // One shot, no retry loop. The service owns provider failover; the
        // browser should never amplify an outage into a request storm.
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
          message:
            body?.dropped > 0
              ? `Every extracted observation failed verification (${body.dropped} dropped) — none of them could be traced back to a line in the text.`
              : 'No usable observations found in that text.',
        });
        return;
      }
      dispatch({
        type: 'propose',
        candidates,
        rejected: Array.isArray(body?.rejected) ? body.rejected : [],
        mode,
        // The one clock read in the app, in an event handler — never during
        // render, so the server has nothing to disagree with. Local calendar
        // date, NOT toISOString(): that returns UTC, and at 3am IST "today"
        // in UTC is still yesterday — which would file a same-day change as
        // the future. An audit caught exactly that.
        today: mode === 'replace' ? localToday() : undefined,
      });
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
      <ActionGate facts={state.facts} today={state.today} />

      <AgentLoop facts={state.facts} today={state.today} />

      <TryItYourself />

      <QueryPanel
        facts={state.facts}
        today={state.today}
        selectedId={state.selectedQuestionId}
        onSelect={(id) => dispatch({ type: 'selectQuestion', id })}
      />

      <section className="panel step">
        <div className="steptag">How it knew</div>
        <h2 className="big">It kept every version, not just the latest</h2>
        <p className="lead">
          Nothing is overwritten. Each value is stored with the dates it
          applied, so &ldquo;what was true in July&rdquo; is a lookup, not a
          guess. Pick a date to see the record as it stood that day.
        </p>
      </section>

      <FactsTable
        facts={state.facts}
        today={state.today}
        asOf={state.asOf}
        onAsOf={(date) => dispatch({ type: 'setAsOf', date })}
      />

      <ConflictBin facts={state.facts} />

      <TimelineInput
        timeline={state.timeline}
        status={state.extract}
        message={state.message}
        records={state.records}
        isDemo={state.isDemo}
        proposal={state.proposal}
        onChange={(timeline) => dispatch({ type: 'setTimeline', timeline })}
        onExtract={extract}
        onLoadDemo={() => dispatch({ type: 'loadDemo' })}
        onConfirm={() => dispatch({ type: 'confirmProposal' })}
        onDiscard={() => dispatch({ type: 'discardProposal' })}
        onRejectCandidate={(index) => dispatch({ type: 'rejectCandidate', index })}
      />
    </>
  );
}
