import type { ReactNode } from "react";

export function PandaCharacter({ side }: { side: "blue" | "red" }) {
  return (
    <span className={`panda-sprite panda-${side}`} role="img" aria-label={side === "red" ? "Panda Red" : "Panda Blue"} />
  );
}

export function BattleAnimation({ compact = false, controls }: { compact?: boolean; controls?: ReactNode }) {
  return (
    <div className={compact ? "arena arena-compact" : "arena"}>
      <div className="arena-hud">
        <span className="arena-label"><span className="led" /> BAMBOO ARENA</span>
        <span className="arena-sector">SECTOR / 01</span>
      </div>
      <div className={controls ? "fighters fighters-with-controls" : "fighters"}>
        <figure><PandaCharacter side="blue" /><figcaption><small>PLAYER A</small> PANDA BLUE</figcaption></figure>
        {controls ? <div className="arena-center">{controls}</div> : <span className="versus" aria-hidden="true">VS</span>}
        <figure><PandaCharacter side="red" /><figcaption><small>PLAYER B</small> PANDA RED</figcaption></figure>
      </div>
      <span className="arena-caption">✦ &nbsp; ENCRYPTED MOVES · PUBLIC VERDICT &nbsp; ✦</span>
    </div>
  );
}
