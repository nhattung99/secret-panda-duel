# Deployment

## Ethereum Sepolia

1. Copy the root `.env.example` to `.env`. Set `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` for a funded Sepolia-only deployer. Use a dedicated test wallet and keep the key in the ignored file or shell environment. Set `ETHERSCAN_API_KEY` if verifying through Etherscan.
2. Run `npm ci`, `npm run compile`, and `npm test`.
3. When ready to send an actual Sepolia transaction, run `npm run deploy:sepolia`. Hardhat checks chain ID, deploys under the `duel` tag, waits for two confirmations and records the address in `packages/contracts/deployments/sepolia/SecretPandaDuel.json`.
4. Run `npm run verify:sepolia -w @panda/contracts -- <ACTUAL_ADDRESS>`. There are no constructor arguments. Check the resulting source verification on Sepolia Etherscan.
5. Record the chain ID, contract address, deploy transaction, block number, and source revision here. Use the real deployment artifact and explorer receipt.

| Field | Recorded value |
| --- | --- |
| Network | Ethereum Sepolia (11155111) |
| Contract | Pending |
| Deployment transaction and block | Pending |
| Source revision | Pending |
| Etherscan verification | Pending |

## Frontend and Vercel

For local use, create `apps/web/.env.local` with the following values.

```dotenv
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_SEPOLIA_RPC_URL=
```

Set the actual deployment address. The RPC field is optional and defaults to Viem's Sepolia RPC. Values prefixed with `NEXT_PUBLIC_` are visible to browser users. Use a public or browser-restricted endpoint there. Keep deployer keys and private RPC credentials out of Vercel frontend variables.

Import the repository in Vercel, select Next.js, set Root Directory to `apps/web`, enable access to source outside the root directory, and use Node.js 24. Leave the framework build settings at the package defaults and set the public environment variables for the target environment. Rebuild when the contract address changes. After approval, deploy, open the public URL, and complete the two-browser checklist in [TESTING.md](TESTING.md).
