/**
 * Canon — the gate. This is the job the product actually exists to do.
 *
 * Knowing what is true is the means. The end is stopping an agent from acting
 * on something that stopped being true. So: hand it a proposed action in plain
 * text, and it returns one of four verdicts plus the receipts behind it.
 *
 * Everything here is deterministic and works with no model and no network. It
 * finds claims by looking for values the engine already has a record of — if
 * the fact table knows "Jay Menon" was once the owner of Atlas, then an action
 * mentioning Jay is making a claim about Atlas, whether or not it says so.
 *
 * That is a narrower detector than a language model (it cannot read an
 * implication that never names anything on record), but it is exact, it never
 * invents a premise, and it does not stop working when a key is missing.
 */

import { checkPremises } from './query';
import type { Fact, IsoDate, Premise, PremiseCheck } from './types';

export type GateVerdict = 'ALLOW' | 'BLOCK_STALE' | 'BLOCK_CONFLICT' | 'NEEDS_EVIDENCE';

export interface GateResult {
  verdict: GateVerdict;
  action: string;
  checks: PremiseCheck[];
  /** The action rewritten with expired values replaced. Only when blocked. */
  corrected?: string;
  headline: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Ways a person might write a date that the fact table stores as ISO. Without
 * this, "launches on 15 August" would sail through while "2026-08-15" is
 * caught — and the friendlier phrasing is the one people actually use.
 */
function dateAliases(value: string): string[] {
  const m = ISO.exec(value);
  if (!m) return [];
  const [, y, mo, d] = m;
  const monthName = MONTHS[Number(mo) - 1];
  const short = monthName.slice(0, 3);
  const day = String(Number(d));
  return [
    `${day} ${monthName}`, `${day} ${short}`,
    `${monthName} ${day}`, `${short} ${day}`,
    `${day} ${monthName} ${y}`, `${monthName} ${day}, ${y}`,
    `${d}/${mo}/${y}`, `${mo}/${d}/${y}`,
  ];
}

/**
 * People are referred to by first name, in drafts and in requests. The record
 * stores "Jay Menon"; a real message says "Hi Jay". Requiring the full string
 * misses the error that matters most — the wrong recipient.
 *
 * Only offered when the first name is UNAMBIGUOUS among the values in scope.
 * With a "Jay Menon" and a "Jay Patel" on record, "Jay" resolves to neither,
 * because guessing which one a draft meant is exactly the kind of invention
 * this product exists to refuse.
 */
function firstNameAliases(values: readonly string[]): Map<string, string> {
  const byFirst = new Map<string, Set<string>>();
  for (const v of values) {
    const parts = v.trim().split(/\s+/);
    if (parts.length < 2) continue;
    if (!parts.every((t) => /^[A-Za-z][A-Za-z'’-]*$/.test(t))) continue;
    const first = parts[0].toLowerCase();
    const set = byFirst.get(first) ?? new Set<string>();
    set.add(v.trim().toLowerCase());
    byFirst.set(first, set);
  }
  const unique = new Map<string, string>();
  for (const [first, set] of byFirst) {
    if (set.size === 1) unique.set([...set][0], first);
  }
  return unique;
}

/** Whole-token match, so "Sam" never matches inside "Samuel". */
function mentions(haystack: string, needle: string): boolean {
  const h = ` ${haystack.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  const n = ` ${needle.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return n.trim().length > 0 && h.includes(n);
}

/**
 * Find the claims a proposed action is resting on.
 *
 * Only values already on record can be found — that is the honest limit of a
 * deterministic scan, and it is stated in the UI rather than hidden. One
 * premise per (entity, property): the most recent matching value wins, so an
 * action naming both an old and a new owner is judged on the old one.
 */
export function scanForPremises(facts: readonly Fact[], action: string): Premise[] {
  const byPair = new Map<string, { premise: Premise; validFrom: IsoDate }>();

  // Scope by entity when the action names one. A person can be current on one
  // project and long gone from another, so "ask Jay about Borealis" must not
  // be blocked by Jay's history on Atlas. Naming the project is the user
  // telling us which record to check against.
  const named = [...new Set(facts.map((f) => f.entity))].filter((e) =>
    mentions(action, e),
  );
  const inScope = named.length > 0
    ? facts.filter((f) => named.includes(f.entity))
    : facts;

  const nameAlias = firstNameAliases(inScope.map((f) => f.value));

  for (const f of inScope) {
    const alias = nameAlias.get(f.value.trim().toLowerCase());
    const candidates = [
      f.value,
      ...dateAliases(f.value),
      ...(alias ? [alias] : []),
    ];
    // Longest match wins. "August 15" and "August 15, 2026" both match a draft
    // containing the latter; replacing the short one leaves an orphan year and
    // produces "2026-09-19, 2026".
    const hit = candidates
      .filter((v) => mentions(action, v))
      .toSorted((a, b) => b.length - a.length)[0];
    if (!hit) continue;

    const pairKey = `${f.entity.toLowerCase()}::${f.property.toLowerCase()}`;
    const existing = byPair.get(pairKey);
    // Prefer the OLDEST matched value: if the action names a stale value, that
    // is the assumption worth flagging, even when it also names a current one.
    if (existing && existing.validFrom <= f.validFrom) continue;

    byPair.set(pairKey, {
      validFrom: f.validFrom,
      premise: {
        entity: f.entity,
        property: f.property,
        assumedValue: f.value,
        sourceSpan: hit,
      },
    });
  }

  return [...byPair.values()].map((v) => v.premise);
}

/**
 * Swap every expired value in the action text for the one that replaced it.
 *
 * A deliberate limit: this substitutes VALUES, it does not rewrite prose. A
 * draft saying "the original launch target date of August 15" still says
 * "original" after the date is corrected, and is then fluent and wrong. So the
 * result is offered as corrected values, never as a message vouched for
 * sentence by sentence. Producing confident text nobody checked is the failure
 * this product exists to prevent; it would be absurd to commit it here.
 */
function rewrite(action: string, checks: readonly PremiseCheck[]): string {
  let out = action;
  for (const c of checks) {
    if (c.verdict !== 'stale' || !c.currentValue) continue;
    for (const form of [c.premise.sourceSpan, c.premise.assumedValue]) {
      if (!form) continue;
      const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'gi');
      if (re.test(out)) {
        out = out.replace(re, c.currentValue);
        break;
      }
    }
  }
  return out;
}

/**
 * The whole product in one function: proposed action in, verdict out.
 *
 * Precedence is deliberate. A contradiction outranks a stale value, because
 * "we do not know" is a worse basis for acting than "we know, and you are
 * behind". Both outrank ALLOW.
 */
export function gateAction(facts: readonly Fact[], action: string): GateResult {
  const trimmed = action.trim();
  if (!trimmed) {
    return {
      verdict: 'NEEDS_EVIDENCE',
      action: trimmed,
      checks: [],
      headline: 'Nothing to check yet.',
    };
  }

  const premises = scanForPremises(facts, trimmed);
  if (premises.length === 0) {
    return {
      verdict: 'NEEDS_EVIDENCE',
      action: trimmed,
      checks: [],
      headline:
        'Nothing in this action matches anything on record, so there is no ' +
        'basis to approve it. Silence is not the same as agreement.',
    };
  }

  const checks = checkPremises(facts, premises);
  const stale = checks.filter((c) => c.verdict === 'stale');
  const conflicted = checks.filter((c) => c.verdict === 'conflicted');
  const unknown = checks.filter((c) => c.verdict === 'unknown');

  if (conflicted.length > 0) {
    return {
      verdict: 'BLOCK_CONFLICT',
      action: trimmed,
      checks,
      headline:
        `The evidence contradicts itself on ${conflicted
          .map((c) => `${c.premise.entity} ${c.premise.property}`)
          .join(', ')}. No value can be confirmed, so this should not go out.`,
    };
  }

  if (stale.length > 0) {
    return {
      verdict: 'BLOCK_STALE',
      action: trimmed,
      checks,
      corrected: rewrite(trimmed, checks),
      headline:
        stale.length === 1
          ? `This rests on one thing that stopped being true.`
          : `This rests on ${stale.length} things that stopped being true.`,
    };
  }

  if (unknown.length > 0) {
    return {
      verdict: 'NEEDS_EVIDENCE',
      action: trimmed,
      checks,
      headline: 'Part of this has never been observed, so it cannot be confirmed.',
    };
  }

  return {
    verdict: 'ALLOW',
    action: trimmed,
    checks,
    headline: 'Everything this action assumes is still true, with receipts.',
  };
}
