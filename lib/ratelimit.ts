/**
 * A small fixed-window limiter for the two model-backed routes.
 *
 * The honest description of what this is: a speed bump. State lives in the
 * function instance, and Fluid Compute reuses instances rather than
 * guaranteeing one, so a determined caller spread across cold starts gets more
 * than the nominal budget. It exists because a public endpoint in front of a
 * personal API key with NO limit is the version that ends with a drained quota
 * — not because it is a rigorous quota system.
 *
 * A real deployment puts this in Redis or Vercel's rate-limit primitive. That
 * is a deliberate scope cut, written down rather than left implied.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

const hits = new Map<string, { count: number; resetAt: number }>();

function callerKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export interface RateVerdict {
  ok: boolean;
  message: string;
  retryAfter: number;
}

export function rateLimit(req: Request, now = Date.now()): RateVerdict {
  const key = callerKey(req);
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map cannot grow without bound.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
    }
    return { ok: true, message: '', retryAfter: 0 };
  }

  if (entry.count >= MAX_PER_WINDOW) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return {
      ok: false,
      retryAfter,
      message: `Too many requests. This demo allows ${MAX_PER_WINDOW} per minute; try again in ${retryAfter}s.`,
    };
  }

  entry.count += 1;
  return { ok: true, message: '', retryAfter: 0 };
}

/** Test seam — the limiter is module state, so tests must be able to clear it. */
export function resetRateLimit(): void {
  hits.clear();
}
