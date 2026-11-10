# Security and fairness

| Threat | Protection and remaining exposure |
| --- | --- |
| Front-running and ordering | Seeing the first submission reveals a ciphertext handle and timing. A different wallet cannot submit it as its own. Standard lobbies are first-come, so a third party can race a join. Verify the joined address before playing. Rematches reserve the opposite seat. |
| Replay | The contract accepts one move per participant and records each accepted input handle across rooms. Zama input proofs bind to contract and sender. Proof finalization binds to the exact stored result handle and can succeed once per room. |
| Malformed ciphertext or proof | Empty input proofs are rejected explicitly. FHEVM verifies typed handles and input proofs. A reverted write cannot consume a handle or mark a seat submitted. |
| Invalid encrypted choice | The encrypted circuit selects the void result if either move is out of range. Invalid inputs can spoil a round, but cannot award a win or a loss. |
| Unauthorized decryption | Moves are kept out of the public result ACL. Persistent access is granted only to the contract for the first move. Move values are absent from application logs, metadata, and backend storage. |
| Duplicate or replaced move | Submission checks the phase, wallet, deadline and submitted flag before evaluating. An accepted move cannot be replaced. |
| Forged outcome | Zama's onchain verifier must accept the KMS proof for the stored handle and exact ABI-encoded result. A failed finalization preserves the pending state. |
| Abandonment and disconnection | Anyone can expire an unjoined lobby after 30 minutes or an incomplete round after 15 minutes from joining. The creator can cancel before joining and before the deadline. Neither action is available after both moves lock. |
| Result availability | Anyone can finalize, and the phase stays open for retries after relayer or KMS delays. A long Zama outage can leave a round pending. |
| Reentrancy | The game holds no funds and never calls participant contracts. FHE interactions target the Zama system contracts configured by the library. |
| Gas and storage abuse | The second submission runs a fixed-size encrypted circuit. History reads are capped at 20 entries. Permanent replay guards, room metadata, stats, and history grow with paid writes. |
| Chain mismatch | The frontend targets Sepolia, gates writes on the connected chain, and checks the wallet again after encryption or simulation. Deployment and the smoke test check RPC chain ID. |

V2 assigns codes from 1000–9999 without reuse to keep existing invitations and history unambiguous. A deployment can create at most 9,000 rooms. The codes are public identifiers, and their assignment uses block data for variety. Anyone can join an open room before it fills. Usernames may repeat, so use the wallet address to distinguish players. A player who stops submitting after losing a round can cause the match to expire, with no match win awarded.

Once both moves are locked and the outcome can be decrypted, a participant who remembers their own move can infer the opponent's move in any valid round. Spectators see addresses, timings, submitted flags, and the outcome. Confidentiality depends on the browser/device and Zama's protocol trust assumptions. Sepolia is a test network. This MVP has had local verification and an internal threat review, with independent audit and live verification pending.
