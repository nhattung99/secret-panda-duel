"use client";

import type { ReactNode } from "react";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { createConfig } from "@zama-fhe/react-sdk/wagmi";
import { sepolia } from "@zama-fhe/sdk/chains";
import { web } from "@zama-fhe/sdk/web";
import { walletConfig } from "@/app/providers";

const config = createConfig({
  chains: [sepolia],
  wagmiConfig: walletConfig,
  relayers: { [sepolia.id]: web() },
});

export function DuelSdk({ children }: { children: ReactNode }) {
  return <ZamaProvider config={config}>{children}</ZamaProvider>;
}
