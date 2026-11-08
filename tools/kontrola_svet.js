// Kontrola atlasu: svet.json, symboly, oblasti a sprity (web/assets/svet/*.webp).
const fs = require("fs"), path = require("path"), R = path.join(__dirname, "..");
global.window = {};
new Function(fs.readFileSync(path.join(R, "web/assets/svet_symboly.js"), "utf8"))();
new Function(fs.readFileSync(path.join(R, "web/assets/svet/sprity.js"), "utf8"))();
const { SVET_SYMBOLY: S, SVET_OBLASTI: O, SVET_SPRITY: P, SVET_SPRITY_META: M } = window;
const D = JSON.parse(fs.readFileSync(path.join(R, "11_Mapy/svet.json"), "utf8")), err = [];
if (D.sirka !== 2048 || D.vyska !== 1440) err.push("rozměry svet.json");
const used = new Set();
Object.values(O).forEach(o => o.spr.forEach(n => used.add(n)));
Object.values(P).forEach(o => o.spr.forEach(n => used.add(n)));
used.forEach(n => { if (!M[n]) err.push("sprite bez metadat: " + n); else if (!fs.existsSync(path.join(R, "web/assets/svet", n + ".webp"))) err.push("chybí soubor: " + n); });
["papir.jpg", "more.jpg"].forEach(f => { if (!fs.existsSync(path.join(R, "web/assets/svet", f))) err.push("chybí textura " + f); });
const ok = (b) => Array.isArray(b) && b.every(p => p.length === 2 && p[0] >= -50 && p[0] <= 2100 && p[1] >= -50 && p[1] <= 1500);
function uvnitr(x, y, body) {
  let inside = false;
  for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
    const [xi, yi] = body[i], [xj, yj] = body[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
["pevnina", "oblasti", "reky", "cesty", "hranice", "hradby", "utesy"].forEach(k => (D[k] || []).forEach((f, i) => { if (!ok(f.body)) err.push(k + "[" + i + "] neplatné body"); }));
(D.oblasti || []).forEach((f, i) => { if (!O[f.typ]) err.push("neznámý typ oblasti " + f.typ); });
(D.symboly || []).forEach((s, i) => { if (!P[s.typ] && !S[s.typ]) err.push("neznámý symbol " + s.typ); });
const vodniSymboly = new Set(["lod", "vrak", "vir", "had", "demon", "vlny", "clun", "ledova_kra"]);
const souse = (D.pevnina || []).map((f, i) => ({ f, i })).filter(({ f }) => f.typ === "pevnina" || f.typ === "ostrov");
(D.symboly || []).forEach((s, i) => {
  if (!vodniSymboly.has(s.typ)) return;
  const nalez = souse.find(({ f }) => uvnitr(s.x, s.y, f.body));
  if (nalez) err.push("vodní symbol " + s.typ + "[" + i + "] (" + s.x + "," + s.y + ") uvnitř pevnina[" + nalez.i + "]");
});
if (err.length) { console.error(err.join("\n")); process.exit(1); }
console.log("atlas OK:", D.pevnina.length, "tvarů,", D.oblasti.length, "oblastí,", D.symboly.length, "symbolů,", used.size, "spritů");
