/* Ryté emblemy mincí: kovový reliéf (dvojitá kresba — stín + světlo),
   14 typů tvorů + role-varianty podle jména + podtypy zvířat + číslo duplikátu. */
import type { Token } from "../types";

/* Pomocné tvary v 24×24 soustavě — vrací JSX skupinu (fill/stroke podle Engrave). */
const G = {
  helmet: <><path d="M12 2.5C7.5 2.5 4.5 6 4.5 10.5v4l2.5 1.5V11c0-2.5 2-4.5 5-4.5s5 2 5 4.5v5l2.5-1.5v-4C19.5 6 16.5 2.5 12 2.5Z"/><path d="M5.5 10.5h13" fill="none" strokeWidth="1.4"/><path d="M11.2 10h1.6v6L12 18l-.8-2Z"/><path d="M7.5 11.5h2.5v1.6H7.5Zm6.5 0h2.5v1.6H14Z" opacity={0.55}/></>,
  plume: <><path d="M12 5C8 5 6 8 6 11v4l2 1.5v-5c0-2.4 1.6-4 4-4s4 1.6 4 4v5l2-1.5v-4c0-3-2-6-6-6Z"/><path d="M12 5c0-2 1.5-3.5 4-3.5-1 1-1.4 2-1.2 3.2.8-.4 1.8-.5 3-.2-1 .8-1.6 1.8-1.8 3-1 .2-3 .5-4 .5V5Z"/><path d="M10.8 10h2.4v6l-1.2 2.4L10.8 16Z"/></>,
  hood: <><path d="M12 2.5C8 2.5 5 6 5 10c0 2 .8 3.8 2 5.2L5.5 21c2-1.5 4.2-2.3 6.5-2.3s4.5.8 6.5 2.3L17 15.2c1.2-1.4 2-3.2 2-5.2 0-4-3-7.5-7-7.5Z"/><path d="M12 7c-2.6 0-4.2 1.9-4.2 4 0 2.4 1.8 4.6 4.2 4.6s4.2-2.2 4.2-4.6C16.2 8.9 14.6 7 12 7Z" opacity={0.55}/></>,
  bow: <><path d="M6 3c5 0 9 4.5 9 9s-4 9-9 9c2.5-2.5 4-5.6 4-9S8.5 5.5 6 3Z"/><path d="M6 3c-.7 3-.7 15 0 18" fill="none"/><path d="M4 12h15" fill="none"/><path d="M16 9.5 19.5 12 16 14.5Z"/></>,
  mask: <><path d="M4 9c2.5-2 5-3 8-3s5.5 1 8 3v4c0 4-3.5 7-8 7s-8-3-8-7Z"/><path d="M7 11.5c1.5-1 3-1 4 0-1.5 1.2-3 1.2-4 0Zm10 0c-1.5-1-3-1-4 0 1.5 1.2 3 1.2 4 0Z" opacity={0.4}/><path d="M9 16c1 1 2 1.5 3 1.5s2-.5 3-1.5" fill="none"/></>,
  crown: <><path d="M4 18 5.5 8l4 4L12 6l2.5 6 4-4L20 18Z"/><path d="M4 18h16v2H4Z"/><circle cx="12" cy="14" r="1.3" opacity={0.5}/></>,
  wolf: <><path d="M6 4 4 9l3 1c0 5 2 8 5 8s5-3 5-8l3-1-2-5-4 3h-4Z"/><circle cx="9.3" cy="11" r="1" opacity={0.4}/><circle cx="14.7" cy="11" r="1" opacity={0.4}/><path d="M10.5 15.5 12 17l1.5-1.5Z" opacity={0.5}/></>,
  bear: <><circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="7" r="2.6"/><path d="M12 5C7.5 5 5 8 5 11.5c0 4 3 8 7 8s7-4 7-8C19 8 16.5 5 12 5Z"/><ellipse cx="12" cy="13.5" rx="3" ry="2.4" opacity={0.4}/></>,
  spider: <><ellipse cx="12" cy="13" rx="4" ry="4.5"/><circle cx="12" cy="7" r="2.2"/><path d="M8.5 9 3 5M8 13l-6-1M8.5 16 3 20M15.5 9 21 5M16 13l6-1M15.5 16 21 20" fill="none"/></>,
  bird: <><path d="M7 14C7 8 10 4 14 4c2.5 0 4 1.5 4 3.5L15 9l2.5 1.5L15 12l1.5 1-2.5.5c-.5 3-2.5 5-5 5-1.5 0-2-.5-2-.5l2-2Z"/><circle cx="14" cy="7.5" r=".9" fillOpacity={0.4}/></>,
  snake: <><path d="M8 20c-2.5-2-2.5-5 0-6.5L15 10c2-1.2 2-3.5.5-5l3-1c2 3 .5 6.5-2 8l-6 3c-1 .5-1.5 1-1 2.5Z"/><path d="M15.5 4c1 .5 2 .5 3 0" fill="none"/><circle cx="16" cy="5.5" r=".8" opacity={0.4}/></>,
  rat: <><circle cx="17" cy="6" r="2.2"/><path d="M6 20c0-6 4-10 9-10l4-4c0 2.5-1 4.5-3 5.5.5 2-1 5-4 5-2 0-3 1-3 3.5Z"/><path d="M6 20c-2 0-3-1.5-3-3" fill="none"/><circle cx="15.5" cy="8" r=".8" opacity={0.4}/></>,
  // 14 typů tvorů
  aberration: <><circle cx="12" cy="10" r="5.5" fill="none" strokeWidth="1.8"/><circle cx="12" cy="10" r="2"/><path d="M6.5 14.5 4 20M10 15.5l-1 6M14 15.5l1 6M17.5 14.5 20 20" fill="none" strokeWidth="1.6"/></>,
  beast: <><path d="M12 4 6 8v6l6 6 6-6V8Z" fill="none" strokeWidth="1.6"/><path d="M8.5 8.5 9 6l2.5 1.5L12 5l.5 2.5L15 6l.5 2.5" fill="none" strokeWidth="1.3"/><circle cx="9.7" cy="11.5" r="1"/><circle cx="14.3" cy="11.5" r="1"/><path d="M9 15c1 1.5 2 2 3 2s2-.5 3-2" fill="none" strokeWidth="1.4"/></>,
  celestial: <><ellipse cx="12" cy="6.5" rx="5.5" ry="2" fill="none" strokeWidth="1.5"/><path d="M5 13c2-2.5 4.5-3.5 7-3.5s5 1 7 3.5c-2 1.5-4.5 2-7 2s-5-.5-7-2Z"/><path d="M7 17.5 12 21l5-3.5" fill="none" strokeWidth="1.5"/></>,
  construct: <><path d="M12 3l2 3h3l2 2-1 3 1 3-2 2h-3l-2 3-2-3H9l-2-2 1-3-1-3 2-2h3Z" fill="none" strokeWidth="1.5"/><circle cx="12" cy="11.5" r="2.5"/><path d="M9 11.5H6M18 11.5h-3" strokeWidth="1.4"/></>,
  dragon: <><path d="M5 18c0-6.5 4-10.5 9.5-10.5 2 0 3.6.7 4.7 1.8L17 10.5l2 1.3-2.6.8 2.2 1.7-2.8-.2c-.8 2.8-2.8 4.4-5.5 4.4-1.5 0-2.9-.5-4.1-1.2Z"/><circle cx="14.2" cy="10.8" r="1" opacity={0.4}/><path d="M6 20c1-.8 2-1.2 3.5-1.2" fill="none"/></>,
  elemental: <><path d="M12 2.5c1.2 3.2 5 4.8 5 9.5a5 5 0 0 1-10 0c0-2 1-3.5 2-4.7 0 1.6.9 2.7 2 3.2-.7-2.6.4-5.3 1-8Z"/><path d="M12 21.5a3.2 3.2 0 0 0 3.2-3.2c0-1.6-1-2.6-3.2-4.3-2.2 1.7-3.2 2.7-3.2 4.3A3.2 3.2 0 0 0 12 21.5Z" opacity={0.6}/></>,
  fey: <><path d="M12 3v18" fill="none" strokeWidth="1.5"/><path d="M6 7.5c2.5 2 4.5 2 6 .5 1.5 1.5 3.5 1.5 6-.5-1 3-3 5-6 5s-5-2-6-5Z"/><path d="M7 14c2 1.6 3.6 1.6 5 .3 1.4 1.3 3 1.3 5-.3-.8 2.6-2.8 4.5-5 4.5s-4.2-1.9-5-4.5Z" opacity={0.7}/><circle cx="12" cy="3" r="1.4"/></>,
  fiend: <><path d="M6.5 12C5.5 8 6 4.5 8.5 2.5c-.5 3 .5 5.5 2 7" fill="none" strokeWidth="1.7"/><path d="M17.5 12c1-4 .5-7.5-2-9.5.5 3-.5 5.5-2 7" fill="none" strokeWidth="1.7"/><path d="M6.5 12a5.5 5.5 0 1 0 11 0" fill="none" strokeWidth="1.7"/><path d="M8.5 13.5c1-1.2 2.2-1.2 3-.3M12.5 13.5c1-1.2 2.2-1.2 3-.3" fill="none" strokeWidth="1.4"/><path d="M9.5 17l5 .5" fill="none" strokeWidth="1.3"/></>,
  giant: <><path d="M4 20 12 3.5 20 20Z" fill="none" strokeWidth="1.8"/><path d="M8.5 14h7M10.5 10h3" strokeWidth="1.5"/><circle cx="12" cy="17" r="1" opacity={0.5}/></>,
  humanoid: <><circle cx="12" cy="8" r="3.6" fill="none" strokeWidth="1.7"/><path d="M5.5 20c0-4 2.8-6.5 6.5-6.5s6.5 2.5 6.5 6.5" fill="none" strokeWidth="1.7"/><path d="M10 8h4" strokeWidth="1.2" opacity={0.6}/></>,
  monstrosity: <><path d="M7 20 8.5 8 6.5 4.5M12 20l.8-12 2.3-3.5M17 20l-1-12.5L19.5 3" fill="none" strokeWidth="1.8"/><path d="M6.5 4.5c1.5 1 3 1 4.5 0M15 4.5c1.5 1 3 1 4.5-.5" fill="none" strokeWidth="1.3"/></>,
  ooze: <><path d="M5 15c0-4.2 3-7.5 7-7.5s7 3.3 7 7.5c0 3-2 4.5-4 4.5s-2-1.2-2-3.2-1.2-2-2-.8c-.6 2.6-2.2 4-3.7 4S5 17.8 5 15Z"/><circle cx="10" cy="12.5" r="1" opacity={0.4}/><circle cx="14" cy="12.5" r="1" opacity={0.4}/></>,
  plant: <><path d="M12 21V9" fill="none" strokeWidth="1.7"/><path d="M12 13C8 13 6 9.5 6 5.5c4 0 6 3.5 6 7.5Z"/><path d="M12 13c4 0 6-3.5 6-7.5-4 0-6 3.5-6 7.5Z" opacity={0.75}/><path d="M8.5 18c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" fill="none" strokeWidth="1.3"/></>,
  undead: <><path d="M6.5 11.5a5.5 5.5 0 1 1 11 0v3.5l-2 2h-7l-2-2Z" fill="none" strokeWidth="1.6"/><circle cx="9.8" cy="10.8" r="1.5"/><circle cx="14.2" cy="10.8" r="1.5"/><path d="M11 14.5h2M10 17.5v-1.8M14 17.5v-1.8" strokeWidth="1.3"/></>,
};

/** Klíč emblemu pro žeton: role-varianta podle jména > podtyp > typ tvora. */
export function emblemKey(t: Token): keyof typeof G {
  const n = (t.nazev || "").toLowerCase();
  // role-varianty humanoidů (i pro pc/npc bez portrétu)
  if (/captain|commander|kapit[aá]n|velitel|sergeant|veteran/.test(n)) return "plume";
  if (/mage|wizard|sorcer|warlock|priest|cultist|acolyte|cleric|druid|kouzeln|kn[ěe]z|sage/.test(n)) return "hood";
  if (/archer|scout|ranger|lu[čc]i[šs]tn|hunter/.test(n)) return "bow";
  if (/bandit|pirate|thug|assassin|rogue|pir[aá]t|lupi[čc]|raub[íi][řr]|cutthroat/.test(n)) return "mask";
  if (/noble|lord|lady|baron|duke|king|queen|kr[aá]l|kn[íi][žz]|v[eé]voda|šlecht/.test(n)) return "crown";
  if (/guard|soldier|knight|watch|str[áá][žz]|voj[aá]k|ryt[íi][řr]|militia/.test(n)) return "helmet";
  // podtypy zvířat
  if (/wolf|vlk|worg|dire/.test(n)) return "wolf";
  if (/bear|medv[ěe]d/.test(n)) return "bear";
  if (/spider|pavouk|etterm?cap/.test(n)) return "spider";
  if (/bird|eagle|raven|hawk|owl|vlaštovk|roc/.test(n)) return "bird";
  if (/snake|serpent|viper|constrictor|had\b/.test(n)) return "snake";
  if (/rat|krysa|squeak/.test(n)) return "rat";
  const ty = (t.typ || "").toLowerCase();
  return (ty in G ? ty : "humanoid") as keyof typeof G;
}

/** Číslo duplikátu z konce jména ("Guard 2" → 2), jinak null. */
export const dupNumber = (t: Token): number | null => {
  const m = (t.nazev || "").match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
};

/** Rytá podoba: tmavý stín posunutý + světlá linie navrch = reliéf kovu. */
export function Engraved({ children, color = "#e8e0cd" }: { children: JSX.Element; color?: string }) {
  return (
    <g>
      <g transform="translate(0.8,1.1)" fill="#0a0906" stroke="#0a0906" opacity={0.85}>{children}</g>
      <g fill={color} stroke={color} strokeWidth={0.3}>{children}</g>
    </g>
  );
}

/** Hotový glyph pro žeton. */
export function emblemFor(t: Token): JSX.Element {
  return G[emblemKey(t)] || G.humanoid;
}
