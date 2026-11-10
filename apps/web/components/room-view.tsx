"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDecryptPublicValues, useEncrypt } from "@zama-fhe/react-sdk";
import { useConnection } from "wagmi";
import { decodeAbiParameters, isAddressEqual, parseEventLogs, zeroAddress, type Address } from "viem";
import { deployed, duel, getMatchRoom, getRoom, getUsername, outcome, phase, publicClient, shortAddress, type MatchScore, type Room } from "@/lib/chain";
import { useDuelTransaction, useGameVersion, useWalletGate } from "@/lib/use-duel-transaction";
import { DuelSdk } from "./duel-sdk";
import { BattleAnimation } from "./panda";
import { MoveSelector } from "./move-cards";
import { TransactionStatus } from "./status";

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

function RoomCard({ address, blue, submitted, you, isMatch }: {
  address: Address; blue: boolean; submitted: boolean; you: boolean; isMatch: boolean;
}) {
  const occupied = address !== zeroAddress;
  const username = useQuery({
    queryKey: ["username", duel.address, address.toLowerCase()],
    queryFn: () => getUsername(address), enabled: isMatch && occupied, refetchInterval: 12_000,
  });
  return (
    <div className={blue ? "seat blue" : "seat red"}>
      <span className="step">{blue ? "01 / PANDA BLUE" : "02 / PANDA RED"}{you && " · YOU"}</span>
      <strong>{occupied ? username.data || shortAddress(address) : "Open seat"}</strong>
      {username.data && <small title={address}>{shortAddress(address)}</small>}
      <EncryptedMoveIndicator submitted={submitted} occupied={occupied} />
    </div>
  );
}

function EncryptedMoveIndicator({ submitted, occupied }: { submitted: boolean; occupied: boolean }) {
  return (
    <small className={submitted ? "move-status move-locked" : "move-status"}>
      {submitted && <span className="lock-signal" aria-hidden="true">◆</span>}
      {submitted ? "Encrypted move locked" : occupied ? "Move pending" : "Waiting for a challenger"}
    </small>
  );
}

function Scoreboard({ score, round }: { score: MatchScore; round?: number }) {
  const labels = ["Draw", "Blue wins", "Red wins", "Void"];
  return (
    <div className="scoreboard" aria-label="Match scoreboard">
      <span className="step">{round ? `ROUND ${round} / 3` : "MATCH SCORE"} · FIRST TO 2 WINS</span>
      <strong>Blue {score.winsA} – {score.winsB} Red</strong>
      {score.played > 0 && <ol className="round-results">
        {score.rounds.slice(0, score.played).map((result, index) =>
          <li className="badge" key={index}>Round {index + 1} · {labels[result]}</li>)}
      </ol>}
    </div>
  );
}

function ResultModal({ result, isA, isB, isMatch }: { result: number; isA: boolean; isB: boolean; isMatch: boolean }) {
  const title = result === outcome.void ? (isMatch ? "Match void" : "Round void") :
    result === outcome.draw ? (isMatch ? "Match drawn" : "A perfect draw") :
    isA || isB ? ((result === outcome.blue) === isA ? (isMatch ? "You win the match!" : "You win!") :
      (isMatch ? "You lose the match" : "You lose")) :
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
  const [selectedMove, setSelectedMove] = useState<bigint>();
  const gate = useWalletGate();
  const version = useGameVersion();
  const isMatch = version.data === 2;
  const encrypt = useEncrypt();
  const decrypt = useDecryptPublicValues();
  const query = useQuery({
    queryKey: ["room", duel.address, version.data, id.toString()],
    queryFn: async () => isMatch ? getMatchRoom(id) : [await getRoom(id), undefined] as const,
    enabled: Boolean(version.data), refetchInterval: 4_000, retry: 1,
  });
  const [room, score] = query.data ?? [];
  const deadline = room?.phase === phase.lobby ? room.joinDeadline : room?.phase === phase.moves ? room.moveDeadline : undefined;
  const block = useQuery({ queryKey: ["chain-time"], queryFn: () => publicClient.getBlock(), enabled: deadline !== undefined, refetchInterval: 8_000 });
  const overdue = deadline !== undefined && block.data !== undefined && block.data.timestamp >= deadline;
  const refresh = async () => { await query.refetch(); };
  const simple = (functionName: "joinRoom" | "cancelRoom" | "expireRoom") =>
    tx.run(() => ({ functionName, args: [id] }), refresh);

  if (!deployed) return <section className="page"><h1>Room #{id.toString()}</h1><p className="notice">{gate}</p><Link href="/play">Back to lobby</Link></section>;
  if (version.isError) return <section className="page"><h1>Room #{id.toString()}</h1>
    <p className="notice danger" role="alert">Could not read the contract version. <button onClick={() => version.refetch()}>Retry</button></p></section>;
  if (!room) return <section className="page"><h1>Room #{id.toString()}</h1>{query.isError ?
    <div className="notice danger" role="alert">{query.error.message.split("\n")[0]} <button className="btn ghost" onClick={refresh}>Retry</button></div> :
    <p className="loading-line" role="status"><span className="loading-spinner" aria-hidden="true" />Reading Sepolia room state…</p>}</section>;

  const isA = Boolean(address && isAddressEqual(address, room.playerA));
  const isB = Boolean(address && isAddressEqual(address, room.playerB));
  const participant = isA || isB;
  const submitted = isA ? room.submittedA : isB && room.submittedB;
  const canJoin = !isA && (room.invitedOpponent === zeroAddress || Boolean(address && isAddressEqual(address, room.invitedOpponent)));
  const disabled = tx.busy || !tx.ready;
  const round = score ? score.played + 1 : undefined;

  function submit(value: bigint) {
    if (!address || disabled) return;
    setSelectedMove(value);
    void tx.run(async stage => {
      stage("Encrypting move in your browser");
      const { encryptedValues, inputProof } = await encrypt.mutateAsync({
        contractAddress: duel.address, userAddress: address, values: [{ type: "euint8", value }],
      });
      const [handle] = encryptedValues;
      if (!handle) throw new Error("Zama returned no encrypted input. Try again.");
      return round === undefined ? { functionName: "submitMove", args: [id, handle, inputProof] } :
        { functionName: "submitRoundMove", args: [id, round, handle, inputProof] };
    }, refresh);
  }

  function finalize(handle: Room["encryptedResult"]) {
    void tx.run(async stage => {
      stage("Fetching the encrypted outcome’s decryption proof");
      const { abiEncodedClearValues, decryptionProof } = await decrypt.mutateAsync([handle]);
      const [value] = decodeAbiParameters([{ type: "uint8" }], abiEncodedClearValues);
      if (value > outcome.void) throw new Error("Zama returned an unexpected outcome.");
      stage("Verifying decrypted outcome");
      return { functionName: "finalizeRound", args: [id, value, decryptionProof] };
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
      <span className="eyebrow">BAMBOO ARENA / DUEL ROOM</span><h1>Room <em>#{id.toString()}</em></h1>
      <div className="two room-layout">
        <div>
          <BattleAnimation compact controls={room.phase === phase.moves && !overdue && participant && !submitted ?
            <><p className="arena-prompt">Choose your move</p>
              <MoveSelector submit={submit} disabled={disabled} selected={selectedMove} busy={tx.busy} />
            </> : undefined} />
          <div className="two seats">
            <RoomCard address={room.playerA} blue submitted={room.submittedA} you={isA} isMatch={isMatch} />
            <RoomCard address={room.playerB} blue={false} submitted={room.submittedB} you={isB} isMatch={isMatch} />
          </div>
        </div>
        <div className="card room-action">
          {score && <Scoreboard score={score} round={room.phase <= phase.result ? round : undefined} />}
          <GameStatus room={room} overdue={overdue} submitted={submitted} />
          {deadline !== undefined && !overdue && <p className="muted">Deadline <time dateTime={new Date(Number(deadline) * 1_000).toISOString()}>{new Date(Number(deadline) * 1_000).toLocaleString()}</time></p>}
          {overdue ? <button className="btn ghost" disabled={disabled} onClick={() => simple("expireRoom")}>Mark room expired</button> :
            room.phase === phase.lobby ? <>
              <p>{isA ? (isMatch ? `Share code ${id} or send the invitation link.` : "Send the room link to your opponent.") :
                canJoin ? "Take the red seat to start the duel." : "This rematch is reserved for the original opponent."}</p>
              {isA ? <div className="actions"><InviteLink /><button className="btn ghost" disabled={disabled} onClick={() => simple("cancelRoom")}>Cancel room</button></div> :
                canJoin && <button className="btn primary" disabled={disabled} onClick={() => simple("joinRoom")}>Join as Panda Red ↗</button>}
            </> : room.phase === phase.moves ? <>
              {participant && !submitted ? <p>Your move is encrypted before you sign. A confirmed move is final.</p> :
                <p>{submitted ? "Your move is locked. This room updates as new transactions confirm." : "Both seats are filled. You can watch the round from here."}</p>}
            </> : room.phase === phase.result ? <>
              <p>Both moves are sealed. Zama may still be computing the encrypted result. Anyone can fetch its proof and submit it for verification.</p>
              <button className="btn primary" disabled={disabled} onClick={() => finalize(room.encryptedResult)}>Verify &amp; finalize ↗</button>
            </> : room.phase === phase.complete ? <>
              <ResultModal result={room.result} isA={isA} isB={isB} isMatch={isMatch} />
              {room.rematchId > 0n ? <Link className="btn primary" href={`/room/${room.rematchId}`}>Open rematch ↗</Link> :
                participant && <button className="btn primary" disabled={disabled} onClick={rematch}>Request rematch ↗</button>}
            </> : <Link className="btn ghost" href="/play">Back to lobby</Link>}
          {gate && <p className="muted">{gate}</p>}
          {query.isRefetchError && <p className="danger" role="alert">Room updates are delayed. <button onClick={refresh}>Retry</button></p>}
          <TransactionStatus progress={tx.progress} busy={tx.busy} />
        </div>
      </div>
    </section>
  );
}

export default function RoomView({ id }: { id: string }) {
  return <DuelSdk><RoomGame id={BigInt(id)} /></DuelSdk>;
}
