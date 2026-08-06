'use client';

import { useMemo, useState } from 'react';
import { gateAction, type GateVerdict } from '../lib/gate';
import type { Fact, PremiseCheck } from '../lib/types';

const PRESETS = [
  'Remind Jay Menon that Atlas launches on 15 August.',
  'Tell Jay Menon that Atlas is green.',
  'Send the Atlas plan to Neha Rao for 2026-09-19.',
  'Ask Jay Menon for the Borealis update.',
];

const VERDICT_LABEL: Record<GateVerdict, string> = {
  ALLOW: 'Allow',
  BLOCK_STALE: 'Blocked — out of date',
  BLOCK_CONFLICT: 'Blocked — sources disagree',
  NEEDS_EVIDENCE: 'Needs evidence',
};

const VERDICT_CLASS: Record<GateVerdict, string> = {
  ALLOW: 'v-allow',
  BLOCK_STALE: 'v-stale',
  BLOCK_CONFLICT: 'v-conflict',
  NEEDS_EVIDENCE: 'v-unknown',
};

function CheckRow({ check }: { check: PremiseCheck }) {
  return (
    <div className={`notice ${check.verdict === 'current' ? 'ok' : 'bad'}`}>
      <div className="row">
        <span className={`chip ${check.verdict === 'current' ? 'current' : check.verdict}`}>
          {check.verdict === 'current' ? 'still true' : check.verdict}
        </span>
        <span className="mono small">
          assumes {check.premise.entity} {check.premise.property} ={' '}
          &ldquo;{check.premise.assumedValue}&rdquo;
        </span>
      </div>
      <p className="tail">{check.explanation}</p>
      {check.supersededBy ? (
        <div className="cite">
          line {check.supersededBy.sourceLine} · {check.supersededBy.observedAt} ·{' '}
          &ldquo;{check.supersededBy.sourceSpan}&rdquo;
        </div>
      ) : null}
    </div>
  );
}

/**
 * The product, in one interaction: an action goes in, a verdict comes out.
 *
 * Runs entirely in the browser against the deterministic engine — no model, no
 * network, no API key. That matters here more than anywhere else on the page:
 * the one thing a reviewer must be able to try is the one thing that cannot be
 * allowed to depend on a key being present.
 */
export function ActionGate({ facts }: { facts: Fact[] }) {
  const [action, setAction] = useState(PRESETS[0]);
  const result = useMemo(() => gateAction(facts, action), [facts, action]);
  const blocked = result.verdict !== 'ALLOW';

  return (
    <section className="panel step">
      <div className="steptag">The whole idea</div>
      <h2 className="big">Check an action before it goes out</h2>
      <p className="lead">
        Type what you&rsquo;re about to have an agent do. Anything in it that
        the record can speak to gets checked against <em>when</em> that was
        true.
      </p>

      <textarea
        className="actionbox"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        spellCheck={false}
        aria-label="Proposed action to check"
        placeholder="e.g. Remind Jay that Atlas launches on 15 August."
      />

      <div className="row tail">
        {PRESETS.map((p, i) => (
          <button
            key={p}
            className="tiny"
            aria-pressed={p === action}
            onClick={() => setAction(p)}
          >
            example {i + 1}
          </button>
        ))}
      </div>

      <div className={`verdict ${VERDICT_CLASS[result.verdict]}`}>
        <div className="vhead">
          <span className="vlabel">{VERDICT_LABEL[result.verdict]}</span>
          <code className="vcode">{result.verdict}</code>
        </div>
        <p className="vhead-sub">{result.headline}</p>
      </div>

      {result.checks.map((c) => (
        <CheckRow key={`${c.premise.entity}-${c.premise.property}`} check={c} />
      ))}

      {result.corrected && result.corrected !== result.action ? (
        <div className="side">
          <div>
            <div className="label">what you asked for</div>
            <p className="flush">{result.action}</p>
          </div>
          <div>
            <div className="label">what the record supports</div>
            <p className="flush">{result.corrected}</p>
          </div>
        </div>
      ) : null}

      {blocked ? null : (
        <p className="faint small tail">
          Approved on evidence, not on absence of doubt — every claim above
          carries the line it came from.
        </p>
      )}

      <details>
        <summary>What this check can and can&rsquo;t see</summary>
        <p className="dim">
          It finds claims by matching things already on record — names, dates,
          values — including dates written the way people write them
          (&ldquo;15 August&rdquo;, &ldquo;Aug 15&rdquo;,
          &ldquo;15/08/2026&rdquo;). When the action names a project, only that
          project&rsquo;s record is checked, so someone who moved teams
          isn&rsquo;t flagged on the project they actually run now.
        </p>
        <p className="dim flush">
          It cannot read an assumption that never names anything on record —
          &ldquo;chase the usual person about this&rdquo; gets{' '}
          <code>NEEDS_EVIDENCE</code>, not approval. That is the deliberate
          answer: no basis to check is not the same as nothing to worry about.
          A language model widens what gets spotted; it never decides the
          verdict.
        </p>
      </details>
    </section>
  );
}
