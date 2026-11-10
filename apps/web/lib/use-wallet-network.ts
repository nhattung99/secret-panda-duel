"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { chain } from "./chain";

export function useWalletNetwork() {
  const connection = useConnection();
  const { address, connector, chainId } = connection;
  const network = useQuery({
    queryKey: ["wallet-chain", connector?.uid, address, chainId],
    queryFn: () => connector!.getChainId(),
    enabled: Boolean(address && connector),
    refetchInterval: 4_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  return { connection, network, onSepolia: chainId === chain.id && network.data === chain.id && !network.isError };
}
