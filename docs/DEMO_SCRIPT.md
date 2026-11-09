# 170-second human pitch

Record your own on-camera introduction and voice. Show the actual application and the two real Sepolia wallets. Collect onchain evidence before recording. Relayer and block waiting time can be edited out with a cut that preserves the transaction hashes and shows the final receipt.

| Time | Screen | Spoken script |
| --- | --- | --- |
| 0–20 s | Presenter and dojo landing | “I’m the builder of Secret Panda Duel. Rock, Paper, Scissors depends on committing a choice before seeing the other move. On a transparent chain, the second player can read the first move and pick the counter. I built a panda dojo where the chain can settle the duel while both choices stay encrypted.” |
| 20–42 s | Two browser profiles on Sepolia | “These are two different wallets. I’m opening a room with Panda Blue and copying the invite. In the other browser I’ll join as Panda Red. Both tabs read the same room state from Sepolia.” |
| 42–73 s | Blue submits and Red reloads | “Blue picks Rock. The Zama SDK encrypts the move in the browser and binds the proof to this wallet and the game contract. Red can see that Blue has locked a move. Here’s the explorer transaction with the handle and proof. The move itself stays sealed. I’ll reload Red’s tab and show that the state comes from the contract.” |
| 73–104 s | Red submits, then request proof | “Red picks Scissors. The contract validates both ranges and computes the result using FHEVM operations. It allows public decryption of one handle, the outcome. I’ll fetch that outcome and its proof, then send the final verification transaction from Red.” |
| 104–129 s | Both result screens, explorer and history | “The receipt confirms verification. Blue sees a win, Red sees a loss, and the room appears in each wallet’s history. Either player can request a fresh rematch. After the result is available, a player can infer their opponent’s move using their own choice.” |
| 129–155 s | Contract and architecture diagram | “Here’s the encrypted range check. An invalid choice voids the round. The finalizer verifies Zama’s proof against this room’s stored handle before updating the result and stats. The local Hardhat tests cover all nine legal pairings, invalid choices, access control, timeouts, and proof replay.” |
| 155–170 s | Presenter with working links and contract | “Secret Panda Duel is my entry for Zama’s Season 5 Confidential Gaming bounty. Try a round with a friend using the app link, or open the repository to see the contract and reproduce the demo.” |

## Screenshots to capture

- Desktop landing page with the dojo and the Play action.
- Room after exactly one encrypted submission, showing both wallet seats.
- Completed round with the verified verdict and the Sepolia receipt.
- Mobile room layout with move buttons and room status.
