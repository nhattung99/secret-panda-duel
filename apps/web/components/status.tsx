import type { Hash } from "viem";
import { chain } from "@/lib/chain";

export function TransactionStatus({ progress, busy }: { progress?: { stage: string; hash?: Hash; error?: string }; busy?: boolean }) {
  if (!progress) return null;
  return (
    <div className={progress.error ? "notice danger" : "notice"} role={progress.error ? "alert" : "status"}>
      <strong className="loading-line">{busy && !progress.error && <span className="loading-spinner" aria-hidden="true" />}{progress.stage}</strong>
      {progress.error && <p>{progress.error}</p>}
      {progress.hash && <a href={`${chain.blockExplorers.default.url}/tx/${progress.hash}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
    </div>
  );
}
