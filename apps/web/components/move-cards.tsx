import { useId } from "react";

const moves = [
  { kind: "rock", name: "Rock", beats: "Beats scissors", value: 0n },
  { kind: "paper", name: "Paper", beats: "Beats rock", value: 1n },
  { kind: "scissors", name: "Scissors", beats: "Beats paper", value: 2n },
] as const;

type Move = (typeof moves)[number];

function MoveArt({ kind }: { kind: Move["kind"] }) {
  const gradient = useId();
  return (
    <svg className="move-art" viewBox="0 0 120 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradient} x2=".72" y2="1">
          {kind === "scissors" ? <><stop stopColor="#ffe4ff" /><stop offset="1" stopColor="#df76dc" /></> :
            <><stop stopColor="#fff4dc" /><stop offset=".56" stopColor="#ffd0a2" /><stop offset="1" stopColor="#e99168" /></>}
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="90" rx="34" ry="5" fill="#1b1330" opacity=".18" />
      <path d="M14 40h12m-6-6v12m80-22h12m-6-6v12" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".8" />
      {kind === "rock" && (
        <g transform="rotate(-16 60 50)" stroke="#2d1920" strokeWidth="4" strokeLinejoin="round">
          <path d="M28 76q-13-13-7-29 4-10 13-11 3-10 13-12 5-11 16-10 10-8 22-1 19 10 17 30l-8 26q-5 16-22 17l-25-1q-12 1-19-9Z" fill={`url(#${gradient})`} />
          <path d="M37 65q-8-12-3-29m22 24q-8-15-8-33m24 27q-4-16-10-40m-33 59q9-13 19-8l13 8" fill="none" stroke="#a95745" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M32 47q3-7 7-9m22-15q5-6 12-5m10 1q7 2 11 9" fill="none" stroke="#fff4e3" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {kind === "paper" && (
        <g transform="rotate(-8 60 50)" stroke="#2d1920" strokeWidth="4" strokeLinejoin="round">
          <path d="M43 82q-10-7-16-18L16 52q-5-6 1-10 6-4 12 1l9 7-5-26q-2-9 5-11 8-2 10 7l7 22-1-31q0-8 7-8 8 0 8 8l2 29 5-23q2-8 9-6 7 2 5 9l-4 24 8-13q5-7 11-3 6 4 1 11L94 62q-3 11-12 17l-2 8q-20 8-36 0Z" fill={`url(#${gradient})`} />
          <path d="M37 51q13-2 21 11m-3-18q13-5 26 1" fill="none" stroke="#c37b5c" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {kind === "scissors" && (
        <g transform="rotate(10 60 50)" stroke="#35184d" strokeWidth="4" strokeLinejoin="round">
          <path d="M41 83q-16-9-14-24 0-8 7-10 0-7 8-8l-5-24q-1-10 7-12 9-2 11 8l9 26 14-23q5-8 12-4 7 4 2 12L79 51q9 8 7 19-2 13-15 17-15 4-30-4Z" fill={`url(#${gradient})`} />
          <path d="M34 49q8 0 11 11m-3-19q8-2 14 12m12 14q-4-12-16-8-7 3-4 9 2 6 13 8" fill="none" stroke="#873c98" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

function MoveFace({ move }: { move: Move }) {
  return (
    <>
      <span className="move-index" aria-hidden="true">0{Number(move.value) + 1}</span>
      <MoveArt kind={move.kind} />
      <strong>{move.name}</strong>
      <small>{move.beats}</small>
    </>
  );
}

export function MoveGallery() {
  return (
    <ul className="move-grid move-gallery" aria-label="Three duel moves">
      {moves.map(move => <li className={`move move-${move.kind}`} key={move.kind}><MoveFace move={move} /></li>)}
    </ul>
  );
}

export function MoveSelector({ submit, disabled, selected, busy }: {
  submit: (move: bigint) => void;
  disabled: boolean;
  selected?: bigint;
  busy: boolean;
}) {
  return (
    <div className="move-grid" role="group" aria-label="Choose your move" aria-busy={busy}>
      {moves.map(move => {
        const pending = busy && selected === move.value;
        return (
          <button key={move.kind} type="button" className={`move move-${move.kind}`} data-selected={pending}
            disabled={disabled} onClick={() => submit(move.value)}>
            <MoveFace move={move} />
            {pending && <span className="move-scan" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
