import type { MapObject, MapV2 } from "../../boj/model/mapV2";
import { duplicateObjects } from "../tools/ops";

export const TOOL_GROUPS = [
  ["Výběr", ["select"]], ["Terén", ["teren", "fill", "flood", "textura", "malba"]],
  ["Stavby", ["mistnost", "polygon", "stena", "dvere", "interier"]],
  ["Obsah", ["objekt", "svetlo", "kresba", "vyska"]],
  ["Hra", ["start", "poznamka"]], ["Nástroje", ["guma", "kapatko"]],
] as const;

export const TOOL_HINTS: Record<string, string> = {
  select: "Klikni pro výběr, táhni pro přesun. Shift přidává do výběru.",
  teren: "Maluj průchodný terén nebo překážky tažením štětce.",
  fill: "Tažením vyplň obdélníkovou oblast terénem.", flood: "Vyplň souvislou oblast stejným terénem.",
  textura: "Přiřaď vybranou texturu jednotlivým buňkám.", malba: "Maluj texturou volně, bez omezení mřížkou. Alt maže.",
  mistnost: "Tažením vytvoř místnost; úhel nastav v liště voleb.",
  polygon: "Klikáním vyznač rohy. Enter dokončí, Escape zruší.",
  stena: "Spojuj body do stěn; Shift přichytí úhel. Escape ukončí.",
  dvere: "Klikni na stěnu pro dveře či okno. Alt přepíná otevření.",
  interier: "Označ polygon bez počasí. Enter dokončí, Alt kliknutím odebere.",
  objekt: "Vyber předlohu v knihovně, klikni nebo táhni do mapy.",
  svetlo: "Kliknutím umísti světlo s nastavenou barvou a dosahem.",
  kresba: "Kresli čáry, tvary a text. Polygon dokončí Enter.",
  vyska: "Klik přidává výšku, Alt + klik ubírá.", start: "Kliknutím umísti startovní pozici zvolené skupiny.",
  poznamka: "Kliknutím přidej poznámku viditelnou jen pro vypravěče.",
  guma: "Klikáním nebo tažením odstraň obsah buňky.", kapatko: "Převezmi terén, texturu nebo objekt pod kurzorem.",
};

export function readPreference<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value == null ? fallback : JSON.parse(value); }
  catch { return fallback; }
}
export function writePreference(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled. */ }
}
export function rememberAsset(id: string) {
  const recent = readPreference<unknown>("me-recent-assets", []);
  writePreference("me-recent-assets", [id, ...(Array.isArray(recent) ? recent.filter(x => typeof x === "string" && x !== id) : [])].slice(0, 12));
  window.dispatchEvent(new Event("me-library-change"));
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function fuzzyScore(label: string, query: string): number {
  const haystack = fold(label), needle = fold(query.trim());
  if (!needle) return 0;
  if (haystack.includes(needle)) return 1000 - haystack.indexOf(needle);
  let at = -1, score = 0;
  for (const c of needle.replace(/\s/g, "")) {
    const next = haystack.indexOf(c, at + 1);
    if (next < 0) return -1;
    score += next === at + 1 ? 5 : 1; at = next;
  }
  return score;
}

export type ObjectAction = "duplicate" | "delete" | "rotate-left" | "rotate-right" | "flip" | "front" | "back" | "align-x" | "align-y";
export function liveSelection<T extends {kind: string; id: string}>(map: MapV2, selection: T[]): T[] {
  const items: Record<string, {id: string}[] | undefined> = {objekt:map.objekty,stena:map.steny,svetlo:map.svetla,kresba:map.kresby,poznamka:map.poznamky};
  const next = selection.filter(s => items[s.kind]?.some(item => item.id === s.id));
  return next.length === selection.length ? selection : next;
}

export function actOnObjects(objects: MapObject[], ids: string[], action: ObjectAction, width = Infinity, height = Infinity): MapObject[] {
  const selected = new Set(ids), active = objects.filter(o => selected.has(o.id));
  if (!active.length) return objects;
  if (action === "delete") return objects.filter(o => !selected.has(o.id));
  if (action === "duplicate") return [...objects, ...duplicateObjects(active, width, height)];
  const top = Math.max(...objects.map(o => o.z ?? 0)), bottom = Math.min(...objects.map(o => o.z ?? 0));
  const next = objects.map(o => !selected.has(o.id) ? o : {
    ...o,
    ...(action === "rotate-left" || action === "rotate-right" ? { rot: ((o.rot || 0) + (action === "rotate-left" ? -15 : 15) + 360) % 360 } : {}),
    ...(action === "flip" ? { flip: !o.flip } : {}),
    ...(action === "front" ? { z: top + 1 } : action === "back" ? { z: bottom - 1 } : {}),
    ...(action === "align-x" ? { x: active[0].x } : action === "align-y" ? { y: active[0].y } : {}),
  });
  return JSON.stringify(next) === JSON.stringify(objects) ? objects : next;
}
