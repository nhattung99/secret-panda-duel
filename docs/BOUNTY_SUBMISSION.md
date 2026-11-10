# Zama Season 5 submission

**Project** Secret Panda Duel

Secret Panda Duel brings simultaneous-choice Rock, Paper, Scissors to Sepolia. If the first move were public, the second player could always counter it. Players submit encrypted choices from their wallets, FHEVM computes the outcome, and the contract verifies the public decryption proof before awarding stats.

## Judging evidence

| Criterion | Demonstration |
| --- | --- |
| Gameplay and UX | Host and join by link, lock in from two wallets, see a personalized verdict, and rematch |
| Confidentiality | Inspect the first submission from the second browser before it chooses and show the encrypted input in calldata |
| Fairness | Show the encrypted validity circuit and the verification call bound to the stored result handle |
| Sepolia functionality | Record one live round, its five transaction links, and its verified result |
| Demo quality | Present the live round and code in the human-recorded storyboard |
| Code quality | Show the official Hardhat suite, threat model, and reproducible deployment |

## Submission checklist

- [ ] Link the public GitHub repository.
- [x] Deploy the Sepolia contract, compare the bytecode, and [record the transaction](DEPLOYMENT.md).
- [ ] Verify the Solidity source on Etherscan.
- [ ] Deploy the Next.js frontend after approval. Link the live URL.
- [ ] Capture a verified two-wallet round and record its transaction links.
- [ ] Add the live room and verdict screenshots to the README.
- [ ] Record and link a 150–180-second real-person pitch using [DEMO_SCRIPT.md](DEMO_SCRIPT.md).
- [ ] Publish the approved X announcement and add its URL.
- [ ] Submit via the [official Season 5 announcement](https://www.zama.org/post/zama-developer-program-mainnet-season-5-confidential-gaming) by December 14, 2026 at 23:59 AoE.

## X announcement draft

> I built Secret Panda Duel for @zama_fhe’s Season 5. Two wallets play Rock, Paper, Scissors on Sepolia. Moves stay encrypted while Zama FHEVM computes the result, and the contract verifies the outcome proof. Play [DAPP] · Code [REPO] · Demo [VIDEO]
