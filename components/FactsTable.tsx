'use client';

import { holdsOn } from '../lib/query';
import type { Fact, IsoDate } from '../lib/types';

/**
 * Truth state, viewable at any date. Moving the date scrubber recomputes
 * nothing — every interval is already stored, so the table is just a filter
 * over facts that hold on that day. History is queryable because it was
 * never overwritten.
 */
export function FactsTable({
  facts,
  asOf,
  onAsOf,
}: {
  facts: Fact[];
  asOf: IsoDate | '';
  onAsOf: (d: IsoDate | '') => void;
}) {
  // Every day on which some value started applying — the only dates where the
  // table looks different, so the only ones worth offering as jumps.
  const changeDates = [...new Set(facts.map((f) => f.validFrom))].toSorted();

  const settled = facts.filter((f) => f.status !== 'conflicted');
  const shown = asOf ? settled.filter((f) => holdsOn(f, asOf)) : settled;
  const ordered = shown.toSorted(
    (a, b) =>
      a.property.localeCompare(b.property) || (a.validFrom < b.validFrom ? -1 : 1),
  );

  return (
    <section className="panel">
      <div className="row spread">
        <h2 className="flush">Facts</h2>
        <div className="row">
          <label className="faint small" htmlFor="asof">view as of</label>
          <input
            id="asof"
            className="dateinput"
            type="date"
            value={asOf}
            onChange={(e) => onAsOf(e.target.value)}
          />
        </div>
      </div>

      {changeDates.length > 0 ? (
        <div className="row jumps">
          <span className="faint small">jump to a day something changed:</span>
          {changeDates.map((d) => (
            <button
              key={d}
              className="tiny"
              aria-pressed={asOf === d}
              onClick={() => onAsOf(d)}
            >
              {d}
            </button>
          ))}
          <button className="tiny" aria-pressed={asOf === ''} onClick={() => onAsOf('')}>
            now
          </button>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <p className="dim">
          {facts.length === 0
            ? 'No evidence yet — load the demo timeline or paste your own.'
            : `Nothing was known on ${asOf}.`}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Property</th>
              <th>Value</th>
              <th>Held</th>
              <th>Status</th>
              <th>Src</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((f) => (
              <tr key={f.id} className={f.status === 'superseded' ? 'is-superseded' : ''}>
                <td>{f.entity}</td>
                <td className="dim">{f.property}</td>
                <td className="val">
                  {f.value}
                  {f.corroborations > 1 ? (
                    <span className="faint mono"> ×{f.corroborations}</span>
                  ) : null}
                </td>
                <td className="mono dim">
                  {f.validFrom} → {f.validUntil ?? '—'}
                </td>
                <td>
                  <span className={`chip ${f.status}`}>{f.status}</span>
                </td>
                <td className="faint mono">L{f.sourceLine}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {asOf ? (
        <p className="faint small tail">
          Showing what was true on {asOf}. Intervals are half-open — a value
          replaced on a date is not also true on that date.
        </p>
      ) : null}
    </section>
  );
}
