/* Paleta a ikony damage types + stran (sdílené vizuály). */
export const DMG_STYLE: Record<string, { c: string; bg: string; icon: string }> = {
  Acid:        { c: "#65a30d", bg: "#365314", icon: "🧪" },
  Bludgeoning: { c: "#a8a29e", bg: "#44403c", icon: "🔨" },
  Cold:        { c: "#38bdf8", bg: "#0c4a6e", icon: "❄️" },
  Fire:        { c: "#f97316", bg: "#7c2d12", icon: "🔥" },
  Force:       { c: "#c084fc", bg: "#581c87", icon: "✴️" },
  Lightning:   { c: "#facc15", bg: "#713f12", icon: "⚡" },
  Necrotic:    { c: "#4d7c0f", bg: "#1a2e05", icon: "💀" },
  Piercing:    { c: "#94a3b8", bg: "#334155", icon: "🗡️" },
  Poison:      { c: "#22c55e", bg: "#14532d", icon: "☠️" },
  Psychic:     { c: "#e879f9", bg: "#701a75", icon: "🧠" },
  Radiant:     { c: "#fde047", bg: "#713f12", icon: "☀️" },
  Slashing:    { c: "#cbd5e1", bg: "#475569", icon: "⚔️" },
  Thunder:     { c: "#60a5fa", bg: "#1e3a8a", icon: "🔊" },
  heal:        { c: "#4ade80", bg: "#14532d", icon: "✚" },
  Immune:      { c: "#60a5fa", bg: "#1e3a8a", icon: "🛡" },
  Resist:      { c: "#f59e0b", bg: "#78350f", icon: "½" },
};
export const dmgStyle = (t?: string) => DMG_STYLE[t || ""] || DMG_STYLE.Force;

export const SIDE_STYLE: Record<string, { name: string; rim: string; ring: string; glow: string }> = {
  druzina:   { name: "Družina",   rim: "#7c8ea8", ring: "#3b82f6", glow: "rgba(96,165,250,.55)" },
  nepratele: { name: "Nepřátelé", rim: "#7c4a32", ring: "#dc2626", glow: "rgba(239,68,68,.55)" },
  neutral:   { name: "Neutrální", rim: "#a3863d", ring: "#eab308", glow: "rgba(234,179,8,.5)" },
};

/** HP stav pro hráče (bucket místo čísel). */
export const hpBucket = (t: { hp: number; max: number; dead?: boolean }) =>
  t.dead || t.hp <= 0 ? "Mrtvý"
  : t.hp === t.max ? "Nezraněný"
  : t.hp / t.max > 0.5 ? "Lehce zraněný"
  : t.hp / t.max > 0.25 ? "Těžce zraněný"
  : "Na pokraji";
