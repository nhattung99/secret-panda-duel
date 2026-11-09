export function PandaCharacter({ side, className = "" }: { side: "blue" | "red"; className?: string }) {
  const red = side === "red";
  const color = red ? "#fa6f9e" : "#65ecd9";
  const trim = red ? "#7c284b" : "#216663";
  return (
    <svg className={className} viewBox="0 0 220 240" role="img" aria-label={red ? "Panda Red" : "Panda Blue"}>
      <ellipse cx="110" cy="215" rx="79" ry="12" fill="#090a19" opacity=".75" />
      <path d="M45 179 32 197Q28 210 48 210h37l7-26m40 0 8 26h39q18-1 13-15l-18-16" fill="#1a1a32" stroke="#38354d" strokeWidth="3" />
      <path d="M58 124Q34 144 40 172q4 22 69 23 67-1 72-23 6-29-21-47" fill={trim} stroke="#18182a" strokeWidth="4" />
      <path d="m80 143 58 45m-1-47-54 49" stroke={color} strokeWidth="8" opacity=".75" />
      <path d="M58 170q52 16 104 0v10q-51 17-104 0z" fill={color} />
      <rect x="99" y="173" width="22" height="17" rx="4" fill="#25233c" stroke={color} strokeWidth="3" />
      <circle cx="53" cy="61" r="29" fill="#24233b" stroke="#413d57" strokeWidth="4" />
      <circle cx="166" cy="61" r="29" fill="#24233b" stroke="#413d57" strokeWidth="4" />
      <circle cx="53" cy="61" r="13" fill="#65536c" />
      <circle cx="166" cy="61" r="13" fill="#65536c" />
      <path d="M39 109c0-37 29-59 71-59s71 22 71 59c0 30-31 49-71 49s-71-19-71-49Z" fill="#f9edee" stroke="#25243b" strokeWidth="4" />
      <path d="M39 91q72-36 142 0l-2 11q-72-30-138 0z" fill={color} />
      <path d={red ? "M178 94q16 1 28-16l-1 13-22 14 27-1-8 9-24-8" : "M42 94Q26 95 14 78l1 13 22 14-27-1 8 9 24-8"} fill={color} />
      <ellipse cx="77" cy="113" rx="17" ry="20" transform="rotate(27 77 113)" fill="#28263d" />
      <ellipse cx="143" cy="113" rx="17" ry="20" transform="rotate(-27 143 113)" fill="#28263d" />
      <circle cx="79" cy="110" r="5" fill="#fff" /><circle cx="141" cy="110" r="5" fill="#fff" />
      <ellipse cx="110" cy="125" rx="8" ry="5" fill="#28263d" />
      <path d="M110 129q-6 11-14 4m14-4q6 11 14 4" fill="none" stroke="#28263d" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="60" cy="131" rx="8" ry="4" fill="#f8a7af" /><ellipse cx="160" cy="131" rx="8" ry="4" fill="#f8a7af" />
      <path d="M54 143q-24-2-20 20 4 15 22 4m111-24q24-2 20 20-4 15-22 4" fill="#29273f" stroke="#43415c" strokeWidth="3" />
    </svg>
  );
}

export function BattleAnimation({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "arena arena-compact" : "arena"}>
      <div className="arena-grid" aria-hidden="true" />
      <span className="arena-label"><span className="led" /> THE BAMBOO DOJO</span>
      <div className="fighters">
        <figure><PandaCharacter side="blue" /><figcaption>01 / PANDA BLUE</figcaption></figure>
        <span className="versus" aria-hidden="true">VS</span>
        <figure><PandaCharacter side="red" /><figcaption>02 / PANDA RED</figcaption></figure>
      </div>
      <span className="arena-caption">✦ &nbsp; ENCRYPTED MOVES · PUBLIC VERDICT &nbsp; ✦</span>
    </div>
  );
}
