'use client';

import { useMemo } from 'react';
import { gateAction } from '../lib/gate';
import { AGENT_DRAFT, AGENT_STEPS } from '../fixtures/agent-run';
import type { Fact } from '../lib/types';

const ACTOR_LABEL = {
  agent: 'agent',
  memory: 'memory',
  canon: 'canon',
} as const;

/**
 * Where Canon sits in a system, rather than what it does on its own.
 *
 * The draft in step three is real recorded model output, not a strawman I
 * wrote. The verdict in step four is computed live from that text by the same
 * engine as the rest of the page. So the only staged part is the sequence —
 * and the sequence is the point.
 */
export function AgentLoop({ facts }: { facts: Fact[] }) {
  const result = useMemo(() => gateAction(facts, AGENT_DRAFT), [facts]);
  const stale = result.checks.filter((c) => c.verdict === 'stale');

  return (
    <section className="panel step">
      <div className="steptag">Where it sits</div>
      <h2 className="big">One step inside an agent loop</h2>
      <p className="lead">
        Canon isn&rsquo;t something you open. It&rsquo;s the check between
        deciding to act and acting — the last place a wrong belief can be caught
        before it becomes a sent message.
      </p>

      <ol className="loop">
        {AGENT_STEPS.map((s) => (
          <li key={s.key} className={`loop-${s.actor}`}>
            <div className="row">
              <span className={`chip actor-${s.actor}`}>{ACTOR_LABEL[s.actor]}</span>
              <strong>{s.label}</strong>
            </div>
            <p className={s.key === 'draft' ? 'draftbox' : 'dim tail'}>{s.detail}</p>
            {s.key === 'draft' ? (
              <p className="faint small tail">
                Verbatim from Gemini 3.1 Pro, 2026-08-07, given this same log.
                In the same reply it noted that Neha had taken over and the date
                had moved — underneath the draft, as prose. An agent takes the
                draft.
              </p>
            ) : null}
          </li>
        ))}

        <li className="loop-canon">
          <div className="row">
            <span className="chip actor-canon">canon</span>
            <strong>Verdict</strong>
            <code className="vcode">{result.verdict}</code>
          </div>

          <div className="verdict v-stale">
            <div className="vhead">
              <span className="vlabel">Held back</span>
            </div>
            <p className="vhead-sub">{result.headline}</p>
          </div>

          {stale.map((c) => (
            <div key={c.premise.property} className="notice bad">
              <div className="row">
                <span className="chip stale">expired</span>
                <span className="mono small">
                  the draft assumes {c.premise.entity} {c.premise.property} ={' '}
                  &ldquo;{c.premise.assumedValue}&rdquo;
                </span>
              </div>
              <p className="tail">{c.explanation}</p>
              {c.supersededBy ? (
                <div className="cite">
                  line {c.supersededBy.sourceLine} · {c.supersededBy.observedAt} ·{' '}
                  &ldquo;{c.supersededBy.sourceSpan}&rdquo;
                </div>
              ) : null}
            </div>
          ))}

          {stale.length > 0 ? (
            <div className="corrections">
              <div className="label">what the record says instead</div>
              {stale.map((c) => (
                <div key={c.premise.property} className="corr">
                  <span className="corr-prop">{c.premise.property}</span>
                  <span className="corr-old">{c.premise.assumedValue}</span>
                  <span className="corr-arrow">→</span>
                  <span className="corr-new">{c.currentValue}</span>
                  {c.supersededBy ? (
                    <span className="faint mono corr-src">
                      line {c.supersededBy.sourceLine}, {c.supersededBy.observedAt}
                    </span>
                  ) : null}
                </div>
              ))}
              <p className="faint small tail flush">
                Values, not a rewritten message. A find-and-replace would leave
                this draft saying &ldquo;the <em>original</em> launch target
                date of 2026-09-19&rdquo; — fluent, corrected, and still false.
                Canon hands back what it can prove and lets the agent write the
                sentence.
              </p>
            </div>
          ) : null}
        </li>
      </ol>

      <p className="dim">
        Two things were wrong and neither looks wrong. The date was superseded
        twice, and Jay handed Atlas over three weeks before this was written —
        he still owns a project, just not this one. Both errors are fluent,
        sourced, and confidently phrased.
      </p>
      <p className="dim flush">
        The verdict is a value an agent can branch on. That is the difference
        between this and a caveat: a pipeline reads{' '}
        <code>{result.verdict}</code> and stops. It cannot read a paragraph of
        hedging appended below the artifact it was asked to produce.
      </p>
    </section>
  );
}
