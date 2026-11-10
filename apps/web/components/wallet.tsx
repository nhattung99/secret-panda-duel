"use client";

import { useConnect, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
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
  const error = connect.error ?? switchChain.error;
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
          onClick={() => connector && connect.mutate({ connector })}>
          {connect.isPending ? "Connecting…" : "Connect MetaMask"}
        </button>
      )}
      {error && <div className="wallet-error" role="alert">{error.message.split("\n")[0]}{" "}
        {!address && <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>}
      </div>}
    </div>
  );
}
