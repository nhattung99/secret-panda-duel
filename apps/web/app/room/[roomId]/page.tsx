import { notFound } from "next/navigation";
import { parseRoomId } from "@/lib/chain";
import { RoomClient } from "@/components/room-client";

export const metadata = { title: "Duel room" };

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const id = parseRoomId(roomId);
  if (!id) notFound();
  return <RoomClient id={id.toString()} />;
}
