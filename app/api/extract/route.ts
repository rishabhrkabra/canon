import { NextResponse } from 'next/server';
import { isValidCandidate } from '../../../lib/engine';
import { NoKeyError, generateJson } from '../../../lib/gemini';
import { EXTRACT_SYSTEM, extractUserPrompt } from '../../../lib/prompts';

/**
 * Bounded so a hung model call fails visibly instead of holding the function
 * open. One attempt, one timeout, honest error.
 */
export const maxDuration = 30;

/** Timeline text -> candidate observations. The engine decides what they mean. */
export async function POST(req: Request) {
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

    // The model is untrusted input, exactly like a form post. Anything
    // malformed is dropped here and never reaches truth state.
    const candidates = Array.isArray(list) ? list.filter(isValidCandidate) : [];

    return NextResponse.json({
      candidates,
      dropped: Array.isArray(list) ? list.length - candidates.length : 0,
    });
  } catch (err) {
    if (err instanceof NoKeyError) {
      // Expected on a deployment with no key. Not an error — the demo path
      // is designed to work in exactly this state.
      return NextResponse.json(
        { code: 'NO_KEY', error: err.message },
        { status: 503 },
      );
    }
    // Message only. The pasted timeline is the user's content and the key is a
    // secret; neither belongs in a log line.
    console.error('[extract] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed.' },
      { status: 502 },
    );
  }
}
