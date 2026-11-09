// Kontrola atlasu: svet.json, symboly, oblasti a sprity (web/assets/svet/*.webp).
const fs = require("fs"), path = require("path"), R = path.join(__dirname, "..");
const { spawnSync } = require("child_process");
global.window = {};
new Function(fs.readFileSync(path.join(R, "web/assets/svet_symboly.js"), "utf8"))();
new Function(fs.readFileSync(path.join(R, "web/assets/svet/sprity.js"), "utf8"))();
const { SVET_SYMBOLY: S, SVET_OBLASTI: O, SVET_SPRITY: P, SVET_SPRITY_META: M } = window;
const PAL = JSON.parse(fs.readFileSync(path.join(R, "web/assets/svet/paleta.json"), "utf8"));
const D = JSON.parse(fs.readFileSync(path.join(R, "11_Mapy/svet.json"), "utf8")), err = [];
const K = JSON.parse(fs.readFileSync(path.join(R, "tools/svet_kresba.json"), "utf8"));
const Z = JSON.parse(fs.readFileSync(path.join(R, "tools/svet_lore.json"), "utf8"));
if (D.sirka !== 2048 || D.vyska !== 1440) err.push("rozměry svet.json");
const oldNorthFloes = (D.symboly || []).filter(s => s.typ === "ledova_kra" && s.pozn === "ledová kra v severním moři Nölienu (návrh)");
if (oldNorthFloes.length) err.push("v severním moři Nölienu zůstaly návrhové ledové kry");
const northVolcanoes = (D.symboly || []).filter(s => s.typ === "sopka" && s.pozn === "sopka v moři severně od Nölienu (kresba DM)");
if (northVolcanoes.length !== 2 || !northVolcanoes.some(s => s.x === 1085 && s.y === 275) || !northVolcanoes.some(s => s.x === 1170 && s.y === 280)) {
  err.push("severně od Nölienu mají být dvě sopky na kreslených kráterech");
}
if (!P.sopka || P.sopka.w !== 60 || P.sopka.kotva[0] !== .5 || P.sopka.kotva[1] !== .62) err.push("nesprávná velikost nebo kotva sopky");
const northWaves = (D.symboly || []).filter(s => s.typ === "vlny" && s.pozn === "vlny severně od Nölienu (kresba DM)");
if (northWaves.length < 5) err.push("severně od Nölienu chybí vlny");
if (!pevninaAt(1065, 765) || pevninaAt(1065, 738)) err.push("Kop Aram má být malý ostrov oddělený od severního břehu");
const used = new Set();
Object.values(O).forEach(o => o.spr.forEach(n => used.add(n)));
Object.values(P).forEach(o => o.spr.forEach(n => used.add(n)));
const cliffSprites = ["utes_d", "utes_e", "utes_f", "hreben_b", "utes_roh", "utes_konec"];
const cliffStripSprites = ["utes_s1", "utes_s2", "utes_s3", "utes_s4"];
cliffSprites.forEach(n => used.add(n));
cliffStripSprites.forEach(n => used.add(n));
used.forEach(n => { if (!M[n]) err.push("sprite bez metadat: " + n); else if (!fs.existsSync(path.join(R, "web/assets/svet", n + ".webp"))) err.push("chybí soubor: " + n); });
const viewportSprites = PAL.viewport_sprites || {}, cliffStyle = PAL.terrain_vectors || {};
const cliffScaleJitter = cliffStyle.cliff_scale_variation == null ? .1 : cliffStyle.cliff_scale_variation;
const cliffRequiredWidth = (cliffStyle.cliff_segment_width_px || 36) * (1 + cliffScaleJitter)
  * Math.pow(2, viewportSprites.max_zoom || 2.5) * (viewportSprites.min_resolution_ratio || 2);
const cliffStripRequiredWidth = (cliffStyle.cliff_steep_strip_width_px || 25)
  * Math.pow(2, viewportSprites.max_zoom || 2.5) * (viewportSprites.min_resolution_ratio || 2);
cliffSprites.forEach(n => {
  if (M[n] && M[n].w < cliffRequiredWidth) err.push(n + " má " + M[n].w + " px, pro 2× rozlišení útesové čáry je třeba " + cliffRequiredWidth.toFixed(1) + " px");
});
cliffStripSprites.forEach(n => {
  if (M[n] && M[n].w < cliffStripRequiredWidth) err.push(n + " má " + M[n].w + " px, pro 2× rozlišení svislého útesu je třeba " + cliffStripRequiredWidth.toFixed(1) + " px");
});
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
function pevninaAt(x, y) {
  return (D.pevnina || []).some(f => (f.typ === "pevnina" || f.typ === "ostrov") && uvnitr(x, y, f.body));
}
if (northWaves.some(s => pevninaAt(s.x, s.y))) err.push("symbol vln severně od Nölienu leží na pevnině");
function ownersAt(x, y) {
  return (D.zeme || []).filter(z => (z.body || []).some(ring => uvnitr(x, y, ring))).map(z => z.nazev);
}
[[1, 1], [1150, 300]].forEach(([x, y]) => {
  if (pevninaAt(x, y)) err.push("(" + x + "," + y + ") musí být moře");
});
[
  [[926, 298], "Imonir"],
  [[1047, 225], "Imonir"],
  [[1013, 270], "Imonir"],
  [[972, 296], "Imonir"],
  [[811, 320], "Imonir"],
  [[871, 357], "Imonir"],
  [[801, 450], "Imonir"],
  [[1023, 245], "Nölien"],
  [[836, 372], "Nölien"],
  [[1485, 388], "Banerbo"],
  [[1549, 268], "Banerbo"],
  [[1733, 823], "Imatoma"],
  [[1214, 838], "Khärghe Zhia"],
  [[594, 1292], "Nöet"],
  [[1300, 1230], "Tali"],
  [[1060, 1327], "Svobodné Jižní ostrovy"],
].forEach(([[x, y], expected]) => {
  const owners = ownersAt(x, y);
  if (owners.length !== 1 || owners[0] !== expected) {
    err.push("(" + x + "," + y + ") má vlastníka " + (owners.join(", ") || "žádného") + ", očekává se " + expected);
  }
});
if (ownersAt(720, 1292).length) err.push("(720,1292) má zůstat bez vlastníka");
const islandCheck = spawnSync("python3", ["-c", [
  "import json, sys",
  "from shapely.geometry import Point, Polygon",
  "from shapely.ops import unary_union",
  "data = json.load(sys.stdin)",
  "land = unary_union([Polygon(f['body']).buffer(0) for f in data if f.get('typ') in ('pevnina', 'ostrov') and len(f.get('body', [])) >= 3])",
  "parts = list(getattr(land, 'geoms', [land]))",
  "island, capital = Point(1060, 1327), Point(1142, 1131)",
  "a = next((i for i, part in enumerate(parts) if part.covers(island)), None)",
  "b = next((i for i, part in enumerate(parts) if part.covers(capital)), None)",
  "print(json.dumps({'island': a is not None, 'capital': b is not None, 'same': a is not None and a == b}))",
].join("\n")], { input: JSON.stringify(D.pevnina || []), encoding: "utf8" });
if (islandCheck.error || islandCheck.status !== 0) {
  err.push("nelze ověřit oddělení Menkantu: " + (islandCheck.error || islandCheck.stderr.trim()));
} else {
  try {
    const result = JSON.parse(islandCheck.stdout);
    if (!result.island || !result.capital || result.same) err.push("Menkant není oddělený od pevniny Laertmundu");
  } catch (e) {
    err.push("neplatný výsledek kontroly ostrova Menkant");
  }
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
(D.bez_snehu || []).forEach((f, i) => {
  if (!ok(f.body) || f.body.length < 3) return;
  for (let j = 0; j < f.body.length; j++) {
    const a = f.body[j], b = f.body[(j + 1) % f.body.length], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (length <= 40) continue;
    const middle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if ([a, middle, b].every(p => vzdalenostKeKrajiPevniny(p[0], p[1]) <= 8)) continue;
    err.push("bez_snehu[" + i + "] má přímý ne-pobřežní úsek " + length.toFixed(1) + " px (limit 40)");
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
const landmarkTypes = new Set(["ledovy_utes", "chram", "hora", "hora2", "hora_snih", "masiv", "hreben", "skala", "kop_aram"]);
const kopAram = (D.symboly || []).find(s => s.typ === "kop_aram");
if (kopAram && M.kop_aram) {
  const need = P.kop_aram.w * (kopAram.m || 1) * Math.pow(2, viewportSprites.max_zoom || 2.5)
    * (viewportSprites.min_resolution_ratio || 2);
  if (M.kop_aram.w < need) err.push("kop_aram má " + M.kop_aram.w + " px, při dané velikosti je pro viewport třeba " + need.toFixed(1) + " px");
}
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
const overlapCheck = spawnSync("python3", ["-c", [
  "import json, sys",
  "from shapely.geometry import Polygon",
  "from shapely.ops import unary_union",
  "z = json.load(sys.stdin)",
  "g = []",
  "for item in z:",
  "    parts = [Polygon(r).buffer(0) for r in item.get('body', []) if len(r) >= 3]",
  "    g.append(unary_union(parts) if parts else Polygon())",
  "hits = []",
  "for i in range(len(g)):",
  "    for j in range(i + 1, len(g)):",
  "        area = g[i].intersection(g[j]).area",
  "        if area >= 2:",
  "            hits.append({'i': i, 'j': j, 'area': area, 'bounds': list(g[i].intersection(g[j]).bounds)})",
  "print(json.dumps(hits))",
].join("\n")], { input: JSON.stringify(D.zeme || []), encoding: "utf8" });
if (overlapCheck.error || overlapCheck.status !== 0) {
  err.push("nelze ověřit průniky zeme: " + (overlapCheck.error || overlapCheck.stderr.trim()));
} else {
  try {
    JSON.parse(overlapCheck.stdout).forEach(hit => {
      const a = D.zeme[hit.i], b = D.zeme[hit.j];
      err.push("průnik zeme " + a.nazev + "[" + hit.i + "] / " + b.nazev + "[" + hit.j + "] " +
        hit.area.toFixed(2) + " px² (limit <2)");
    });
  } catch (e) {
    err.push("neplatný výsledek kontroly průniků zeme");
  }
}
const refs = [];
function addReference(points, closed) {
  if (!Array.isArray(points) || points.length < 2) return;
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    refs.push({
      a, b,
      x0: Math.min(a[0], b[0]) - 2.5, x1: Math.max(a[0], b[0]) + 2.5,
      y0: Math.min(a[1], b[1]) - 2.5, y1: Math.max(a[1], b[1]) + 2.5,
    });
  }
}
(D.pevnina || []).filter(f => f.typ === "pevnina" || f.typ === "ostrov").forEach(f => addReference(f.body, true));
(K.hranice || []).filter(h => !h.carkovana).forEach(h => addReference(h.body, false));
(K.uzemi || []).filter(u => !u.pozn || (!u.pozn.startsWith("východní hranice DM:") && !u.pozn.startsWith("jižní hranice DM:")))
  .forEach(u => addReference(u.body, true));
(Z.vlastnictvi || []).forEach(u => addReference(u.body, true));
function liesOnReference(a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const candidates = refs.filter(s => s.x1 >= Math.min(a[0], b[0]) - 2.5 && s.x0 <= Math.max(a[0], b[0]) + 2.5 &&
    s.y1 >= Math.min(a[1], b[1]) - 2.5 && s.y0 <= Math.max(a[1], b[1]) + 2.5);
  if (!candidates.length) return false;
  const steps = Math.max(2, Math.ceil(length / 12));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
    if (candidates.reduce((min, s) => Math.min(min, vzdalenostKUseku(x, y, s.a, s.b)), Infinity) > 2.5) return false;
  }
  return true;
}
let straightEdges = 0;
(D.zeme || []).forEach((z, i) => (z.body || []).forEach((ring, r) => {
  if (ring.length < 3) return;
  for (let j = 0; j < ring.length; j++) {
    const a = ring[j], b = ring[(j + 1) % ring.length], length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (length <= 60 || liesOnReference(a, b)) continue;
    straightEdges++;
    if (straightEdges <= 50) err.push("zeme " + z.nazev + "[" + i + "] má přímou hranu " + length.toFixed(1) + " px mimo pobřeží/DM vektor");
  }
}));
if (straightEdges > 50) err.push("dalších " + (straightEdges - 50) + " dlouhých přímých hran zeme");
if (err.length) { console.error(err.join("\n")); process.exit(1); }
console.log("atlas OK:", D.pevnina.length, "tvarů,", D.oblasti.length, "oblastí,", D.symboly.length, "symbolů,", used.size, "spritů");
