# FHE design

The browser encrypts a single `euint8` with the Zama SDK using the game address and wallet address. The contract requires a nonempty proof, verifies it with `FHE.fromExternal`, and consumes the input handle once. It gives the first submitted handle a persistent contract ACL grant because the second move arrives in another transaction. The second handle is used within its submission transaction. The application grants no move ACL to a player or the public. After evaluation or expiration, the contract clears its reference to the pending move. Earlier ciphertext handles and transaction metadata remain visible on the public chain.

## Circuit

Rock, paper, and scissors are 0, 1, and 2. In encrypted unsigned 8-bit arithmetic, `difference = a - b` wraps at 256. For valid moves, 0 is a draw, 1 and 254 are Blue wins, and 2 and 255 are Red wins. An encrypted check tests both inputs against 2. The outer encrypted selection returns 3 if either input is invalid, regardless of the computed difference.

| Result | Meaning | Match effect |
| --- | --- | --- |
| 0 | Draw | Uses one round without adding a win |
| 1 | Panda Blue wins | Adds one round win for Blue |
| 2 | Panda Red wins | Adds one round win for Red |
| 3 | Invalid move | Voids the match without awarding stats |

## Finalization

The second submission of each round sets that round's result handle publicly decryptable. A client calls `decryptPublicValues([handle])` and submits the clear code and proof in a separate transaction. The contract reads the handle from its own storage and verifies `FHE.checkSignatures([handle], abi.encode(outcome), proof)`. Successful verification records the round and opens the next one or completes the match. Stats and history are written only at match completion. Decryption is asynchronous and client-triggered. Any funded Sepolia address can submit the proof, including a spectator.

[Official public decryption flow](https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle)
