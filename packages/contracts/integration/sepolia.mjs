import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { sepolia as fheSepolia } from "@zama-fhe/sdk/chains";
import { node } from "@zama-fhe/sdk/node";
import { createPublicClient, createWalletClient, decodeAbiParameters, http, isAddress, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const { SEPOLIA_RPC_URL: rpc, NEXT_PUBLIC_CONTRACT_ADDRESS: address, SEPOLIA_PLAYER_A_PRIVATE_KEY: keyA,
  SEPOLIA_PLAYER_B_PRIVATE_KEY: keyB } = process.env;

assert(process.argv.includes("--send"), "Pass --send after approving the eight Sepolia transactions.");
assert(rpc && address && isAddress(address) && keyA && keyB,
  "Set SEPOLIA_RPC_URL, NEXT_PUBLIC_CONTRACT_ADDRESS and two disposable SEPOLIA_PLAYER private keys.");
const [a, b] = [keyA, keyB].map(key => privateKeyToAccount(key));
assert.notEqual(a.address, b.address, "Use two distinct wallets.");

const { abi, deployedBytecode } = JSON.parse(await readFile(new URL("../artifacts/contracts/SecretPandaDuel.sol/SecretPandaDuel.json", import.meta.url)));
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
assert.equal(await client.getChainId(), sepolia.id, "RPC chain must be Sepolia.");
assert.equal(await client.getCode({ address }), deployedBytecode, "Address must contain the locally compiled duel bytecode.");
for (const account of [a, b]) {
  assert(await client.getBalance({ address: account.address }) > 0n, `${account.address} needs Sepolia gas.`);
}

const contract = { address, abi };
const walletFor = account => createWalletClient({ account, chain: sepolia, transport: http(rpc) });
const sdkFor = account => new ZamaSDK(createConfig({
  chains: [fheSepolia],
  publicClient: client,
  walletClient: walletFor(account),
  relayers: { [sepolia.id]: node() },
}));

async function send(account, functionName, args = []) {
  const wallet = walletFor(account);
  const { request } = await client.simulateContract({ ...contract, account, functionName, args });
  const hash = await wallet.writeContract(request);
  console.log(`${functionName} submitted: ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 2 });
  assert.equal(receipt.status, "success");
  return receipt;
}

const receipt = await send(a, "createRoom");
const [created] = parseEventLogs({ abi, logs: receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase()), eventName: "RoomCreated" });
assert(created, "Create receipt must contain a room ID.");
const id = created.args.roomId;
assert(id >= 1000n && id <= 9999n, "Expected a four-digit room code.");
console.log(`Room ${id}`);
await send(b, "joinRoom", [id]);

const sdkA = sdkFor(a);
const sdkB = sdkFor(b);
const readMatch = () => client.readContract({ ...contract, functionName: "getMatchRoom", args: [id] });
async function decryptResult(handle) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await sdkB.decryption.decryptPublicValues([handle]);
    } catch (error) {
      if (attempt === 11) throw error;
      console.log("Public proof pending. Retrying in 10 seconds.");
      await new Promise(resolve => setTimeout(resolve, 10_000));
    }
  }
}

for (const [round, moveA, moveB] of [[1, 0n, 2n], [2, 1n, 0n]]) {
  for (const [sdk, account, value] of [[sdkA, a, moveA], [sdkB, b, moveB]]) {
    const { encryptedValues, inputProof } = await sdk.encrypt({
      contractAddress: address, userAddress: account.address, values: [{ value, type: "euint8" }],
    });
    assert(encryptedValues[0], "Expected a registered move handle.");
    await send(account, "submitRoundMove", [id, round, encryptedValues[0], inputProof]);
  }
  const [{ encryptedResult, phase }] = await readMatch();
  assert.equal(phase, 2);
  const result = await decryptResult(encryptedResult);
  const [outcome] = decodeAbiParameters([{ type: "uint8" }], result.abiEncodedClearValues);
  assert.equal(outcome, 1);
  await send(b, "finalizeRound", [id, outcome, result.decryptionProof]);
}

const [complete, score] = await readMatch();
assert.equal(complete.phase, 3);
assert.equal(complete.result, 1);
assert.equal(score.played, 2);
assert.equal(score.winsA, 2);
assert.equal(score.winsB, 0);
console.log(`Verified Sepolia match ${id}: Panda Blue wins 2–0.`);
