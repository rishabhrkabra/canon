import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, Output } from 'ai';

/**
 * Model access, server-only.
 *
 * Calls Google directly with a free-tier AI Studio key rather than going
 * through a gateway. The gateway route was tried and rejected every request —
 * it requires a card on file, and this project has a hard no-spend rule. A
 * direct free-tier key costs nothing and needs no billing account.
 *
 * Three constraints that survived the rewrite:
 *  - The key is read from process.env at call time, server-side only, never
 *    under a NEXT_PUBLIC_ name. The SDK puts it in a header, not a query string.
 *  - No retries. Free-tier limits are unpublished, and a retry storm is the
 *    fastest way to lose the key mid-demo. One attempt, honest error.
 *  - A missing key is a distinct, EXPECTED outcome — not a failure. Everything
 *    on the page except this one feature is deterministic, so a deployment with
 *    no key must say exactly that instead of implying an outage.
 *
 * `Output.json()` only proves the response parses as JSON. Structure, receipts
 * and meaning are still decided by the validators and the engine.
 */

const MODEL = 'gemini-3.5-flash-lite';

export class NoKeyError extends Error {
  constructor() {
    super('No GEMINI_API_KEY is configured on this deployment.');
    this.name = 'NoKeyError';
  }
}

export function hasKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Calls the model and returns parsed JSON, or throws with a usable message. */
export async function generateJson(
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new NoKeyError();

  const google = createGoogleGenerativeAI({ apiKey });

  const { output } = await generateText({
    model: google(MODEL),
    system,
    prompt: user,
    output: Output.json(),
    abortSignal: signal,
  });

  return output;
}
