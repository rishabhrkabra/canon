'use client';

import { checkPremises, hasBlockingPremise, queryAsOf, queryNow } from '../lib/query';
import { DEMO_QUESTIONS, type DemoQuestion } from '../fixtures/demo-questions';
import type { Fact, PremiseCheck, QueryResult } from '../lib/types';

const VERDICT_WORD: Record<string, string> = {
  known: 'Answer',
  unknown: "Don't know",
  conflicted: 'Sources disagree',
  current: 'Still true',
  stale: 'Out of date',
};

function Citations({ facts }: { facts: Fact[] }) {
  return facts.length === 0 ? null : (
    <>
      {facts.map((f) => (
        <div key={f.id} className="cite">
          line {f.sourceLine} · {f.observedAt} · &ldquo;{f.sourceSpan}&rdquo;
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
          {VERDICT_WORD[check.verdict] ?? check.verdict}
        </span>
        <span className="mono small">
          you assumed: {check.premise.entity} {check.premise.property} is{' '}
          &ldquo;{check.premise.assumedValue}&rdquo;
        </span>
      </div>
      <p className="tail">{check.explanation}</p>
      {check.supersededBy ? <Citations facts={[check.supersededBy]} /> : null}
    </div>
  );
}

function Answer({ result }: { result: QueryResult }) {
  const tone =
    result.verdict === 'known' ? 'ok' : result.verdict === 'conflicted' ? 'bad' : '';
  return (
    <div className={`notice ${tone}`}>
      <div className="row">
        <span className={`chip ${result.verdict}`}>{VERDICT_WORD[result.verdict]}</span>
        {result.value ? <strong className="answerval">{result.value}</strong> : null}
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
  const result = q?.query
    ? q.query.asOf
      ? queryAsOf(facts, q.query.entity, q.query.property, q.query.asOf)
      : queryNow(facts, q.query.entity, q.query.property)
    : null;

  return (
    <section className="panel step">
      <div className="steptag">Then — ask the same four here</div>
      <h2 className="big">Same file. Same questions.</h2>

      <div className="qlist tail">
        {DEMO_QUESTIONS.map((item) => (
          <button
            key={item.id}
            aria-pressed={item.id === selectedId}
            onClick={() => onSelect(item.id)}
          >
            <span className="qlabel">{item.label}</span>
            <span className="qq">{item.question}</span>
          </button>
        ))}
      </div>

      {q ? (
        <div>
          {checks ? (
            <>
              <p className={hasBlockingPremise(checks) ? 'blocked' : 'dim'}>
                {hasBlockingPremise(checks)
                  ? "Won't send it. The request is built on things that stopped being true."
                  : 'Everything this request assumes is still true.'}
              </p>
              {checks.map((c) => (
                <PremiseRow key={`${c.premise.property}-${c.premise.assumedValue}`} check={c} />
              ))}
              {q.correctedDraft && hasBlockingPremise(checks) ? (
                <div className="side">
                  <div>
                    <div className="label">you asked for</div>
                    <p className="flush">{q.question}</p>
                  </div>
                  <div>
                    <div className="label">what it should say</div>
                    <p className="flush">{q.correctedDraft}</p>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {result ? <Answer result={result} /> : null}

          <p className="faint small tail">
            <strong>What&rsquo;s actually in the file:</strong> {q.truth}
          </p>
        </div>
      ) : null}
    </section>
  );
}
