/**
 * AsOf — core types.
 *
 * Design rule that governs this whole file: **dates are ISO `YYYY-MM-DD`
 * strings, never Date objects.** Lexicographic comparison equals chronological
 * comparison for that format, so the engine needs no date library, and there
 * is no timezone to shift a fact onto the wrong day. A temporal linter that
 * gets days wrong is worse than no linter.
 */

/** ISO calendar day, `YYYY-MM-DD`. Compared with `<` / `>` directly. */
export type IsoDate = string;

/**
 * What the model is allowed to produce. Note what is absent: no status, no
 * validity interval, no supersedes pointer. The model nominates observations;
 * it never decides what is true.
 */
export interface Candidate {
  entity: string;
  property: string;
  value: string;
  /** The day this was observed — the date on the source line. */
  observedAt: IsoDate;
  /** Verbatim text this was taken from, so every fact can cite itself. */
  sourceSpan: string;
  /** 1-based index of the timeline line it came from. */
  sourceLine: number;
}

export type FactStatus =
  /** True as of now, per the evidence we have. */
  | 'active'
  /** Was true, later replaced by a newer observation. History, not error. */
  | 'superseded'
  /** Contradicted by an equally-dated observation. Truth unknown. */
  | 'conflicted';

export interface Fact {
  id: string;
  entity: string;
  property: string;
  value: string;
  observedAt: IsoDate;
  /** Start of the interval this value is believed to hold. */
  validFrom: IsoDate;
  /**
   * End of the interval, EXCLUSIVE. `undefined` means "still holds".
   * Half-open `[validFrom, validUntil)` — so a value replaced on the 20th is
   * not also true on the 20th. Every boundary test in the suite pins this.
   */
  validUntil?: IsoDate;
  status: FactStatus;
  /** The fact this one replaced. */
  supersedes?: string;
  /** The fact that replaced this one. */
  supersededBy?: string;
  /** Ids of facts this one is in unresolved conflict with. */
  conflictsWith?: string[];
  /** How many separate observations asserted the same value. */
  corroborations: number;
  sourceSpan: string;
  sourceLine: number;
}

/** What the engine did with a candidate, and why. Rendered in the UI. */
export type ApplyOutcome =
  | 'added'
  | 'superseded'
  | 'backfilled'
  | 'duplicate'
  | 'conflict';

export interface ApplyRecord {
  outcome: ApplyOutcome;
  candidate: Candidate;
  /** The fact created, if any. */
  factId?: string;
  /** The fact affected (superseded, corroborated, or conflicted with). */
  relatedFactId?: string;
  /** Plain-English reason, shown to the user. The engine explains itself. */
  reason: string;
}

export interface ApplyResult {
  facts: Fact[];
  records: ApplyRecord[];
}

/** The three answers a temporal query can give. The third one is the product. */
export type QueryVerdict = 'known' | 'unknown' | 'conflicted';

export interface QueryResult {
  verdict: QueryVerdict;
  entity: string;
  property: string;
  /** Present only when verdict === 'known'. */
  value?: string;
  /** The fact(s) the answer rests on — never an answer without a citation. */
  citations: Fact[];
  /** Plain-English explanation, including why an answer was withheld. */
  explanation: string;
}

export type PremiseVerdict = 'current' | 'stale' | 'unknown' | 'conflicted';

/** A claim embedded in a user's question, extracted so it can be checked. */
export interface Premise {
  entity: string;
  property: string;
  /** What the question assumes the value is. */
  assumedValue: string;
  /** The words in the question that carried the assumption. */
  sourceSpan: string;
}

export interface PremiseCheck {
  premise: Premise;
  verdict: PremiseVerdict;
  /** What the evidence actually says now. */
  currentValue?: string;
  /** The fact that invalidated the assumption — the receipt for a rejection. */
  supersededBy?: Fact;
  /** Facts the verdict rests on, when the rejection cites more than one. */
  citations?: Fact[];
  explanation: string;
}
