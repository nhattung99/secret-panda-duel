# Testing

## Local contract tests

```sh
npm run compile
npm test
npm run typecheck
npm run build
```

The contract suite deploys the actual Solidity implementation and drives FHEVM inputs, operations, ACL checks, and decryption proofs with Zama's official Hardhat plugin. The plugin emulates the coprocessor and KMS on the local network. Real ciphertext processing and live KMS integration are covered by the separate Sepolia procedure below.

The 19 local cases cover all nine legal outcomes, three invalid-input combinations, unique rooms and join rules, submitter authorization, malformed proofs, signer binding, duplicate submission and cross-room replay, public and opponent move secrecy, bad and replayed result proofs, cancellation, expiration, rematch isolation, paged history, and player statistics. Each test deploys a fresh contract because rewinding EVM snapshots can leave the local coprocessor event cursor ahead of the chain.

## Browser tests

Install Chromium with `npx playwright install chromium` and run `npm run test:web`. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser. The two tests check desktop and mobile navigation, wallet reconnection, and reading fresh room state after reload. The reconnect test uses an injected EIP-1193 test wallet and intercepted JSON-RPC reads. Live MetaMask and Sepolia coverage comes from the walkthrough below.

## Live two-wallet smoke test

After deployment, add the actual address and two distinct funded disposable keys to the root `.env`. Obtain approval for five testnet transactions, then run `npm run test:sepolia -- --send`. It checks the chain and bytecode, creates a room, joins from the other wallet, encrypts both moves using the current Zama SDK, waits for the public result proof, finalizes, and asserts Blue wins. Record the five transaction hashes and room ID from real output.

## Two-wallet browser verification

1. Set the deployed contract address in the web environment and start the app.
2. Use distinct MetaMask browser profiles on Sepolia. Create a room in A and join from B using the invitation link.
3. Submit Rock from A, reload both pages, and confirm only Blue's encrypted submission indicator appears. Disconnect and reconnect one wallet and confirm its seat and pending action are restored.
4. Submit Scissors from B. Wait for **Verify & finalize**, then fetch and submit the proof. If the relayer is still processing, retry after confirmation.
5. Confirm A sees a win and B a loss. Reload both pages and check the same verified result, transaction receipt, history, and stats.
6. Request and accept a rematch. Confirm it has a fresh ID and both move slots are empty.

Live Sepolia smoke test and MetaMask browser walkthrough are pending deployment and wallet approval.
