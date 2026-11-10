"use client";

import dynamic from "next/dynamic";

const RoomView = dynamic(() => import("./room-view"), {
  ssr: false,
  loading: () => <section className="page" role="status"><p className="loading-line">
    <span className="loading-spinner" aria-hidden="true" />Opening the dojo…
  </p></section>,
});

export function RoomClient({ id }: { id: string }) {
  return <RoomView key={id} id={id} />;
}
