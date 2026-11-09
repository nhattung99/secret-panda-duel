import Link from "next/link";

export const metadata = { title: "Fairness" };

export default function About() {
  return (
    <section className="page prose">
      <span className="eyebrow">INSIDE THE DOJO</span><h1>Fairness</h1>
      <p className="lead">Rock, paper, scissors only works when the second player has to choose without seeing the first move.</p>
      <article className="card">
        <h2>Sealed at the source</h2>
        <p>The Zama SDK encrypts your choice in your browser and binds the proof to your wallet and the duel contract. The contract verifies the proof and locks one submission per player.</p>
        <h2>Computed on ciphertext</h2>
        <p>Zama’s FHEVM compares the encrypted choices and checks both ranges. Out-of-range inputs void the round. Only the resulting draw, win, or void code is eligible for public decryption.</p>
        <h2>Verified on Sepolia</h2>
        <p>Anyone can fetch the outcome proof from Zama. The contract verifies it against the room’s stored ciphertext before updating its result and stats. Players may deduce the other choice from their own move and the verdict once both are locked.</p>
      </article>
      <Link className="btn primary" href="/play">Play a duel ↗</Link>
    </section>
  );
}
