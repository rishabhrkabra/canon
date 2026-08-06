/**
 * Synthetic demo data. "Project Atlas" and everyone in it are invented for this
 * demo — no real project, company, or person appears anywhere in this repo.
 *
 * The timeline is built so that all four engine rules fire on one paste:
 *   line 4  duplicates line 3  → corroboration
 *   lines 5/6 clash same-day   → conflict bin
 *   lines 7, 8, 9 replace 1, 3, 2 → supersede chains
 * and so the launch date changes twice, which is what makes a stale premise
 * easy to demonstrate rather than merely assert.
 */

export const DEMO_TIMELINE = `2026-06-12: Kickoff. Project Atlas owner is Jay Menon. Target launch 2026-08-15.
2026-06-28: Atlas budget approved at 40L.
2026-07-02: Atlas launch moved to 2026-09-05 after the vendor slipped.
2026-07-14: Jay confirms Atlas is still tracking to 2026-09-05.
2026-07-20: Weekly review: Atlas status green.
2026-07-20: QA reports Atlas status red, two blocking defects.
2026-07-28: Neha Rao takes over as Atlas owner. Jay Menon moves to Borealis.
2026-08-02: Atlas launch pushed again to 2026-09-19.
2026-08-04: Atlas budget revised to 52L.`;

export const DEMO_TIMELINE_LINES = DEMO_TIMELINE.split('\n');
