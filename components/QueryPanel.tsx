'use client';

import { checkPremises, hasBlockingPremise, queryAsOf, queryNow } from '../lib/query';
import { DEMO_QUESTIONS, type DemoQuestion } from '../fixtures/demo-questions';
import type { Fact, PremiseCheck, QueryResult } from '../lib/types';

function Citations({ facts }: { facts: Fact[] }) {
  return facts.length === 0 ? null : (
    <>
      {facts.map((f) => (
        <div key={f.id} className="cite">
          L{f.sourceLine} · {f.observedAt} · &ldquo;{f.sourceSpan}&rdquo;
        </div>
      ))}
    </>
  );
}

function PremiseRow({ check }: { check: PremiseCheck }) {
  const bad = check.verdict !== 'current';
  return (
    <div className={`notice ${bad ? 'bad' : 'ok'}`}>
      <div className="row">
        <span className={`chip ${check.verdict === 'current' ? 'current' : check.verdict}`}>
          {check.verdict}
        </span>
        <span className="mono">
          {check.premise.entity} · {check.premise.property} ={' '}
          &ldquo;{check.premise.assumedValue}&rdquo;
        </span>
      </div>
      <p className="tail">{check.explanation}</p>
      {check.supersededBy ? <Citations facts={[check.supersededBy]} /> : null}
    </div>
  );
}

function Answer({ result }: { result: QueryResult }) {
  return (
    <div className={`notice ${result.verdict === 'known' ? 'ok' : result.verdict === 'conflicted' ? 'bad' : ''}`}>
      <div className="row">
        <span className={`chip ${result.verdict}`}>{result.verdict}</span>
        {result.value ? <strong>{result.value}</strong> : null}
      </div>
      <p className="tail">{result.explanation}</p>
      <Citations facts={result.citations} />
    </div>
  );
}

export function QueryPanel({
  facts,
  selectedId,
  onSelect,
}: {
  facts: Fact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const q: DemoQuestion | undefined = DEMO_QUESTIONS.find((x) => x.id === selectedId);

  const checks = q?.premises ? checkPremises(facts, q.premises) : null;
  const result =
    q?.query
      ? q.query.asOf
        ? queryAsOf(facts, q.query.entity, q.query.property, q.query.asOf)
        : queryNow(facts, q.query.entity, q.query.property)
      : null;

  return (
    <section className="panel">
      <h2>Ask</h2>
      <div className="qlist">
        {DEMO_QUESTIONS.map((item) => (
          <button
            key={item.id}
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          >
            {item.question}
          </button>
        ))}
      </div>

      {q ? (
        <div className="answer">
          {checks ? (
            <>
              <p className="dim small tail">
                {hasBlockingPremise(checks)
                  ? 'Blocked — the request assumes something the evidence no longer supports.'
                  : 'All assumptions check out against current evidence.'}
              </p>
              {checks.map((c) => (
                <PremiseRow key={`${c.premise.property}-${c.premise.assumedValue}`} check={c} />
              ))}
              {q.correctedDraft && hasBlockingPremise(checks) ? (
                <div className="side">
                  <div>
                    <div className="label">Original request</div>
                    <p className="flush">{q.question}</p>
                  </div>
                  <div>
                    <div className="label">Corrected draft</div>
                    <p className="flush">{q.correctedDraft}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {result ? <Answer result={result} /> : null}

          <details>
            <summary>Why this question is here</summary>
            <p className="dim flush">{q.point}</p>
          </details>
        </div>
      ) : null}
    </section>
  );
}
