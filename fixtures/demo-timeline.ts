/**
 * Synthetic demo data. "Project Atlas", "Project Borealis" and everyone in
 * them are invented for this demo — no real project, company, or person
 * appears anywhere in this repo.
 *
 * Built so the same file does double duty: the reviewer uploads it to their
 * own AI and watches it answer badly, then loads it here. Design notes:
 *
 *  - Long enough that the changes are buried, not adjacent.
 *  - TWO projects, so a name can be current in one place and stale in another.
 *    Jay is a real current owner — of Borealis, not Atlas. That is the trap.
 *  - Owner changes once, launch date twice, budget once.
 *  - Lines 8 and 9 contradict each other on the same day, and NOTHING ever
 *    resolves it.
 *  - Lines 12 and 13 contradict each other too — and line 15 settles it two
 *    days later. Telling those two situations apart is the pair that matters:
 *    one is still open, one is history.
 *  - Headcount is never mentioned, so "how many people" has no answer.
 *  - Lines 2 and 10 are noise: real project logs contain prose that carries
 *    no fact worth tracking.
 */

export const DEMO_TIMELINE = `2026-06-12: Kickoff for Project Atlas. Jay Menon owns it. Target launch 2026-08-15.
2026-06-15: Atlas scope locked: payments dashboard, refunds, dispute flow.
2026-06-28: Atlas budget approved at 40L.
2026-07-01: Project Borealis kicked off. Priya Nair owns Borealis.
2026-07-02: Atlas launch moved to 2026-09-05 after the vendor slipped.
2026-07-08: Borealis budget approved at 18L.
2026-07-14: Jay confirms Atlas is still tracking to 2026-09-05.
2026-07-20: Weekly review: Atlas status green.
2026-07-20: QA reports Atlas status red, two blocking defects.
2026-07-24: Atlas vendor contract renewed for another quarter.
2026-07-28: Neha Rao takes over as Atlas owner. Jay Menon moves to Borealis.
2026-07-30: Weekly review: Borealis status green.
2026-07-30: Ops reports Borealis status red, integration blocked.
2026-08-02: Atlas launch pushed again to 2026-09-19.
2026-08-03: Borealis status confirmed amber after triage.
2026-08-04: Atlas budget revised to 52L.
2026-08-05: Borealis launch target set to 2026-11-10.`;

export const DEMO_TIMELINE_LINES = DEMO_TIMELINE.split('\n');

/** Served at /project-atlas-log.md for the reviewer to download and upload. */
export const DOWNLOAD_FILENAME = 'project-atlas-log.md';

/**
 * The demo's fixed "today" — the date the recorded model runs were made.
 *
 * Fixed on purpose, twice over. The engine never reads a clock, so the caller
 * must say what day it is; and a demo pinned to synthetic 2026 dates would rot
 * silently if it used the real clock — a year from now every fact would read
 * as ancient history. When a reviewer starts their OWN record, the app reads
 * the real date once, in the event handler, where there is no server render to
 * disagree with.
 */
export const DEMO_TODAY = '2026-08-08';
