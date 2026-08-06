'use client';

import type { Fact } from '../lib/types';

/**
 * Facts that contradicted each other on the same day.
 *
 * The split matters. An UNRESOLVED contradiction still blocks answers right
 * now — nothing in the evidence orders it, and picking a side would be
 * inventing one. A SETTLED contradiction was overtaken by a later observation:
 * it is history, and labelling it "unresolved" tells the reader the system is
 * still stuck on something it has actually moved past.
 */
function Group({
  facts,
  settled,
}: {
  facts: Fact[];
  settled: boolean;
}) {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    const k = `${f.entity}::${f.property}::${f.validFrom}`;
    const g = groups.get(k);
    if (g) g.push(f);
    else groups.set(k, [f]);
  }

  return (
    <>
      {[...groups.entries()].map(([k, fs]) => (
        <div key={k}>
          <h3>
            {fs[0].entity} · {fs[0].property}{' '}
            <span className={`chip ${settled ? 'superseded' : 'conflicted'}`}>
              {settled ? 'settled later' : 'unresolved'}
            </span>
          </h3>
          <p className="dim small">
            {settled
              ? `Contradicted each other on ${fs[0].observedAt}, then a later observation on ${fs[0].validUntil} settled it. Kept as history.`
              : `Both observed ${fs[0].observedAt}. Nothing orders them, so no value is reported for this property.`}
          </p>
          {fs.map((f) => (
            <div key={f.id} className="cite">
              line {f.sourceLine} · &ldquo;{f.value}&rdquo; — {f.sourceSpan}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function ConflictBin({ facts }: { facts: Fact[] }) {
  const conflicted = facts.filter((f) => f.status === 'conflicted');
  const open = conflicted.filter((f) => f.validUntil === undefined);
  const closed = conflicted.filter((f) => f.validUntil !== undefined);

  return (
    <section className="panel">
      <h2>Conflict bin</h2>
      {open.length === 0 ? (
        <p className="dim">No unresolved contradictions in the current evidence.</p>
      ) : (
        <Group facts={open} settled={false} />
      )}

      {closed.length > 0 ? (
        <details>
          <summary>
            Settled contradictions ({new Set(closed.map((f) => f.validFrom)).size})
          </summary>
          <Group facts={closed} settled />
        </details>
      ) : null}
    </section>
  );
}
