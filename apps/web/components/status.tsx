import type { Hash } from "viem";
import { chain } from "@/lib/chain";

export function TransactionStatus({ progress }: { progress?: { stage: string; hash?: Hash; error?: string } }) {
  if (!progress) return null;
  return (
    <div className={progress.error ? "notice danger" : "notice"} role={progress.error ? "alert" : "status"}>
      <strong>{progress.stage}</strong>
      {progress.error && <p>{progress.error}</p>}
      {progress.hash && <a href={`${chain.blockExplorers.default.url}/tx/${progress.hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
    </div>
  );
}
