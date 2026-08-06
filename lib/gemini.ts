/**
 * Minimal Gemini client. Server-only.
 *
 * Three deliberate constraints:
 *  - The key is read from process.env at call time and sent in the
 *    `x-goog-api-key` header, never in the URL (query strings land in logs and
 *    proxies) and never under a NEXT_PUBLIC_ name.
 *  - No retries. Free-tier limits are unpublished, and a retry storm is the
 *    fastest way to lose the key mid-demo. One attempt, honest error.
 *  - A missing key is a distinct, expected outcome — not an exception. The
 *    app is required to work without one.
 */

const MODEL = 'gemini-3.5-flash-lite';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class NoKeyError extends Error {
  constructor() {
    super('GEMINI_API_KEY is not configured on this deployment.');
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

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      // No temperature/top-p: the current model docs mark those sampling
      // controls as deprecated for this family and they may later be rejected
      // outright. Determinism does not live here anyway — it lives in the
      // engine, which is the point of the whole design.
      generationConfig: {
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Model request failed (${res.status}).${detail ? ` ${detail.slice(0, 300)}` : ''}`,
    );
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('Model returned an empty response.');

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Model returned output that was not valid JSON.');
  }
}
