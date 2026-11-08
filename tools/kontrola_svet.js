// Kontrola atlasu: svet.json, symboly, oblasti a sprity (web/assets/svet/*.webp).
const fs = require("fs"), path = require("path"), R = path.join(__dirname, "..");
global.window = {};
new Function(fs.readFileSync(path.join(R, "web/assets/svet_symboly.js"), "utf8"))();
new Function(fs.readFileSync(path.join(R, "web/assets/svet/sprity.js"), "utf8"))();
const { SVET_SYMBOLY: S, SVET_OBLASTI: O, SVET_SPRITY: P, SVET_SPRITY_META: M } = window;
const PAL = JSON.parse(fs.readFileSync(path.join(R, "web/assets/svet/paleta.json"), "utf8"));
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
function orient(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function oblastiSePrekryvaji(a, b) {
  if (a.some(p => uvnitr(p[0], p[1], b)) || b.some(p => uvnitr(p[0], p[1], a))) return true;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const a1 = a[i], a2 = a[(i + 1) % a.length], b1 = b[j], b2 = b[(j + 1) % b.length];
    if (orient(a1, a2, b1) * orient(a1, a2, b2) < 0 && orient(b1, b2, a1) * orient(b1, b2, a2) < 0) return true;
  }
  return false;
}
function vzdalenostOblasti(a, b) {
  let min = Infinity;
  a.forEach(p => b.forEach((q, i) => { min = Math.min(min, vzdalenostKUseku(p[0], p[1], b[(i + b.length - 1) % b.length], q)); }));
  b.forEach(p => a.forEach((q, i) => { min = Math.min(min, vzdalenostKUseku(p[0], p[1], a[(i + a.length - 1) % a.length], q)); }));
  return min;
}
function vzdalenostKUseku(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}
function vzdalenostKPobrezi(x, y) {
  let min = Infinity;
  souse.forEach(({ f }) => f.body.forEach((p, i) => { min = Math.min(min, vzdalenostKUseku(x, y, f.body[(i + f.body.length - 1) % f.body.length], p)); }));
  return min;
}
function vzdalenostKeKrajiPevniny(x, y) {
  let min = Infinity;
  (D.pevnina || []).forEach(f => f.body.forEach((p, i) => { min = Math.min(min, vzdalenostKUseku(x, y, f.body[(i + f.body.length - 1) % f.body.length], p)); }));
  return min;
}
function spriteBox(s) {
  const spec = P[s.typ];
  if (!spec) return null;
  const name = spec.spr[Math.abs(s.x * 7 + s.y * 13) % spec.spr.length], meta = M[name];
  if (!meta) return null;
  const view = PAL.viewport_sprites || {}, maxScale = Math.pow(2, view.max_zoom || 2.5);
  const w = Math.min(spec.w * (s.m || 1), meta.w / (maxScale * (view.min_resolution_ratio || 2)));
  const h = w * meta.h / meta.w, angle = (s.typ === "ledovy_utes" ? 0 : (s.rot || 0)) * Math.PI / 180;
  const cx = s.x + (h / 2 - 2) * Math.sin(angle), cy = s.y + (2 - h / 2) * Math.cos(angle);
  const hw = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2;
  const hh = (Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h) / 2;
  return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
}
function boxOverlap(a, b) {
  const w = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const h = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const area = box => (box.x1 - box.x0) * (box.y1 - box.y0);
  return w * h / Math.min(area(a), area(b));
}
function boxInArea(box, body) {
  let inside = 0, samples = 200;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 20; x++) {
    if (uvnitr(box.x0 + (x + .5) * (box.x1 - box.x0) / 20,
               box.y0 + (y + .5) * (box.y1 - box.y0) / 10, body)) inside++;
  }
  return inside / samples;
}
["pevnina", "oblasti", "reky", "cesty", "hranice", "hradby", "utesy"].forEach(k => (D[k] || []).forEach((f, i) => { if (!ok(f.body)) err.push(k + "[" + i + "] neplatné body"); }));
(D.oblasti || []).forEach((f, i) => { if (!O[f.typ]) err.push("neznámý typ oblasti " + f.typ); });
(D.oblasti || []).forEach((f, i) => {
  if (!["les", "haj", "dzungle", "mrtvy", "mrtva_zeme", "ledovec", "velehory"].includes(f.typ) || !ok(f.body) || f.body.length < 3) return;
  const limit = 40;
  for (let j = 0; j < f.body.length; j++) {
    const a = f.body[j], b = f.body[(j + 1) % f.body.length], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (length <= limit) continue;
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ([a, middle, b].every(p => vzdalenostKeKrajiPevniny(p[0], p[1]) <= 8)) continue;
    err.push(f.typ + "[" + i + "] má přímý úsek obvodu " + length.toFixed(1) + " px (limit " + limit + ")");
    break;
  }
});
(D.oblasti || []).forEach((f, i) => {
  if (f.typ !== "pole") return;
  (D.oblasti || []).forEach((s, j) => {
    if ((s.typ === "ledovec" || s.typ === "velehory") && oblastiSePrekryvaji(f.body, s.body)) err.push("pole[" + i + "] se překrývá se sněhem/ledem v oblasti[" + j + "]");
    else if (s.typ === "ledovec" && vzdalenostOblasti(f.body, s.body) < 24) err.push("pole[" + i + "] zasahuje do 24px sněhového okraje oblasti[" + j + "]");
  });
});
(D.symboly || []).forEach((s, i) => { if (!P[s.typ] && !S[s.typ]) err.push("neznámý symbol " + s.typ); });
const vodniSymboly = new Set(["lod", "vrak", "vir", "had", "demon", "vlny", "clun", "ledova_kra"]);
const souse = (D.pevnina || []).map((f, i) => ({ f, i })).filter(({ f }) => f.typ === "pevnina" || f.typ === "ostrov");
(D.symboly || []).forEach((s, i) => {
  if (s.typ === "ledovy_utes") {
    if (!souse.some(({ f }) => uvnitr(s.x, s.y, f.body))) err.push("ledový útes[" + i + "] není na pevnině");
    const coast = vzdalenostKPobrezi(s.x, s.y);
    if (coast > 25) err.push("ledový útes[" + i + "] je " + coast.toFixed(1) + " px od pobřeží (limit 25)");
    if (s.pozn === "ledový útes u severního fjordu Nölienu" && coast > 2) err.push("ledový útes Nölienu není ukotvený na pobřeží (limit 2 px)");
  }
  if (!vodniSymboly.has(s.typ)) return;
  const nalez = souse.find(({ f }) => uvnitr(s.x, s.y, f.body));
  if (nalez) err.push("vodní symbol " + s.typ + "[" + i + "] (" + s.x + "," + s.y + ") uvnitř pevnina[" + nalez.i + "]");
});
const landmarkTypes = new Set(["ledovy_utes", "chram", "hora", "hora2", "hora_snih", "masiv", "hreben", "skala"]);
const landmarks = (D.symboly || []).map((s, i) => ({ s, i, box: landmarkTypes.has(s.typ) ? spriteBox(s) : null }))
  .filter(x => x.box);
for (let i = 0; i < landmarks.length; i++) for (let j = i + 1; j < landmarks.length; j++) {
  const a = landmarks[i], b = landmarks[j], overlap = boxOverlap(a.box, b.box);
  if (overlap > .15) err.push("překryv orientačních symbolů " + a.s.typ + "[" + a.i + "] / " + b.s.typ + "[" + b.i + "] " + Math.round(overlap * 100) + "% (limit 15%)");
}
(D.symboly || []).forEach((s, i) => {
  if (s.typ !== "ledovy_utes") return;
  const box = spriteBox(s);
  (D.oblasti || []).forEach((area, j) => {
    if (area.typ !== "hory" && area.typ !== "velehory") return;
    const overlap = boxInArea(box, area.body);
    if (overlap > .15) err.push("ledový útes[" + i + "] překrývá horský terén oblasti[" + j + "] " + Math.round(overlap * 100) + "% (limit 15%)");
  });
});
if (err.length) { console.error(err.join("\n")); process.exit(1); }
console.log("atlas OK:", D.pevnina.length, "tvarů,", D.oblasti.length, "oblastí,", D.symboly.length, "symbolů,", used.size, "spritů");
