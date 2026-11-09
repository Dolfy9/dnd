// Bojový modul: mapy s mřížkou, žetony, iniciativa a bojový pomocník (pravidla 2024)
(function () {
  "use strict";
  const SIZE = { Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 };
  const ABS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  const ABN = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
  const COND = {
    Blinded: "nevidí; útoky proti mají Advantage, jeho útoky Disadvantage",
    Charmed: "nemůže útočit na zdroj okouzlení",
    Deafened: "neslyší",
    Exhaustion: "−2 k d20 testům za úroveň, −5 ft rychlosti za úroveň",
    Frightened: "Disadvantage na útoky a testy, dokud vidí zdroj; nesmí se k němu přiblížit",
    Grappled: "Speed 0; Disadvantage na útoky proti jiným než tomu, kdo ho drží",
    Incapacitated: "žádné akce, bonusové akce ani reakce; ztrácí Concentration",
    Invisible: "jeho útoky mají Advantage, útoky proti němu Disadvantage",
    Paralyzed: "Incapacitated, Speed 0; útoky proti mají Advantage, zásah do 5 ft je kritický; neuspěje v STR/DEX záchranách",
    Petrified: "zkamenělý; Resistance všemu, útoky proti mají Advantage",
    Poisoned: "Disadvantage na útoky a testy schopností",
    Prone: "útoky do 5 ft proti mají Advantage, z dálky Disadvantage; jeho útoky Disadvantage; vstát stojí půl rychlosti",
    Restrained: "Speed 0; útoky proti mají Advantage, jeho útoky Disadvantage; Disadvantage na DEX záchrany",
    Stunned: "Incapacitated; útoky proti mají Advantage; neuspěje v STR/DEX záchranách",
    Unconscious: "Incapacitated, Prone; útoky proti mají Advantage, zásah do 5 ft je kritický"
  };
  // DMG 2024: XP rozpočet na postavu (Low / Moderate / High)
  const BUD = [null, [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100], [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100], [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800], [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000]];
  const TILE = {
    ".": ["Podlaha / zem", 1], g: ["Tráva", 1], r: ["Cesta", 1], "#": ["Zeď", 0], o: ["Sloup / balvan (three-quarters cover)", 0], T: ["Strom (three-quarters cover)", 0],
    "%": ["Bedny / sarkofág (half cover, těžký terén)", 2], "^": ["Těžký terén", 2], "~": ["Hluboká voda (plavání)", 2], ",": ["Mělčina (těžký terén)", 2],
    "=": ["Most / lávka", 1], "+": ["Dveře", 1], _: ["Propast / jáma", 0], x: ["Nebezpečí", 1], S: ["Schody", 1]
  };
  const BASE = { mesto: "#8b8478", krypta: "#57524d", les: "#6d8c4c", ruiny: "#968b70", reka: "#789a54", more: "#1e4f78", pristav: "#7d7466", bazina: "#55684a", snih: "#dfe4ea", jeskyne: "#46423e", hory: "#827d73", poust: "#d4b882", plaz: "#dcc896" };
  const LIGHT = { druzina: "#a9d2fb", nepratele: "#f59a8a", neutral: "#f5dc9a" };
  const SIDE = { druzina: ["#2f6fb0", "Družina"], nepratele: ["#b03030", "Nepřátelé"], neutral: ["#b08a2f", "Neutrální"] };
  const RANGES = { longbow: [150, 600], shortbow: [80, 320], "heavy crossbow": [100, 400], "light crossbow": [80, 320], "hand crossbow": [30, 120], sling: [30, 120], dart: [20, 60], javelin: [30, 120], "throwing": [20, 60], handaxe: [20, 60], dagger: [20, 60], spear: [20, 60], blowgun: [25, 100], musket: [40, 120], pistol: [30, 90] };

  let A = null, S = null;
  const MUT = { uncond: "Odebrání stavu", conc: "Konec Concentration", react: "Reaction", react2: "Reaction", del: "Odebrání žetonu", ds: "Death save", init: "Iniciativa", ecoA: "Action", ecoB: "Bonus Action", slot: "Spell slot", oaskip: "Opportunity Attack", enc: "Přidání střetnutí", place: "Rozestavení", addpc: "Přidání postavy", addmon: "Přidání netvora", custom: "Vlastní žeton", dash: "Dash", dis: "Disengage", dodge: "Dodge" };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sg = n => (n >= 0 ? "+" : "") + n;
  const mod = v => Math.floor(((Number(v) || 10) - 10) / 2);
  const d = n => 1 + Math.floor(Math.random() * n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const pct = p => Math.round(p * 100) + " %";
  function base() { const s = document.querySelector('script[src*="assets/boj.js"]'); return s ? s.src.replace(/assets\/boj\.js.*$/, "") : "/"; }
  function avgOf(expr) { let t = 0; String(expr).replace(/\s/g, "").replace(/([+\-−]?)(\d*)d(\d+)|([+\-−]?)(\d+)/g, (m, s1, n, f, s2, k) => { if (f) t += (s1 === "-" || s1 === "−" ? -1 : 1) * (Number(n) || 1) * (Number(f) + 1) / 2; else t += (s2 === "-" || s2 === "−" ? -1 : 1) * Number(k); return m; }); return t; }
  function diceAvg(expr) { let t = 0; String(expr).replace(/(\d*)d(\d+)/g, (m, n, f) => { t += (Number(n) || 1) * (Number(f) + 1) / 2; return m; }); return t; }
  function roll(expr, crit) { let t = 0, parts = []; String(expr).replace(/\s/g, "").replace(/([+\-−]?)(\d*)d(\d+)|([+\-−]?)(\d+)/g, (m, s1, n, f, s2, k) => { if (f) { const sgn = s1 === "-" || s1 === "−" ? -1 : 1, c = (Number(n) || 1) * (crit ? 2 : 1); for (let i = 0; i < c; i++) { const r = d(Number(f)); t += sgn * r; parts.push(r); } } else t += (s2 === "-" || s2 === "−" ? -1 : 1) * Number(k); return m; }); return { t: Math.max(0, t), parts }; }
  function d20(adv) { const a = d(20), b = d(20); return adv > 0 ? { r: Math.max(a, b), txt: a + "/" + b } : adv < 0 ? { r: Math.min(a, b), txt: a + "/" + b } : { r: a, txt: String(a) }; }

  // ---------- data ----------
  function map() { return A.M.mapy[S.map] || A.M.mapy[0]; }
  function tile(x, y) { const m = map(); return y >= 0 && y < m.mrizka.length && x >= 0 && x < m.mrizka[0].length ? m.mrizka[y][x] : "#"; }
  function tok(id) { return S.tok.find(t => t.id === id); }
  function alive(t) { return !t.dead; }
  function hostile(a, b) { return a.side !== b.side && !(a.side === "neutral" || b.side === "neutral"); }
  function actor() { return S.turn >= 0 ? tok(S.ord[S.turn]) : null; }
  function hasC(t, n) { return (t.cond || []).some(c => c.n === n); }
  function incap(t) { return ["Incapacitated", "Paralyzed", "Stunned", "Unconscious", "Petrified"].some(n => hasC(t, n)) || t.dead || (t.kind === "pc" && t.hp <= 0); }
  function exh(t) { const c = (t.cond || []).find(c => c.n === "Exhaustion"); return c ? Number(c.lvl) || 1 : 0; }
  function speedOf(t) { if (hasC(t, "Grappled") || hasC(t, "Restrained") || incap(t)) return 0; return Math.max(0, t.speed - 5 * exh(t)); }

  function nAttacks(c) {
    const L = n => (c.tridy || []).filter(t => t.trida === n).reduce((s, t) => s + Number(t.uroven), 0);
    if (L("Fighter") >= 20) return 4; if (L("Fighter") >= 11) return 3;
    return ["Fighter", "Barbarian", "Monk", "Paladin", "Ranger"].some(n => L(n) >= 5) ? 2 : 1;
  }
  function parseSpell(name, K, dd, c, castAb, lvl) {
    const k = K[name] || K[K._low[String(name).toLowerCase()]]; if (!k || !k.text || (/stat block/i.test(k.text) && /\n\s*\|/.test(k.text))) return null;
    const txt = k.text.split(/\n(?:Using a Higher-Level Spell Slot|At Higher Levels)/)[0];
    const dm = txt.match(/(\d+)d(\d+)(?:\s*\+\s*your spellcasting ability modifier)? (\w+) damage/i); if (!dm) return null;
    let n = Number(dm[1]); const f = Number(dm[2]);
    if (Number(k.uroven) === 0 && /Cantrip Upgrade/i.test(k.text)) n *= lvl >= 17 ? 4 : lvl >= 11 ? 3 : lvl >= 5 ? 2 : 1;
    const m = dd.mods[castAb] || 0, plusMod = /\+\s*your spellcasting ability modifier/i.test(dm[0]);
    const dmg = n + "d" + f + (plusMod ? sg(m) : "");
    const sv = txt.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
    if (!sv && !/spell attack/i.test(txt)) return null;
    const dos = String(k.dosah || ""), area = (dos + " " + txt).match(/(\d+)-foot(?:-radius)?(?:[- ]long)?,?\s*(?:\d+-foot-wide\s*)?(Cone|Sphere|Cube|Line|Emanation|Cylinder)/i);
    let range = /touch/i.test(dos) ? 5 : (Number((dos.match(/(\d+)\s*feet/) || [])[1]) || (/self/i.test(dos) ? 0 : 60));
    const cast = dd.casting.find(x => x.ab === castAb) || dd.casting[0] || { dc: 8 + dd.pb + m, atk: dd.pb + m };
    const o = { nazev: name + (Number(k.uroven) ? " (" + k.uroven + ". úr.)" : ""), kouzlo: name, dmg, avg: avgOf(dmg), typ: dm[3], kind: "spell", lvl: Number(k.uroven) || 0, conc: /Concentration/i.test(k.trvani || ""), ba: /Bonus Action/i.test(k.cas || ""), range, reach: range <= 5 ? 5 : 0, n: 1 };
    if (area) { o.area = { size: Number(area[1]), shape: area[2].toLowerCase() }; if (!range) o.self = true; }
    if (sv) { o.save = ABN[sv[1].toLowerCase()]; o.dc = cast.dc; o.half = /half as much damage|Half damage/i.test(txt); }
    else { o.bonus = cast.atk; o.melee = range <= 5; }
    return o;
  }
  function pcToken(e) {
    const c = e.postava, P = window.MontelienPostava, dd = P.compute(c), atk = [], n = nAttacks(c), mx = Math.max(dd.mods.STR, dd.mods.DEX);
    (c.utoky || []).forEach(u => {
      const castAb = dd.casting[0] ? dd.casting[0].ab : "INT";
      const m = u.atribut === "FIN" ? mx : u.atribut === "SPELL" ? dd.mods[castAb] : dd.mods[u.atribut || "STR"] || 0;
      const key = Object.keys(RANGES).find(k => String(u.nazev).toLowerCase().indexOf(k) >= 0);
      const rg = u.dosah ? String(u.dosah).match(/(\d+)(?:\s*\/\s*(\d+))?/) : null;
      const ranged = rg ? Number(rg[1]) > 10 : key && /bow|sling|blowgun|musket|pistol|dart/.test(key);
      const dmg = (u.kostka || "1") + sg((u.bez_modu ? 0 : m) + (Number(u.bonus_zraneni) || 0));
      const o = { nazev: u.nazev, bonus: m + dd.pb + (Number(u.bonus) || 0), dmg, avg: avgOf(dmg), typ: u.typ || "", kind: "weapon", n: u.atribut === "SPELL" ? 1 : n };
      if (ranged) { o.range = rg ? Number(rg[1]) : RANGES[key][0]; o.long = rg && rg[2] ? Number(rg[2]) : key ? RANGES[key][1] : o.range; }
      else { o.melee = true; o.reach = /reach|glaive|halberd|pike|lance|whip/i.test(u.nazev + " " + (u.vlastnosti || "")) ? 10 : 5; if (key && RANGES[key] && !/bow|sling|blowgun|musket|pistol|dart/.test(key)) { o.thrown = RANGES[key]; } }
      atk.push(o);
    });
    const monk = (c.tridy || []).filter(t => t.trida === "Monk").reduce((s, t) => s + Number(t.uroven), 0);
    if (monk) { const r = A.R.tridy.Monk.tabulka[monk] || {}, die = r["Martial Arts"] || "1d6", dmg = die + sg(mx); atk.push({ nazev: "Unarmed Strike (Martial Arts)", bonus: mx + dd.pb, dmg, avg: avgOf(dmg), typ: "Bludgeoning", kind: "weapon", melee: true, reach: 5, n, pozn: monk >= 2 ? "+ Flurry of Blows (" + (monk >= 10 ? 3 : 2) + "×) za Bonus Action" : "+1 úder za Bonus Action" }); }
    const castAb = dd.casting[0] ? dd.casting[0].ab : null;
    if (castAb) (c.kouzla || []).forEach(k => { const o = parseSpell(k.nazev, A.K, dd, c, castAb, dd.lvl); if (o) atk.push(o); });
    if (!atk.length) { const au = P.autoDpr(c, dd); atk.push({ nazev: "Útok (odhad z úrovně)", bonus: au.atk, dmg: String(Math.max(1, au.dpr)), avg: au.dpr, typ: "", kind: "weapon", melee: true, reach: 5, n: 1 }); }
    return { id: uid(), nazev: c.jmeno, kind: "pc", side: "druzina", s: SIZE[c.velikost] || 1, hp: dd.hp, max: dd.hp, tmp: 0, ac: dd.ac, initB: dd.init, speed: parseInt(dd.speed, 10) || 30, swim: 0, fly: 0,
      saves: dd.saves, atk, cond: [], conc: false, react: true, xp: (dd.cr && dd.cr.xp) || 0, lvl: dd.lvl, cr: dd.cr && dd.cr.cr, src: { cesta: e.cesta }, ds: { s: 0, f: 0 },
      slots: (dd.slots || []).map(n => ({ max: Number(n) || 0, used: 0 })), sdc: castAb ? (dd.casting[0] || {}).dc : null, satk: castAb ? (dd.casting[0] || {}).atk : null, smod: castAb ? dd.mods[castAb] : 0, summ: (c.kouzla || []).map(k => k.nazev).filter(isSummon), pact: dd.pact && Number(dd.pact.pocet) ? { lvl: Number(dd.pact.uroven) || 1, max: Number(dd.pact.pocet), used: 0 } : null };
  }
  const NUMW = ["one", "one", "two", "three", "four", "five", "six"];
  function spellK(n) { return A.K && (A.K[n] || A.K[(A.K._low || {})[String(n).toLowerCase()]]); }
  function isSummon(n) { const k = spellK(n); return !!(k && k.text && /stat block/i.test(k.text) && /\n\s*\|/.test(k.text)); }
  function summonList() { return Object.keys(A.K || {}).filter(n => n !== "_low" && isSummon(n)).sort(); }
  function sbLines(n) { const k = spellK(n); return { k, L: k.text.split("\n").filter(l => /^\s*\|/.test(l)).map(l => l.replace(/^\s*\|\s*/, "").trim()).filter(Boolean) }; }
  function summonVariants(n) {
    const s = [];
    sbLines(n).L.forEach(l => l.replace(/\(([^()]*)\)/g, (m, p) => { p.split(";").forEach(q => { const mm = q.trim().match(/^([A-Z][\w-]+(?: and [A-Z][\w-]+)*) only$/i); if (mm) mm[1].split(/ and /i).forEach(v => { if (s.indexOf(v) < 0) s.push(v); }); }); return m; }));
    return s;
  }
  function summonMon(n, L, c, v) {
    const ls = sbLines(n).L, atk = Number(c.satk) || 0, dc = Number(c.sdc) || 10, md = Number(c.smod) || 0;
    const only = p => /\bonly\b/i.test(p), match = p => !v || new RegExp("\\b" + v + "\\b", "i").test(p);
    const sub = s => String(s).replace(/(?:the|this) spell[’']s level/gi, L).replace(/your spellcasting ability modifier/gi, md)
      .replace(/(\d+) (?:for each|per) spell level above (\d+)/gi, (m, a, b) => a * Math.max(0, L - b)).replace(/(\d+) per spell level/gi, (m, a) => a * L);
    const num = s => {
      const alts = []; s = sub(s).replace(/^HP\s*/i, "").replace(/(\+\s*)?(\d+)\s*\(([^)]*)\)\s*(?:or\s*)?/gi, (m, plus, a, p) => { if (!only(p)) return (plus ? "+ " : "") + a + " "; if (plus) return match(p) ? "+ " + a + " " : ""; alts.push([Number(a), p]); return ""; });
      if (alts.length) { const al = alts.find(x => v && match(x[1])) || alts[0]; return al[0] + (s.match(/\+\s*\d+/g) || []).reduce((x, y) => x + Number(y.replace(/\D/g, "")), 0); }
      const m = s.match(/\d+(?:\s*\+\s*\d+)*/); return m ? m[0].split("+").reduce((x, y) => x + Number(y), 0) : 10;
    };
    const get = re => { const l = ls.find(x => re.test(x)); return l ? l.replace(re, "").trim() : ""; };
    const spd = sub(get(/^Speed:?/i)), rych = { walk: parseInt(spd, 10) || 0 };
    spd.replace(/(Fly|Swim|Climb|Burrow) (\d+) ft\.?(?:\s*\(([^)]*)\))?/gi, (m, k, x, p) => { const rq = p && p.match(/requires level (\d+)/i); if (!p || (rq ? L >= Number(rq[1]) : !only(p) || match(p))) rych[k.toLowerCase()] = Number(x); return m; });
    const ci = ls.findIndex(l => /^CHA\b/.test(l)), at = {}; ABS.forEach((a, i) => { at[a] = parseInt(ls[ci + 1 + i], 10) || 10; });
    const tx = t => {
      t = sub(t).replace(/(Melee or Ranged|Melee|Ranged) Attack:/g, "$1 Attack Roll:").replace(/Bonus equals your spell attack modifier/gi, "+" + atk)
        .replace(/DC equals your spell save DC|Your spell save DC/gi, "DC " + dc).replace(/\bplus\b/g, "+").replace(/\+ (\d+) of /g, "+ $1 ").replace(/Hit:(\S)/g, "Hit: $1")
        .replace(/reach (\d+) feet/g, "reach $1 ft").replace(/range (\d+) ft/g, "range $1/$1 ft")
        .replace(/a number of (.*?)attacks equal to half (\d+) \(round down\)/i, (m, w, x) => NUMW[Math.min(6, Math.floor(x / 2))] + " " + w + "attacks");
      return t.replace(/(\d+d\d+(?:\s*\+\s*\d+)*)\s+((?:[A-Z][a-z]+(?:\s*\([^)]*\))?(?:,\s*(?:or\s+)?|\s+or\s+)?)+?)\s*damage/g, (m, ex, ty) => {
        const opts = ty.split(/,\s*(?:or\s+)?|\s+or\s+/).map(x => x.trim()).filter(Boolean).map(x => { const mm = x.match(/^([A-Z][a-z]+)(?:\s*\(([^)]*)\))?/) || [0, x, ""]; return [mm[1], mm[2] || ""]; });
        const o = opts.find(x => v && x[1] && match(x[1])) || opts[0]; return Math.floor(avgOf(ex)) + " (" + ex.replace(/\s+/g, " ") + ") " + o[0] + " damage";
      });
    };
    const sect = h => { const i = ls.indexOf(h); if (i < 0) return []; const out = []; for (let j = i + 1; j < ls.length && !/^(Actions|Bonus Actions|Reactions|Legendary Actions)$/.test(ls[j]); j++) { const m = ls[j].match(/^([^.]+?)\.\s*(.*)$/); if (!m) continue; const p = (m[1].match(/\(([^)]*)\)/) || [])[1] || ""; if (only(p) && !match(p)) continue; out.push({ nazev: m[1], text: tx(m[2]) }); } return out; };
    return { nazev: ls[0], velikost: (ls[1] || "").split(" ")[0], typ: ls[1], hp: num(get(/^Hit Points:?/i)), ac: num(get(/^Armor Class:?/i)), iniciativa: c.initB || 0, atributy: at, zachrany: [], rychlost: rych, akce: sect("Actions"), bonusove_akce: sect("Bonus Actions"), xp: 0, cr: "—" };
  }
  function endConc(t) {
    const k = t.conc; t.conc = false; if (typeof k !== "string") return;
    S.tok.filter(x => x.src && x.src.owner === t.id && x.src.kouzlo === k).forEach(x => { removeTok(x.id); log(esc(x.nazev) + " mizí (" + esc(t.nazev) + ": konec Concentration na " + esc(k) + ")."); });
  }
  function ordFix() {
    const sm = S.ord.filter(id => { const t = tok(id); return t && t.src && t.src.owner && tok(t.src.owner); });
    const o = S.ord.filter(id => sm.indexOf(id) < 0); sm.forEach(id => { const t = tok(id); t.init = tok(t.src.owner).init; o.splice(o.indexOf(t.src.owner) + 1, 0, id); }); S.ord = o;
  }
  function castSummon(c, n) {
    if (!c || !n || !isSummon(n)) return false;
    const k = spellK(n), min = Number(k.uroven) || 1, vs = summonVariants(n);
    const L = Number(prompt(n + " – úroveň spell slotu (min. " + min + ")", String(min))); if (!L) return false;
    let v = ""; if (vs.length) { const x = prompt(n + " – varianta: " + vs.join(", "), vs[0]); if (x == null) return false; v = vs.find(y => y.toLowerCase() === x.trim().toLowerCase()) || x.trim(); }
    if (c.sdc == null) { const x = prompt("Spell save DC a bonus útoku kouzlem sesilatele " + c.nazev + " (např. 14 6)", "13 5"); if (x == null) return false; const p = x.match(/\d+/g) || []; c.sdc = Number(p[0]) || 13; c.satk = Number(p[1]) || 5; }
    const ba = /Bonus Action/i.test(k.cas || ""), viol = [], ex = c.slots && c.slots[L - 1] && c.slots[L - 1].used < c.slots[L - 1].max ? c.slots[L - 1] : c.pact && c.pact.lvl === L && c.pact.used < c.pact.max ? c.pact : null;
    if (L < min) viol.push("slot " + L + ". úrovně je nižší než úroveň kouzla (" + min + ")"); if (L > 9) viol.push("spell sloty jsou jen do 9. úrovně");
    if (((c.slots || []).some(x => x.max) || c.pact) && !ex) viol.push("nezbývá spell slot " + L + ". úrovně");
    if (S.round) { if (actor() !== c) viol.push(c.nazev + " není na tahu"); if (incap(c)) viol.push(c.nazev + " nemůže jednat"); if (ba ? S.eco.b : S.eco.a) viol.push((ba ? "Bonus Action" : "Action") + " už byla v tomto tahu použita"); if (!ba && S.eco.baSpell) viol.push("po kouzle se slotem za Bonus Action nejde v tomtéž tahu seslat další kouzlo se slotem"); }
    return gate(viol, "seslání " + n + " (" + L + ". úroveň) – " + c.nazev, () => {
      if (S.round && actor() === c) { if (ba) { S.eco.b = 1; S.eco.baSpell = 1; } else { S.eco.a = 1; S.eco.spell = 1; } }
      if (ex) { ex.used++; log(esc(c.nazev) + " spotřeboval " + (ex === c.pact ? "Pact slot" : "spell slot " + L + ". úrovně") + " (zbývá " + (ex.max - ex.used) + ")."); }
      if (/Concentration/i.test(k.trvani || "")) { if (c.conc) log(esc(c.nazev) + ": předchozí Concentration" + (typeof c.conc === "string" ? " (" + esc(c.conc) + ")" : "") + " končí."); endConc(c); c.conc = n; }
      const t = monToken(summonMon(n, L, c, v), c.side); t.nazev = t.nazev.replace(/ \d+$/, "") + (v ? " – " + v : "") + " (" + c.nazev + ")"; t.src = { kouzlo: n, owner: c.id, uroven: L }; t.summon = true; t.xp = 0;
      addTokSilent(t, [c.x != null ? c.x + (c.s || 1) : 15, c.y != null ? c.y : 10]);
      if (S.round) { const cur = S.ord[S.turn]; t.init = c.init; S.ord.splice(S.ord.indexOf(c.id) + 1, 0, t.id); S.turn = S.ord.indexOf(cur); }
      log("✦ " + esc(c.nazev) + " sesílá " + esc(n) + " (" + L + ". úroveň" + (v ? ", " + esc(v) : "") + "): " + esc(t.nazev) + " – HP " + t.hp + ", AC " + t.ac + ", útoky " + (t.atk.map(x => esc(x.nazev) + (x.n > 1 ? " ×" + x.n : "")).join(", ") || "—") + ", pole " + cellName(t.x, t.y) + (S.round ? ", jedná hned po sesilateli" : "") + ".");
    });
  }
  function monAttacks(m) {
    const out = [], acts = (m.akce || []).concat((m.bonusove_akce || []).map(a => Object.assign({ bonusova: true }, a)));
    const multi = (m.akce || []).find(a => /^Multiattack/.test(a.nazev));
    const W = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    acts.forEach(a => {
      const t = a.text || "", am = t.match(/(Melee or Ranged|Melee|Ranged) Attack Roll:\s*\+(\d+)/), sv = t.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:\s*DC (\d+)/);
      let dmgAvg = 0, dice = [], typ = []; t.replace(/(\d+) \(([^)]+)\) (\w+) damage/g, (x, av, ex, ty) => { dmgAvg += Number(av); dice.push(ex); typ.push(ty); return x; });
      if (!dmgAvg || (!am && !sv)) return;
      const o = { nazev: a.nazev + (a.bonusova ? " (BA)" : ""), dmg: dice.join(" + "), avg: dmgAvg, typ: typ.join("/"), kind: "mon", n: 1 };
      if (a.bonusova) o.ba = true; const rc0 = a.nazev.match(/Recharge (\d)/); if (rc0) { o.rc = Number(rc0[1]); o.pozn = "Recharge " + rc0[1] + "–6"; }
      if (am) {
        o.bonus = Number(am[2]);
        const re = t.match(/reach (\d+) ft/), rg = t.match(/range (\d+)\/(\d+) ft/);
        if (/Melee/.test(am[1])) { o.melee = true; o.reach = re ? Number(re[1]) : 5; }
        if (rg) { if (am[1] === "Ranged") { o.range = Number(rg[1]); o.long = Number(rg[2]); } else o.thrown = [Number(rg[1]), Number(rg[2])]; }
      } else {
        o.save = ABN[sv[1].toLowerCase()]; o.dc = Number(sv[2]); o.half = /Success:\s*Half damage/i.test(t);
        const ar = t.match(/(\d+)-foot(?:-long)?[^.]*?(Cone|Sphere|Cube|Line|Emanation|Cylinder)/); if (ar) { o.area = { size: Number(ar[1]), shape: ar[2].toLowerCase() }; o.self = /Cone|Line|Emanation/.test(ar[2]); }
        o.range = Number((t.match(/within (\d+) feet/) || [])[1]) || (o.area ? o.area.size : 5);
        const rc = a.nazev.match(/Recharge ([\d–-]+)/); if (rc) o.pozn = "Recharge " + rc[1];
      }
      if (multi && !a.bonusova && o.bonus != null) { const mt = multi.text, re = new RegExp("(one|two|three|four|five|six) " + a.nazev.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " attacks?", "i"), mm = mt.match(re); if (mm) o.n = W[mm[1].toLowerCase()]; else { const any = mt.match(/makes (one|two|three|four|five|six) attacks/i); if (any && (mt.indexOf(a.nazev) >= 0 || !/using/i.test(mt))) o.n = W[any[1].toLowerCase()]; } }
      out.push(o);
    });
    return out;
  }
  function monToken(m, side) {
    const sv = {}; ABS.forEach(a => { sv[a] = mod(m.atributy[a]); }); (m.zachrany || []).forEach(z => { const p = z.split(" "); sv[p[0]] = Number(p[1]); });
    const same = S.tok.filter(t => t.src && t.src.srd === m.nazev).length;
    return { id: uid(), nazev: m.nazev + " " + (same + 1), kind: "mon", side: side || "nepratele", s: SIZE[m.velikost] || 1, hp: m.hp, max: m.hp, tmp: 0, ac: m.ac, initB: m.iniciativa != null ? m.iniciativa : mod(m.atributy.DEX),
      speed: (m.rychlost || {}).walk || 0, swim: (m.rychlost || {}).swim || 0, fly: (m.rychlost || {}).fly || 0, saves: sv, atk: monAttacks(m), cond: [], conc: false, react: true, xp: m.xp || 0, cr: m.cr, src: { srd: m.nazev } };
  }

  // ---------- geometrie ----------
  function cells(t, x, y) { const o = []; for (let i = 0; i < t.s; i++) for (let j = 0; j < t.s; j++) o.push([(x == null ? t.x : x) + i, (y == null ? t.y : y) + j]); return o; }
  function gap(a, b, ax, ay) { ax = ax == null ? a.x : ax; ay = ay == null ? a.y : ay; const dx = Math.max(0, b.x - (ax + a.s - 1), ax - (b.x + b.s - 1)), dy = Math.max(0, b.y - (ay + a.s - 1), ay - (b.y + b.s - 1)); return Math.max(dx, dy) * 5; }
  function occ(x, y, except) { return S.tok.find(t => t !== except && t.x != null && !t.dead && x >= t.x && x < t.x + t.s && y >= t.y && y < t.y + t.s); }
  function stepCost(t, x, y) {
    let worst = 1;
    for (const [cx, cy] of cells(t, x, y)) {
      const c = tile(cx, cy), def = TILE[c] || TILE["."];
      if (c === "_" && !t.fly) return Infinity;
      if (!def[1] && c !== "_") return Infinity;
      let k = def[1] || 1; if (c === "~" && t.swim) k = 1; if (t.fly && "^,%~_".indexOf(c) >= 0) k = 1;
      const o = occ(cx, cy, t); if (o) { if (hostile(t, o) && Math.abs(o.s - t.s) < 2 && !incap(o)) return Infinity; k = Math.max(k, 2); }
      worst = Math.max(worst, k);
    }
    return worst;
  }
  function canEnd(t, x, y) { return cells(t, x, y).every(([cx, cy]) => !occ(cx, cy, t)) && stepCost(t, x, y) < Infinity; }
  function dijkstra(t, limit) {
    const m = map(), W = m.mrizka[0].length, H = m.mrizka.length, dist = {}, prev = {}, k = (x, y) => x + "," + y, q = [[0, t.x, t.y]];
    dist[k(t.x, t.y)] = 0;
    while (q.length) {
      q.sort((a, b) => a[0] - b[0]); const [c, x, y] = q.shift(); if (c > dist[k(x, y)]) continue;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx + t.s > W || ny + t.s > H) continue;
        if (dx && dy && TILE[tile(x + dx, y)] && !TILE[tile(x + dx, y)][1] && !TILE[tile(x, y + dy)][1]) continue;
        const sc = stepCost(t, nx, ny); if (sc === Infinity) continue; const nc = c + sc * 5; if (nc > limit) continue;
        if (dist[k(nx, ny)] == null || nc < dist[k(nx, ny)]) { dist[k(nx, ny)] = nc; prev[k(nx, ny)] = k(x, y); q.push([nc, nx, ny]); }
      }
    }
    return { dist, prev, path(x, y) { const p = []; let c = k(x, y); while (c) { p.unshift(c.split(",").map(Number)); c = prev[c]; } return p; } };
  }
  function meleeReach(t) { return Math.max(5, ...t.atk.filter(a => a.melee).map(a => a.reach || 5)); }
  function oaAlong(t, path) {
    if (S.disengage && actor() === t) return [];
    const res = [];
    S.tok.filter(h => h.x != null && alive(h) && hostile(t, h) && !incap(h) && h.react !== false).forEach(h => {
      const r = meleeReach(h);
      for (let i = 1; i < path.length; i++) { if (gap(t, h, path[i - 1][0], path[i - 1][1]) <= r && gap(t, h, path[i][0], path[i][1]) > r) { res.push(h); break; } }
    });
    return res;
  }
  function lineVal(x0, y0, x1, y1, skip) {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len * 8)); let v = 0;
    for (let i = 1; i < n; i++) {
      const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n, cx = Math.floor(px), cy = Math.floor(py), key = cx + "," + cy;
      if (skip[key]) continue; const c = tile(cx, cy);
      if (c === "#") return 9; if (c === "o" || c === "T") v = Math.max(v, 3); else if (c === "%") v = Math.max(v, 2);
      if (occ(cx, cy)) v = Math.max(v, 2);
    }
    return v;
  }
  function coverOf(a, b, ax, ay) {
    ax = ax == null ? a.x : ax; ay = ay == null ? a.y : ay;
    const skip = {}; cells(a, ax, ay).concat(cells(b)).forEach(([x, y]) => { skip[x + "," + y] = 1; });
    const e = 0.04, ac = [[ax + e, ay + e], [ax + a.s - e, ay + e], [ax + e, ay + a.s - e], [ax + a.s - e, ay + a.s - e]], tc = [[b.x + e, b.y + e], [b.x + b.s - e, b.y + e], [b.x + e, b.y + b.s - e], [b.x + b.s - e, b.y + b.s - e]];
    let best = 9;
    for (const p of ac) {
      const vals = tc.map(q => lineVal(p[0], p[1], q[0], q[1], skip));
      let c; if (vals.every(v => v === 9)) c = 9; else { const nb = vals.filter(v => v > 0).length; c = nb >= 3 ? 3 : nb >= 1 ? 2 : 0; }
      best = Math.min(best, c); if (!best) break;
    }
    return best;
  }
  const COVTXT = { 0: "bez krytu", 2: "Half Cover (+2 AC)", 3: "Three-Quarters Cover (+5 AC)", 9: "Total Cover" };
  const covB = c => c === 2 ? 2 : c === 3 ? 5 : 0;

  // ---------- pomocník: vyhodnocení ----------
  function advFor(a, b, atk, dist) {
    let adv = 0, dis = 0, why = [];
    if (["Blinded", "Paralyzed", "Restrained", "Stunned", "Unconscious", "Petrified"].some(n => hasC(b, n))) { adv = 1; why.push("cíl je oslabený"); }
    if (hasC(b, "Prone")) { if (dist <= 5) { adv = 1; why.push("cíl Prone"); } else { dis = 1; why.push("cíl Prone z dálky"); } }
    if (hasC(b, "Invisible")) { dis = 1; why.push("cíl Invisible"); }
    if (hasC(b, "Dodge")) { dis = 1; why.push("cíl Dodge"); }
    if (hasC(a, "Invisible")) { adv = 1; why.push("útočník Invisible"); }
    if (["Blinded", "Poisoned", "Prone", "Restrained", "Frightened"].some(n => hasC(a, n))) { dis = 1; why.push("útočník oslabený"); }
    const thrownNow = atk.melee && atk.thrown && dist > (atk.reach || 5);
    if ((!atk.melee || thrownNow) && atk.bonus != null) {
      if (atk.long && dist > atk.range) { dis = 1; why.push("dlouhý dostřel"); }
      if (thrownNow && dist > atk.thrown[0]) { dis = 1; why.push("dlouhý dostřel (hod)"); }
      if (S.tok.some(h => h.x != null && alive(h) && hostile(a, h) && !incap(h) && gap(a, h) <= 5)) { dis = 1; why.push("nepřítel do 5 ft"); }
    }
    return { v: adv && dis ? 0 : adv ? 1 : dis ? -1 : 0, why };
  }
  function inRange(atk, dist) {
    if (atk.save != null) return atk.self ? dist <= (atk.area ? atk.area.size : 5) : dist <= (atk.range || 5);
    if (atk.melee && dist <= (atk.reach || 5)) return true;
    if (atk.thrown && dist <= atk.thrown[1]) return true;
    return !atk.melee && dist <= (atk.long || atk.range || 0);
  }
  function areaHits(a, b, atk, ax, ay) {
    if (!atk.area) return [b];
    const sz = atk.area.size / 5, cx = (ax == null ? a.x : ax) + a.s / 2, cy = (ay == null ? a.y : ay) + a.s / 2, tx = b.x + b.s / 2, ty = b.y + b.s / 2, sh = atk.area.shape;
    return S.tok.filter(t => t.x != null && alive(t) && t !== a).filter(t => {
      const px = t.x + t.s / 2, py = t.y + t.s / 2;
      if (sh === "emanation") return Math.max(Math.abs(px - cx), Math.abs(py - cy)) - (t.s + a.s) / 2 <= sz;
      if (atk.self && (sh === "cone" || sh === "line")) {
        const dx = tx - cx, dy = ty - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, vx = px - cx, vy = py - cy, along = vx * ux + vy * uy, perp = Math.abs(vx * uy - vy * ux);
        if (along <= 0 || along > sz + t.s / 2) return false;
        return sh === "cone" ? perp <= along / 2 + t.s / 2 : perp <= 0.5 + t.s / 2;
      }
      const r = sh === "cube" ? sz / 2 : sz; return Math.max(Math.abs(px - tx), Math.abs(py - ty)) - t.s / 2 < r + 0.01;
    });
  }
  function evalAtk(a, b, atk, ax, ay) {
    const dist = gap(a, b, ax, ay); if (!inRange(atk, dist)) return null;
    const cov = coverOf(a, b, ax, ay); if (cov === 9) return null;
    const out = { atk, b, dist, cov };
    if (atk.save != null) {
      const hits = areaHits(a, b, atk, ax, ay), foes = hits.filter(t => hostile(a, t)), allies = hits.filter(t => !hostile(a, t));
      let ev = 0; foes.forEach(t => { let sm = (t.saves || {})[atk.save] || 0; if (atk.save === "DEX") sm += covB(t === b ? cov : 0); if ((atk.save === "STR" || atk.save === "DEX") && ["Paralyzed", "Stunned", "Unconscious", "Petrified"].some(n => hasC(t, n))) sm = -99; const pf = clamp((atk.dc - sm - 1) / 20, 0, 1); ev += pf * atk.avg + (1 - pf) * (atk.half ? atk.avg / 2 : 0); if (t === b) out.p = pf; });
      out.ev = ev; out.foes = foes; out.allies = allies; out.adv = { v: 0, why: [] };
    } else {
      const ad = advFor(a, b, atk, dist), need = b.ac + covB(cov) - atk.bonus + 2 * exh(a);
      let p = clamp((21 - need) / 20, 0.05, 0.95), pc = 0.05;
      if (ad.v > 0) { p = 1 - (1 - p) * (1 - p); pc = 0.0975; } else if (ad.v < 0) { p = p * p; pc = 0.0025; }
      if (dist <= 5 && (hasC(b, "Paralyzed") || hasC(b, "Unconscious"))) pc = p;
      const da = diceAvg(atk.dmg), n = atk.n || 1;
      out.p = p; out.adv = ad; out.ev = n * ((p - pc) * atk.avg + pc * (atk.avg + da));
    }
    out.kill = out.ev >= b.hp + (b.tmp || 0);
    out.score = out.ev * (b.conc ? 1.25 : 1) * (out.kill ? 1.4 : 1) * (out.allies && out.allies.length ? 0.3 : 1);
    return out;
  }
  function bestPlan(a) {
    const foes = S.tok.filter(t => t.x != null && alive(t) && hostile(a, t) && !(t.kind === "pc" && t.hp <= 0 && false));
    const here = []; foes.forEach(b => a.atk.forEach(atk => { const r = evalAtk(a, b, atk); if (r) here.push(r); }));
    here.sort((x, y) => y.score - x.score);
    const left = speedOf(a) * (S.dash ? 2 : 1) - S.moved, plan = { here, move: null };
    if (left > 0 && a.x != null) {
      const dj = dijkstra(a, left); let best = null;
      Object.keys(dj.dist).forEach(k => {
        const [x, y] = k.split(",").map(Number); if (!canEnd(a, x, y)) return;
        const path = dj.path(x, y), oa = oaAlong(a, path);
        foes.forEach(b => a.atk.forEach(atk => { if (atk.save != null && !atk.self) return; const r = evalAtk(a, b, atk, x, y); if (!r) return; const sc = r.score - oa.length * 4 - dj.dist[k] / 50; if (!best || sc > best.sc) best = { sc, r, x, y, cost: dj.dist[k], oa }; }));
      });
      if (best && (!here.length || best.r.score > here[0].score * 1.15 + 0.5)) plan.move = best;
    }
    return plan;
  }
  function threats(a) {
    return S.tok.filter(h => h.x != null && alive(h) && hostile(a, h) && !incap(h)).map(h => {
      const reachNext = gap(h, a) <= speedOf(h) + Math.max(meleeReach(h), ...h.atk.map(x => x.melee ? 0 : (x.range || 0)));
      let ev = 0; h.atk.forEach(x => { if (x.bonus == null) return; const p = clamp((21 - (a.ac - x.bonus)) / 20, 0.05, 0.95); ev = Math.max(ev, (x.n || 1) * p * x.avg); });
      return { h, reachNext, ev };
    }).filter(x => x.reachNext);
  }
  function difficulty() {
    const party = S.tok.filter(t => t.side === "druzina"), foes = S.tok.filter(t => t.side === "nepratele");
    const b = [0, 0, 0]; party.forEach(t => { const r = BUD[clamp(t.lvl || 1, 1, 20)]; b[0] += r[0]; b[1] += r[1]; b[2] += r[2]; });
    const xp = foes.reduce((s, t) => s + (t.xp || 0), 0);
    const lab = !party.length ? "—" : xp > b[2] * 1.5 ? "Smrtící" : xp > b[2] ? "Nad High" : xp > b[1] ? "High" : xp > b[0] ? "Moderate" : "Low";
    return { b, xp, lab };
  }

  // ---------- akce ----------
  function log(t, o) { o = o || {}; const a = actor(), now = new Date(); S.log.unshift({ k: S.round || 0, c: now.toTimeString().slice(0, 8), d: now.toISOString().slice(0, 10), kdo: a ? a.nazev : "", t: t, pj: !!o.pj, blok: !!o.blok, warn: !!o.warn }); if (S.log.length > 3000) S.log.length = 3000; }
  // ---------- kontrola pravidel, zápis a návrat kroků ----------
  function snap(label) { A.hist.push({ l: label, s: JSON.stringify(S) }); if (A.hist.length > 80) A.hist.shift(); }
  function undo() { const x = A.hist.pop(); if (!x) return; const keep = { tab: S.tab, zoom: S.zoom }; S = JSON.parse(x.s); Object.assign(S, keep); log("↶ Vrácen krok: " + esc(x.l), { pj: true }); save(); draw(); }
  function gate(v, label, fn, noSnap) {
    if (v.length && !confirm("Kontrola pravidel – " + label + ":\n\n• " + v.join("\n• ") + "\n\nOK = provést přesto (zapíše se jako zásah PJ)\nZrušit = neprovádět")) { log("✋ Zablokováno – " + esc(label) + ": " + v.map(esc).join("; "), { blok: true }); save(); draw(); return false; }
    if (!noSnap) snap(label);
    if (v.length) log("⚠ Zásah PJ – " + esc(label) + ": " + v.map(esc).join("; "), { pj: true });
    fn(); save(); draw(); return true;
  }
  function econ(a, kind) {
    const v = []; if (!S.round) v.push("boj ještě nezačal – hoď iniciativu"); if (!a) return v.concat(["nikdo není na tahu"]);
    if (incap(a)) v.push(a.nazev + " nemůže jednat");
    if (kind === "a" && S.eco.a) v.push("Action už byla v tomto tahu použita");
    if (kind === "b" && S.eco.b) v.push("Bonus Action už byla v tomto tahu použita");
    return v;
  }
  function slotFor(a, lvl) {
    if (a.pact && a.pact.lvl >= lvl && a.pact.used < a.pact.max) return { o: a.pact, txt: "Pact Magic slot (" + a.pact.lvl + ". úr.)" };
    for (let l = lvl; l <= (a.slots || []).length; l++) { const x = a.slots[l - 1]; if (x && x.used < x.max) return { o: x, txt: "spell slot " + l + ". úrovně" }; }
    return null;
  }
  function checkAttack(a, b, atk, o) {
    const v = [], cur = actor(), dist = gap(a, b), reaction = o.oa || (cur && a !== cur);
    if (!S.round) v.push("boj ještě nezačal – hoď iniciativu");
    if (incap(a)) v.push(a.nazev + " nemůže jednat");
    if (b.dead) v.push(b.nazev + " je už poražen");
    if (reaction) { if (a.react === false) v.push(a.nazev + " už v tomto kole použil Reaction"); }
    else if (S.round) {
      if (atk.ba) { if (S.eco.b) v.push("Bonus Action už byla v tomto tahu použita"); }
      else if (S.eco.a) v.push("Action už byla v tomto tahu použita");
      if (atk.kind === "spell" && atk.lvl > 0 && atk.ba && S.eco.spell) v.push("po kouzle se spell slotem nejde v tomtéž tahu seslat kouzlo se slotem za Bonus Action");
      if (atk.kind === "spell" && atk.lvl > 0 && !atk.ba && S.eco.baSpell) v.push("po kouzle se slotem za Bonus Action nejde v tomtéž tahu seslat další kouzlo se slotem");
    }
    if (!inRange(atk, dist)) v.push("cíl je mimo dosah (" + dist + " ft)");
    else if (coverOf(a, b) === 9) v.push("cíl je za Total Cover");
    if (a.side === b.side) v.push("cíl je na stejné straně");
    if (atk.kind === "spell" && atk.lvl > 0 && ((a.slots || []).some(x => x.max) || a.pact) && !slotFor(a, atk.lvl)) v.push("nezbývá spell slot " + atk.lvl + ". úrovně ani vyšší");
    if (atk.rc && (a.spent || {})[atk.nazev]) v.push(atk.nazev + " se ještě nenabil (Recharge " + atk.rc + "–6)");
    return v;
  }
  function spend(a, atk, o) {
    const cur = actor();
    if (o.oa || (cur && a !== cur)) { a.react = false; log(esc(a.nazev) + " používá Reaction."); }
    else if (S.round) { if (atk.ba) S.eco.b = 1; else S.eco.a = 1; if (atk.kind === "spell" && atk.lvl > 0) { if (atk.ba) S.eco.baSpell = 1; else S.eco.spell = 1; } }
    if (atk.kind === "spell" && atk.lvl > 0) { const sl = slotFor(a, atk.lvl); if (sl) { sl.o.used++; log(esc(a.nazev) + " spotřeboval " + sl.txt + " (zbývá " + (sl.o.max - sl.o.used) + ")."); } }
    if (atk.kind === "spell" && atk.conc) { if (a.conc) log(esc(a.nazev) + ": předchozí Concentration" + (typeof a.conc === "string" ? " (" + esc(a.conc) + ")" : "") + " končí."); endConc(a); a.conc = atk.kouzlo; }
    if (atk.rc) { a.spent = a.spent || {}; a.spent[atk.nazev] = true; }
  }
  function forceEval(a, b, atk) { const dist = gap(a, b), cov = coverOf(a, b); return { atk, b, dist, cov: cov === 9 ? 3 : cov, adv: advFor(a, b, atk, dist), foes: [b], allies: [], p: 0, ev: 0 }; }
  function attack(a, b, atk, o) {
    o = o || {}; if (!a || !b || !atk) return false;
    let sx, sy; if (o.tpos) { sx = b.x; sy = b.y; b.x = o.tpos[0]; b.y = o.tpos[1]; }
    const v = checkAttack(a, b, atk, o), r = evalAtk(a, b, atk) || forceEval(a, b, atk);
    if (o.tpos) { b.x = sx; b.y = sy; }
    return gate(v, (o.oa ? "Opportunity Attack " : "útok ") + a.nazev + " → " + b.nazev + " (" + atk.nazev + ")", () => { spend(a, atk, o); doAttack(a, r); });
  }
  function oaInfo(t, path) {
    if (S.disengage && actor() === t) return [];
    const res = [];
    S.tok.filter(h => h.x != null && alive(h) && hostile(t, h) && !incap(h) && h.react !== false).forEach(h => {
      const r = meleeReach(h);
      for (let i = 1; i < path.length; i++) if (gap(t, h, path[i - 1][0], path[i - 1][1]) <= r && gap(t, h, path[i][0], path[i][1]) > r) { res.push({ h, pos: path[i - 1] }); break; }
    });
    return res;
  }
  function strip(h) { const el = document.createElement("div"); el.innerHTML = h; return el.textContent.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim(); }
  function logMd() {
    const m = map(), now = new Date(), ent = S.log.slice().reverse(), df = difficulty();
    let s = "# Boj: " + m.nazev + " (" + now.toISOString().slice(0, 10) + ")\n\n> **Stav:** záznam z bojového modulu (vygenerováno automaticky)\n\n"
      + "- **Mapa:** " + m.nazev + (m.misto ? " – [" + m.misto.replace(/^.*\/|\.md$/g, "").replace(/_/g, " ") + "](../" + m.misto + ")" : "") + "\n"
      + (S.meta.nazev ? "- **Boj:** " + S.meta.nazev + "\n" : "") + (S.meta.kampan ? "- **Kampaň:** [" + pgName(S.meta.kampan) + "](../" + S.meta.kampan + ")\n" : "") + (S.meta.quest ? "- **Quest:** [" + pgName(S.meta.quest) + "](../" + S.meta.quest + ")\n" : "")
      + "- **Odehraná kola:** " + (S.round || 0) + "\n- **Obtížnost (DMG 2024):** " + df.lab + " (XP nepřátel " + df.xp + ")\n"
      + "- **Kroků v deníku:** " + ent.length + " (zásahy PJ: " + ent.filter(e => e.pj).length + ", zablokováno: " + ent.filter(e => e.blok).length + ")\n\n"
      + "## Účastníci\n\n| Žeton | Strana | HP | AC | Stavy |\n|---|---|---|---|---|\n"
      + S.tok.map(t => "| " + strip(esc(t.nazev)) + " | " + SIDE[t.side][1] + " | " + (t.dead ? "☠ " : "") + t.hp + "/" + t.max + " | " + t.ac + " | " + (t.cond.map(c => c.n).join(", ") || "—") + " |").join("\n") + "\n\n"
      + "## Průběh (všechny kroky)\n\n| # | Kolo | Čas | Na tahu | Událost |\n|---|---|---|---|---|\n"
      + ent.map((e, i) => typeof e === "string" ? "| " + (i + 1) + " | | | | " + strip(e) + " |" : "| " + (i + 1) + " | " + e.k + " | " + e.c + " | " + strip(esc(e.kdo)) + " | " + (e.pj ? "**[zásah PJ]** " : "") + (e.blok ? "**[zablokováno]** " : "") + (e.warn ? "**[kontrola]** " : "") + strip(e.t) + " |").join("\n") + "\n";
    return s;
  }
  function dlMd() { const blob = new Blob([logMd()], { type: "text/markdown" }), u = document.createElement("a"); u.href = URL.createObjectURL(blob); u.download = "Sezeni_Boj_" + map().id + ".md"; u.click(); }
  function saveLog() {
    const n = new Date(), p = "10_Sezeni/Sezeni_Boj_" + n.toISOString().slice(0, 10) + "_" + n.toTimeString().slice(0, 5).replace(":", "") + "_" + map().id + ".md", E = window.MontelienEditor;
    if (!E || !E.api) { dlMd(); return Promise.resolve(); }
    return E.api("POST", "soubor", { cesta: p, obsah: logMd() }).then(() => { log("Deník uložen do " + esc(p) + "."); if (!S.meta.sezeni) S.meta.sezeni = p; if (S.meta.id) storePut(); save(); draw(); status('Uloženo: <a href="' + base() + p.replace(/\.md$/, "/") + '">' + esc(p) + "</a>"); })
      .catch(er => { alert("Uložení na server selhalo (" + er.message + "), stahuji soubor."); dlMd(); });
  }
  function logPane() {
    const n = S.log.length, pj = S.log.filter(e => e.pj).length, bl = S.log.filter(e => e.blok).length;
    return '<div class="bj-logh"><span>' + n + " kroků · zásahy PJ " + pj + " · zablokováno " + bl + '</span><button data-act="savelog" class="ed-primary">Uložit do záznamu sezení</button><button data-act="dlmd">Stáhnout .md</button></div><div class="bj-log">'
      + (n ? S.log.map(e => typeof e === "string" ? "<div>" + e + "</div>" : '<div class="bj-l' + (e.pj ? " pj" : "") + (e.blok ? " blok" : "") + (e.warn ? " warn" : "") + '"><small>K' + e.k + " · " + esc(e.c) + (e.kdo ? " · " + esc(e.kdo) : "") + "</small> " + e.t + "</div>").join("") : "Zatím nic.") + "</div>";
  }
  function ecoHtml(a) {
    const e = S.eco || {}, sp = speedOf(a) * (S.dash ? 2 : 1), left = sp - S.moved, pip = x => "●".repeat(Math.max(0, x.max - x.used)) + "○".repeat(x.used);
    let h = '<div class="bj-eco"><span data-act="ecoA" class="' + (e.a ? "used" : "") + '" title="Klik = označit / vrátit">Action</span><span data-act="ecoB" class="' + (e.b ? "used" : "") + '" title="Klik = označit / vrátit">Bonus Action</span><span data-act="react2" class="' + (a.react === false ? "used" : "") + '" title="Klik = označit / vrátit">Reaction</span><span class="bj-mv' + (left <= 0 ? " used" : "") + '">Pohyb ' + Math.max(0, left) + "/" + sp + " ft</span></div>";
    const sl = (a.slots || []).map((x, i) => x.max ? '<span data-act="slot" data-l="' + (i + 1) + '" title="Klik = spotřebovat slot (po vyčerpání obnoví)">' + (i + 1) + ". " + pip(x) + "</span>" : "").join("");
    if (sl || a.pact) h += '<div class="bj-slots"><b>Spell sloty:</b> ' + sl + (a.pact ? '<span data-act="slot" data-p="1" title="Pact Magic">Pakt ' + a.pact.lvl + ". " + pip(a.pact) + "</span>" : "") + "</div>";
    const sp2 = Object.keys(a.spent || {}); if (sp2.length) h += '<div class="bj-slots"><b>Nenabito (Recharge):</b> ' + sp2.map(esc).join(", ") + "</div>";
    return h;
  }
  function oaHtml() {
    return (S.oa || []).map((o, i) => {
      const H = tok(o.h), T = tok(o.t); if (!H || !T) return ""; const m = H.atk.filter(x => x.melee).sort((x, y) => y.avg - x.avg)[0];
      return '<div class="bj-oa"><b>Opportunity Attack:</b> ' + esc(H.nazev) + " → " + esc(T.nazev) + (H.react === false ? " (Reaction už použita)" : "") + " " + (m ? '<button data-act="oa" data-i="' + i + '">Hodit ' + esc(m.nazev) + "</button> " : "<small>nemá útok na blízko</small> ") + '<button data-act="oaskip" data-i="' + i + '">Nevyužít</button></div>';
    }).join("");
  }
  function topExtra() {
    const m = map();
    return '<button data-act="undo" title="Vrátit poslední krok (Ctrl+Z)"' + (A.hist.length ? "" : " disabled") + ">↶ Zpět</button>"
      + (m.obrazek ? '<button data-act="obr" class="' + (S.bezObr ? "" : "on") + '" title="Ilustrovaná mapa / schéma">Ilustrace</button>' : "")
      + '<button data-act="teren" class="' + (S.teren ? "on" : "") + '" title="Zobrazit terén z mřížky (zdi, voda, krytí)">Terén</button><button data-act="mriz" class="' + (S.mriz === false ? "" : "on") + '" title="Mřížka">Mřížka</button>';
  }
  function damage(t, n, crit) {
    n = Math.max(0, Math.round(n)); if (!n) return;
    const absorb = Math.min(t.tmp || 0, n); t.tmp -= absorb; const rest = n - absorb;
    if (t.kind === "pc" && t.hp <= 0) { t.ds.f += crit ? 2 : 1; log(esc(t.nazev) + " dostal zásah na 0 HP → " + (crit ? 2 : 1) + " neúspěch death save (" + t.ds.f + "/3)"); if (t.ds.f >= 3) { t.dead = true; log("☠ " + esc(t.nazev) + " umírá."); } return; }
    t.hp -= rest;
    if (t.conc && rest > 0) { const dc = Math.min(30, Math.max(10, Math.floor(rest / 2))), r = d20(0), tot = r.r + ((t.saves || {}).CON || 0); log("Concentration " + esc(t.nazev) + ": " + r.txt + sg((t.saves || {}).CON || 0) + " = " + tot + " vs DC " + dc + (tot >= dc ? " – udrženo" : " – <b>ztraceno</b>")); if (tot < dc) endConc(t); }
    if (t.hp <= 0) {
      const over = -t.hp; t.hp = 0; endConc(t);
      if (t.kind === "pc") { if (over >= t.max) { t.dead = true; log("☠ " + esc(t.nazev) + ": masivní zranění – okamžitá smrt."); } else { if (!hasC(t, "Unconscious")) t.cond.push({ n: "Unconscious" }); log(esc(t.nazev) + " padá na 0 HP (Unconscious, death saves)."); } }
      else { t.dead = true; log("☠ " + esc(t.nazev) + " je poražen."); if (t.summon) { removeTok(t.id); log(esc(t.nazev) + " mizí."); } }
    }
  }
  function heal(t, n) { if (t.dead && t.kind !== "pc") t.dead = false; if (t.kind === "pc" && t.hp <= 0) { t.cond = t.cond.filter(c => c.n !== "Unconscious"); t.ds = { s: 0, f: 0 }; t.dead = false; } t.hp = Math.min(t.max, t.hp + n); }
  function doAttack(a, r) {
    const atk = r.atk;
    if (atk.save != null) {
      const hits = r.foes.concat(r.allies || []); let txt = esc(a.nazev) + " – <b>" + esc(atk.nazev) + "</b> (DC " + atk.dc + " " + atk.save + "): ";
      const dm = roll(atk.dmg).t;
      hits.forEach(t => { let sm = (t.saves || {})[atk.save] || 0; if (atk.save === "DEX" && t === r.b) sm += covB(r.cov); const s = d20(0), tot = s.r + sm, ok = tot >= atk.dc; const got = ok ? (atk.half ? Math.floor(dm / 2) : 0) : dm; txt += esc(t.nazev) + " " + s.r + sg(sm) + "=" + tot + (ok ? " ✓" : " ✗") + " → " + got + "; "; damage(t, got); });
      log(txt + "(" + dm + " " + esc(atk.typ) + ")");
    } else {
      for (let i = 0; i < (atk.n || 1); i++) {
        const b = r.b; if (b.dead) break;
        const s = d20(r.adv.v), tot = s.r + atk.bonus - 2 * exh(a), ac = b.ac + covB(r.cov), crit = s.r === 20 || (s.r !== 1 && tot >= ac && r.dist <= 5 && (hasC(b, "Paralyzed") || hasC(b, "Unconscious")));
        const hit = s.r === 20 || (s.r !== 1 && tot >= ac);
        let txt = esc(a.nazev) + " → " + esc(b.nazev) + ": <b>" + esc(atk.nazev) + "</b> " + s.txt + sg(atk.bonus) + " = " + tot + " vs AC " + ac + (crit ? " <b>KRITICKÝ ZÁSAH</b>" : hit ? " zásah" : " minul");
        if (hit) { const dm = roll(atk.dmg, crit).t; txt += " → " + dm + " " + esc(atk.typ); damage(b, dm, crit); txt += " · HP " + b.hp + "/" + b.max; }
        log(txt);
      }
    }
    save(); draw();
  }
  function next() {
    if (!S.ord.length) return;
    snap("Další tah");
    const prev = actor(); if (prev && prev.kind === "pc" && prev.hp <= 0 && !prev.dead && !prev.stable && prev.dsK !== S.round) log("⚠ Kontrola: " + esc(prev.nazev) + " je na 0 HP a v tomto tahu nehodil Death Saving Throw.", { warn: true });
    for (let i = 0; i < S.ord.length + 1; i++) {
      S.turn++; if (S.turn >= S.ord.length) { S.turn = 0; S.round++; log("— kolo " + S.round + " —"); }
      const t = actor(); if (t && !(t.dead && t.kind !== "pc")) break;
    }
    const t = actor(); S.moved = 0; S.dash = false; S.disengage = false; S.eco = { a: 0, b: 0, spell: 0, baSpell: 0 }; S.oa = []; if (!t) return;
    t.react = true;
    log("▶ Na tahu: <b>" + esc(t.nazev) + "</b>" + (incap(t) ? " (nemůže jednat)" : ""));
    if (t.spent) Object.keys(t.spent).forEach(n => { const at = t.atk.find(x => x.nazev === n), r = d(6); if (at && r >= at.rc) { delete t.spent[n]; log(esc(t.nazev) + ": " + esc(n) + " se nabil (d6 = " + r + ")."); } else log(esc(t.nazev) + ": " + esc(n) + " se nenabil (d6 = " + r + ")."); });
    t.cond = (t.cond || []).filter(c => { if (c.r) { c.r--; if (!c.r) { log(esc(t.nazev) + ": " + c.n + " skončil."); return false; } } return true; });
    if (t.x != null && cells(t).some(([x, y]) => tile(x, y) === "x")) log("⚠ " + esc(t.nazev) + " začíná tah na nebezpečném poli – viz popis mapy.");
    S.sel = t.id; save(); draw(); centerOn(t);
  }
  function rollInit(all) {
    const grp = {};
    S.tok.forEach(t => { if ((!all && t.init != null) || (t.src && t.src.owner && tok(t.src.owner))) return; const g = S.groups && t.kind === "mon" ? t.src.srd : t.id; if (grp[g] == null) grp[g] = d(20); t.init = grp[g] + t.initB; });
    S.ord = S.tok.filter(t => t.init != null || !(t.src && t.src.owner)).sort((a, b) => b.init - a.init || b.initB - a.initB).map(t => t.id); S.tok.forEach(t => { if (t.src && t.src.owner && S.ord.indexOf(t.id) < 0) S.ord.push(t.id); }); ordFix();
    log("Iniciativa: " + S.ord.map(id => { const t = tok(id); return esc(t.nazev) + " " + t.init + " (" + sg(t.initB) + ")"; }).join(", ") + ".");
    if (S.round === 0) { S.round = 1; S.turn = -1; log("Iniciativa hozena – kolo 1."); next(); return; }
    save(); draw();
  }
  function addTok(t, pos) {
    const m = map(), W = m.mrizka[0].length, H = m.mrizka.length, want = pos || [Math.floor(W / 2), Math.floor(H / 2)];
    let best = null;
    for (let r = 0; r < Math.max(W, H) && !best; r++) for (let x = want[0] - r; x <= want[0] + r && !best; x++) for (let y = want[1] - r; y <= want[1] + r && !best; y++) { if (x < 0 || y < 0 || x + t.s > W || y + t.s > H) continue; t.x = x; t.y = y; if (canEnd(t, x, y)) best = [x, y]; }
    if (!best) { t.x = want[0]; t.y = want[1]; }
    S.tok.push(t);
    if (S.round > 0) { t.init = d(20) + t.initB; S.ord.push(t.id); const cur = S.ord[S.turn]; S.ord.sort((a, b) => tok(b).init - tok(a).init); S.turn = S.ord.indexOf(cur); log(esc(t.nazev) + " vstupuje do boje (iniciativa " + t.init + ", pole " + cellName(t.x, t.y) + ")."); } else if (!A.quiet) log(esc(t.nazev) + " přidán na mapu (" + cellName(t.x, t.y) + ").");
  }
  function removeTok(id) { const cur = S.ord[S.turn]; S.tok = S.tok.filter(t => t.id !== id); S.ord = S.ord.filter(x => x !== id); S.turn = cur === id ? Math.min(S.turn, S.ord.length - 1) : S.ord.indexOf(cur); }

  // ---------- stav ----------
  function fresh(mapIdx) { return { map: mapIdx || 0, tok: [], ord: [], turn: -1, round: 0, log: [], moved: 0, dash: false, disengage: false, sel: null, zoom: 1, paint: null, groups: true, tab: "pomocnik", eco: { a: 0, b: 0, spell: 0, baSpell: 0 }, oa: [], meta: freshMeta() }; }
  function freshMeta(o) { return Object.assign({ id: null, nazev: "", stav: "priprava", kampan: "", quest: "", sezeni: "", poznamky: "", vysledek: "", auto: true }, o || {}); }
  function save() { try { localStorage.setItem("boj-stav", JSON.stringify(S)); } catch (e) { } autoSave(); }
  function load2() { S.eco = S.eco || { a: 0, b: 0, spell: 0, baSpell: 0 }; S.oa = S.oa || []; S.log = S.log || []; S.meta = freshMeta(S.meta); }
  function load() { try { S = JSON.parse(localStorage.getItem("boj-stav")) || fresh(); } catch (e) { S = fresh(); } if (S.map >= A.M.mapy.length) S.map = 0; S.eco = S.eco || { a: 0, b: 0, spell: 0, baSpell: 0 }; S.oa = S.oa || []; S.meta = freshMeta(S.meta); }

  // ---------- vykreslení ----------
  function boardSvg() {
    const m = map(), W = m.mrizka[0].length, H = m.mrizka.length, bg = BASE[m.podklad] || BASE.mesto, C = 34 * (S.zoom || 1);
    let s = '<svg class="bj-svg" viewBox="-0.7 -0.7 ' + (W + 0.7) + " " + (H + 0.7) + '" width="' + Math.round((W + 0.7) * C) + '" height="' + Math.round((H + 0.7) * C) + '">'
      + '<defs><pattern id="bj-w" width="1" height="0.5" patternUnits="userSpaceOnUse"><path d="M0 .3 Q.25 .15 .5 .3 T1 .3" stroke="rgba(255,255,255,.35)" stroke-width=".04" fill="none"/></pattern>'
      + '<pattern id="bj-st" width=".25" height=".25" patternUnits="userSpaceOnUse"><rect width=".25" height=".12" fill="rgba(0,0,0,.25)"/></pattern>'
      + '<radialGradient id="bj-fire"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#e2541b"/><stop offset="1" stop-color="rgba(120,20,0,0)"/></radialGradient>'
      + '<filter id="bj-sh" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx=".04" dy=".07" stdDeviation=".05" flood-color="#000" flood-opacity=".75"/></filter>'
      + '<linearGradient id="bj-rim-pc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#c9982f"/><stop offset="1" stop-color="#6e4c10"/></linearGradient>'
      + '<linearGradient id="bj-rim-mon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0e0e0"/><stop offset=".5" stop-color="#707070"/><stop offset="1" stop-color="#262626"/></linearGradient>'
      + Object.keys(SIDE).map(k => '<radialGradient id="bj-f-' + k + '" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="' + LIGHT[k] + '"/><stop offset="1" stop-color="' + SIDE[k][0] + '"/></radialGradient>').join("") + "</defs>";
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + bg + '"/>';
    const img = m.obrazek && !S.bezObr, tiles = !img || S.teren || S.paint;
    if (img) s += '<image href="' + base() + "11_Mapy/" + esc(m.obrazek) + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>';
    if (tiles) s += "<g" + (img ? ' opacity=".55"' : "") + ">";
    if (tiles) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = m.mrizka[y][x], r = (f, extra) => '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + f + '"' + (extra || "") + "/>";
      switch (c) {
        case "g": s += r("#6d8c4c"); break;
        case "r": s += r("#a58a63"); break;
        case "#": s += r("#2b2724") + '<rect x="' + (x + .08) + '" y="' + (y + .08) + '" width=".84" height=".84" fill="#3b3531"/>'; break;
        case "o": s += '<circle cx="' + (x + .5) + '" cy="' + (y + .5) + '" r=".42" fill="#7a736c" stroke="#3b3631" stroke-width=".06"/>'; break;
        case "T": s += '<circle cx="' + (x + .5) + '" cy="' + (y + .5) + '" r=".48" fill="#2e5a28" stroke="#1d3a1a" stroke-width=".06"/><circle cx="' + (x + .4) + '" cy="' + (y + .4) + '" r=".18" fill="#3f7536"/>'; break;
        case "%": s += '<rect x="' + (x + .12) + '" y="' + (y + .12) + '" width=".76" height=".76" fill="#7a5230" stroke="#4a3018" stroke-width=".05"/><path d="M' + (x + .12) + " " + (y + .12) + "L" + (x + .88) + " " + (y + .88) + '" stroke="#4a3018" stroke-width=".04"/>'; break;
        case "^": s += '<g fill="rgba(40,30,20,.55)"><circle cx="' + (x + .25) + '" cy="' + (y + .3) + '" r=".09"/><circle cx="' + (x + .7) + '" cy="' + (y + .45) + '" r=".11"/><circle cx="' + (x + .4) + '" cy="' + (y + .75) + '" r=".08"/></g>'; break;
        case "~": s += r("#2c5d88") + r("url(#bj-w)"); break;
        case ",": s += r("#5d8eae") + r("url(#bj-w)", ' opacity=".6"'); break;
        case "=": s += r("#8a6a44") + '<path d="M' + x + " " + (y + .33) + "h1M" + x + " " + (y + .66) + 'h1" stroke="#5a4129" stroke-width=".04"/>'; break;
        case "+": s += '<rect x="' + (x + .1) + '" y="' + (y + .35) + '" width=".8" height=".3" fill="#6b4423" stroke="#2f1d0e" stroke-width=".04"/>'; break;
        case "_": s += r("#0b0908") + '<rect x="' + (x + .1) + '" y="' + (y + .1) + '" width=".8" height=".8" fill="#000" opacity=".6"/>'; break;
        case "x": s += '<circle cx="' + (x + .5) + '" cy="' + (y + .5) + '" r=".5" fill="url(#bj-fire)"/>'; break;
        case "S": s += r("url(#bj-st)"); break;
      }
    }
    if (tiles) s += "</g>";
    s += '<g stroke="' + (img ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.28)") + '" stroke-width="' + (img ? ".02" : ".025") + '"' + (S.mriz === false ? ' display="none"' : "") + ">";
    for (let x = 0; x <= W; x++) s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + H + '"/>';
    for (let y = 0; y <= H; y++) s += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>';
    s += "</g><g class=\"bj-lab\">";
    for (let x = 0; x < W; x++) s += '<text x="' + (x + .5) + '" y="-.2">' + colName(x) + "</text>";
    for (let y = 0; y < H; y++) s += '<text x="-.35" y="' + (y + .62) + '">' + (y + 1) + "</text>";
    s += '</g><g class="bj-ov"></g><g class="bj-toks">';
    const act = actor();
    S.tok.filter(t => t.x != null).forEach(t => {
      const cx = t.x + t.s / 2, cy = t.y + t.s / 2, R = t.s / 2 - .07, col = SIDE[t.side][0], ini = t.nazev.split(/\s+/).filter(w => !/^\d+$/.test(w)).map(w => (w.match(/[\p{L}]/u) || [""])[0]).join("").slice(0, 2) + (/\d+$/.test(t.nazev) ? t.nazev.match(/\d+$/)[0] : "");
      const hpP = t.max ? clamp(t.hp / t.max, 0, 1) : 1;
      s += '<g class="bj-tok' + (t.dead ? " dead" : "") + (act === t ? " act" : "") + (S.sel === t.id ? " sel" : "") + '" data-id="' + t.id + '" transform="translate(' + cx + " " + cy + ')">'
        + (act === t ? '<circle r="' + (R + .12) + '" class="bj-ring"/>' : "")
        + '<g filter="url(#bj-sh)"><circle r="' + R + '" fill="url(#bj-rim-' + (t.kind === "pc" ? "pc" : "mon") + ')"/><circle r="' + (R - .07) + '" fill="url(#bj-f-' + t.side + ')" stroke="rgba(0,0,0,.55)" stroke-width=".02"/></g>'
        + (S.sel === t.id ? '<circle r="' + (R + .05) + '" fill="none" stroke="#ffd54a" stroke-width=".07"/>' : "")
        + '<text y="' + (t.s > 1 ? .19 : .12) + '" font-size="' + (t.s > 1 ? .55 : .34) + '">' + esc(ini) + "</text>"
        + '<rect x="' + (-R) + '" y="' + (R - .12) + '" width="' + 2 * R + '" height=".12" fill="#300"/><rect x="' + (-R) + '" y="' + (R - .12) + '" width="' + 2 * R * hpP + '" height=".12" fill="' + (hpP > .5 ? "#3c3" : hpP > .25 ? "#e93" : "#e33") + '"/>'
        + (t.conc ? '<circle cx="' + (R * .75) + '" cy="' + (-R * .75) + '" r=".13" fill="#8af" stroke="#124" stroke-width=".03"/>' : "")
        + (t.cond.length ? '<circle cx="' + (-R * .75) + '" cy="' + (-R * .75) + '" r=".13" fill="#f6c343" stroke="#432" stroke-width=".03"/>' : "")
        + (t.dead ? '<text y=".18" font-size=".5">☠</text>' : "")
        + "<title>" + esc(t.nazev) + " · HP " + t.hp + "/" + t.max + " · AC " + t.ac + (t.cond.length ? " · " + t.cond.map(c => c.n).join(", ") : "") + "</title></g>";
    });
    return s + "</g></svg>";
  }
  function colName(x) { return x < 26 ? String.fromCharCode(65 + x) : "A" + String.fromCharCode(65 + x - 26); }
  function cellName(x, y) { return colName(x) + (y + 1); }

  function initList() {
    const act = actor(), list = S.ord.length ? S.ord.map(tok).filter(Boolean) : S.tok;
    if (!list.length) return '<p class="bj-empty">Přidej postavy a netvory (záložka <b>Přidat</b>) nebo navržené střetnutí mapy.</p>';
    return '<table class="bj-init">' + list.map(t => {
      const hpP = t.max ? clamp(t.hp / t.max, 0, 1) : 1;
      return '<tr class="' + (act === t ? "act " : "") + (t.dead ? "dead " : "") + (S.sel === t.id ? "sel" : "") + '" data-id="' + t.id + '">'
        + '<td class="bj-ini"><input type="number" autocomplete="off" value="' + (t.init != null ? t.init : "") + '" data-f="init" title="Iniciativa (' + sg(t.initB) + ')"></td>'
        + '<td class="bj-nm"><i style="background:' + SIDE[t.side][0] + '"></i><a href="#" data-act="sel">' + esc(t.nazev) + "</a>"
        + (t.src && t.src.srd ? ' <a href="#" data-act="sb" title="Statblok">↗</a>' : t.src && t.src.cesta ? ' <a href="' + base() + t.src.cesta.replace(/\.md$/, "/") + '" target="_blank" title="Character sheet">↗</a>' : "")
        + '<div class="bj-conds">' + t.cond.map((c, i) => '<span class="bj-cond" title="' + esc(COND[c.n] || "") + '">' + esc(c.n) + (c.lvl ? " " + c.lvl : "") + (c.r ? " (" + c.r + ")" : "") + '<b data-act="uncond" data-i="' + i + '">×</b></span>').join("") + (t.conc ? '<span class="bj-cond bj-conc">Concentration' + (typeof t.conc === "string" ? ": " + esc(t.conc) : "") + '<b data-act="conc">×</b></span>' : "")
        + (t.kind === "pc" && t.hp <= 0 && !t.dead ? '<span class="bj-ds">Death saves ✓' + t.ds.s + " ✗" + t.ds.f + ' <button data-act="ds">hodit</button></span>' : "") + "</div></td>"
        + '<td class="bj-hp"><div class="bj-hpbar"><s style="width:' + hpP * 100 + "%;background:" + (hpP > .5 ? "#3a3" : hpP > .25 ? "#e93" : "#d33") + '"></s></div><span>' + t.hp + "/" + t.max + (t.tmp ? " +" + t.tmp : "") + '</span><input type="number" autocomplete="off" placeholder="±" data-f="dmg" title="Číslo + Enter = zranění, s + = léčení"></td>'
        + '<td class="bj-ac" title="Armor Class">' + t.ac + "</td>"
        + '<td class="bj-tools"><select data-f="cond" title="Přidat stav"><option value="">+stav</option>' + Object.keys(COND).map(n => "<option>" + n + "</option>").join("") + '<option value="conc">Concentration</option></select>'
        + '<span class="bj-react' + (t.react === false ? " used" : "") + '" data-act="react" title="Reakce (klik = použita)">R</span><b class="bj-x" data-act="del" title="Odebrat">×</b></td></tr>';
    }).join("") + "</table>";
  }
  function helperHtml() {
    const a = actor(), df = difficulty();
    let h = '<div class="bj-diff"><b>Obtížnost (DMG 2024):</b> <span class="bj-dl bj-d-' + df.lab.replace(/\s/g, "") + '">' + df.lab + "</span> · XP nepřátel " + df.xp + " · rozpočet Low " + df.b[0] + " / Moderate " + df.b[1] + " / High " + df.b[2] + "</div>";
    h += oaHtml();
    if (!a) return h + '<p class="bj-empty">Až hodíš iniciativu, pomocník ukáže pro postavu na tahu dosah, cover, šance na zásah, doporučený tah a hrozby.</p>';
    const left = speedOf(a) * (S.dash ? 2 : 1) - S.moved;
    h += '<div class="bj-who"><b>' + esc(a.nazev) + "</b> na tahu · HP " + a.hp + "/" + a.max + " · AC " + a.ac + " · pohyb zbývá <b>" + left + " ft</b> z " + speedOf(a) + (a.swim ? " (swim " + a.swim + ")" : "") + (a.fly ? " (fly " + a.fly + ")" : "")
      + '<div class="bj-btns"><button data-act="dash" class="' + (S.dash ? "on" : "") + '">Dash</button><button data-act="dis" class="' + (S.disengage ? "on" : "") + '">Disengage</button><button data-act="dodge">Dodge</button><button data-act="next" class="bj-next">Další tah ▶</button></div></div>';
    if (a.summ && a.summ.length) h += '<div class="bj-sum"><b>Vyvolání:</b> ' + a.summ.map(n => '<button data-act="summon" data-k="' + esc(n) + '">✦ ' + esc(n) + "</button>").join(" ") + "</div>";
    h += ecoHtml(a);
    if (a.kind === "pc" && a.hp <= 0 && !a.dead) h += '<p class="bj-warn">Na 0 HP: hoď <b>Death Saving Throw</b> (tlačítko v iniciativě). 10+ úspěch, 20 = vstává s 1 HP, 1 = dva neúspěchy.</p>';
    a.cond.forEach(c => { h += '<p class="bj-tip"><b>' + esc(c.n) + ":</b> " + esc(COND[c.n] || "") + "</p>"; });
    if (incap(a)) return h + '<p class="bj-warn">Postava nemůže jednat.</p>';
    const plan = bestPlan(a), row = (r, mv) => {
      const atk = r.atk, foes = r.foes ? r.foes.length : 1;
      return '<tr><td><b>' + esc(atk.nazev) + "</b>" + (atk.n > 1 ? " ×" + atk.n : "") + (atk.pozn ? "<br><small>" + esc(atk.pozn) + "</small>" : "") + "</td><td>" + esc(r.b.nazev) + "<br><small>" + r.dist + " ft · " + COVTXT[r.cov] + "</small></td>"
        + "<td>" + (atk.save != null ? "DC " + atk.dc + " " + atk.save + "<br><small>selže " + pct(r.p || 0) + (r.foes.length > 1 ? " · zasáhne " + r.foes.length + " nepřátel" : "") + (r.allies.length ? ' · <span class="bj-red">i ' + r.allies.length + " spojence!</span>" : "") + "</small>" : pct(r.p) + (r.adv.v ? (r.adv.v > 0 ? " <span class=\"bj-g\">ADV</span>" : " <span class=\"bj-red\">DIS</span>") : "") + (r.adv.why.length ? "<br><small>" + esc(r.adv.why.join(", ")) + "</small>" : "")) + "</td>"
        + "<td>~" + r.ev.toFixed(1) + (r.kill ? ' <span class="bj-g" title="Očekávané zranění ≥ HP cíle">může dorazit</span>' : "") + (r.b.conc ? ' <span class="bj-b">Concentration</span>' : "") + "</td>"
        + (mv ? "" : '<td><button data-act="atk" data-b="' + r.b.id + '" data-a="' + a.atk.indexOf(atk) + '">Hodit</button></td>') + "</tr>";
    };
    if (plan.move) {
      const mv = plan.move;
      h += '<div class="bj-plan"><b>Doporučení:</b> přesuň se na <b>' + cellName(mv.x, mv.y) + "</b> (" + mv.cost + " ft) a použij <b>" + esc(mv.r.atk.nazev) + "</b> na <b>" + esc(mv.r.b.nazev) + "</b> – očekávané zranění ~" + mv.r.ev.toFixed(1) + "."
        + (mv.oa.length ? ' <span class="bj-red">Cestou provokuješ Opportunity Attack: ' + mv.oa.map(x => esc(x.nazev)).join(", ") + " (zvaž Disengage).</span>" : "") + ' <button data-act="go" data-x="' + mv.x + '" data-y="' + mv.y + '">Přesunout</button></div>';
    } else if (plan.here.length) {
      const b = plan.here[0];
      h += '<div class="bj-plan"><b>Doporučení:</b> <b>' + esc(b.atk.nazev) + "</b> na <b>" + esc(b.b.nazev) + "</b> – " + (b.atk.save != null ? "záchrana selže na " + pct(b.p || 0) : "zásah " + pct(b.p)) + ", očekávané zranění ~" + b.ev.toFixed(1) + (b.kill ? ", pravděpodobně cíl vyřadí" : "") + ".</div>";
    } else h += '<p class="bj-tip">Žádný nepřítel v dosahu ani po pohybu. Zvaž Dash, úkryt (Hide), pomoc spojenci (Help) nebo přípravu akce (Ready).</p>';
    if (plan.here.length) h += '<table class="bj-opts"><tr><th>Útok</th><th>Cíl</th><th>Šance</th><th>Zranění</th><th></th></tr>' + plan.here.slice(0, 8).map(r => row(r)).join("") + "</table>";
    const th = threats(a), inc = th.reduce((s, x) => s + x.ev, 0);
    if (th.length) h += '<p class="bj-tip"><b>Hrozby příští kolo:</b> ' + th.map(x => esc(x.h.nazev) + " (~" + x.ev.toFixed(1) + ")").join(", ") + " · celkem ~" + inc.toFixed(1) + " zranění." + (inc >= a.hp ? ' <span class="bj-red">Hrozí pád na 0 HP – zvaž ústup s Disengage, Dodge, léčení nebo cover.</span>' : "") + "</p>";
    const adj = S.tok.filter(h2 => h2.x != null && alive(h2) && hostile(a, h2) && !incap(h2) && gap(a, h2) <= meleeReach(h2));
    if (adj.length && !S.disengage) h += '<p class="bj-tip">Odchod z dosahu vyvolá Opportunity Attack od: ' + adj.map(x => esc(x.nazev) + (x.react === false ? " (reakci už použil)" : "")).join(", ") + ".</p>";
    S.tok.filter(t => t.side === a.side && t.kind === "pc" && t.hp <= 0 && !t.dead).forEach(t => { h += '<p class="bj-tip"><b>' + esc(t.nazev) + "</b> je na 0 HP (" + gap(a, t) + " ft): stabilizace Medicine DC 10, Spare the Dying nebo léčení.</p>"; });
    const conc = S.tok.filter(t => t.x != null && alive(t) && hostile(a, t) && t.conc); if (conc.length) h += '<p class="bj-tip">Nepřítel drží Concentration: ' + conc.map(t => esc(t.nazev)).join(", ") + " – zásah vynutí CON save (DC 10 nebo polovina zranění).</p>";
    return h;
  }
  function addHtml() {
    const ms = map().stretnuti || [];
    return '<div class="bj-add"><h4>Navržené střetnutí mapy</h4><p>' + ms.map(x => x.pocet + "× " + esc(x.nazev)).join(", ") + ' <button data-act="enc">Přidat</button> <button data-act="place">Rozestavit na startovní pozice</button></p>'
      + '<h4>Postavy z wiki</h4><div class="bj-row"><input data-q="pc" placeholder="Hledat postavu…"><select data-side="pc"><option value="druzina">Družina</option><option value="nepratele">Nepřátelé</option><option value="neutral">Neutrální</option></select></div><div class="bj-pc-facets" data-pc-facets></div><div class="bj-res" data-res="pc"></div>'
      + '<h4>Netvoři (SRD 5.2.1)</h4><div class="bj-row"><input data-q="mon" placeholder="Hledat netvora… (např. Zombie)"><select data-cr><option value="">CR vše</option>' + ["0", "1/8", "1/4", "1/2"].concat(Array.from({ length: 30 }, (_, i) => String(i + 1))).map(c => "<option>" + c + "</option>").join("") + '</select><input type="number" data-n value="1" min="1" max="20" title="Počet"><select data-side="mon"><option value="nepratele">Nepřátelé</option><option value="druzina">Spojenci</option><option value="neutral">Neutrální</option></select></div><div class="bj-res" data-res="mon"></div>'
      + '<h4>Vyvolání kouzlem</h4><div class="bj-row"><select data-c="sum">' + summonList().map(n => "<option>" + esc(n) + "</option>").join("") + '</select><button data-act="summonx">Seslat</button></div><p class="bj-tip">Sesilatel je vybraný žeton, jinak postava na tahu. Tvor sdílí jeho iniciativu, jedná hned po něm, HP, AC a útoky se spočítají z úrovně slotu a zmizí při ztrátě Concentration. Find Familiar a další kouzla bez vlastního statbloku přidej jako netvora z bestiáře.</p>'
      + '<h4>Vlastní žeton</h4><div class="bj-row"><input data-c="n" placeholder="Jméno"><input data-c="hp" type="number" placeholder="HP"><input data-c="ac" type="number" placeholder="AC"><input data-c="i" type="number" placeholder="Init +"><button data-act="custom">Přidat</button></div></div>';
  }
  function mapHtml() {
    const m = map(), ed = document.body.classList.contains("ed-on");
    let h = '<div class="bj-mapi"><select data-f="map">' + A.M.mapy.map((x, i) => '<option value="' + i + '"' + (i === S.map ? " selected" : "") + ">" + esc(x.nazev) + "</option>").join("") + "</select>"
      + "<p>" + esc(m.popis || "") + "</p><p><b>Světlo:</b> " + esc(m.osvetleni || "—") + (m.misto ? ' · <a href="' + base() + m.misto.replace(/\.md$/, "/") + '">' + esc(m.misto.replace(/^.*\/|\.md$/g, "").replace(/_/g, " ")) + "</a>" : "") + " · " + m.mrizka[0].length * 5 + " × " + m.mrizka.length * 5 + " ft</p>"
      + '<div class="bj-legend">' + Object.keys(TILE).map(k => '<span class="bj-pal' + (S.paint === k ? " on" : "") + '" data-paint="' + esc(k) + '" title="' + esc(TILE[k][0]) + '"><svg viewBox="0 0 1 1" width="18" height="18">' + tileIcon(k) + "</svg>" + esc(TILE[k][0].replace(/ \(.*/, "")) + "</span>").join("") + "</div>";
    if (ed) h += '<p class="bj-edit">Režim úprav: vyber dlaždici v legendě a maluj do mapy (tah myší). ' + (S.paint ? '<button data-act="nopaint">Ukončit malování</button> ' : "") + '<button data-act="savemap" class="ed-primary">Uložit mapy</button> <button data-act="newmap">+ Nová mapa</button> <button data-act="mapjson">Upravit JSON</button> <button data-act="mapimg">Obrázek mapy…</button></p>';
    else h += '<p class="bj-edit"><small>Mapy jde upravovat v režimu úprav (lokální editační server).</small></p>';
    return h + '<p><button data-act="reset">Nové střetnutí (vyčistit)</button> <button data-act="export">Export stavu</button> <button data-act="import">Import</button> <label><input type="checkbox" data-f="groups"' + (S.groups ? " checked" : "") + "> stejní netvoři sdílí iniciativu</label></p></div>";
  }
  function tileIcon(k) { const m = { ".": "#8b8478", g: "#6d8c4c", r: "#a58a63", "#": "#2b2724", o: "#7a736c", T: "#2e5a28", "%": "#7a5230", "^": "#5a4a3a", "~": "#2c5d88", ",": "#5d8eae", "=": "#8a6a44", "+": "#6b4423", _: "#000", x: "#e2541b", S: "#666" }; return '<rect width="1" height="1" fill="' + (m[k] || "#888") + '"/>'; }

  function draw() {
    const host = A.host, keep = host.querySelector(".bj-board") ? [host.querySelector(".bj-board").scrollLeft, host.querySelector(".bj-board").scrollTop] : null;
    const tabs = [["pomocnik", "Pomocník"], ["pridat", "Přidat"], ["mapa", "Mapa"], ["log", "Deník"], ["boje", "Boje"]];
    host.innerHTML = '<div class="bj"><div class="bj-left"><div class="bj-top"><b>' + esc(map().nazev) + '</b><span class="bj-round">' + (S.round ? "Kolo " + S.round : "Před bojem") + '</span><span class="bj-zoom"><button data-act="zo">−</button><button data-act="zi">+</button></span>' + topExtra()
      + '<button data-act="init" class="ed-primary">⚄ ' + (S.round ? "Přehodit iniciativu" : "Hodit iniciativu") + "</button>" + (S.round ? '<button data-act="next">Další tah ▶</button>' : "") + "</div>"
      + '<div class="bj-board">' + boardSvg() + '</div><div class="bj-status">Najeď na pole: vzdálenost a cover od vybraného žetonu.</div></div>'
      + '<div class="bj-right"><h3>Iniciativa</h3>' + initList() + '<nav class="bj-tabs">' + tabs.map(t => '<button data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>").join("") + '</nav><div class="bj-pane">'
      + (S.tab === "pridat" ? addHtml() : S.tab === "mapa" ? mapHtml() : S.tab === "log" ? logPane() : S.tab === "boje" ? bojeHtml() : helperHtml()) + "</div></div></div>";
    if (keep) { const b = host.querySelector(".bj-board"); b.scrollLeft = keep[0]; b.scrollTop = keep[1]; }
    if (S.tab === "pridat") { drawPcFilters(); search("pc"); search("mon"); }
  }
  function centerOn(t) { const b = A.host.querySelector(".bj-board"); if (!b || t.x == null) return; const C = 34 * (S.zoom || 1); b.scrollTo({ left: (t.x + .7) * C - b.clientWidth / 2, top: (t.y + .7) * C - b.clientHeight / 2, behavior: "smooth" }); }
  function search(kind) {
    const host = A.host, q = (host.querySelector('[data-q="' + kind + '"]') || {}).value || "", res = host.querySelector('[data-res="' + kind + '"]'); if (!res) return;
    const ql = q.toLowerCase();
    if (kind === "pc") res.innerHTML = A.P.filter(e => {
      const ix = (A.PI || []).find(x => x.cesta === e.cesta), f = A.pcf || {};
      return (!ql || String(e.postava.jmeno).toLowerCase().indexOf(ql) >= 0)
        && (!f.kategorie || !f.kategorie.size || f.kategorie.has(ix && ix.kategorie))
        && (!f.zeme || !f.zeme.size || (ix && ix.zeme || []).some(x => f.zeme.has(x.cesta)))
        && (!f.stitek || !f.stitek.size || (ix && ix.stitky || []).some(x => f.stitek.has(x)));
    }).slice(0, 30).map(e => '<button data-act="addpc" data-i="' + A.P.indexOf(e) + '">' + esc(e.postava.jmeno) + " <small>" + esc((e.postava.tridy || []).map(t => t.trida + " " + t.uroven).join(" / ")) + "</small></button>").join("");
    else { const cr = host.querySelector("[data-cr]").value; res.innerHTML = A.B.filter(m => (!ql || m.nazev.toLowerCase().indexOf(ql) >= 0) && (!cr || m.cr === cr)).slice(0, 40).map(m => '<button data-act="addmon" data-n="' + esc(m.nazev) + '">' + esc(m.nazev) + " <small>CR " + esc(m.cr) + " · " + esc(m.typ) + "</small></button>").join(""); }
  }
  function drawPcFilters() {
    const host = A.host.querySelector("[data-pc-facets]"); if (!host) return;
    A.pcf = A.pcf || { kategorie: new Set(), zeme: new Set(), stitek: new Set() };
    const facets = [["kategorie", "Kategorie", [...new Set((A.PI || []).map(x => x.kategorie))].filter(Boolean).map(x => [x, x])],
      ["zeme", "Země", [...new Map((A.PI || []).flatMap(x => x.zeme || []).map(x => [x.cesta, x.nazev])).entries()]],
      ["stitek", "Štítek", [...new Set((A.PI || []).flatMap(x => x.stitky || []))].map(x => [x, x])]];
    host.innerHTML = facets.map(([key, label, options]) => '<div><b>' + label + '</b> ' + options.map(([value, name]) =>
      '<button type="button" data-pc-filter="' + key + '" data-value="' + esc(value) + '" class="' + (A.pcf[key].has(value) ? "on" : "") + '">' + esc(name) + '</button>').join("") + "</div>").join("");
  }

  // ---------- interakce ----------
  function cellAt(ev) { const svg = A.host.querySelector(".bj-svg"), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; }
  function overlay(t) {
    const g = A.host.querySelector(".bj-ov"); if (!g) return;
    const isAct = actor() === t, sp = speedOf(t), left = isAct ? sp * (S.dash ? 2 : 1) - S.moved : sp, full = isAct && !S.dash ? left + sp : left;
    const dj = dijkstra(t, Math.max(0, full)); let s = "";
    Object.keys(dj.dist).forEach(k => { const [x, y] = k.split(",").map(Number), c = dj.dist[k]; if (!c) return; s += '<rect x="' + x + '" y="' + y + '" width="' + t.s + '" height="' + t.s + '" fill="' + (c <= left ? "rgba(80,220,120,.28)" : "rgba(240,200,60,.22)") + '"/>'; });
    g.innerHTML = s; return dj;
  }
  function bind() {
    const host = A.host;
    let drag = null, painting = false;
    host.addEventListener("pointerdown", e => {
      if (S.paint && e.target.closest(".bj-svg")) { snap("Malování mapy"); painting = true; paintAt(e); e.preventDefault(); return; }
      const g = e.target.closest(".bj-tok"); if (!g) return;
      const t = tok(g.dataset.id); if (!t) return;
      e.preventDefault(); S.sel = t.id;
      drag = { t, g, dj: overlay(t), moved: false, sx: e.clientX, sy: e.clientY }; g.setPointerCapture(e.pointerId);
    });
    host.addEventListener("pointermove", e => {
      if (painting) { paintAt(e); return; }
      if (drag) {
        if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
        const [px, py] = cellAt(e); drag.g.setAttribute("transform", "translate(" + px + " " + py + ")");
        const x = Math.floor(px - drag.t.s / 2 + .5), y = Math.floor(py - drag.t.s / 2 + .5), c = drag.dj.dist[x + "," + y];
        status(cellName(x, y) + (c != null ? " · pohyb " + c + " ft" : " · mimo dosah pohybu"));
        return;
      }
      const svg = e.target.closest && e.target.closest(".bj-svg"); if (!svg) return;
      const [px, py] = cellAt(e), x = Math.floor(px), y = Math.floor(py), src = tok(S.sel) || actor(); if (x < 0 || y < 0) return;
      let s = cellName(x, y) + " · " + (TILE[tile(x, y)] || ["?"])[0];
      if (src && src.x != null) { const fake = { x, y, s: 1 }; s += " · " + gap(src, fake) + " ft od " + esc(src.nazev); const o = occ(x, y); if (o && o !== src) s += " · " + COVTXT[coverOf(src, o)]; }
      status(s);
    });
    host.addEventListener("pointerup", e => {
      if (painting) { painting = false; log("PJ přemaloval mapu (" + esc((TILE[S.paint] || ["?"])[0]) + ").", { pj: true }); save(); return; }
      if (!drag) return; const t = drag.t, d0 = drag; drag = null;
      if (!d0.moved) { draw(); return; }
      const [px, py] = cellAt(e), x = Math.floor(px - t.s / 2 + .5), y = Math.floor(py - t.s / 2 + .5);
      if (x === t.x && y === t.y) { draw(); return; }
      const m = map(); if (x < 0 || y < 0 || x + t.s > m.mrizka[0].length || y + t.s > m.mrizka.length || !canEnd(t, x, y)) { status("Sem žeton nejde (zeď, obsazené pole nebo mimo mapu)."); draw(); return; }
      moveTo(t, x, y, d0.dj);
    });
    host.addEventListener("click", e => {
      const pcFilter = e.target.closest("[data-pc-filter]");
      if (pcFilter) { const set = A.pcf[pcFilter.dataset.pcFilter], value = pcFilter.dataset.value; set.has(value) ? set.delete(value) : set.add(value); draw(); return; }
      const tb = e.target.closest("[data-tab]"); if (tb) { S.tab = tb.dataset.tab; save(); draw(); return; }
      const pal = e.target.closest("[data-paint]"); if (pal && document.body.classList.contains("ed-on")) { S.paint = pal.dataset.paint; draw(); return; }
      const b = e.target.closest("[data-act]"); if (!b) return; e.preventDefault();
      const row = b.closest("tr[data-id]"), t = row ? tok(row.dataset.id) : null, act = b.dataset.act, a = actor();
      if (MUT[act]) snap(MUT[act] + (t ? " – " + t.nazev : a && /^(eco|react2|slot|dash|dis|dodge)/.test(act) ? " – " + a.nazev : ""));
      ({
        sel() { S.sel = t.id; draw(); centerOn(t); },
        sb() { window.MontelienSRD && window.MontelienSRD.show("bestiar", t.src.srd); },
        uncond() { const c = t.cond.splice(Number(b.dataset.i), 1)[0]; log(esc(t.nazev) + ": stav " + esc(c.n) + " odebrán."); save(); draw(); },
        conc() { endConc(t); log(esc(t.nazev) + " ukončil Concentration."); save(); draw(); },
        react() { t.react = t.react === false; log(esc(t.nazev) + ": Reaction " + (t.react ? "vrácena" : "použita") + "."); save(); draw(); },
        react2() { a.react = a.react === false; log(esc(a.nazev) + ": Reaction " + (a.react ? "vrácena" : "použita") + "."); save(); draw(); },
        ecoA() { if (!a) return; S.eco.a = S.eco.a ? 0 : 1; log(esc(a.nazev) + ": Action " + (S.eco.a ? "použita (ručně)" : "vrácena") + "."); save(); draw(); },
        ecoB() { if (!a) return; S.eco.b = S.eco.b ? 0 : 1; log(esc(a.nazev) + ": Bonus Action " + (S.eco.b ? "použita (ručně)" : "vrácena") + "."); save(); draw(); },
        slot() { if (!a) return; const x = b.dataset.p ? a.pact : a.slots[Number(b.dataset.l) - 1]; if (!x) return; if (x.used < x.max) { x.used++; log(esc(a.nazev) + ": ručně spotřebován " + (b.dataset.p ? "Pact slot" : "spell slot " + b.dataset.l + ". úrovně") + "."); } else { x.used = 0; log(esc(a.nazev) + ": sloty " + (b.dataset.p ? "Pact Magic" : b.dataset.l + ". úrovně") + " obnoveny.", { pj: true }); } save(); draw(); },
        oa() { const i = Number(b.dataset.i), o = S.oa[i], H = tok(o.h), T = tok(o.t), m = H && H.atk.filter(x => x.melee).sort((x, y) => y.avg - x.avg)[0]; if (m && T && attack(H, T, Object.assign({}, m, { n: 1 }), { oa: true, tpos: o.pos })) { S.oa.splice(i, 1); save(); draw(); } },
        oaskip() { const o = S.oa.splice(Number(b.dataset.i), 1)[0], H = o && tok(o.h); log(esc(H ? H.nazev : "?") + " nevyužil Opportunity Attack."); save(); draw(); },
        undo() { undo(); },
        summon() { castSummon(a, b.dataset.k); },
        summonx() { const c = tok(S.sel) || a; if (!c) { alert("Vyber sesilatele (klikni na žeton) nebo hoď iniciativu."); return; } castSummon(c, host.querySelector('[data-c="sum"]').value); },
        obr() { S.bezObr = !S.bezObr; save(); draw(); },
        teren() { S.teren = !S.teren; save(); draw(); },
        mriz() { S.mriz = S.mriz === false; save(); draw(); },
        savelog() { saveLog(); },
        bsave() { storePut(true); },
        bsaveas() { S.meta.id = null; storePut(true); },
        bnew() { if (!confirm("Připravit nový boj? Současný stav " + (S.meta.id ? "zůstane uložený" : "se ztratí, pokud ho neuložíš") + ".")) return; const keep = { kampan: S.meta.kampan, quest: S.meta.quest, sezeni: S.meta.sezeni }; S = fresh(S.map); S.tab = "boje"; S.meta = freshMeta(keep); log("Nový boj (příprava)."); save(); draw(); },
        bload() { openBoj(b.dataset.id); },
        bdup() { Store.get(b.dataset.id).then(x => { x = JSON.parse(JSON.stringify(x)); x.id = newId(x.nazev + " kopie"); x.nazev = (x.nazev || "Boj") + " (kopie)"; x.vytvoreno = x.upraveno = new Date().toISOString(); return Store.put(x); }).then(refreshList); },
        bdel() { const x = (A.lib || []).find(y => y.id === b.dataset.id); if (!confirm("Smazat uložený boj „" + ((x && x.nazev) || b.dataset.id) + "“?")) return; Store.del(b.dataset.id).then(() => { if (S.meta.id === b.dataset.id) { S.meta.id = null; save(); } refreshList(); }); },
        bstav() { Store.get(b.dataset.id).then(x => { x.stav = b.dataset.v; x.upraveno = new Date().toISOString(); if (S.meta.id === x.id) S.meta.stav = x.stav; return Store.put(x); }).then(refreshList); },
        bexpall() { Promise.all((A.lib || []).map(x => Store.get(x.id))).then(all => { const blob = new Blob([JSON.stringify({ boje: all }, null, 1)], { type: "application/json" }), u = document.createElement("a"); u.href = URL.createObjectURL(blob); u.download = "boje_montelien.json"; u.click(); }); },
        bimp() { const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = () => i.files[0].text().then(t2 => { const j = JSON.parse(t2), arr = j.boje || (j.stav_boje ? [j] : [{ id: newId("import"), nazev: "Importovaný boj", stav: "probiha", stav_boje: j }]); return Promise.all(arr.map(x => { x.id = x.id && !(A.lib || []).some(y => y.id === x.id) ? x.id : newId(x.nazev || "import"); return Store.put(x); })); }).then(refreshList); i.click(); },
        bnewpage() { newPage(b.dataset.k); },
        dlmd() { dlMd(); },
        mapimg() { const v = prompt("Obrázek mapy – cesta relativně k 11_Mapy (např. bojove/moje.jpg), prázdné = bez obrázku", map().obrazek || ""); if (v == null) return; snap("Obrázek mapy"); if (v.trim()) map().obrazek = v.trim(); else delete map().obrazek; log("PJ změnil obrázek mapy.", { pj: true }); save(); draw(); },
        del() { if (confirm("Odebrat " + t.nazev + "?")) { removeTok(t.id); log(esc(t.nazev) + " odebrán z boje."); save(); draw(); } },
        ds() { t.dsK = S.round; const r = d(20); if (r === 20) { heal(t, 1); log(esc(t.nazev) + ": death save 20 – vstává s 1 HP!"); } else if (r === 1) { t.ds.f += 2; log(esc(t.nazev) + ": death save 1 – dva neúspěchy."); } else if (r >= 10) { t.ds.s++; log(esc(t.nazev) + ": death save " + r + " – úspěch (" + t.ds.s + "/3)."); } else { t.ds.f++; log(esc(t.nazev) + ": death save " + r + " – neúspěch (" + t.ds.f + "/3)."); } if (t.ds.s >= 3) { log(esc(t.nazev) + " je stabilizován."); t.ds = { s: 0, f: 0 }; t.stable = true; } if (t.ds.f >= 3) { t.dead = true; log("☠ " + esc(t.nazev) + " umírá."); } save(); draw(); },
        init() { rollInit(S.round > 0 && confirm("Přehodit iniciativu všem?")); },
        next() { next(); },
        dash() { if (a && S.dash) { S.dash = false; S.eco.a = 0; log(esc(a.nazev) + " ruší Dash (Action vrácena)."); save(); draw(); return; } gate(econ(a, "a"), "Dash", () => { S.dash = true; S.eco.a = 1; log(esc(a.nazev) + " používá Dash (pohyb ×2, Action)."); }, true); },
        dis() { if (a && S.disengage) { S.disengage = false; S.eco.a = 0; log(esc(a.nazev) + " ruší Disengage (Action vrácena)."); save(); draw(); return; } gate(econ(a, "a"), "Disengage", () => { S.disengage = true; S.eco.a = 1; log(esc(a.nazev) + " používá Disengage (pohyb nevyvolá Opportunity Attack, Action)."); }, true); },
        dodge() { if (!a || hasC(a, "Dodge")) return; gate(econ(a, "a"), "Dodge", () => { S.eco.a = 1; a.cond.push({ n: "Dodge", r: 1 }); log(esc(a.nazev) + " používá Dodge (útoky proti mají Disadvantage, Advantage na DEX záchrany do jeho dalšího tahu; Action)."); }, true); },
        atk() { attack(a, tok(b.dataset.b), a.atk[Number(b.dataset.a)]); },
        go() { const x = Number(b.dataset.x), y = Number(b.dataset.y), dj = dijkstra(a, 9999); moveTo(a, x, y, dj); },
        zi() { S.zoom = Math.min(2.5, (S.zoom || 1) * 1.2); save(); draw(); },
        zo() { S.zoom = Math.max(.4, (S.zoom || 1) / 1.2); save(); draw(); },
        enc() { (map().stretnuti || []).forEach(x => { const m = A.B.find(mm => mm.nazev === x.nazev); if (m) for (let i = 0; i < x.pocet; i++) addTok(monToken(m, "nepratele")); }); place(); save(); draw(); },
        place() { place(); log("Žetony rozestaveny na startovní pozice."); save(); draw(); },
        addpc() { const e2 = A.P[Number(b.dataset.i)], side = A.host.querySelector('[data-side="pc"]').value, t2 = pcToken(e2); t2.side = side; addTok(t2, startPos(side)); save(); draw(); },
        addmon() { const m = A.B.find(mm => mm.nazev === b.dataset.n), n = Number(A.host.querySelector("[data-n]").value) || 1, side = A.host.querySelector('[data-side="mon"]').value; for (let i = 0; i < n; i++) addTok(monToken(m, side), startPos(side)); save(); draw(); },
        custom() { const g = k => A.host.querySelector('[data-c="' + k + '"]').value; const hp = Number(g("hp")) || 10; addTok({ id: uid(), nazev: g("n") || "Žeton", kind: "mon", side: "nepratele", s: 1, hp, max: hp, tmp: 0, ac: Number(g("ac")) || 12, initB: Number(g("i")) || 0, speed: 30, swim: 0, fly: 0, saves: {}, atk: [], cond: [], conc: false, react: true, xp: 0, src: {} }); save(); draw(); },
        nopaint() { S.paint = null; draw(); },
        savemap() { window.MontelienEditor.api("PUT", "soubor", { cesta: "11_Mapy/bojove_mapy.json", obsah: JSON.stringify(A.M, null, 1) }).then(() => { log("Mapy uloženy do 11_Mapy/bojove_mapy.json.", { pj: true }); save(); draw(); status("Mapy uloženy do 11_Mapy/bojove_mapy.json."); }).catch(er => alert("Chyba: " + er.message)); },
        newmap() { const w = Number(prompt("Šířka (polí po 5 ft)", "30")), h = Number(prompt("Výška", "20")), n = prompt("Název mapy", "Nová mapa"); if (!w || !h) return; A.M.mapy.push({ id: "mapa-" + uid(), nazev: n || "Nová mapa", podklad: "mesto", osvetleni: "", popis: "", start: { druzina: [], nepratele: [] }, stretnuti: [], mrizka: Array.from({ length: h }, () => ".".repeat(w)) }); S.map = A.M.mapy.length - 1; S.tok.forEach(t => { t.x = null; }); log("PJ založil mapu " + esc(n || "Nová mapa") + ".", { pj: true }); save(); draw(); },
        mapjson() { const E = window.MontelienEditor, ta = E.el("textarea", { rows: 26, class: "pf-raw" }); ta.value = JSON.stringify(map(), null, 1); const m = E.modal("Mapa – JSON", ta, [{ text: "Použít", primary: true, click() { try { snap("JSON mapy"); A.M.mapy[S.map] = JSON.parse(ta.value); log("PJ upravil JSON mapy.", { pj: true }); save(); m.close ? m.close() : document.querySelector(".ed-modal-bg").remove(); draw(); } catch (er) { alert(er.message); } } }]); },
        reset() { if (!confirm("Vyčistit střetnutí (žetony, iniciativu, deník)?")) return; const go2 = () => { S = fresh(S.map); log("Nové střetnutí."); save(); draw(); }; if (S.log.length && confirm("Uložit nejdřív deník do záznamu sezení?")) saveLog().then(go2); else go2(); },
        export() { const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }), u = document.createElement("a"); u.href = URL.createObjectURL(blob); u.download = "stretnuti.json"; u.click(); },
        import() { const i = document.createElement("input"); i.type = "file"; i.accept = ".json"; i.onchange = () => i.files[0].text().then(t2 => { snap("Import"); S = JSON.parse(t2); load2(); log("Stav střetnutí importován.", { pj: true }); save(); draw(); }); i.click(); }
      }[act] || (() => { }))();
    });
    host.addEventListener("change", e => {
      const f = e.target.dataset.f, row = e.target.closest("tr[data-id]"), t = row ? tok(row.dataset.id) : null;
      if (f === "init" && t) { snap("Iniciativa – " + t.nazev); const old = t.init; t.init = Number(e.target.value); log(esc(t.nazev) + ": iniciativa " + (old == null ? "—" : old) + " → " + t.init + " (ručně)."); const cur = S.ord[S.turn]; S.ord = S.tok.filter(x => x.init != null).sort((a, b) => b.init - a.init || b.initB - a.initB).map(x => x.id); S.turn = S.ord.indexOf(cur); save(); draw(); }
      if (f === "cond" && t && e.target.value) {
        const v = e.target.value; snap("Stav – " + t.nazev); if (v === "conc") { t.conc = true; log(esc(t.nazev) + ": Concentration (ručně)."); }
        else { const c = { n: v }; if (v === "Exhaustion") c.lvl = Number(prompt("Úroveň Exhaustion (1–6)", "1")) || 1; const r = prompt("Trvání v kolech (prázdné = dokud neodebereš)", ""); if (Number(r)) c.r = Number(r); t.cond.push(c); log(esc(t.nazev) + ": " + v); }
        save(); draw();
      }
      if (f === "map") { snap("Změna mapy"); S.map = Number(e.target.value); log("Mapa: " + esc(map().nazev) + "."); S.tok.forEach(t2 => { t2.x = null; }); place(); save(); draw(); }
      if (f === "groups") { S.groups = e.target.checked; save(); }
      const mf = e.target.dataset.meta; if (mf) { S.meta[mf] = e.target.type === "checkbox" ? e.target.checked : e.target.value; if (mf === "kampan" && S.meta.quest && (qById(S.meta.quest) || {}).kampan && qById(S.meta.quest).kampan !== S.meta.kampan) S.meta.quest = ""; if (mf === "quest" && !S.meta.kampan && (qById(e.target.value) || {}).kampan) S.meta.kampan = qById(e.target.value).kampan; save(); if (/kampan|quest/.test(mf)) draw(); }
      const bf = e.target.dataset.bf; if (bf) { A.bf = A.bf || {}; A.bf[bf] = e.target.value; draw(); }
      if (e.target.dataset.cr != null) search("mon");
    });
    host.addEventListener("keydown", e => {
      if (e.target.dataset.f === "dmg" && e.key === "Enter") {
        const t = tok(e.target.closest("tr").dataset.id), v = e.target.value.trim(); if (!v) return;
        snap("HP – " + t.nazev); if (/^\+/.test(v)) { heal(t, Number(v.slice(1))); log(esc(t.nazev) + " léčen o " + v.slice(1) + " (HP " + t.hp + "/" + t.max + ")."); } else if (/^t/i.test(v)) { t.tmp = Number(v.slice(1)); log(esc(t.nazev) + ": dočasné HP " + t.tmp + "."); } else { damage(t, Number(v)); log(esc(t.nazev) + " dostal " + Number(v) + " zranění (HP " + t.hp + "/" + t.max + ")."); }
        save(); draw();
      }
    });
    host.addEventListener("input", e => { if (e.target.dataset.q) search(e.target.dataset.q); if (e.target.dataset.bq != null) { A.bf = A.bf || {}; A.bf.q = e.target.value; const l = host.querySelector(".bj-blist"); if (l) l.innerHTML = bojeList(); } });
    document.addEventListener("keydown", e => { if (!document.getElementById("boj-app") || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; } if (e.key === "n" || e.key === "N") next(); });
  }
  function moveTo(t, x, y, dj) {
    const ok = dj && dj.dist[x + "," + y] != null, path = ok ? dj.path(x, y) : [[t.x, t.y], [x, y]], cost = ok ? dj.dist[x + "," + y] : null, cur = actor(), oa = S.round ? oaInfo(t, path) : [], v = [];
    if (S.round) {
      if (cur !== t) v.push(t.nazev + " není na tahu (pohyb mimo tah)");
      else {
        if (incap(t)) v.push(t.nazev + " nemůže jednat");
        else if (!speedOf(t)) v.push("rychlost je 0 (" + ((t.cond || []).map(c => c.n).join(", ") || "stav") + ")");
        if (cost == null) v.push("cíl je mimo dosah pohybu nebo k němu nevede cesta");
        else { const left = speedOf(t) * (S.dash ? 2 : 1) - S.moved; if (cost > left) v.push("pohyb " + cost + " ft, zbývá jen " + Math.max(0, left) + " ft"); }
      }
    }
    return gate(v, "pohyb " + t.nazev + " → " + cellName(x, y), () => {
      const from = t.x != null ? cellName(t.x, t.y) : "mimo mapu"; t.x = x; t.y = y;
      let txt = esc(t.nazev) + ": " + from + " → " + cellName(x, y) + (cost != null ? " (" + cost + " ft)" : " (přesun PJ)");
      if (cur === t && cost != null) S.moved += cost;
      if (oa.length) { txt += ' <span class="bj-red">⚠ provokuje Opportunity Attack: ' + oa.map(o => esc(o.h.nazev)).join(", ") + "</span>"; S.oa = (S.oa || []).concat(oa.map(o => ({ h: o.h.id, t: t.id, pos: o.pos }))); }
      if (cells(t).some(([cx, cy]) => tile(cx, cy) === "x")) txt += " ⚠ nebezpečné pole";
      log(txt); if (oa.length) S.tab = "pomocnik";
    });
  }
  function startPos(side) { const st = (map().start || {})[side === "druzina" ? "druzina" : "nepratele"] || []; const used = S.tok.filter(t => t.x != null).length; return st[used % Math.max(1, st.length)] || null; }
  function place() {
    const st = map().start || {}, idx = { druzina: 0, nepratele: 0, neutral: 0 };
    S.tok.forEach(t => { t.x = null; });
    const all = S.tok.slice(); S.tok = [];
    all.forEach(t => { const list = st[t.side === "druzina" ? "druzina" : "nepratele"] || [], p = list[idx[t.side]++ % Math.max(1, list.length)]; S.tok.push(t); t.x = -99; const tmp = S.tok.pop(); addTokSilent(tmp, p); });
  }
  function addTokSilent(t, pos) { const r = S.round; S.round = 0; A.quiet = true; addTok(t, pos); A.quiet = false; S.round = r; }
  function paintAt(e) { const [px, py] = cellAt(e), x = Math.floor(px), y = Math.floor(py), m = map(); if (x < 0 || y < 0 || y >= m.mrizka.length || x >= m.mrizka[0].length) return; const row = m.mrizka[y]; if (row[x] === S.paint) return; m.mrizka[y] = row.slice(0, x) + S.paint + row.slice(x + 1); draw(); }
  function status(t) { const s = A.host.querySelector(".bj-status"); if (s) s.innerHTML = t; }

  // ---------- uložené boje (11_Mapy/boje/<id>.json přes lokální server, jinak localStorage) ----------
  const STAV = { priprava: "Příprava", probiha: "Probíhá", dokonceno: "Dokončeno", archiv: "Archiv" };
  const Store = {
    srv: null,
    test() { if (this.srv != null) return Promise.resolve(this.srv); return fetch(base() + "api/boje").then(r => { this.srv = r.ok; return this.srv; }).catch(() => (this.srv = false)); },
    loc() { try { return JSON.parse(localStorage.getItem("boj-knihovna")) || {}; } catch (e) { return {}; } },
    locSet(o) { localStorage.setItem("boj-knihovna", JSON.stringify(o)); },
    index() {
      return this.test().then(srv => srv ? fetch(base() + "api/boje").then(r => r.json())
        : fetch(base() + "boje_index.json").then(r => r.ok ? r.json() : {}).catch(() => ({})).then(ix => { const L = this.loc(); ix.boje = (ix.boje || []).filter(x => !L[x.id]).map(x => Object.assign(x, { repo: true })).concat(Object.values(L).map(summ)); return ix; }));
    },
    get(id) { return this.test().then(srv => { const L = this.loc(); if (!srv && L[id]) return L[id]; return fetch(base() + (srv ? "api/boj?id=" + encodeURIComponent(id) : "11_Mapy/boje/" + id + ".json")).then(r => { if (!r.ok) throw new Error("boj nenalezen"); return r.json(); }); }); },
    put(b) { return this.test().then(srv => srv ? fetch(base() + "api/boj", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boj: b }) }).then(r => r.json()).then(j => { if (j.chyba) throw new Error(j.chyba); return b; }) : (() => { const L = this.loc(); L[b.id] = b; this.locSet(L); return b; })()); },
    del(id) { return this.test().then(srv => { if (srv) return fetch(base() + "api/boj?id=" + encodeURIComponent(id), { method: "DELETE" }).then(r => r.json()); const L = this.loc(); delete L[id]; this.locSet(L); }); }
  };
  function summ(b) { const st = b.stav_boje || {}; return Object.assign({}, b, { stav_boje: undefined, kola: st.round || 0, kroku: (st.log || []).length, ucastnici: (st.tok || []).map(t => ({ nazev: strip(t.nazev), strana: t.side, hp: t.hp, max: t.max, mrtvy: !!t.dead })) }); }
  function slug(t) { return String(t || "boj").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "boj"; }
  function newId(n) { return slug(n) + "-" + Date.now().toString(36); }
  function pgName(p) { const all = [].concat(A.ix && A.ix.kampane || [], A.ix && A.ix.questy || [], A.ix && A.ix.sezeni || []), x = all.find(y => y.cesta === p); return x ? x.nazev : String(p || "").replace(/^.*\/|\.md$/g, "").replace(/_/g, " "); }
  function qById(p) { return ((A.ix && A.ix.questy) || []).find(x => x.cesta === p); }
  function mapById(id) { return A.M.mapy.findIndex(m => m.id === id); }
  function record() {
    const now = new Date().toISOString(), m = S.meta;
    if (!m.id) { m.id = newId(m.nazev || map().nazev); m.vytvoreno = now; }
    if (!m.nazev) m.nazev = map().nazev + " – " + now.slice(0, 10);
    if (m.stav === "priprava" && S.round > 0) m.stav = "probiha";
    const st = JSON.parse(JSON.stringify(S)); delete st.meta; st.sel = null; st.paint = null;
    return { id: m.id, nazev: m.nazev, stav: m.stav, kampan: m.kampan, quest: m.quest, sezeni: m.sezeni, poznamky: m.poznamky, vysledek: m.vysledek, vytvoreno: m.vytvoreno || now, upraveno: now, mapa: map().id, stav_boje: st };
  }
  function storePut(loud) {
    clearTimeout(A.autoT); const r = record();
    return Store.put(r).then(() => { try { localStorage.setItem("boj-stav", JSON.stringify(S)); } catch (e) { } if (loud) { log("Boj uložen: " + esc(r.nazev) + (Store.srv ? " (11_Mapy/boje/" + r.id + ".json)" : " (v prohlížeči)") + "."); draw(); } refreshList(); })
      .catch(er => { if (loud) alert("Uložení boje selhalo: " + er.message); });
  }
  function autoSave() { if (!A || !S.meta || !S.meta.id || !S.meta.auto) return; clearTimeout(A.autoT); A.autoT = setTimeout(() => storePut(false), 2500); }
  function openBoj(id) {
    return Store.get(id).then(x => {
      if (S.meta.id && S.meta.auto && S.meta.id !== id) storePut(false);
      snap("Načtení boje"); S = Object.assign(fresh(), x.stav_boje || {}); const mi = mapById(x.mapa); if (mi >= 0) S.map = mi;
      S.meta = freshMeta({ id: x.id, nazev: x.nazev, stav: x.stav, kampan: x.kampan, quest: x.quest, sezeni: x.sezeni, poznamky: x.poznamky, vysledek: x.vysledek, vytvoreno: x.vytvoreno });
      load2(); S.tab = "boje"; log("Načten uložený boj: " + esc(x.nazev) + ".", { pj: true }); try { localStorage.setItem("boj-stav", JSON.stringify(S)); } catch (e) { } draw();
    }).catch(er => alert("Boj se nenačetl: " + er.message));
  }
  function refreshList() { return Store.index().then(ix => { A.ix = ix; A.lib = ix.boje || []; if (S.tab === "boje") { const l = A.host.querySelector(".bj-blist"); if (l) l.innerHTML = bojeList(); else draw(); } }).catch(() => { }); }
  function urlStart() {
    const q = new URLSearchParams(location.search);
    if (q.get("boj")) return openBoj(q.get("boj"));
    if (q.get("postava")) {
      const e = A.P.find(x => x.cesta === q.get("postava"));
      if (e) { S.tab = "pridat"; addTok(pcToken(e), startPos("druzina")); save(); log(esc(e.postava.jmeno) + " přidán do boje z odkazu."); }
      history.replaceState(null, "", location.pathname);
      return Promise.resolve();
    }
    if (q.get("mapa") || q.get("novy") || q.get("quest") || q.get("kampan")) {
      const mi = q.get("mapa") ? mapById(q.get("mapa")) : S.map;
      if (S.meta.id && S.meta.auto) storePut(false);
      S = fresh(mi >= 0 ? mi : 0); S.meta = freshMeta({ kampan: q.get("kampan") || "", quest: q.get("quest") || "", sezeni: q.get("sezeni") || "" });
      if (q.get("quest") || q.get("kampan")) S.tab = "boje"; log("Nový boj" + (q.get("mapa") ? " na mapě " + esc(map().nazev) : "") + ".");
      save(); history.replaceState(null, "", location.pathname);
    }
    return Promise.resolve();
  }
  function newPage(k) {
    const E = window.MontelienEditor, n = prompt(k === "kampan" ? "Název nové kampaně" : "Název nového questu"); if (!n) return;
    const dir = k === "kampan" ? "07_Kampane/Kampan_" : "08_Questy/Quest_", p = dir + slug(n).replace(/-/g, "_").replace(/^./, c => c.toUpperCase()) + ".md";
    const obsah = k === "kampan" ? "# Kampaň: " + n + "\n\n> **Stav:** návrh\n\n- **Úrovně postav:**\n- **Hlavní region:**\n- **Hlavní antagonista:**\n- **Témata a tón:**\n\n## Premisa (pro hráče)\n## Pozadí (pro DM)\n## Struktura (akty / kapitoly)\n## Klíčová NPC\n## Questy\n## Možné konce\n## Pro DM (tajné)\n"
      : "# Quest: " + n + "\n\n> **Stav:** návrh\n\n- **Typ:** vedlejší\n- **Doporučená úroveň:**\n- **Kampaň:** " + (S.meta.kampan ? "[" + pgName(S.meta.kampan) + "](../" + S.meta.kampan + ")" : "") + "\n- **Zadavatel:**\n- **Lokace:**" + (map().misto ? " [" + pgName(map().misto) + "](../" + map().misto + ")" : "") + "\n\n## Háček (jak se k tomu hráči dostanou)\n## Pozadí (co se doopravdy děje)\n## Průběh / scény\n## Setkání a nepřátelé (CR, statbloky)\n## Odměny (zlato, předměty, XP / milníky, informace)\n## Důsledky (úspěch / neúspěch)\n## Pro DM (tajné)\n";
    if (!E || !E.api) { alert("Nové stránky jde zakládat jen přes lokální editační server (režim úprav)."); return; }
    E.api("POST", "soubor", { cesta: p, obsah }).then(() => { A.ix = A.ix || {}; const arr = k === "kampan" ? (A.ix.kampane = A.ix.kampane || []) : (A.ix.questy = A.ix.questy || []); arr.push({ cesta: p, nazev: n, kampan: k === "quest" ? S.meta.kampan : undefined }); S.meta[k] = p; log("Založena stránka " + esc(p) + "."); save(); draw(); })
      .catch(er => alert("Založení selhalo: " + er.message));
  }
  function opt(list, v, empty) { return '<option value="">' + empty + "</option>" + list.map(x => '<option value="' + esc(x.cesta) + '"' + (x.cesta === v ? " selected" : "") + ">" + esc(x.nazev) + "</option>").join(""); }
  function bojeHtml() {
    const m = S.meta, ix = A.ix || {}, ed = document.body.classList.contains("ed-on"), qs = (ix.questy || []).filter(q => !m.kampan || !q.kampan || q.kampan === m.kampan), bf = A.bf || {};
    return '<div class="bj-boje"><h4>Tento boj ' + (m.id ? '<small class="bj-g">uložen' + (m.auto ? ", ukládá se sám" : "") + "</small>" : '<small class="bj-red">neuložen</small>') + "</h4>"
      + '<div class="bj-bform"><label>Název<input data-meta="nazev" value="' + esc(m.nazev) + '" placeholder="' + esc(map().nazev) + '"></label>'
      + '<label>Stav<select data-meta="stav">' + Object.keys(STAV).map(k => '<option value="' + k + '"' + (m.stav === k ? " selected" : "") + ">" + STAV[k] + "</option>").join("") + "</select></label>"
      + '<label>Kampaň<span class="bj-row"><select data-meta="kampan">' + opt(ix.kampane || [], m.kampan, "— bez kampaně —") + "</select>" + (ed ? '<button data-act="bnewpage" data-k="kampan" title="Založit novou kampaň">+</button>' : "") + "</span></label>"
      + '<label>Quest<span class="bj-row"><select data-meta="quest">' + opt(qs, m.quest, "— bez questu —") + "</select>" + (ed ? '<button data-act="bnewpage" data-k="quest" title="Založit nový quest">+</button>' : "") + "</span></label>"
      + '<label>Sezení<select data-meta="sezeni">' + opt(ix.sezeni || [], m.sezeni, "— bez sezení —") + "</select></label>"
      + '<label class="bj-wide">Poznámky PJ (příprava, taktika nepřátel, odměny)<textarea data-meta="poznamky" rows="3">' + esc(m.poznamky) + "</textarea></label>"
      + '<label class="bj-wide">Výsledek boje<textarea data-meta="vysledek" rows="2">' + esc(m.vysledek) + "</textarea></label>"
      + '<label class="bj-chk"><input type="checkbox" data-meta="auto"' + (m.auto ? " checked" : "") + "> ukládat automaticky po každém kroku</label></div>"
      + '<p><button data-act="bsave" class="ed-primary">Uložit</button> <button data-act="bsaveas">Uložit jako nový</button> <button data-act="bnew">+ Připravit nový boj</button> <button data-act="savelog">Deník → záznam sezení</button></p>'
      + (Store.srv === false ? '<p class="bj-tip">Bez lokálního serveru se boje ukládají jen v tomto prohlížeči. Export je přenese jinam.</p>' : "")
      + '<h4>Uložené boje <small>(' + (A.lib || []).length + ')</small> <a href="' + base() + 'boje/">správa bojů →</a></h4>'
      + '<div class="bj-row"><input data-bq placeholder="Hledat…" value="' + esc(bf.q || "") + '"><select data-bf="kampan">' + opt(ix.kampane || [], bf.kampan, "všechny kampaně") + '</select><select data-bf="stav"><option value="">všechny stavy</option>' + Object.keys(STAV).map(k => '<option value="' + k + '"' + (bf.stav === k ? " selected" : "") + ">" + STAV[k] + "</option>").join("") + "</select></div>"
      + '<div class="bj-blist">' + bojeList() + '</div><p><button data-act="bexpall">Export všech bojů</button> <button data-act="bimp">Import bojů</button></p></div>';
  }
  function bojeList() {
    const bf = A.bf || {}, q = (bf.q || "").toLowerCase();
    const L = (A.lib || []).filter(x => (!bf.kampan || x.kampan === bf.kampan) && (!bf.stav || x.stav === bf.stav) && (!q || (x.nazev + " " + pgName(x.kampan) + " " + pgName(x.quest)).toLowerCase().indexOf(q) >= 0));
    if (!L.length) return '<p class="bj-tip">Žádné uložené boje.</p>';
    return L.map(x => { const mm = A.M.mapy[mapById(x.mapa)]; return '<div class="bj-bitem' + (x.id === S.meta.id ? " on" : "") + '"><b>' + esc(x.nazev) + '</b> <span class="bj-bst st-' + esc(x.stav) + '">' + (STAV[x.stav] || x.stav) + "</span><br><small>" + esc(mm ? mm.nazev : x.mapa) + " · kolo " + (x.kola || 0) + " · " + (x.ucastnici || []).length + " žetonů" + (x.kampan ? " · " + esc(pgName(x.kampan)) : "") + (x.quest ? " › " + esc(pgName(x.quest)) : "") + " · " + esc(String(x.upraveno || "").slice(0, 16).replace("T", " ")) + (x.repo ? " · z repa" : "") + "</small><br>"
      + '<button data-act="bload" data-id="' + esc(x.id) + '">Načíst</button> <button data-act="bdup" data-id="' + esc(x.id) + '">Duplikovat</button> ' + (x.stav !== "dokonceno" ? '<button data-act="bstav" data-v="dokonceno" data-id="' + esc(x.id) + '">✓ Dokončeno</button> ' : "") + '<button data-act="bdel" data-id="' + esc(x.id) + '">Smazat</button></div>'; }).join("");
  }

  // ---------- stránka Správa bojů ----------
  function initManager() {
    const host = document.getElementById("boje-app"); if (!host || host.dataset.done) return; host.dataset.done = "1";
    let ix = {}, mapy = [], f = { q: "", stav: "" };
    const nm = (p, list) => { const x = (list || []).find(y => y.cesta === p); return x ? x.nazev : String(p || "").replace(/^.*\/|\.md$/g, "").replace(/_/g, " "); };
    const link = p => p ? '<a href="' + base() + p.replace(/(README)?\.md$/, "") + (p.endsWith("README.md") ? "" : "/").replace(/\/\/$/, "/") + '">' + esc(nm(p, [].concat(ix.kampane || [], ix.questy || [], ix.sezeni || []))) + "</a>" : "";
    function card(x) {
      const m = mapy.find(y => y.id === x.mapa) || {}, alive = (x.ucastnici || []).filter(u => !u.mrtvy);
      return '<div class="bm-card">' + (m.obrazek ? '<img src="' + base() + "11_Mapy/" + esc(m.obrazek) + '" alt="" loading="lazy">' : "") + '<div><b>' + esc(x.nazev) + '</b> <span class="bj-bst st-' + esc(x.stav) + '">' + (STAV[x.stav] || x.stav) + "</span><br><small>" + esc(m.nazev || x.mapa) + " · kolo " + (x.kola || 0) + " · " + (x.kroku || 0) + " kroků v deníku" + (x.sezeni ? " · sezení " + link(x.sezeni) : "") + "</small><br><small>"
        + (x.ucastnici || []).map(u => (u.mrtvy ? "☠ " : "") + esc(u.nazev) + " " + u.hp + "/" + u.max).join(", ") + "</small>" + (x.vysledek ? "<p><i>" + esc(x.vysledek) + "</i></p>" : "") + (x.poznamky ? '<details><summary>Poznámky PJ</summary><p>' + esc(x.poznamky) + "</p></details>" : "")
        + '<p><a class="md-button" href="' + base() + "boj/?boj=" + encodeURIComponent(x.id) + '">Otevřít v bojovém modulu</a> ' + Object.keys(STAV).filter(k => k !== x.stav).map(k => '<button data-st="' + k + '" data-id="' + esc(x.id) + '">→ ' + STAV[k] + "</button>").join(" ") + ' <button data-del="' + esc(x.id) + '">Smazat</button></p></div></div>';
    }
    function draw2() {
      const q = f.q.toLowerCase(), B = (ix.boje || []).filter(x => (!f.stav || x.stav === f.stav) && (!q || JSON.stringify(x).toLowerCase().indexOf(q) >= 0));
      const cnt = k => (ix.boje || []).filter(x => x.stav === k).length;
      let h = '<div class="bm-top"><input data-mq placeholder="Hledat boj, postavu, quest…" value="' + esc(f.q) + '"><select data-ms><option value="">všechny stavy (' + (ix.boje || []).length + ")</option>" + Object.keys(STAV).map(k => '<option value="' + k + '"' + (f.stav === k ? " selected" : "") + ">" + STAV[k] + " (" + cnt(k) + ")</option>").join("") + '</select> <a class="md-button md-button--primary" href="' + base() + 'boj/?novy=1">+ Nový boj</a></div>';
      const groups = {}; B.forEach(x => { const k = x.kampan || ""; (groups[k] = groups[k] || {}); const qk = x.quest || ""; (groups[k][qk] = groups[k][qk] || []).push(x); });
      const ks = Object.keys(groups).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1) || nm(a, ix.kampane).localeCompare(nm(b, ix.kampane)));
      if (!ks.length) h += "<p>Zatím žádné uložené boje. Boj uložíš v bojovém modulu v záložce Boje.</p>";
      ks.forEach(k => {
        h += "<h2>" + (k ? "Kampaň: " + link(k) : "Bez kampaně") + "</h2>";
        Object.keys(groups[k]).sort((a, b) => (a ? 0 : 1) - (b ? 0 : 1)).forEach(qk => {
          h += "<h3>" + (qk ? "Quest: " + link(qk) + ' <a class="bm-new" href="' + base() + "boj/?novy=1&quest=" + encodeURIComponent(qk) + (k ? "&kampan=" + encodeURIComponent(k) : "") + '">+ boj</a>' : "Bez questu") + "</h3>" + groups[k][qk].map(card).join("");
        });
      });
      const free = (ix.questy || []).filter(x => !(ix.boje || []).some(y => y.quest === x.cesta));
      if (free.length) h += "<h2>Questy bez bojů</h2><p>" + free.map(x => link(x.cesta) + ' <a class="bm-new" href="' + base() + "boj/?novy=1&quest=" + encodeURIComponent(x.cesta) + (x.kampan ? "&kampan=" + encodeURIComponent(x.kampan) : "") + '">+ boj</a>').join(" · ") + "</p>";
      host.innerHTML = h;
    }
    host.addEventListener("input", e => { if (e.target.dataset.mq != null) { f.q = e.target.value; draw2(); const i = host.querySelector("[data-mq]"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
    host.addEventListener("change", e => { if (e.target.dataset.ms != null) { f.stav = e.target.value; draw2(); } });
    host.addEventListener("click", e => {
      const st = e.target.closest("[data-st]"), del = e.target.closest("[data-del]");
      if (st) Store.get(st.dataset.id).then(x => { x.stav = st.dataset.st; x.upraveno = new Date().toISOString(); return Store.put(x); }).then(go);
      if (del && confirm("Smazat uložený boj?")) Store.del(del.dataset.id).then(go);
    });
    function go() { return Promise.all([Store.index(), fetch(base() + "11_Mapy/bojove_mapy.json").then(r => r.json())]).then(([i, M]) => { ix = i; mapy = M.mapy; draw2(); }).catch(er => { host.innerHTML = '<p class="bj-warn">Správa bojů se nenačetla: ' + esc(er.message) + "</p>"; }); }
    host.innerHTML = "<p>Načítám…</p>"; go();
  }

  function init() {
    initManager();
    const host = document.getElementById("boj-app"); if (!host || host.dataset.done) return; host.dataset.done = "1"; host.innerHTML = "<p>Načítám bojový modul…</p>";
    const wait = () => window.MontelienPostava && window.MontelienPostava.compute && window.MontelienSRD && window.MontelienKouzla ? Promise.resolve() : new Promise(r => setTimeout(r, 100)).then(wait);
    wait().then(() => Promise.all([
      fetch(base() + "11_Mapy/bojove_mapy.json").then(r => r.json()),
      fetch(base() + "boj_postavy.json").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(base() + "postavy_index.json").then(r => r.ok ? r.json() : []).catch(() => []),
      window.MontelienSRD.load("bestiar"), window.MontelienPostava.rules(), window.MontelienKouzla.load()
    ])).then(([M, P, PI, B, R, K]) => { A = { host, M, P, PI, B, R, K, hist: [] }; load(); load2(); bind(); urlStart().then(() => { draw(); refreshList(); }); })
      .catch(e => { host.innerHTML = '<p class="bj-warn">Bojový modul se nenačetl: ' + esc(e.message) + "</p>"; });
  }
  window.MontelienBoj = { _test: () => ({ A, S, evalAtk, coverOf, bestPlan, dijkstra, monAttacks, checkAttack, attack, undo, logMd, moveTo, summonMon, summonVariants, summonList, castSummon, endConc }) };
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
