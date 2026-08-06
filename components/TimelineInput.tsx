'use client';

import type { ApplyRecord } from '../lib/types';
import type { ExtractStatus } from '../lib/state';

export function TimelineInput({
  timeline,
  status,
  message,
  records,
  isDemo,
  onChange,
  onExtract,
  onLoadDemo,
}: {
  timeline: string;
  status: ExtractStatus;
  message: string | null;
  records: ApplyRecord[];
  isDemo: boolean;
  onChange: (v: string) => void;
  onExtract: (mode: 'merge' | 'replace') => void;
  onLoadDemo: () => void;
}) {
  const recent = records.slice(-8).toReversed();

  return (
    <section className="panel">
      <h2>Timeline</h2>
      <p className="dim small">
        <strong>The only part of this page that needs a model.</strong>{' '}
        Everything above is deterministic and works with no key; reading prose
        you paste does not. One dated line per observation,{' '}
        <code>YYYY-MM-DD: what happened</code>.
        Paste anything; the model only nominates candidates, the engine decides
        what they mean.
      </p>

      <textarea
        value={timeline}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={'2026-07-02: Atlas launch moved to 2026-09-05\n2026-07-28: Neha Rao takes over as Atlas owner'}
      />

      <div className="row end tail">
        <button onClick={onLoadDemo}>Reset to demo log</button>
        <button
          onClick={() => onExtract('replace')}
          disabled={status === 'working' || !timeline.trim()}
          title="Discard the current record and build a fresh one from this text"
        >
          Start a new record
        </button>
        <button
          className="primary"
          onClick={() => onExtract('merge')}
          disabled={status === 'working' || !timeline.trim()}
          title="Fold this text into the record already loaded"
        >
          {status === 'working' ? 'Reading…' : 'Add to current record'}
        </button>
      </div>

      {isDemo ? (
        <p className="faint small tail">
          The demo log is loaded. Pasting your own text and choosing
          <strong> Add to current record</strong> would mix it with Project
          Atlas — use <strong>Start a new record</strong> instead.
        </p>
      ) : null}

      <div aria-live="polite">
      {status === 'no-key' ? (
        <div className="notice tail">
          <strong>Reading new text is off on this deployment.</strong>{' '}
          {message ?? 'No GEMINI_API_KEY is configured.'} This is the only
          feature that needs a model. Everything else on this page — the action
          gate, the queries, the time travel — is deterministic and already
          working in front of you.
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="notice bad tail">{message}</div>
      ) : null}
      </div>

      {recent.length > 0 ? (
        <details open>
          <summary>What the engine did ({records.length} decisions)</summary>
          {recent.map((r, i) => (
            <div key={`${r.candidate.sourceLine}-${r.outcome}-${i}`} className="cite">
              <span className={`chip ${r.outcome === 'conflict' ? 'conflicted' : r.outcome === 'duplicate' ? 'unknown' : r.outcome === 'added' ? 'active' : 'superseded'}`}>
                {r.outcome}
              </span>{' '}
              {r.reason}
            </div>
          ))}
        </details>
      ) : null}
    </section>
  );
}
