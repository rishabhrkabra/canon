'use client';

import type { ApplyRecord, Candidate } from '../lib/types';
import type { ExtractStatus, State } from '../lib/state';

export function TimelineInput({
  timeline,
  status,
  message,
  records,
  isDemo,
  proposal,
  onChange,
  onExtract,
  onLoadDemo,
  onConfirm,
  onDiscard,
  onRejectCandidate,
}: {
  timeline: string;
  status: ExtractStatus;
  message: string | null;
  records: ApplyRecord[];
  isDemo: boolean;
  proposal: State['proposal'];
  onChange: (v: string) => void;
  onExtract: (mode: 'merge' | 'replace') => void;
  onLoadDemo: () => void;
  onConfirm: () => void;
  onDiscard: () => void;
  onRejectCandidate: (index: number) => void;
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

      {proposal ? (
        <div className="proposal" aria-live="polite">
          <h3 className="flush">
            Found {proposal.candidates.length}{' '}
            {proposal.candidates.length === 1 ? 'fact' : 'facts'} — nothing is
            recorded until you confirm
          </h3>
          <p className="dim small">
            The model nominates; it does not decide. Each row cites the line it
            came from — read the ones that matter. The verifier already dropped
            anything whose cited text never states its value, but a checker
            cannot read &ldquo;is <em>not</em> compromised&rdquo;. You can.
          </p>
          {proposal.candidates.map((c: Candidate, i: number) => (
            <div key={`${c.sourceLine}-${c.property}-${c.value}`} className="prop-item">
              <div className="prop-row">
                <span className="mono small">
                  {c.entity} · {c.property} = &ldquo;{c.value}&rdquo;
                </span>
                <span className="faint mono corr-src">line {c.sourceLine} · {c.observedAt}</span>
                <button className="tiny" onClick={() => onRejectCandidate(i)}>
                  reject
                </button>
              </div>
              {/* The quote IS the review. Showing only entity·property=value
                  asks the reviewer to approve a conclusion; the entire reason
                  this step exists is that the source might say "is NOT
                  compromised", and only the quote reveals that. */}
              <div className="cite">&ldquo;{c.sourceSpan}&rdquo;</div>
            </div>
          ))}
          {proposal.rejected.length > 0 ? (
            <details>
              <summary>
                Dropped by the verifier ({proposal.rejected.length})
              </summary>
              {proposal.rejected.map((r) => (
                <div key={`${r.line}-${r.value}`} className="cite">
                  line {r.line} · &ldquo;{r.value}&rdquo; — {r.reason}
                </div>
              ))}
            </details>
          ) : null}
          <div className="row end tail">
            <button onClick={onDiscard}>Discard all</button>
            <button
              className="primary"
              onClick={onConfirm}
              disabled={proposal.candidates.length === 0}
            >
              {proposal.mode === 'replace' ? 'Start record with these' : 'Add these to the record'}
            </button>
          </div>
        </div>
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
