import { AsOfApp } from '../components/AsOfApp';
import { BuildDecisions } from '../components/BuildDecisions';

export default function Page() {
  return (
    <main>
      <h1>AsOf</h1>
      <p className="sub">
        A temporal memory linter for AI agents. Agents don&rsquo;t only make
        things up — they act, confidently and fluently, on facts that{' '}
        <em>used to be</em> true. AsOf bolts onto an agent&rsquo;s memory: a
        language model nominates candidate facts, a deterministic engine owns
        what is true, and assumptions that have expired get rejected with the
        evidence that replaced them.
      </p>

      <AsOfApp />
      <BuildDecisions />

      <p className="faint small">
        Built independently for the Razorpay AI Builders challenge, using
        synthetic data and no employer materials. &ldquo;Project Atlas&rdquo;
        and everyone in it are invented.
      </p>
    </main>
  );
}
