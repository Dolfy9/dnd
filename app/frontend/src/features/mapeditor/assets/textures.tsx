/* Procedurální SVG textury (pattern) — ≥15 typů, tmavé fantasy. */
import React from "react";

export interface TextureDef { id: string; nazev: string; size: number; render: () => React.ReactElement; bg: string }

const P = (id: string, nazev: string, size: number, bg: string, render: () => React.ReactElement): TextureDef => ({ id, nazev, size, bg, render });
const L = (props: any) => <line {...props} />;
const R = (props: any) => <rect {...props} />;
const C = (props: any) => <circle {...props} />;
const Pa = (props: any) => <path {...props} />;

export const TEXTURES: TextureDef[] = [
  P("dlazba", "Dlažba", 24, "#8a857c", () => <>
    <L x1="0" y1="0" x2="24" y2="0" stroke="#5c574e" strokeWidth="1" /><L x1="0" y1="0" x2="0" y2="24" stroke="#5c574e" strokeWidth="1" />
    <L x1="0" y1="12" x2="24" y2="12" stroke="#6e695f" strokeWidth=".5" /><L x1="12" y1="0" x2="12" y2="12" stroke="#6e695f" strokeWidth=".5" /><L x1="6" y1="12" x2="6" y2="24" stroke="#6e695f" strokeWidth=".5" /><L x1="18" y1="12" x2="18" y2="24" stroke="#6e695f" strokeWidth=".5" /></>),
  P("kocici-hlavy", "Kočičí hlavy", 20, "#7d7466", () => <>
    <C cx="5" cy="6" r="3" fill="#655c50" /><C cx="15" cy="16" r="3" fill="#655c50" /><C cx="15" cy="6" r="2.6" fill="#6e6558" /><C cx="5" cy="16" r="2.6" fill="#6e6558" /></>),
  P("drevo", "Dřevo", 24, "#8a6a44", () => <>
    <Pa d="M0 4 Q12 6 24 3 M0 10 Q12 12 24 9 M0 17 Q12 15 24 18 M0 22 Q12 24 24 21" stroke="#6b4f30" strokeWidth="1" fill="none" />
    <C cx="7" cy="8" r="1" fill="#5d4229" /><C cx="18" cy="15" r=".8" fill="#5d4229" /></>),
  P("trava", "Tráva", 20, "#5d7345", () => <>
    <Pa d="M4 18 l1 -4 M7 19 l1.5 -5 M11 18 l-1 -4 M14 19 l1 -5 M17 18 l1 -3 M3 8 l1 -3 M9 7 l1 -3 M16 7 l-1 -3" stroke="#47603a" strokeWidth="1" fill="none" /></>),
  P("hlina", "Hlína", 20, "#7a5c3e", () => <>
    <C cx="5" cy="5" r="1.4" fill="#65492f" /><C cx="14" cy="9" r="1" fill="#65492f" /><C cx="8" cy="15" r="1.2" fill="#6b5034" /><Pa d="M2 12 q4 2 8 0" stroke="#5f452c" fill="none" /></>),
  P("pisek", "Písek", 20, "#c9b489", () => <>
    <Pa d="M0 6 Q10 3 20 7 M0 14 Q10 11 20 15" stroke="#b39d72" strokeWidth="1" fill="none" />
    <C cx="5" cy="10" r=".6" fill="#a38e63" /><C cx="15" cy="18" r=".6" fill="#a38e63" /></>),
  P("snih", "Sníh", 20, "#e8ecf0", () => <>
    <Pa d="M3 8 q3 -3 6 0 M11 15 q3 -3 6 0" stroke="#c4ccd6" strokeWidth="1" fill="none" /><C cx="15" cy="5" r=".7" fill="#c4ccd6" /></>),
  P("mramor", "Mramor", 28, "#cfcbc4", () => <>
    <Pa d="M0 8 Q10 4 20 10 T28 8 M0 20 Q14 16 28 22 M8 0 Q12 10 6 18" stroke="#a9a49b" strokeWidth=".8" fill="none" /></>),
  P("koberec", "Koberec", 20, "#7d3b3b", () => <>
    <R x="1" y="1" width="18" height="18" fill="none" stroke="#5d2c2c" strokeWidth="1.4" />
    <Pa d="M6 10 l4 -4 4 4 -4 4 z" fill="none" stroke="#a06a4a" strokeWidth="1" /><C cx="10" cy="10" r="1" fill="#a06a4a" /></>),
  P("melka-voda", "Mělká voda", 24, "#5f8a9e", () => <>
    <Pa d="M0 6 Q6 4 12 6 T24 6 M0 14 Q6 12 12 14 T24 14 M0 20 Q6 18 12 20 T24 20" stroke="#7fa8ba" strokeWidth="1" fill="none" /></>),
  P("hluboka-voda", "Hluboká voda", 24, "#2e4f63", () => <>
    <Pa d="M0 7 Q6 5 12 7 T24 7 M0 16 Q6 14 12 16 T24 16" stroke="#436b82" strokeWidth="1.2" fill="none" /></>),
  P("lava", "Láva", 24, "#4a1608", () => <>
    <Pa d="M0 8 Q8 5 14 9 T24 7 M0 18 Q10 14 20 19" stroke="#e05a16" strokeWidth="1.6" fill="none" />
    <C cx="6" cy="6" r="1.4" fill="#f08a24" /><C cx="17" cy="13" r="1" fill="#f0b024" /></>),
  P("led", "Led", 24, "#bcd8e8", () => <>
    <Pa d="M4 4 l8 10 M14 2 l-4 9 M8 16 l10 4 M18 8 l4 6" stroke="#8fb8d4" strokeWidth="1" /></>),
  P("bazina", "Bažina", 20, "#4d5c3e", () => <>
    <C cx="6" cy="8" r="2.4" fill="#3e5c52" /><C cx="14" cy="15" r="1.8" fill="#3e5c52" /><C cx="7" cy="7" r=".7" fill="#6a7c50" /><C cx="15" cy="6" r="1.4" fill="#46543a" /></>),
  P("jeskyne", "Jeskynní skála", 24, "#57534e", () => <>
    <Pa d="M2 8 L10 4 L14 9 M6 18 L14 14 L20 18 M16 4 L22 8" stroke="#43403c" strokeWidth="1.4" fill="none" /><C cx="19" cy="19" r="1" fill="#3d3a36" /></>),
];

export const TEXTURE_IDS = new Set(TEXTURES.map((t) => t.id));
export const textureById = (id: string) => TEXTURES.find((t) => t.id === id);

/** <defs> bloky pro všechny použité textury (vložit do editor/battle SVG). */
export function TextureDefs() {
  return <>{TEXTURES.map((t) => (
    <pattern key={t.id} id={`tex-${t.id}`} width={t.size} height={t.size} patternUnits="userSpaceOnUse">
      <rect width={t.size} height={t.size} fill={t.bg} />
      {t.render()}
    </pattern>
  ))}</>;
}
export const texUrl = (id: string) => `url(#tex-${id})`;
