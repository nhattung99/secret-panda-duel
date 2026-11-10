"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { parseEventLogs, type Address } from "viem";
import { useConnection } from "wagmi";
import { duel, getUsername, parseRoomId } from "@/lib/chain";
import { useDuelTransaction, useGameVersion, useWalletGate } from "@/lib/use-duel-transaction";
import { TransactionStatus } from "@/components/status";

function PlayerProfile({ address }: { address?: Address }) {
  const tx = useDuelTransaction();
  const gate = useWalletGate();
  const username = useQuery({
    queryKey: ["username", duel.address, address?.toLowerCase()],
    queryFn: () => getUsername(address!),
    enabled: Boolean(address),
  });
  const [draft, setDraft] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    void tx.run(() => ({ functionName: "setUsername", args: [draft] }), async () => {
      await username.refetch();
      setDraft("");
    });
  }
  return (
    <form className="card lobby-card profile-card" onSubmit={save}>
      <span className="step">PLAYER PROFILE</span>
      <h2>Choose your username</h2>
      <p>{username.data ? `Current username: ${username.data}` : "Your username is public and linked to your wallet."}</p>
      <label htmlFor="username">3–20 letters, digits, or underscores</label>
      <input id="username" value={draft} onChange={event => setDraft(event.target.value)}
        pattern="[A-Za-z0-9_]{3,20}" minLength={3} maxLength={20} required autoComplete="off" disabled={!address} />
      <button className="btn ghost" disabled={!tx.ready || tx.busy || draft === username.data}>Save username</button>
      {gate && <p className="muted">{gate}</p>}
      {username.isError && <button className="btn ghost" type="button" onClick={() => username.refetch()}>Retry profile read</button>}
      <TransactionStatus progress={tx.progress} busy={tx.busy} />
    </form>
  );
}

export default function Play() {
  const router = useRouter();
  const { address } = useConnection();
  const tx = useDuelTransaction();
  const gate = useWalletGate();
  const version = useGameVersion();
  const isMatch = version.data === 2;
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function join(event: FormEvent) {
    event.preventDefault();
    const raw = code.trim();
    const path = raw.match(/^(?:https?:\/\/[^/]+)?\/room\/([0-9]+)\/?(?:[?#].*)?$/)?.[1] ?? raw;
    const id = parseRoomId(path);
    if (!id || (isMatch && !/^[1-9][0-9]{3}$/.test(path))) {
      setError(isMatch ? "Enter a four-digit room code or invitation URL." : "Enter a valid room number or invitation URL.");
      return;
    }
    router.push(`/room/${id}`);
  }

  return (
    <section className="page">
      <span className="eyebrow">DOJO LOBBY</span><h1>Take your seat.</h1>
      <p className="lead">Host a new duel or use an invitation to enter a friend’s room.</p>
      {version.isError && <p className="notice danger" role="alert">Could not read the contract version. <button onClick={() => version.refetch()}>Retry</button></p>}
      {isMatch && <PlayerProfile key={address} address={address} />}
      <div className="two">
        <article className="card lobby-card">
          <span className="step">01 / HOST</span><h2>Create a room</h2>
          <p>{isMatch ? "Play as Panda Blue. Share your four-digit code with one opponent. First to two wins takes the match." :
            "You’ll play as Panda Blue. Share the room link and wait for your opponent."}</p>
          <button className="btn primary" disabled={!tx.ready || tx.busy || !version.data} onClick={() =>
            tx.run(() => ({ functionName: "createRoom" }), (receipt) => {
              const [created] = parseEventLogs({ abi: duel.abi, eventName: "RoomCreated", logs: receipt.logs.filter(log => log.address.toLowerCase() === duel.address.toLowerCase()) });
              if (!created) throw new Error("The receipt did not include a room ID.");
              router.push(`/room/${created.args.roomId}`);
            })}>Create room ↗</button>
          {gate && <p className="muted">{gate}</p>}
          <TransactionStatus progress={tx.progress} busy={tx.busy} />
        </article>
        <form className="card lobby-card" onSubmit={join}>
          <span className="step">02 / CHALLENGE</span><h2>Find a room</h2>
          <label htmlFor="room-code">{isMatch ? "Four-digit room code or invitation link" : "Room number or invitation link"}</label>
          <input id="room-code" value={code} onChange={event => { setCode(event.target.value); setError(""); }}
            placeholder={isMatch ? "e.g. 4821" : "e.g. 42"} required />
          {error && <p role="alert" className="danger">{error}</p>}
          <button className="btn ghost">Open room ↗</button>
        </form>
      </div>
    </section>
  );
}
