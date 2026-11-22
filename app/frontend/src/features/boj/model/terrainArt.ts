const NATURAL = new Set(["jeskyne", "hory", "snih", "les", "reka", "bazina"]);
const SURFACES: Record<string, string> = {
  g: "g", r: "r", "^": "rubble", "~": "voda", ",": "melcina", "=": "most",
  _: "propast", S: "schody",
};
const GROUNDS = new Set(["mesto", "krypta", "les", "ruiny", "reka", "more", "pristav",
  "bazina", "snih", "jeskyne", "hory", "poust", "plaz"]);

export function terrainTexture(tile: string, ground: string, interior = false): string {
  if (tile === "l") return "lava";
  if (tile === "i") return "led";
  if (tile === "u" || tile === "h") return "teren-rubble";
  if (tile === "p") return "teren-propast";
  const key = tile === "#" ? interior ? "bedrock" : NATURAL.has(ground) ? "skala" : "wall"
    : SURFACES[tile] || (GROUNDS.has(ground) ? ground : "mesto");
  return "teren-" + key;
}

export function terrainProp(tile: string, ground: string, x: number, y: number): string | null {
  const variant = (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663)) >>> 0;
  if (tile === "T") return ["strom", "strom2", "strom3"][variant % 3];
  if (tile === "o") return ["krypta", "mesto", "ruiny", "pristav"].includes(ground)
    ? "sloup" : ["balvan", "balvan2"][variant % 2];
  if (tile === "%") return ground === "krypta" ? "sarkofag" : ["bedny", "sudy"][variant % 2];
  if (tile === "+") return "dvere";
  if (tile === "x") return "ohen";
  if (tile === "^" && ["les", "reka"].includes(ground)) return ["ker", "ker2"][variant % 2];
  return null;
}

export function interiorWall(x: number, y: number, at: (x: number, y: number) => string | undefined): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = at(x + dx, y + dy);
    if (c !== undefined && c !== "#") return false;
  }
  return true;
}
