import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Providers } from "./providers";
import { ConnectWalletButton, NetworkStatus } from "@/components/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Secret Panda Duel", template: "%s · Secret Panda Duel" },
  description: "A confidential two-wallet Rock, Paper, Scissors duel powered by Zama.",
};

function CreatorLink() {
  return <a className="creator-link" href="https://x.com/nhattung00" target="_blank" rel="noopener noreferrer">
    <span>Panda Beo</span> <span className="creator-handle">x.com/nhattung00 ↗</span>
  </a>;
}

function ZamaCredit() {
  return <a className="zama-credit" href="https://docs.zama.org/protocol" target="_blank" rel="noopener noreferrer">
    <span>Powered by</span>
    <span className="zama-mark"><Image src="/brand/zama.svg" width={76} height={15} alt="Zama" unoptimized /></span>
  </a>;
}

function Navbar() {
  return (
    <header className="nav shell">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">🐼</span>
        <span>Secret Panda <span className="brand-duel">Duel</span></span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/play">Play</Link><Link href="/history">History</Link><Link href="/about">Fairness</Link>
      </nav>
      <div className="nav-actions"><CreatorLink /><ConnectWalletButton /></div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer shell">
      <ZamaCredit />
      <NetworkStatus />
      <CreatorLink />
    </footer>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Navbar /><main className="shell">{children}</main><Footer /></Providers></body></html>;
}
