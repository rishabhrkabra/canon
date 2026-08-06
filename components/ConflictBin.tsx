'use client';

import type { Fact } from '../lib/types';

/**
 * Facts that contradict each other on the same day. They are held here rather
 * than resolved, because nothing in the evidence resolves them — picking the
 * higher-ranked chunk would be inventing an answer. The bin is the honest
 * output.
 */
export function ConflictBin({ facts }: { facts: Fact[] }) {
  const conflicted = facts.filter((f) => f.status === 'conflicted');

  const groups = new Map<string, Fact[]>();
  for (const f of conflicted) {
    const k = `${f.entity}::${f.property}`;
    const g = groups.get(k);
    if (g) g.push(f);
    else groups.set(k, [f]);
  }

  return (
    <section className="panel">
      <h2>Conflict bin</h2>
      {groups.size === 0 ? (
        <p className="dim">No contradictions in the current evidence.</p>
      ) : (
        [...groups.entries()].map(([k, fs]) => (
          <div key={k}>
            <h3>
              {fs[0].entity} · {fs[0].property}{' '}
              <span className="chip conflicted">unresolved</span>
            </h3>
            <p className="dim small">
              Both observed {fs[0].observedAt}. Nothing orders them, so no value
              is reported for this property.
            </p>
            {fs.map((f) => (
              <div key={f.id} className="cite">
                L{f.sourceLine} · &ldquo;{f.value}&rdquo; — {f.sourceSpan}
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
