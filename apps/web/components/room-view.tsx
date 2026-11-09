"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDecryptPublicValues, useEncrypt } from "@zama-fhe/react-sdk";
import { useConnection } from "wagmi";
import { isAddressEqual, parseEventLogs, zeroAddress, type Address } from "viem";
import { deployed, duel, getRoom, outcome, phase, publicClient, shortAddress, type Room } from "@/lib/chain";
import { useDuelTransaction, useWalletGate } from "@/lib/use-duel-transaction";
import { DuelSdk } from "./duel-sdk";
import { BattleAnimation } from "./panda";
import { TransactionStatus } from "./status";

const moves = [
  { name: "Rock", icon: "◆", beats: "Beats scissors", value: 0n },
  { name: "Paper", icon: "▤", beats: "Beats rock", value: 1n },
  { name: "Scissors", icon: "✂", beats: "Beats paper", value: 2n },
];

function InviteLink() {
  const [copied, setCopied] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied("Invitation copied.");
    } catch {
      setCopied("Copy the invitation from your browser’s address bar.");
    }
  }
  return <div><button className="btn ghost" onClick={copy}>Copy invite link</button><p role="status">{copied}</p></div>;
}

function RoomCard({ address, blue, submitted, you }: { address: Address; blue: boolean; submitted: boolean; you: boolean }) {
  return (
    <div className={blue ? "seat blue" : "seat red"}>
      <span className="step">{blue ? "01 / PANDA BLUE" : "02 / PANDA RED"}{you && " · YOU"}</span>
      <strong>{address === zeroAddress ? "Open seat" : shortAddress(address)}</strong>
      <EncryptedMoveIndicator submitted={submitted} occupied={address !== zeroAddress} />
    </div>
  );
}

function EncryptedMoveIndicator({ submitted, occupied }: { submitted: boolean; occupied: boolean }) {
  return <small>{submitted ? "◆ Encrypted move locked" : occupied ? "Move pending" : "Waiting for a challenger"}</small>;
}

function MoveSelector({ submit, disabled }: { submit: (value: bigint) => void; disabled: boolean }) {
  return (
    <div className="move-grid">
      {moves.map(move => <button key={move.name} className="move" onClick={() => submit(move.value)} disabled={disabled}>
        <span aria-hidden="true">{move.icon}</span><strong>{move.name}</strong><small>{move.beats}</small>
      </button>)}
    </div>
  );
}

function ResultModal({ result, isA, isB }: { result: number; isA: boolean; isB: boolean }) {
  const title = result === outcome.void ? "Round void" : result === outcome.draw ? "A perfect draw" :
    isA || isB ? ((result === outcome.blue) === isA ? "You win!" : "You lose") :
      result === outcome.blue ? "Panda Blue wins" : "Panda Red wins";
  return <div className="result" role="status"><span className="eyebrow">✦ &nbsp; VERIFIED ON SEPOLIA</span><h2>{title}</h2>
    <p>{result === outcome.void ? "An encrypted move was outside the allowed range. No stats were awarded." :
      "The duel contract verified the proof and recorded this outcome."}</p></div>;
}

function GameStatus({ room, overdue, submitted }: { room: Room; overdue: boolean; submitted: boolean }) {
  if (overdue) return <h2>Time is up.</h2>;
  switch (room.phase) {
    case phase.lobby: return <h2>Waiting for a challenger.</h2>;
    case phase.moves: return <h2>{submitted ? "Waiting for your opponent." : "Choose your move."}</h2>;
    case phase.result: return <h2>Verify the verdict.</h2>;
    case phase.cancelled: return <h2>Room cancelled.</h2>;
    case phase.expired: return <h2>Room expired.</h2>;
    default: return null;
  }
}

function RoomGame({ id }: { id: bigint }) {
  const { address } = useConnection();
  const router = useRouter();
  const tx = useDuelTransaction();
  const gate = useWalletGate();
  const encrypt = useEncrypt();
  const decrypt = useDecryptPublicValues();
  const query = useQuery({ queryKey: ["room", id.toString()], queryFn: () => getRoom(id),
    enabled: deployed, refetchInterval: 4_000, retry: 1 });
  const room = query.data;
  const deadline = room?.phase === phase.lobby ? room.joinDeadline : room?.phase === phase.moves ? room.moveDeadline : undefined;
  const block = useQuery({ queryKey: ["chain-time"], queryFn: () => publicClient.getBlock(), enabled: deadline !== undefined, refetchInterval: 8_000 });
  const overdue = deadline !== undefined && block.data !== undefined && block.data.timestamp >= deadline;
  const refresh = async () => { await query.refetch(); };
  const simple = (functionName: "joinRoom" | "cancelRoom" | "expireRoom") =>
    tx.run(() => ({ functionName, args: [id] }), refresh);

  if (!deployed) return <section className="page"><h1>Room #{id.toString()}</h1><p className="notice">{gate}</p><Link href="/play">Back to lobby</Link></section>;
  if (!room) return <section className="page"><h1>Room #{id.toString()}</h1>{query.isError ?
    <div className="notice danger" role="alert">{query.error.message.split("\n")[0]} <button className="btn ghost" onClick={refresh}>Retry</button></div> :
    <p role="status">Reading Sepolia room state…</p>}</section>;

  const isA = Boolean(address && isAddressEqual(address, room.playerA));
  const isB = Boolean(address && isAddressEqual(address, room.playerB));
  const participant = isA || isB;
  const submitted = isA ? room.submittedA : isB && room.submittedB;
  const canJoin = !isA && (room.invitedOpponent === zeroAddress || Boolean(address && isAddressEqual(address, room.invitedOpponent)));
  const disabled = tx.busy || !tx.ready;

  function submit(value: bigint) {
    if (!address) return;
    void tx.run(async stage => {
      stage("Encrypting move in your browser");
      const { encryptedValues, inputProof } = await encrypt.mutateAsync({
        contractAddress: duel.address, userAddress: address, values: [{ type: "euint8", value }],
      });
      const [handle] = encryptedValues;
      if (!handle) throw new Error("Zama returned no encrypted input. Try again.");
      return { functionName: "submitMove", args: [id, handle, inputProof] };
    }, refresh);
  }

  function finalize(handle: Room["encryptedResult"]) {
    void tx.run(async stage => {
      stage("Fetching the encrypted outcome’s decryption proof");
      const { clearValues, decryptionProof } = await decrypt.mutateAsync([handle]);
      const value = clearValues[handle];
      if (typeof value !== "bigint" || value < 0n || value > 3n) throw new Error("Zama returned an unexpected outcome.");
      stage("Verifying decrypted outcome");
      return { functionName: "finalizeRound", args: [id, Number(value), decryptionProof] };
    }, refresh);
  }

  function rematch() {
    void tx.run(() => ({ functionName: "createRematch", args: [id] }), receipt => {
      const [created] = parseEventLogs({ abi: duel.abi, eventName: "RematchCreated", logs: receipt.logs.filter(log => log.address.toLowerCase() === duel.address.toLowerCase()) });
      if (!created) throw new Error("The receipt did not include a rematch ID.");
      router.push(`/room/${created.args.roomId}`);
    });
  }

  return (
    <section className="page room">
      <span className="eyebrow">THE BAMBOO DOJO</span><h1>Room #{id.toString()}</h1>
      <div className="two room-layout">
        <div>
          <BattleAnimation compact />
          <div className="two seats">
            <RoomCard address={room.playerA} blue submitted={room.submittedA} you={isA} />
            <RoomCard address={room.playerB} blue={false} submitted={room.submittedB} you={isB} />
          </div>
        </div>
        <div className="card room-action">
          <GameStatus room={room} overdue={overdue} submitted={submitted} />
          {deadline !== undefined && !overdue && <p className="muted">Deadline <time dateTime={new Date(Number(deadline) * 1_000).toISOString()}>{new Date(Number(deadline) * 1_000).toLocaleString()}</time></p>}
          {overdue ? <button className="btn ghost" disabled={disabled} onClick={() => simple("expireRoom")}>Mark room expired</button> :
            room.phase === phase.lobby ? <>
              <p>{isA ? "Send the room link to your opponent." : canJoin ? "Take the red seat to start the duel." : "This rematch is reserved for the original opponent."}</p>
              {isA ? <div className="actions"><InviteLink /><button className="btn ghost" disabled={disabled} onClick={() => simple("cancelRoom")}>Cancel room</button></div> :
                canJoin && <button className="btn primary" disabled={disabled} onClick={() => simple("joinRoom")}>Join as Panda Red ↗</button>}
            </> : room.phase === phase.moves ? <>
              {participant && !submitted ? <><p>Your selection is encrypted before you sign. A confirmed move is final.</p><MoveSelector submit={submit} disabled={disabled} /></> :
                <p>{submitted ? "Your move is locked. This room updates as new transactions confirm." : "Both seats are filled. You can watch the round from here."}</p>}
            </> : room.phase === phase.result ? <>
              <p>Both moves are sealed. Zama may still be computing the encrypted result. Anyone can fetch its proof and submit it for verification.</p>
              <button className="btn primary" disabled={disabled} onClick={() => finalize(room.encryptedResult)}>Verify &amp; finalize ↗</button>
            </> : room.phase === phase.complete ? <>
              <ResultModal result={room.result} isA={isA} isB={isB} />
              {room.rematchId > 0n ? <Link className="btn primary" href={`/room/${room.rematchId}`}>Open rematch ↗</Link> :
                participant && <button className="btn primary" disabled={disabled} onClick={rematch}>Request rematch ↗</button>}
            </> : <Link className="btn ghost" href="/play">Back to lobby</Link>}
          {gate && <p className="muted">{gate}</p>}
          {query.isRefetchError && <p className="danger" role="alert">Room updates are delayed. <button onClick={refresh}>Retry</button></p>}
          <TransactionStatus progress={tx.progress} />
        </div>
      </div>
    </section>
  );
}

export default function RoomView({ id }: { id: string }) {
  return <DuelSdk><RoomGame id={BigInt(id)} /></DuelSdk>;
}
