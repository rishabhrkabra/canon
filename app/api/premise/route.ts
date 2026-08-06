import { NextResponse } from 'next/server';
import { NoKeyError, generateJson } from '../../../lib/gemini';
import { PREMISE_SYSTEM, premiseUserPrompt } from '../../../lib/prompts';
import type { Premise } from '../../../lib/types';

export const maxDuration = 30;

function isValidPremise(v: unknown): v is Premise {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.entity === 'string' && p.entity.trim().length > 0 &&
    typeof p.property === 'string' && p.property.trim().length > 0 &&
    typeof p.assumedValue === 'string' && p.assumedValue.trim().length > 0 &&
    typeof p.sourceSpan === 'string'
  );
}

/**
 * A request -> the claims it takes for granted. Checking them is the engine's
 * job, not the model's: this route returns premises with no verdicts attached.
 */
export async function POST(req: Request) {
  let question: unknown;
  let known: unknown;
  try {
    ({ question, known } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  if (typeof question !== 'string' || question.trim().length === 0) {
    return NextResponse.json({ error: 'Provide a question.' }, { status: 400 });
  }
  const knownList = Array.isArray(known) ? known.filter((k) => typeof k === 'string') : [];

  try {
    const raw = await generateJson(
      PREMISE_SYSTEM,
      premiseUserPrompt(question, knownList),
    );
    const list = (raw as { premises?: unknown })?.premises;
    const premises = Array.isArray(list) ? list.filter(isValidPremise) : [];
    return NextResponse.json({ premises });
  } catch (err) {
    if (err instanceof NoKeyError) {
      return NextResponse.json({ code: 'NO_KEY', error: err.message }, { status: 503 });
    }
    console.error('[premise] failed:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Premise extraction failed.' },
      { status: 502 },
    );
  }
}
