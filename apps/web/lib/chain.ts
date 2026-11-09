import { createPublicClient, http, isAddress, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { duelAbi } from "./duel-abi";

export const chain = sepolia;
const configured = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const configuredChain = process.env.NEXT_PUBLIC_CHAIN_ID;
export const deployed = Boolean(configured && isAddress(configured) && configured.toLowerCase() !== zeroAddress &&
  (!configuredChain || configuredChain === String(chain.id)));
export const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
export const duel = { abi: duelAbi, address: deployed ? configured as `0x${string}` : zeroAddress };

export function parseRoomId(raw: string): bigint | undefined {
  if (!/^[0-9]{1,78}$/.test(raw)) return undefined;
  const id = BigInt(raw);
  return id > 0n && id < 2n ** 256n ? id : undefined;
}

export const roomRead = (id: bigint) => ({ ...duel, functionName: "getRoom" as const, args: [id] as const });
export const getRoom = (id: bigint) => publicClient.readContract(roomRead(id));
export type Room = Awaited<ReturnType<typeof getRoom>>;

export const phase = { lobby: 0, moves: 1, result: 2, complete: 3, cancelled: 4, expired: 5 } as const;
export const outcome = { draw: 0, blue: 1, red: 2, void: 3 } as const;
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
