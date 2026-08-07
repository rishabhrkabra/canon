import { describe, it, expect } from 'vitest';
import {
  applyCandidates,
  buildFacts,
  isIsoDate,
  isValidCandidate,
  verifyReceipts,
} from './engine';
import type { Candidate } from './types';

const c = (
  entity: string,
  property: string,
  value: string,
  observedAt: string,
  sourceLine = 1,
): Candidate => ({
  entity, property, value, observedAt, sourceLine,
  sourceSpan: `${observedAt}: ${entity} ${property} ${value}`,
});

describe('supersede', () => {
  it('closes the old value at the new date and links both ways', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
    ]);
    const jay = facts.find((f) => f.value === 'Jay')!;
    const neha = facts.find((f) => f.value === 'Neha')!;

    expect(jay.status).toBe('superseded');
    expect(jay.validFrom).toBe('2026-07-01');
    expect(jay.validUntil).toBe('2026-07-28'); // exclusive
    expect(jay.supersededBy).toBe(neha.id);

    expect(neha.status).toBe('active');
    expect(neha.validFrom).toBe('2026-07-28');
    expect(neha.validUntil).toBeUndefined();
    expect(neha.supersedes).toBe(jay.id);
  });

  it('handles a three-step chain with exactly one active fact', () => {
    const { facts } = buildFacts([
      c('Atlas', 'launch', '2026-08-15', '2026-07-01', 1),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
      c('Atlas', 'launch', '2026-09-19', '2026-08-02', 3),
    ]);
    expect(facts.filter((f) => f.status === 'active')).toHaveLength(1);
    expect(facts.find((f) => f.status === 'active')!.value).toBe('2026-09-19');
    expect(facts.find((f) => f.value === '2026-08-15')!.validUntil).toBe('2026-07-20');
    expect(facts.find((f) => f.value === '2026-09-05')!.validUntil).toBe('2026-08-02');
  });

  it('is order-independent: shuffled input produces the same truth', () => {
    const lines = [
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 3),
      c('Atlas', 'launch', '2026-09-05', '2026-07-20', 2),
    ];
    const forward = buildFacts(lines).facts;
    const shuffled = buildFacts([lines[2], lines[0], lines[1]]).facts;
    const shape = (fs: typeof forward) =>
      fs.map((f) => `${f.property}=${f.value}:${f.status}:${f.validFrom}-${f.validUntil ?? ''}`).sort();
    expect(shape(shuffled)).toEqual(shape(forward));
  });
});

describe('conflict', () => {
  it('marks BOTH sides conflicted when values clash on the same day', () => {
    const { facts, records } = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-25', 4),
      c('Atlas', 'status', 'red', '2026-07-25', 5),
    ]);
    expect(facts).toHaveLength(2);
    expect(facts.every((f) => f.status === 'conflicted')).toBe(true);
    expect(facts[0].conflictsWith).toContain(facts[1].id);
    expect(facts[1].conflictsWith).toContain(facts[0].id);
    expect(records.at(-1)!.outcome).toBe('conflict');
  });

  it('does not conflict with a value that was already superseded', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
      c('Atlas', 'owner', 'Priya', '2026-07-28', 3), // clashes with Neha only
    ]);
    expect(facts.find((f) => f.value === 'Jay')!.status).toBe('superseded');
    expect(facts.find((f) => f.value === 'Neha')!.status).toBe('conflicted');
    expect(facts.find((f) => f.value === 'Priya')!.status).toBe('conflicted');
  });
});

describe('backfill — late evidence about the past', () => {
  // Within ONE paste, candidates are sorted chronologically first, so an
  // out-of-order line is simply applied in order and supersedes normally.
  // Backfill is specifically the CROSS-PASTE case: state already exists, and
  // new evidence describes a time before it. That is the case that must not
  // disturb the present.
  it('within a single paste, an out-of-order line still supersedes correctly', () => {
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Neha', '2026-07-28', 1),
      c('Atlas', 'owner', 'Jay', '2026-07-01', 2),
    ]);
    expect(facts.find((f) => f.value === 'Jay')!.validUntil).toBe('2026-07-28');
    expect(facts.find((f) => f.value === 'Neha')!.status).toBe('active');
  });

  it('inserts closed history without disturbing the present', () => {
    const first = buildFacts([c('Atlas', 'owner', 'Neha', '2026-07-28', 1)]).facts;
    const { facts, records } = applyCandidates(first, [
      c('Atlas', 'owner', 'Jay', '2026-07-01', 2), // learned later, happened earlier
    ]);
    const jay = facts.find((f) => f.value === 'Jay')!;
    const neha = facts.find((f) => f.value === 'Neha')!;

    expect(records.at(-1)!.outcome).toBe('backfilled');
    expect(jay.status).toBe('superseded');    // born closed
    expect(jay.validFrom).toBe('2026-07-01');
    expect(jay.validUntil).toBe('2026-07-28');
    expect(jay.supersededBy).toBe(neha.id);
    expect(neha.status).toBe('active');       // present untouched
    expect(neha.validUntil).toBeUndefined();
    expect(neha.supersedes).toBe(jay.id);
  });
});

describe('regressions — three ways the engine was wrong', () => {
  // All three were found by an adversarial audit, reproduced as failing tests
  // before anything was changed, and share one root cause: the engine judged a
  // candidate against "the live fact" instead of "the fact in force on that
  // candidate's own date".

  it('a value that returns to an earlier value becomes current again', () => {
    // Was: the second Jay observation matched the OLD superseded Jay fact and
    // was swallowed as corroboration, leaving Neha current forever.
    const { facts } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
      c('Atlas', 'owner', 'Jay', '2026-08-10', 3),
    ]);
    const live = facts.filter((f) => f.validUntil === undefined);
    expect(live).toHaveLength(1);
    expect(live[0].value).toBe('Jay');
    expect(live[0].validFrom).toBe('2026-08-10');
    // The first stint is untouched history, not overwritten.
    const firstStint = facts.find((f) => f.value === 'Jay' && f.validFrom === '2026-07-01')!;
    expect(firstStint.validUntil).toBe('2026-07-28');
    expect(firstStint.corroborations).toBe(1);
  });

  it('a second backfill lands inside the first instead of overlapping it', () => {
    // Was: both backfilled facts closed at 2026-07-28, so two different values
    // both claimed 20 July.
    const first = buildFacts([c('Atlas', 'owner', 'Neha', '2026-07-28', 1)]).facts;
    const { facts } = applyCandidates(first, [
      c('Atlas', 'owner', 'Jay', '2026-07-01', 2),
      c('Atlas', 'owner', 'Sam', '2026-07-15', 3),
    ]);
    const jay = facts.find((f) => f.value === 'Jay')!;
    const sam = facts.find((f) => f.value === 'Sam')!;
    const neha = facts.find((f) => f.value === 'Neha')!;

    expect(jay.validFrom).toBe('2026-07-01');
    expect(jay.validUntil).toBe('2026-07-15');   // closes where Sam begins
    expect(sam.validFrom).toBe('2026-07-15');
    expect(sam.validUntil).toBe('2026-07-28');   // closes where Neha begins
    expect(neha.validUntil).toBeUndefined();     // present untouched

    // The chain links to the real neighbours, not to whatever is current.
    expect(jay.supersededBy).toBe(sam.id);
    expect(sam.supersededBy).toBe(neha.id);

    // No date is covered by two values at once.
    for (const day of ['2026-07-05', '2026-07-20', '2026-08-01']) {
      const covering = facts.filter(
        (f) => f.validFrom <= day && (f.validUntil === undefined || day < f.validUntil),
      );
      expect(covering, `${day} covered by ${covering.length} facts`).toHaveLength(1);
    }
  });

  it('a later observation resolves a conflict instead of it lasting forever', () => {
    const { facts } = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-20', 1),
      c('Atlas', 'status', 'red', '2026-07-20', 2),
      c('Atlas', 'status', 'yellow', '2026-07-21', 3),
    ]);
    const yellow = facts.find((f) => f.value === 'yellow')!;
    expect(yellow.validUntil).toBeUndefined();

    // Both sides of the settled conflict are closed, and stay on the record.
    for (const v of ['green', 'red']) {
      const f = facts.find((x) => x.value === v)!;
      expect(f.status).toBe('conflicted');
      expect(f.validUntil).toBe('2026-07-21');
    }
  });

  it('a repeat of one side settles a conflict instead of prolonging it', () => {
    // Second audit round. Was: "green" on the 21st was counted as another vote
    // for the historical green, so the pair stayed conflicted forever. Backing
    // one side of a contradiction is a resolution, not corroboration.
    const { facts } = buildFacts([
      c('Atlas', 'status', 'green', '2026-07-20', 1),
      c('Atlas', 'status', 'red', '2026-07-20', 2),
      c('Atlas', 'status', 'green', '2026-07-21', 3),
    ]);
    const live = facts.filter((f) => f.validUntil === undefined);
    expect(live).toHaveLength(1);
    expect(live[0].value).toBe('green');
    expect(live[0].status).toBe('active');
    expect(live[0].validFrom).toBe('2026-07-21');

    // Both original sides are closed, and still on the record as history.
    for (const v of ['green', 'red']) {
      const historical = facts.find(
        (f) => f.value === v && f.validFrom === '2026-07-20',
      )!;
      expect(historical.status).toBe('conflicted');
      expect(historical.validUntil).toBe('2026-07-21');
    }
  });

  it('rejects a receipt that cites nothing', () => {
    const base = c('Atlas', 'owner', 'Jay', '2026-07-01', 1);
    expect(isValidCandidate({ ...base, sourceSpan: '' })).toBe(false);
    expect(isValidCandidate({ ...base, sourceSpan: '   ' })).toBe(false);
    expect(isValidCandidate({ ...base, sourceLine: 0 })).toBe(false);
    expect(isValidCandidate({ ...base, sourceLine: -3 })).toBe(false);
    expect(isValidCandidate({ ...base, sourceLine: 1.5 })).toBe(false);
    const { verified, rejected } = verifyReceipts(
      [{ ...base, sourceSpan: '' }],
      '2026-07-01: Atlas owner is Jay',
    );
    expect(verified).toHaveLength(0);
    expect(rejected[0].reason).toContain('cites no text');
  });

  it('rejects dates that match the shape but are not real days', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
    expect(isIsoDate('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isIsoDate('2028-02-29')).toBe(true);  // 2028 is
    expect(isIsoDate('2026-08-07')).toBe(true);
  });
});

describe('receipts must exist in the source', () => {
  const timeline = '2026-07-01: Atlas owner is Jay\n2026-07-28: Atlas owner is Neha';

  it('keeps candidates whose quote really appears on the line they cite', () => {
    const { verified, rejected } = verifyReceipts(
      [c('Atlas', 'owner', 'Jay', '2026-07-01', 1)].map((x) => ({
        ...x, sourceSpan: 'Atlas owner is Jay',
      })),
      timeline,
    );
    expect(verified).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('drops a fabricated quote, a missing line, and a mismatched date', () => {
    const bad = [
      { ...c('Atlas', 'owner', 'Jay', '2026-07-01', 1), sourceSpan: 'Atlas owner is Priya' },
      { ...c('Atlas', 'owner', 'Jay', '2026-07-01', 99), sourceSpan: 'Atlas owner is Jay' },
      { ...c('Atlas', 'owner', 'Neha', '2026-07-15', 2), sourceSpan: 'Atlas owner is Neha' },
    ];
    const { verified, rejected } = verifyReceipts(bad, timeline);
    expect(verified).toHaveLength(0);
    expect(rejected).toHaveLength(3);
    expect(rejected[0].reason).toContain('does not appear');
    expect(rejected[1].reason).toContain('does not exist');
    expect(rejected[2].reason).toContain('not that date');
  });
});

describe('the injection boundary', () => {
  it('a real quote cannot carry a value it never states', () => {
    // Audit: an injected instruction made the model emit status=compromised
    // while citing a genuine line that says "status green". Quote real, date
    // real, fact invented — and it sailed through. The span must state the
    // value.
    const line = '2026-07-20: Weekly review: Atlas status green.';
    const { verified, rejected } = verifyReceipts(
      [{ entity: 'Atlas', property: 'status', value: 'compromised',
         observedAt: '2026-07-20', sourceLine: 1,
         sourceSpan: 'Weekly review: Atlas status green' }],
      line,
    );
    expect(verified).toHaveLength(0);
    expect(rejected[0].reason).toContain('never states that value');
  });

  it('presence cannot read negation — which is why confirmation exists', () => {
    // Documented limitation, pinned so nobody mistakes the verifier for the
    // boundary: "is not compromised" CONTAINS "compromised", so this passes
    // the span check. The guarantee lives one layer up — extracted candidates
    // are proposals, and state.test.ts pins that truth state only changes on
    // explicit confirmation.
    const line = '2026-08-01: Atlas status is not compromised.';
    const { verified } = verifyReceipts(
      [{ entity: 'Atlas', property: 'status', value: 'compromised',
         observedAt: '2026-08-01', sourceLine: 1,
         sourceSpan: 'Atlas status is not compromised' }],
      line,
    );
    expect(verified).toHaveLength(1); // yes, it passes — see the comment
  });

  it('rejects a candidate about an entity the cited line never mentions', () => {
    const line = '2026-07-20: Weekly review: Atlas status green.';
    const { verified, rejected } = verifyReceipts(
      [{ entity: 'Mars', property: 'status', value: 'green',
         observedAt: '2026-07-20', sourceLine: 1,
         sourceSpan: 'Weekly review: Atlas status green' }],
      line,
    );
    expect(verified).toHaveLength(0);
    expect(rejected[0].reason).toContain('never mentions it');
  });

  it('still accepts a date written as prose', () => {
    const line = '2026-06-12: Atlas kickoff. Target launch August 15.';
    const { verified } = verifyReceipts(
      [{ entity: 'Atlas', property: 'launch', value: '2026-08-15',
         observedAt: '2026-06-12', sourceLine: 1,
         sourceSpan: 'Target launch August 15' }],
      line,
    );
    expect(verified).toHaveLength(1);
  });
});

describe('duplicate', () => {
  it('corroborates instead of inserting a second copy', () => {
    const { facts, records } = buildFacts([
      c('Atlas', 'owner', 'Jay', '2026-07-01', 1),
      c('Atlas', 'owner', 'jay', '2026-07-14', 2), // same value, different case
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].corroborations).toBe(2);
    expect(records.at(-1)!.outcome).toBe('duplicate');
  });
});

describe('validation and purity', () => {
  it('rejects malformed model output before it reaches truth state', () => {
    expect(isValidCandidate({ ...c('A', 'b', 'v', '2026-07-01'), observedAt: '20 July' })).toBe(false);
    expect(isValidCandidate({ ...c('A', 'b', 'v', '2026-07-01'), entity: '' })).toBe(false);
    expect(isValidCandidate(null)).toBe(false);
    const { facts } = buildFacts([
      { entity: 'Atlas', property: 'owner', value: 'Jay', observedAt: 'yesterday', sourceSpan: '', sourceLine: 1 } as never,
      c('Atlas', 'owner', 'Neha', '2026-07-28', 2),
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe('Neha');
  });

  it('does not mutate the fact table it was given', () => {
    const first = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts;
    const snapshot = JSON.stringify(first);
    applyCandidates(first, [c('Atlas', 'owner', 'Neha', '2026-07-28', 2)]);
    expect(JSON.stringify(first)).toBe(snapshot);
  });

  it('produces stable ids across runs', () => {
    const a = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts[0].id;
    const b = buildFacts([c('Atlas', 'owner', 'Jay', '2026-07-01', 1)]).facts[0].id;
    expect(a).toBe(b);
  });
});
