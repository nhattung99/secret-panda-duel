# Deployment

## Ethereum Sepolia

The current source builds V2. Both deployments are recorded below. Use the V2 address for four-digit rooms, usernames, and matches. Room and match history are specific to each deployment.

1. Copy the root `.env.example` to `.env`. Set `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` for a funded Sepolia-only deployer. Use a dedicated test wallet and keep the key in the ignored file or shell environment. Set `ETHERSCAN_API_KEY` if verifying through Etherscan.
2. Run `npm ci`, `npm run compile`, and `npm test`.
3. When ready to send an actual Sepolia transaction, run `npm run deploy:sepolia`. Hardhat checks chain ID, deploys under the `duel` tag, waits for two confirmations and records the address in `packages/contracts/deployments/sepolia/SecretPandaDuel.json`.
4. Run `npm run verify:sepolia -w @panda/contracts -- <ACTUAL_ADDRESS>`. There are no constructor arguments. Check the resulting source verification on Sepolia Etherscan.
5. Record the chain ID, contract address, deploy transaction, block number, and source revision here. Use the real deployment artifact and explorer receipt.

| V1 deployment field | Recorded value |
| --- | --- |
| Network | Ethereum Sepolia (11155111) |
| Contract | [`0x7d928e377bd880e7cc5e1befec9a2d583bd561ee`](https://sepolia.etherscan.io/address/0x7d928e377bd880e7cc5e1befec9a2d583bd561ee) |
| Deployment transaction and block | [Deployment receipt](https://sepolia.etherscan.io/tx/0xe5e595242a43dbbc3e7228a8df243cdbb22ee819ea98b209b61bc45caf73df4c), block 12101767 |
| Source revision | `3b11609` |
| Verification | Onchain bytecode matches the local artifact. Etherscan source verification is pending. |

| V2 deployment field | Recorded value |
| --- | --- |
| Network | Ethereum Sepolia (11155111) |
| Contract | [`0x2bd5f625f51fa7c515eed84ccbedc08d328133fe`](https://sepolia.etherscan.io/address/0x2bd5f625f51fa7c515eed84ccbedc08d328133fe) |
| Deployment transaction and block | [Deployment receipt](https://sepolia.etherscan.io/tx/0x2bbb5a2de2af3bf0db4254fa72ee9184e871b63b721c275b53e09263e4b4d5fb), block 12101973 |
| Verification | Onchain bytecode matches the local artifact. The contract reports version 2. Etherscan source verification is pending. |

## Sign a Sepolia deployment in MetaMask

Set `SEPOLIA_RPC_URL` in the root `.env` and run `npm run compile`. Then run `node --env-file=.env scripts/deploy-with-wallet.mjs` from the repository root. Open `http://127.0.0.1:3016` in the browser profile with MetaMask, select a funded Sepolia test account, and review the contract creation transaction in the wallet. The page verifies two confirmations and the deployed bytecode, then records the public receipt details in `.sepolia-wallet-deploy.json`.

If the wallet already returned a transaction hash, verify that hash with `node --env-file=.env scripts/deploy-with-wallet.mjs <TX_HASH>` before retrying the deployment.

## Frontend and Vercel

For local use, create `apps/web/.env.local` with the following values.

```dotenv
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
```

Set the actual deployment address. The RPC field is optional and defaults to Viem's Sepolia RPC. Values prefixed with `NEXT_PUBLIC_` are visible to browser users. Use a public or browser-restricted endpoint there. Keep deployer keys and private RPC credentials out of Vercel frontend variables.

Import the repository in Vercel, select Next.js, set Root Directory to `apps/web`, enable access to source outside the root directory, and use Node.js 24. Leave the framework build settings at the package defaults and set the public environment variables for the target environment. Rebuild when the contract address changes. After approval, deploy, open the public URL, and complete the two-browser checklist in [TESTING.md](TESTING.md).
