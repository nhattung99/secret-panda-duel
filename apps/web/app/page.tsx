import Link from "next/link";
import { BattleAnimation } from "@/components/panda";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">✦ &nbsp; THE SEALED DOJO</span>
          <h1>Secret<br />Panda <em>Duel.</em></h1>
          <p className="lead">Rock, paper, scissors in a neon bamboo dojo. Lock in your move under encryption and let the chain settle the duel.</p>
          <div className="actions">
            <Link className="btn primary" href="/play">Enter the dojo <span aria-hidden="true">↗</span></Link>
            <Link className="btn ghost" href="/about">How it works</Link>
          </div>
          <p className="hero-note">TWO WALLETS <span>•</span> ETHEREUM SEPOLIA</p>
        </div>
        <BattleAnimation />
      </section>
      <section className="how" aria-labelledby="how-title">
        <div className="section-title"><span className="eyebrow">THE RULES</span><h2 id="how-title">Three steps to a duel</h2></div>
        <div className="three">
          <article className="card"><span className="step">01</span><h3>Open a room</h3><p>Connect MetaMask, create a room, and share your link with a challenger.</p></article>
          <article className="card"><span className="step">02</span><h3>Lock your move</h3><p>Pick rock, paper, or scissors. Your browser encrypts it before your wallet submits it.</p></article>
          <article className="card"><span className="step">03</span><h3>Verify the verdict</h3><p>After both moves are locked, verify Zama’s proof on Sepolia to record the outcome.</p></article>
        </div>
      </section>
    </>
  );
}
