"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getConnection, writeContract } from "wagmi/actions";
import { BaseError, ChainMismatchError, type ContractFunctionArgs, type ContractFunctionName, type Hash } from "viem";
import { useConfig } from "wagmi";
import { chain, deployed, duel, getGameVersion, publicClient } from "./chain";
import { useWalletNetwork } from "./use-wallet-network";

type Method = ContractFunctionName<typeof duel.abi, "nonpayable">;
type Action = { [Name in Method]: { functionName: Name } &
  (ContractFunctionArgs<typeof duel.abi, "nonpayable", Name> extends readonly []
    ? { args?: undefined } : { args: ContractFunctionArgs<typeof duel.abi, "nonpayable", Name> })
}[Method];
type Progress = { stage: string; hash?: Hash; error?: string };

export function useGameVersion() {
  return useQuery({ queryKey: ["game-version", duel.address], queryFn: getGameVersion, enabled: deployed, staleTime: Infinity });
}

export function useDuelTransaction() {
  const config = useConfig();
  const { connection: { address, connector }, network, onSepolia } = useWalletNetwork();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const ready = Boolean(deployed && address && connector && onSepolia);

  async function checkWallet() {
    const current = getConnection(config);
    if (!connector || current.connector?.uid !== connector.uid || current.address !== address) {
      throw new Error("Your wallet changed. Reconnect and try again.");
    }
    const actualChain = await connector.getChainId();
    if (actualChain !== chain.id) {
      void network.refetch();
      throw new Error(`MetaMask is on network ${actualChain}. Select Switch to Sepolia and try again.`);
    }
  }

  async function run(prepare: (stage: (label: string) => void) => Promise<Action> | Action,
    onConfirmed?: (receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>) => void | Promise<void>) {
    if (!ready || !address || !connector || lock.current) return;
    lock.current = true;
    setBusy(true);
    setProgress(undefined);
    let hash: Hash | undefined;
    try {
      const stage = (label: string) => setProgress({ stage: label });
      await checkWallet();
      const action = await prepare(stage);
      stage("Checking transaction");
      const { request } = await publicClient.simulateContract({ ...duel, ...action, account: address });
      await checkWallet();
      stage("Awaiting wallet signature");
      hash = await writeContract(config, { ...request, account: address, chainId: chain.id, connector });
      setProgress({ stage: "Transaction submitted", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted. Refresh the room state and try again.");
      hash = receipt.transactionHash;
      setProgress({ stage: "Transaction confirmed", hash });
      await onConfirmed?.(receipt);
    } catch (error) {
      const wrongNetwork = error instanceof BaseError && error.walk(cause => cause instanceof ChainMismatchError);
      if (wrongNetwork) void network.refetch();
      setProgress({
        stage: hash ? "Check transaction status" : "Action interrupted",
        hash,
        error: wrongNetwork ? "MetaMask is on a different network. Select Switch to Sepolia and try again." :
          error instanceof BaseError ? error.shortMessage :
          error instanceof Error ? error.message : "Please check your wallet and try again.",
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { run, ready, busy, progress };
}

export function useWalletGate() {
  const { connection: { address }, network, onSepolia } = useWalletNetwork();
  if (!deployed) return "A Sepolia deployment address is required to play.";
  if (!address) return "Connect MetaMask to take a seat.";
  if (network.isPending) return "Checking your wallet network…";
  if (!onSepolia) return "Select Switch to Sepolia in the top bar to continue.";
}
