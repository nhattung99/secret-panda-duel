import Image from "next/image";
import Link from "next/link";
import { BattleAnimation } from "@/components/panda";
import { MoveGallery } from "@/components/move-cards";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <a className="hero-logo" href="https://docs.zama.org/protocol" target="_blank" rel="noopener noreferrer">
            <Image src="/brand/zama.svg" width={127} height={25} alt="Zama" unoptimized priority />
          </a>
          <h1>Secret Panda <em>Duel.</em></h1>
          <p className="hero-tagline">Confidential Rock · Paper · Scissors</p>
        </div>
        <BattleAnimation controls={<><p className="arena-prompt">Choose your move</p><MoveGallery /></>} />
        <div className="hero-bottom">
          <div className="actions">
            <Link className="btn primary" href="/play">Enter the dojo <span aria-hidden="true">↗</span></Link>
            <Link className="btn ghost" href="/about">How it works</Link>
          </div>
          <p className="hero-note">2 PLAYERS <span>◆</span> ENCRYPTED MOVES <span>◆</span> SEPOLIA</p>
        </div>
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
