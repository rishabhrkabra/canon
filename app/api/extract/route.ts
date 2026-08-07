import { NextResponse } from 'next/server';
import { isValidCandidate, verifyReceipts } from '../../../lib/engine';
import { NoKeyError, generateJson } from '../../../lib/gemini';
import { EXTRACT_SYSTEM, extractUserPrompt } from '../../../lib/prompts';
import { rateLimit } from '../../../lib/ratelimit';

/**
 * Bounded so a hung model call fails visibly instead of holding the function
 * open. One attempt, one timeout, honest error.
 */
export const maxDuration = 30;

/** Timeline text -> candidate observations. The engine decides what they mean. */
export async function POST(req: Request) {
  const gate = rateLimit(req);
  if (!gate.ok) {
    return NextResponse.json(
      { code: 'RATE_LIMITED', error: gate.message },
      { status: 429, headers: { 'retry-after': String(gate.retryAfter) } },
    );
  }

  let timeline: unknown;
  try {
    ({ timeline } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (typeof timeline !== 'string' || timeline.trim().length === 0) {
    return NextResponse.json({ error: 'Provide a non-empty timeline.' }, { status: 400 });
  }
  if (timeline.length > 20_000) {
    return NextResponse.json(
      { error: 'Timeline too long for this demo (20k character limit).' },
      { status: 413 },
    );
  }

  try {
    const raw = await generateJson(EXTRACT_SYSTEM, extractUserPrompt(timeline));
    const list = (raw as { candidates?: unknown })?.candidates;

    // Two gates, both mandatory. The first rejects anything malformed — the
    // model is untrusted input, exactly like a form post. The second proves
    // each receipt is real: the line exists, the quote is on it, the date
    // matches. Well-formed output is not the same as true output, and a
    // citation nobody checked is the failure this product exists to prevent.
    const wellFormed = Array.isArray(list) ? list.filter(isValidCandidate) : [];
    const { verified, rejected } = verifyReceipts(wellFormed, timeline);

    return NextResponse.json({
      candidates: verified,
      dropped:
        (Array.isArray(list) ? list.length - wellFormed.length : 0) + rejected.length,
      rejected: rejected.map((r) => ({
        line: r.candidate.sourceLine,
        value: r.candidate.value,
        reason: r.reason,
      })),
    });
  } catch (err) {
    if (err instanceof NoKeyError) {
      // Expected on a deployment with no key. Not an outage, and it must not
      // be described as one — everything except this route is designed to work
      // in exactly this state.
      return NextResponse.json(
        { code: 'NO_KEY', error: err.message },
        { status: 503 },
      );
    }
    // Message only. The pasted text is the user's content and the key is a
    // secret; neither belongs in a log line.
    console.error('[extract] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { code: 'MODEL_ERROR', error: 'The model could not read this text. Try again.' },
      { status: 502 },
    );
  }
}
