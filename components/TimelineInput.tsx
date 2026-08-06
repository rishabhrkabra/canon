'use client';

import type { ApplyRecord } from '../lib/types';
import type { ExtractStatus } from '../lib/state';

export function TimelineInput({
  timeline,
  status,
  message,
  records,
  onChange,
  onExtract,
  onLoadDemo,
}: {
  timeline: string;
  status: ExtractStatus;
  message: string | null;
  records: ApplyRecord[];
  onChange: (v: string) => void;
  onExtract: () => void;
  onLoadDemo: () => void;
}) {
  const recent = records.slice(-8).toReversed();

  return (
    <section className="panel">
      <h2>Timeline</h2>
      <p className="dim small">
        One dated line per observation, <code>YYYY-MM-DD: what happened</code>.
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
        <button onClick={onLoadDemo}>Load demo</button>
        <button className="primary" onClick={onExtract} disabled={status === 'working' || !timeline.trim()}>
          {status === 'working' ? 'Extracting…' : 'Extract facts'}
        </button>
      </div>

      {status === 'no-key' ? (
        <div className="notice tail">
          <strong>Live extraction is off.</strong>{' '}
          {message ?? 'No GEMINI_API_KEY is configured on this deployment.'} The
          demo timeline below is pre-extracted and runs entirely offline — every
          panel on this page works without a model.
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="notice bad tail">{message}</div>
      ) : null}

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
