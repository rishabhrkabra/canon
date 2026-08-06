/**
 * The model's two jobs, both narrow on purpose.
 *
 * Neither prompt asks the model what is true, what changed, or what supersedes
 * what. Those are engine decisions. Widening these prompts would move judgment
 * out of tested code and into a sampled distribution, which is precisely the
 * failure this project exists to prevent.
 */

export const EXTRACT_SYSTEM = `You extract dated observations from a timeline. You do not interpret them.

Each input line starts with an ISO date, then text. For every distinct claim of the form "some entity has some property with some value", emit one candidate.

Rules:
- observedAt is ALWAYS the ISO date at the start of the line the claim came from. Never infer a date from prose, never use today's date.
- property is a short lowercase noun: owner, launch, budget, status, deadline, price, version.
- value is the literal value. If it is a date, format it YYYY-MM-DD.
- entity is the canonical short name, consistent across lines ("Project Atlas" -> "Atlas").
- sourceSpan is the exact substring of the line the claim came from, copied verbatim.
- sourceLine is the 1-based line number.
- Emit a candidate even when it repeats an earlier one. Repetition is evidence and is counted downstream.
- Do NOT decide what replaced what, what is current, or what conflicts. Emit every observation and stop.
- If a line contains no such claim, emit nothing for it.

Return JSON only: {"candidates":[{"entity","property","value","observedAt","sourceSpan","sourceLine"}]}`;

export const PREMISE_SYSTEM = `You extract the factual assumptions buried inside a request. You do not answer the request or check the assumptions.

Given a question or instruction, list every claim it takes for granted about an entity's property having a value. "Remind Jay that Atlas launches on 2026-08-15" assumes two things: Atlas's owner is Jay, and Atlas's launch is 2026-08-15.

Rules:
- Use the same property vocabulary as the known facts you are shown, and the same canonical entity names.
- assumedValue is what the request treats as true. Format dates YYYY-MM-DD.
- sourceSpan is the words in the request that carried the assumption, copied verbatim.
- Only assumptions about entities in the known-facts list. Ignore everything else.
- Do NOT say whether an assumption is correct, current, or stale. That is decided downstream.

Return JSON only: {"premises":[{"entity","property","assumedValue","sourceSpan"}]}`;

export function extractUserPrompt(timeline: string): string {
  const numbered = timeline
    .split('\n')
    .map((line, i) => `${i + 1}: ${line}`)
    .join('\n');
  return `Timeline (line numbers prefixed, do not include the prefix in sourceSpan):\n\n${numbered}`;
}

export function premiseUserPrompt(question: string, known: string[]): string {
  return `Known entities and properties:\n${known.join('\n')}\n\nRequest:\n${question}`;
}
