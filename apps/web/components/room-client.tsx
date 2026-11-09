"use client";

import dynamic from "next/dynamic";

const RoomView = dynamic(() => import("./room-view"), {
  ssr: false,
  loading: () => <section className="page" role="status">Opening the dojo…</section>,
});

export function RoomClient({ id }: { id: string }) {
  return <RoomView key={id} id={id} />;
}
