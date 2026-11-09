"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { deployed, duel, getRoom, outcome, publicClient, shortAddress, type Room } from "@/lib/chain";

const pageSize = 10n;

function MatchHistory({ entries, player }: { entries: { id: bigint; room: Room }[]; player: string }) {
  return (
    <ul className="match-list">
      {entries.map(({ id, room }) => {
        const isA = room.playerA.toLowerCase() === player.toLowerCase();
        const other = isA ? room.playerB : room.playerA;
        const label = room.result === outcome.draw ? "Draw" : room.result === outcome.void ? "Void" :
          (room.result === outcome.blue) === isA ? "Win" : "Loss";
        return <li key={id.toString()}><Link href={`/room/${id}`}>
          <strong>Room #{id.toString()}</strong><span>vs {shortAddress(other)}</span><span className={`badge ${label.toLowerCase()}`}>{label}</span>
        </Link></li>;
      })}
    </ul>
  );
}

export default function History() {
  const { address } = useConnection();
  return (
    <section className="page">
      <span className="eyebrow">THE DOJO LEDGER</span><h1>Match history.</h1>
      <p className="lead">Your verified rounds and lifetime stats on Ethereum Sepolia.</p>
      {!deployed ? <p className="notice">A Sepolia deployment address is required to read match history.</p> :
        !address ? <p className="notice">Connect MetaMask to see your rounds.</p> : <PlayerHistory key={address} address={address} />}
    </section>
  );
}

function PlayerHistory({ address }: { address: `0x${string}` }) {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["matches", address, page],
    queryFn: async () => {
      const [stats, ids] = await Promise.all([
        publicClient.readContract({ ...duel, functionName: "getPlayerStats", args: [address] }),
        publicClient.readContract({ ...duel, functionName: "getRecentMatches", args: [address, BigInt(page) * pageSize, pageSize + 1n] }),
      ]);
      const entries = await Promise.all(ids.slice(0, Number(pageSize)).map(async id => ({ id, room: await getRoom(id) })));
      return { stats, entries, hasMore: ids.length > Number(pageSize) };
    },
  });

  if (query.isPending) return <p role="status">Reading match history…</p>;
  if (query.isError) return <div className="notice danger" role="alert">Could not load match history. <button onClick={() => query.refetch()}>Retry</button></div>;
  const { stats, entries, hasMore } = query.data;
  return (
    <>
      <div className="three stats">{Object.entries(stats).map(([name, value]) =>
        <div className="card" key={name}><span className="step">{name.toUpperCase()}</span><strong>{value.toString()}</strong></div>)}</div>
      <div className="card ledger">
        <h2>Verified rounds</h2>
        {entries.length ? <MatchHistory entries={entries} player={address} /> : <p>No verified rounds yet. <Link href="/play">Play a duel ↗</Link></p>}
        {(page > 0 || hasMore) && <div className="actions"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
          <button className="btn ghost" disabled={!hasMore} onClick={() => setPage(page + 1)}>Older</button></div>}
      </div>
    </>
  );
}
