"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseEventLogs } from "viem";
import { duel, parseRoomId } from "@/lib/chain";
import { useDuelTransaction, useWalletGate } from "@/lib/use-duel-transaction";
import { TransactionStatus } from "@/components/status";

export default function Play() {
  const router = useRouter();
  const tx = useDuelTransaction();
  const gate = useWalletGate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function join(event: FormEvent) {
    event.preventDefault();
    const raw = code.trim();
    const path = raw.match(/^(?:https?:\/\/[^/]+)?\/room\/([0-9]+)\/?(?:[?#].*)?$/)?.[1] ?? raw;
    const id = parseRoomId(path);
    if (!id) { setError("Enter a valid room number or invitation URL."); return; }
    router.push(`/room/${id}`);
  }

  return (
    <section className="page">
      <span className="eyebrow">DOJO LOBBY</span><h1>Take your seat.</h1>
      <p className="lead">Host a new duel or use an invitation to enter a friend’s room.</p>
      <div className="two">
        <article className="card lobby-card">
          <span className="step">01 / HOST</span><h2>Create a room</h2>
          <p>You’ll play as Panda Blue. Share the room link and wait for your opponent.</p>
          <button className="btn primary" disabled={!tx.ready || tx.busy} onClick={() =>
            tx.run(() => ({ functionName: "createRoom" }), (receipt) => {
              const [created] = parseEventLogs({ abi: duel.abi, eventName: "RoomCreated", logs: receipt.logs.filter(log => log.address.toLowerCase() === duel.address.toLowerCase()) });
              if (!created) throw new Error("The receipt did not include a room ID.");
              router.push(`/room/${created.args.roomId}`);
            })}>Create room ↗</button>
          {gate && <p className="muted">{gate}</p>}
          <TransactionStatus progress={tx.progress} />
        </article>
        <form className="card lobby-card" onSubmit={join}>
          <span className="step">02 / CHALLENGE</span><h2>Find a room</h2>
          <label htmlFor="room-code">Room number or invitation link</label>
          <input id="room-code" value={code} onChange={event => { setCode(event.target.value); setError(""); }} placeholder="e.g. 42" required />
          {error && <p role="alert" className="danger">{error}</p>}
          <button className="btn ghost">Open room ↗</button>
        </form>
      </div>
    </section>
  );
}
