import { AsOfApp } from '../components/AsOfApp';
import { BuildDecisions } from '../components/BuildDecisions';

export default function Page() {
  return (
    <main>
      <header className="hero">
        <h1>AsOf</h1>
        <p className="tagline">
          Your AI will tell you things that stopped being true.
        </p>
        <p className="sub">
          It isn&rsquo;t making them up. It read them somewhere, and they were
          true then. Nothing in the answer tells you they expired — so the
          reminder goes to the person who left, on the date that moved. AsOf
          keeps track of <em>when</em> each fact was true, and refuses the ones
          that aren&rsquo;t any more.
        </p>
      </header>

      <AsOfApp />
      <BuildDecisions />

      <p className="faint small">
        Built independently for the Razorpay AI Builders challenge, using
        synthetic data and no employer materials. &ldquo;Project Atlas&rdquo;,
        &ldquo;Project Borealis&rdquo; and everyone in them are invented.
      </p>
    </main>
  );
}
