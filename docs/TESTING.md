# Testing

## Local contract tests

```sh
npm run compile
npm test
npm run typecheck
npm run build
```

The contract suite deploys the actual Solidity implementation and drives FHEVM inputs, operations, ACL checks, and decryption proofs with Zama's official Hardhat plugin. The plugin emulates the coprocessor and KMS on the local network. Real ciphertext processing and live KMS integration are covered by the separate Sepolia procedure below.

The local cases cover all nine legal outcomes, three invalid-input combinations, unique four-digit codes, two-player lobbies, wallet usernames, 2–0 and 2–1 match wins, draws after three rounds, stale moves and proofs, authorization, malformed proofs, move secrecy, cancellation, expiration, rematches, paged history, and match statistics. Each test deploys a fresh contract because rewinding EVM snapshots can leave the local coprocessor event cursor ahead of the chain.

## Browser tests

Install Chromium with `npx playwright install chromium` and run `npm run test:web`. Set `PLAYWRIGHT_CHANNEL=msedge` to use an installed Edge browser. The tests check desktop and mobile navigation, V1 and V2 wallet reconnection, and restoring room state, usernames and scores after reload. The reconnect tests use an injected EIP-1193 test wallet and intercepted JSON-RPC reads.

## Live two-wallet smoke test

After deploying V2, add its address and two distinct funded disposable keys to the root `.env`. Obtain approval for eight testnet transactions, then run `npm run test:sepolia -- --send`. It checks the chain and bytecode, creates and joins a four-digit room, plays two rounds using the current Zama SDK and verifies a 2–0 match win. Record the transaction hashes and room code from real output.

## Two-wallet browser verification

1. Set the deployed contract address in the web environment and start the app.
2. Use distinct MetaMask browser profiles on Sepolia. Create a room in A and join from B using the invitation link.
3. Submit Rock from A, reload both pages, and confirm only Blue's encrypted submission indicator appears. Disconnect and reconnect one wallet and confirm its seat and pending action are restored.
4. Submit Scissors from B. Wait for **Verify & finalize**, then fetch and submit the proof. If the relayer is still processing, retry after confirmation.
5. On V2, confirm the scoreboard advances and each player can submit once in the next round. Finalize a second win for Blue, then reload both pages and check the verified match result, history and stats.
6. Request and accept a rematch. Confirm it has a fresh ID and both move slots are empty.

V2 is deployed on Sepolia. The V2 smoke test and full browser walkthrough are pending transactions signed by funded test wallets.
