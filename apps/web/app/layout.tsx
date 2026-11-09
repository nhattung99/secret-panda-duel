import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "./providers";
import { ConnectWalletButton, NetworkStatus } from "@/components/wallet";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Secret Panda Duel", template: "%s · Secret Panda Duel" },
  description: "A confidential two-wallet Rock, Paper, Scissors duel powered by Zama.",
};

function Navbar() {
  return (
    <header className="nav shell">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">✦</span> Secret Panda<span className="brand-duel">Duel</span></Link>
      <nav aria-label="Main navigation">
        <Link href="/play">Play</Link><Link href="/history">History</Link><Link href="/about">Fairness</Link>
      </nav>
      <ConnectWalletButton />
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer shell">
      <span>SECRET PANDA DUEL <span className="foot-sep">/</span> THE SEALED DOJO</span>
      <NetworkStatus />
      <a href="https://docs.zama.org/protocol" target="_blank" rel="noreferrer">Powered by Zama ↗</a>
    </footer>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><Providers><Navbar /><main className="shell">{children}</main><Footer /></Providers></body></html>;
}
