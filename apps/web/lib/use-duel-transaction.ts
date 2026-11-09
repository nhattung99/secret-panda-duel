"use client";

import { useRef, useState } from "react";
import { getConnection, writeContract } from "wagmi/actions";
import { BaseError, type ContractFunctionArgs, type ContractFunctionName, type Hash } from "viem";
import { useConnection, useConfig } from "wagmi";
import { chain, deployed, duel, publicClient } from "./chain";

type Method = ContractFunctionName<typeof duel.abi, "nonpayable">;
type Action = { [Name in Method]: { functionName: Name } &
  (ContractFunctionArgs<typeof duel.abi, "nonpayable", Name> extends readonly []
    ? { args?: undefined } : { args: ContractFunctionArgs<typeof duel.abi, "nonpayable", Name> })
}[Method];
type Progress = { stage: string; hash?: Hash; error?: string };

export function useDuelTransaction() {
  const config = useConfig();
  const { address, chainId } = useConnection();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress>();
  const ready = Boolean(deployed && address && chainId === chain.id);

  async function run(prepare: (stage: (label: string) => void) => Promise<Action> | Action,
    onConfirmed?: (receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>) => void | Promise<void>) {
    if (!ready || !address || lock.current) return;
    lock.current = true;
    setBusy(true);
    setProgress(undefined);
    let hash: Hash | undefined;
    try {
      const stage = (label: string) => setProgress({ stage: label });
      const action = await prepare(stage);
      const current = getConnection(config);
      if (current.address !== address || current.chainId !== chain.id) {
        throw new Error("Wallet changed. Reconnect to Sepolia and try again.");
      }
      stage("Checking transaction");
      const { request } = await publicClient.simulateContract({ ...duel, ...action, account: address });
      const afterSimulation = getConnection(config);
      if (afterSimulation.address !== address || afterSimulation.chainId !== chain.id) {
        throw new Error("Wallet changed. Reconnect to Sepolia and try again.");
      }
      stage("Awaiting wallet signature");
      hash = await writeContract(config, { ...request, account: address, chainId: chain.id });
      setProgress({ stage: "Transaction submitted", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The transaction reverted. Refresh the room state and try again.");
      hash = receipt.transactionHash;
      setProgress({ stage: "Transaction confirmed", hash });
      await onConfirmed?.(receipt);
    } catch (error) {
      setProgress({
        stage: hash ? "Check transaction status" : "Action interrupted",
        hash,
        error: error instanceof BaseError ? error.shortMessage :
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
  const { address, chainId } = useConnection();
  if (!deployed) return "A Sepolia deployment address is required to play.";
  if (!address) return "Connect MetaMask to take a seat.";
  if (chainId !== chain.id) return "Switch your wallet to Sepolia to continue.";
}
