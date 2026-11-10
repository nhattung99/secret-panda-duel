"use client";

import { useState } from "react";
import { ProviderNotFoundError, useConnect, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { chain, rpcUrl, shortAddress } from "@/lib/chain";
import { useWalletNetwork } from "@/lib/use-wallet-network";

export function NetworkStatus() {
  return <span className="network"><span className="led" /> Sepolia testnet</span>;
}

export function ConnectWalletButton() {
  const { connection: { address, connector: activeConnector }, network, onSepolia } = useWalletNetwork();
  const [connector] = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [copyStatus, setCopyStatus] = useState("");
  const error = connect.error ?? switchChain.error;
  const missingProvider = error instanceof ProviderNotFoundError;

  async function copyGameLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyStatus("Link copied.");
    } catch {
      setCopyStatus("Copy the link from your browser’s address bar.");
    }
  }
  return (
    <div className="wallet">
      {address && onSepolia ? (
        <button className="btn ghost wallet-button" onClick={() => disconnect.mutate({})} title="Disconnect wallet">
          <span className="led" /> {shortAddress(address)}
        </button>
      ) : address ? (
        <button className="btn ghost wallet-button" disabled={!activeConnector || switchChain.isPending}
          onClick={() => activeConnector && switchChain.mutate({
            chainId: chain.id,
            connector: activeConnector,
            addEthereumChainParameter: rpcUrl ? { rpcUrls: [rpcUrl] } : undefined,
          }, { onSettled: () => { void network.refetch(); } })}>
          {switchChain.isPending ? "Switching network…" : "Switch to Sepolia"}
        </button>
      ) : (
        <button className="btn ghost wallet-button" disabled={!connector || connect.isPending}
          onClick={() => {
            setCopyStatus("");
            if (connector) connect.mutate({ connector });
          }}>
          {connect.isPending ? "Connecting…" : "Connect MetaMask"}
        </button>
      )}
      {error && <div className="wallet-error">
        {missingProvider ? <>
          <p role="alert"><strong>MetaMask isn’t available in this browser.</strong>{" "}
            Open this link in Chrome or Edge with MetaMask enabled, or in the MetaMask app’s browser on mobile.</p>
          <div className="wallet-error-actions">
            <button type="button" className="btn ghost" onClick={copyGameLink}>Copy game link</button>
            <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Get MetaMask ↗</a>
          </div>
          {copyStatus && <p role="status">{copyStatus}</p>}
        </> : <p role="alert">{error.message.split("\n")[0]}</p>}
      </div>}
    </div>
  );
}
