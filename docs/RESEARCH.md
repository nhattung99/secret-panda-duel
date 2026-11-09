# Research and implementation plan

The Season 5 announcement requires a confidential game and frontend running on Sepolia, clear documentation, a three-minute human-presented pitch, and an X post. The listed deadline is December 14, 2026 at 23:59 AoE. Judging covers playability, confidentiality, verifiable fairness, Sepolia functionality, demo quality, and code quality. [Season 5 announcement](https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming)

## Architecture and milestones

1. Implement the room state machine in `packages/contracts/contracts` and verify it with the official Hardhat plugin in `packages/contracts/test`.
2. Export the contract ABI to `apps/web`. Encrypt in the browser against the Sepolia contract and the submitting wallet, and read state through Viem.
3. Verify public result proofs onchain and provide a separate live two-wallet smoke test. Document ACL, timeouts, proof replay, and what the outcome leaks by inference.
4. Prepare Hardhat and Vercel deployment, collect screenshots, and record Sepolia evidence and a human pitch before submission.

## Compatibility

| Layer | Selected versions |
| --- | --- |
| Browser encryption and public decryption | `@zama-fhe/sdk` and `@zama-fhe/react-sdk` 3.7.2 |
| Contract and official local tests | `@fhevm/solidity` 0.11.1, `@fhevm/hardhat-plugin` and `@fhevm/mock-utils` 0.4.2, Hardhat 2.28.6, Solidity 0.8.27 with Cancun |
| Frontend | Next.js 16.4.5, React 19.3.1, Wagmi 3.7.11, Viem 2.57.17, TanStack Query 5.107.1, Tailwind 4.3.5 |

The npm registry lists Solidity library 0.13.4, while the official Hardhat plugin 0.4.2 declares `^0.11.1` and requires legacy relayer SDK 0.4.1 as a peer. This project pins the compatible official toolchain. The legacy package is confined to the Hardhat toolchain dependency graph. Browser and live smoke-test code use the current SDK. [Template manifest](https://github.com/zama-ai/fhevm-hardhat-template/blob/main/package.json) · [FHEVM repository](https://github.com/zama-ai/fhevm)

The Windows Turbopack build failed while spawning its CSS worker. The web workspace uses webpack and resolves the SDK's WASM feature detector to 1.8.0, which is within the SDK's declared range. The registry's newer 1.10.0 build uses source-phase import syntax that the bundled webpack rejects.

## References and API changes

- The [documentation root](https://docs.zama.org/) redirects to the welcome page. The [Developer Hub](https://www.zama.org/developer-hub), [SDK overview](https://docs.zama.org/protocol/sdk), [SDK source](https://github.com/zama-ai/sdk), and [Solidity guides](https://docs.zama.org/protocol/solidity-guides) are the current starting points.
- The supplied FHEVM GitHub examples path could not be retrieved. The maintained [protocol examples catalog](https://docs.zama.org/protocol/examples) and [Hardhat test guide](https://docs.zama.org/protocol/solidity-guides/development-guide/hardhat/write_test) cover the examples needed here.
- The browser uses the Sepolia preset and `web()` transport. `useEncrypt` encrypts an `euint8` against the submitting wallet and contract. `useDecryptPublicValues` supplies the result proof. The official Sepolia preset requires no relayer key. Older browser examples use `createInstance` and `createEncryptedInput`. The latter remains part of the separate official Hardhat helper. [Encrypt and decrypt](https://docs.zama.org/protocol/sdk/guides/encrypt-decrypt) · [Network presets](https://docs.zama.org/protocol/sdk/api-references/sdk/network-presets) · [Next.js SSR](https://docs.zama.org/protocol/sdk/guides/nextjs-ssr)
- `FHE.fromExternal` checks the typed input proof. `FHE.allowThis` preserves the first move for use across transactions. Public decryption uses `FHE.makePubliclyDecryptable` followed by `FHE.checkSignatures`. [Inputs](https://docs.zama.org/protocol/solidity-guides/smart-contract/inputs) · [ACL](https://docs.zama.org/protocol/solidity-guides/smart-contract/acl) · [Public decryption](https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle)
- RPS uses a deterministic rule. The [encrypted randomness guide](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random) and [OpenZeppelin confidential contracts](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts) cover random games and confidential token applications respectively.

## Risks that informed the contract

Check both move ranges under encryption and assign a dedicated void outcome. Bind finalization to the room's result handle and reject move handle reuse. Permit cancellation only before joining and make finalization permissionless after both submissions. A participant can infer an opponent's move from their own move and the public outcome once both moves are locked. Sepolia, the Zama relayer, and the KMS are availability dependencies. See [security review](SECURITY.md).
