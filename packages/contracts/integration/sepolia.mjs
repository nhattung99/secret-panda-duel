import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ZamaSDK } from "@zama-fhe/sdk";
import { createConfig } from "@zama-fhe/sdk/viem";
import { sepolia as fheSepolia } from "@zama-fhe/sdk/chains";
import { node } from "@zama-fhe/sdk/node";
import { createPublicClient, createWalletClient, http, isAddress, parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const { SEPOLIA_RPC_URL: rpc, NEXT_PUBLIC_CONTRACT_ADDRESS: address, SEPOLIA_PLAYER_A_PRIVATE_KEY: keyA,
  SEPOLIA_PLAYER_B_PRIVATE_KEY: keyB } = process.env;

assert(process.argv.includes("--send"), "Pass --send after approving the five Sepolia transactions.");
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
console.log(`Room ${id}`);
await send(b, "joinRoom", [id]);

const sdkA = sdkFor(a);
const sdkB = sdkFor(b);
for (const [sdk, account, value] of [[sdkA, a, 0n], [sdkB, b, 2n]]) {
  const { encryptedValues, inputProof } = await sdk.encrypt({
    contractAddress: address, userAddress: account.address, values: [{ value, type: "euint8" }],
  });
  assert(encryptedValues[0], "Expected a registered move handle.");
  await send(account, "submitMove", [id, encryptedValues[0], inputProof]);
}

const readRoom = () => client.readContract({ ...contract, functionName: "getRoom", args: [id] });
const { encryptedResult, phase } = await readRoom();
assert.equal(phase, 2);
let result;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    result = await sdkB.decryption.decryptPublicValues([encryptedResult]);
    break;
  } catch (error) {
    if (attempt === 11) throw error;
    console.log("Public proof pending. Retrying in 10 seconds.");
    await new Promise(resolve => setTimeout(resolve, 10_000));
  }
}
assert.equal(result.clearValues[encryptedResult], 1n);
await send(b, "finalizeRound", [id, 1, result.decryptionProof]);
const complete = await readRoom();
assert.equal(complete.phase, 3);
assert.equal(complete.result, 1);
console.log(`Verified Sepolia round ${id}: Panda Blue wins.`);
