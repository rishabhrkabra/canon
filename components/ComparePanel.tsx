'use client';

import { checkPremises, hasBlockingPremise, queryAsOf, queryNow } from '../lib/query';
import { DEMO_QUESTIONS } from '../fixtures/demo-questions';
import type { Fact } from '../lib/types';

/**
 * Side-by-side, with an honesty label that stays on the panel: the left column
 * is a hand-written illustration of the standard failure mode, not a measured
 * baseline. Claiming otherwise would be a fabricated benchmark, and the whole
 * point of this project is not doing that.
 */
export function ComparePanel({ facts }: { facts: Fact[] }) {
  return (
    <section className="panel">
      <h2>Without AsOf / with AsOf</h2>
      <p className="dim small">
        Left column: what a system that retrieves by similarity and has no
        notion of validity intervals typically returns. These are written by
        hand to illustrate the failure mode — not output from a measured
        baseline run. Right column is computed live by the engine.
      </p>

      {DEMO_QUESTIONS.map((q) => {
        const checks = q.premises ? checkPremises(facts, q.premises) : null;
        const result = q.query
          ? q.query.asOf
            ? queryAsOf(facts, q.query.entity, q.query.property, q.query.asOf)
            : queryNow(facts, q.query.entity, q.query.property)
          : null;

        const right = checks
          ? hasBlockingPremise(checks)
            ? `Blocked: ${checks
                .filter((c) => c.verdict !== 'current')
                .map((c) => `"${c.premise.assumedValue}" is ${c.verdict}`)
                .join('; ')}. ${q.correctedDraft ?? ''}`
            : 'All assumptions current — proceeding.'
          : result!.explanation;

        return (
          <div key={q.id} className="cmp">
            <p className="mono small flush">{q.question}</p>
            <div className="side">
              <div>
                <div className="label">no temporal check</div>
                <p className="flush">{q.naiveAnswer}</p>
              </div>
              <div>
                <div className="label">asof</div>
                <p className="flush">{right}</p>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
