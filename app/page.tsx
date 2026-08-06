import { CanonApp } from '../components/CanonApp';
import { BuildDecisions } from '../components/BuildDecisions';

export default function Page() {
  return (
    <main>
      <header className="hero">
        <h1>Canon</h1>
        <p className="tagline">
          Stop your agent acting on things that stopped being true.
        </p>
        <p className="sub">
          It isn&rsquo;t hallucinating. It read that fact somewhere, and back
          then it was right. Nothing in the answer says it expired — so the
          reminder goes to the person who left, about the date that moved.
          Canon keeps the <em>when</em> on every fact and checks an action
          against it before the action goes out.
        </p>
      </header>

      <CanonApp />
      <BuildDecisions />

      <p className="faint small">
        Built independently for the Razorpay AI Builders challenge, using
        synthetic data and no employer materials. &ldquo;Project Atlas&rdquo;,
        &ldquo;Project Borealis&rdquo; and everyone in them are invented.
      </p>
    </main>
  );
}
