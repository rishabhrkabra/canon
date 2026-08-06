/** Server component — static content, no client JS. */

export function BuildDecisions() {
  return (
    <section className="panel">
      <h2>Build decisions</h2>

      <h3>What the model is allowed to do</h3>
      <p className="dim">
        Nominate candidate observations from text, and nothing else. It never
        decides what is true. Every candidate is schema-validated before the
        engine sees it, because schema-constrained output is a strong hint, not
        a guarantee — malformed candidates are dropped, not coerced.
      </p>

      <h3>What is deterministic</h3>
      <ul className="tight dim">
        <li>Supersede chains, conflict detection, historical backfill.</li>
        <li>All temporal queries — <code>now</code>, <code>as-of</code>, and the boundary rules.</li>
        <li>Premise verdicts and whether a draft is blocked.</li>
      </ul>
      <p className="dim">
        The engine is pure: no clock, no randomness, no network. Same input,
        same output, every run — which is why the whole thing is testable and
        replayable, and why a wrong answer is a bug rather than a temperature
        setting.
      </p>

      <h3>Three answers, not two</h3>
      <p className="dim">
        Most systems can say a value or say they don&rsquo;t know. The third
        answer is the product: <em>I had evidence and it is no longer usable</em>
        {' '}— stale, or contradicted. A system that cannot tell &ldquo;never
        knew&rdquo; from &ldquo;knew, and it expired&rdquo; will act on expired
        facts with full confidence, and nothing about that output looks like a
        hallucination.
      </p>

      <h3>Dates</h3>
      <p className="dim">
        ISO <code>YYYY-MM-DD</code> strings everywhere, never{' '}
        <code>Date</code> objects. Lexicographic comparison equals chronological
        comparison for that format, so there is no date library and no timezone
        that can shift a fact onto the wrong day. Intervals are half-open{' '}
        <code>[validFrom, validUntil)</code>: a value replaced on the 28th is
        not also true on the 28th.
      </p>

      <h3>Cuts I made deliberately</h3>
      <ul className="tight dim">
        <li>
          <strong>No entity resolution.</strong> &ldquo;Atlas&rdquo; and
          &ldquo;Project Atlas&rdquo; are the same string after normalisation,
          but nothing fuzzy-matches. Wrong merges corrupt truth state silently,
          and a silent corruption is worse than a missed link.
        </li>
        <li>
          <strong>Conflicts are not auto-resolved.</strong> No source-priority
          heuristic, no recency tiebreak on same-day claims. The evidence does
          not order them, so neither does the engine.
        </li>
        <li>
          <strong>No persistence.</strong> State lives in one reducer for the
          session. The engine is a pure function over a fact table, so a
          database is a storage decision, not a design one.
        </li>
        <li>
          <strong>Premise extraction is single-turn.</strong> One question, one
          set of triples. No multi-hop reasoning over chained assumptions.
        </li>
      </ul>

      <h3>Known limitations</h3>
      <ul className="tight dim">
        <li>
          Observation date is taken from the line, so it conflates &ldquo;when
          it was recorded&rdquo; with &ldquo;when it became true&rdquo;. A full
          bitemporal model separates those; this one collapses them, which is
          fine for timelines and wrong for backdated records.
        </li>
        <li>
          Corroboration is a count, not a weight. Ten copies of one rumour
          outrank one primary source.
        </li>
        <li>
          A property that is genuinely multi-valued (two owners at once) reads
          as a conflict.
        </li>
      </ul>
    </section>
  );
}
