/**
 * A real agent step, recorded rather than staged.
 *
 * The draft below is **verbatim output from Gemini 3.1 Pro on 2026-08-07**,
 * given the same project log this page ships and asked to remind Jay about the
 * launch. Nothing is written to make a point: this is what a competent model
 * actually produced, and it is the artifact a tool-using agent would hand to a
 * send_email call.
 *
 * That matters, because the model was not ignorant. In the same reply it noted
 * underneath that Neha had taken over and the date had moved twice. It knew,
 * and it drafted this anyway — and an agent pipeline takes the draft and drops
 * the commentary. The note is not the artifact.
 *
 * The gate verdict shown in the UI is not recorded. It is computed live from
 * this text by the same engine everything else on the page uses.
 */

export interface AgentStep {
  key: string;
  label: string;
  detail: string;
  /** Who does this step — the model, the runtime, or Canon. */
  actor: 'agent' | 'memory' | 'canon';
}

export const AGENT_REQUEST = 'Remind the Atlas owner about the launch date.';

/** Verbatim, Gemini 3.1 Pro, 2026-08-07. */
export const AGENT_DRAFT =
  'Hi Jay, I wanted to check in with you regarding Project Atlas and the ' +
  'original launch target date of August 15, 2026.';

export const AGENT_STEPS: AgentStep[] = [
  {
    key: 'request',
    actor: 'agent',
    label: 'A request arrives',
    detail: AGENT_REQUEST,
  },
  {
    key: 'retrieve',
    actor: 'memory',
    label: 'The agent retrieves what it remembers',
    detail:
      'Search returns the project log. Every line in it is real and was true ' +
      'when written — including the ones that stopped being true in July.',
  },
  {
    key: 'draft',
    actor: 'agent',
    label: 'The agent drafts the action',
    detail: AGENT_DRAFT,
  },
  {
    key: 'gate',
    actor: 'canon',
    label: 'Canon checks it before it leaves',
    detail:
      'Every claim the draft rests on, checked against when it was true. ' +
      'Computed live below — not recorded.',
  },
];
