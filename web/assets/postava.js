// Character sheet D&D 2024: výpočet odvozených hodnot, vykreslení a formulář pro úpravy
(function () {
  var AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  var AB_CZ = { STR: "Síla", DEX: "Obratnost", CON: "Odolnost", INT: "Inteligence", WIS: "Moudrost", CHA: "Charisma" };
  var AB_EN = { Strength: "STR", Dexterity: "DEX", Constitution: "CON", Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA" };
  var SKILLS = { "Acrobatics": "DEX", "Animal Handling": "WIS", "Arcana": "INT", "Athletics": "STR", "Deception": "CHA", "History": "INT",
    "Insight": "WIS", "Intimidation": "CHA", "Investigation": "INT", "Medicine": "WIS", "Nature": "INT", "Perception": "WIS",
    "Performance": "CHA", "Persuasion": "CHA", "Religion": "INT", "Sleight of Hand": "DEX", "Stealth": "DEX", "Survival": "WIS" };
  var CASTER = { Bard: [1, "CHA"], Cleric: [1, "WIS"], Druid: [1, "WIS"], Sorcerer: [1, "CHA"], Wizard: [1, "INT"], Paladin: [2, "CHA"], Ranger: [2, "WIS"] };
  var THIRD = { "Eldritch Knight": "INT", "Arcane Trickster": "INT" };
  var MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  var SKIP_COLS = ["Proficiency Bonus", "Features", "Class Features", "Cantrips", "Prepared Spells", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "Spell Slots", "Slot Level"];
  var R = null;
  // CR: [cr, AC, HPmax, útok, DPRmax, DC] – metoda „Monster Statistics by Challenge Rating“
  var CRT = [["0",13,6,3,1,13],["1/8",13,35,3,3,13],["1/4",13,49,3,5,13],["1/2",13,70,3,8,13],["1",13,85,3,14,13],["2",13,100,3,20,13],["3",13,115,4,26,13],["4",14,130,5,32,14],["5",15,145,6,38,15],["6",15,160,6,44,15],["7",15,175,6,50,15],["8",16,190,7,56,16],["9",16,205,7,62,16],["10",17,220,7,68,16],["11",17,235,8,74,17],["12",17,250,8,80,17],["13",18,265,8,86,18],["14",18,280,8,92,18],["15",18,295,8,98,18],["16",18,310,9,104,18],["17",19,325,10,110,19],["18",19,340,10,116,19],["19",19,355,10,122,19],["20",19,400,10,140,19],["21",19,445,11,158,20],["22",19,490,11,176,20],["23",19,535,11,194,20],["24",19,580,12,212,21],["25",19,625,12,230,21],["26",19,670,12,248,21],["27",19,715,13,266,22],["28",19,760,13,284,22],["29",19,805,13,302,22],["30",19,850,14,320,23]];
  var XP = {"0":10,"1/8":25,"1/4":50,"1/2":100,"1":200,"2":450,"3":700,"4":1100,"5":1800,"6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,"13":10000,"14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,"20":25000,"21":33000,"22":41000,"23":50000,"24":62000,"25":75000,"26":90000,"27":105000,"28":120000,"29":135000,"30":155000};
  function crIdx(v, col) { for (var i = 0; i < CRT.length; i++) if (v <= CRT[i][col]) return i; return CRT.length - 1; }
  function computeCR(hp, ac, dpr, atk, dc) {
    var di = crIdx(hp, 2); di = Math.max(0, Math.min(CRT.length - 1, di + Math.trunc((ac - CRT[di][1]) / 2)));
    var oi = crIdx(dpr, 4), useDc = dc && (!atk || dc - 8 > atk), dif = useDc ? dc - CRT[oi][5] : atk - CRT[oi][3];
    oi = Math.max(0, Math.min(CRT.length - 1, oi + Math.trunc(dif / 2)));
    var fi = Math.round((di + oi) / 2);
    return { cr: CRT[fi][0], def: CRT[di][0], off: CRT[oi][0], xp: XP[CRT[fi][0]] };
  }

  function base() { var s = document.querySelector('script[src*="assets/postava.js"]'); return s ? s.src.replace(/assets\/postava\.js.*$/, "") : "/"; }
  function rules() {
    return R ? Promise.resolve(R) : fetch(base() + "assets/pravidla2024.json").then(function (r) { return r.json(); }).then(function (j) {
      R = j; var low = {}; Object.keys(j.kouzla).forEach(function (k) { low[k.toLowerCase()] = j.kouzla[k]; });
      R.spell = function (n) { return j.kouzla[n] || low[String(n || "").toLowerCase()]; }; return j; });
  }
  function mod(s) { return Math.floor((Number(s) || 10) - 10) >> 1; }
  function sg(n) { return (n >= 0 ? "+" : "") + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function has(list, name) { return (list || []).some(function (f) { return (f.nazev || f) === name; }); }
  function para(t) { return esc(t).replace(/\n/g, "<br>"); }

  function compute(c) {
    var d = {}, tridy = c.tridy || [];
    d.lvl = tridy.reduce(function (a, t) { return a + (Number(t.uroven) || 0); }, 0) || 1;
    d.pb = 2 + Math.floor((d.lvl - 1) / 4);
    d.mods = {}; AB.forEach(function (a) { d.mods[a] = mod((c.atributy || {})[a]); });
    var first = tridy[0] && R.tridy[tridy[0].trida];
    d.saveProf = (c.zachrany_navic || []).slice();
    if (first) Object.keys(AB_EN).forEach(function (k) { if ((first.core["Saving Throw Proficiencies"] || "").indexOf(k) >= 0) d.saveProf.push(AB_EN[k]); });
    d.saves = {}; AB.forEach(function (a) { d.saves[a] = d.mods[a] + (d.saveProf.indexOf(a) >= 0 ? d.pb : 0); });
    var bardLvl = lvlOf(c, "Bard"), jack = bardLvl >= 2;
    d.skills = {};
    Object.keys(SKILLS).forEach(function (s) {
      var prof = (c.dovednosti || []).indexOf(s) >= 0, exp = (c.expertiza || []).indexOf(s) >= 0;
      d.skills[s] = { val: d.mods[SKILLS[s]] + (prof ? d.pb : 0) + (exp ? d.pb : 0) + (!prof && jack ? Math.floor(d.pb / 2) : 0), prof: prof, exp: exp };
    });
    d.passive = 10 + d.skills.Perception.val;
    d.init = d.mods.DEX + (has(c.featy, "Alert") ? d.pb : 0);
    // AC
    var z = c.zbroj || { typ: "none" }, ac;
    if (z.typ === "heavy") ac = Number(z.zakladni_ac);
    else if (z.typ === "medium") ac = Number(z.zakladni_ac) + Math.min(d.mods.DEX, 2);
    else if (z.typ === "light") ac = Number(z.zakladni_ac) + d.mods.DEX;
    else {
      ac = 10 + d.mods.DEX;
      if (lvlOf(c, "Barbarian")) ac = Math.max(ac, 10 + d.mods.DEX + d.mods.CON);
      if (lvlOf(c, "Monk") && !z.stit) ac = Math.max(ac, 10 + d.mods.DEX + d.mods.WIS);
      if (z.zakladni_ac) ac = Math.max(ac, Number(z.zakladni_ac) + d.mods.DEX);
    }
    if (z.stit) ac += 2;
    if (z.typ && z.typ !== "none" && has(c.featy, "Defense")) ac += 1;
    ac += Number(z.bonus) || 0;
    d.ac = c.ac_rucne || ac;
    // HP
    var hp = 0, dice = {};
    tridy.forEach(function (t, i) {
      var cl = R.tridy[t.trida]; if (!cl) return; var hd = cl.hit_die, n = Number(t.uroven) || 0;
      dice["d" + hd] = (dice["d" + hd] || 0) + n;
      hp += (i === 0 ? hd + (n - 1) * (hd / 2 + 1) : n * (hd / 2 + 1));
    });
    hp += d.lvl * d.mods.CON;
    if (has(c.featy, "Tough")) hp += 2 * d.lvl;
    if (/Dwarf/.test(c.druh || "")) hp += d.lvl;
    if (has(c.featy, "Boon of Fortitude")) hp += 40;
    d.hp = c.hp_rucne || hp; d.hpCalc = hp;
    d.dice = Object.keys(dice).map(function (k) { return dice[k] + k; }).join(" + ");
    // rychlost
    var sp = (R.druhy[c.druh] || {}).rychlost || 30;
    if (/Wood Elf/.test(c.druh_volby || "")) sp += 5;
    if (lvlOf(c, "Barbarian") >= 5 && z.typ !== "heavy") sp += 10;
    var monk = lvlOf(c, "Monk"); if (monk && z.typ === "none") { var um = (row("Monk", monk)["Unarmored Movement"] || "").match(/\d+/); if (um) sp += Number(um[0]); }
    if (has(c.featy, "Speedy")) sp += 10;
    if (has(c.featy, "Boon of Speed")) sp += 30;
    d.speed = c.rychlost_rucne || sp;
    // kouzlení
    d.casting = []; var cl = 0, n = 0, single = null;
    tridy.forEach(function (t) {
      var lv = Number(t.uroven) || 0, k = CASTER[t.trida], th = THIRD[t.podtrida];
      if (k) { n++; single = [t, k[0]]; cl += k[0] === 1 ? lv : Math.ceil(lv / 2); d.casting.push({ trida: t.trida, ab: k[1] }); }
      else if (th && lv >= 3) { n++; single = [t, 3]; cl += Math.floor(lv / 3); d.casting.push({ trida: t.trida + " (" + t.podtrida + ")", ab: th }); }
      if (t.trida === "Warlock") {
        var r = row("Warlock", lv); d.pact = { pocet: r["Spell Slots"], uroven: r["Slot Level"] };
        d.casting.push({ trida: "Warlock", ab: "CHA" });
      }
    });
    if (n === 1) { var lv = Number(single[0].uroven); cl = single[1] === 1 ? lv : single[1] === 2 ? Math.ceil(lv / 2) : Math.ceil(lv / 3); }
    d.slots = MULTI[Math.min(cl, 20)] || [];
    d.casting.forEach(function (x) { x.dc = 8 + d.pb + d.mods[x.ab]; x.atk = d.pb + d.mods[x.ab]; });
    var b = c.boj || {}, bestAtk = 0;
    (c.utoky || []).forEach(function (u) { var a = u.atribut === "FIN" ? Math.max(d.mods.STR, d.mods.DEX) : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0; bestAtk = Math.max(bestAtk, a + d.pb + (Number(u.bonus) || 0)); });
    var bestDc = d.casting.reduce(function (m, x) { return Math.max(m, x.dc); }, 0);
    d.cr = computeCR(d.hp, d.ac, Number(b.dpr) || 0, bestAtk, bestDc);
    return d;
  }
  function lvlOf(c, t) { return (c.tridy || []).filter(function (x) { return x.trida === t; }).reduce(function (a, x) { return a + Number(x.uroven); }, 0); }
  function row(t, lv) { return ((R.tridy[t] || {}).tabulka || {})[lv] || {}; }

  function features(c) {
    var out = [];
    (c.tridy || []).forEach(function (t) {
      var cl = R.tridy[t.trida]; if (!cl) return; var sub = R.podtridy[t.podtrida] || { rysy: {} }, seen = {};
      for (var lv = 1; lv <= Number(t.uroven); lv++) {
        var r = cl.tabulka[lv] || {}, f = r.Features || r["Class Features"] || "";
        f.split(/,\s*(?![^()]*\))/).forEach(function (raw) {
          var name = raw.replace(/\s*\(.*?\)\s*/g, "").trim(); if (!name || name === "-") return;
          if (/Subclass|Arcane Tradition/.test(name)) {
            Object.keys(sub.rysy).forEach(function (k) { if (sub.rysy[k].uroven === lv) out.push({ zdroj: t.podtrida || "Subclass", uroven: lv, nazev: k, text: sub.rysy[k].text }); });
            return;
          }
          if (seen[name]) { seen[name].urovne.push(lv); return; }
          var desc = (cl.rysy[name] || cl.rysy[name.replace(/s$/, "")] || {}).text || "";
          seen[name] = { zdroj: t.trida, uroven: lv, urovne: [lv], nazev: name, text: desc }; out.push(seen[name]);
        });
      }
    });
    return out;
  }

  function render(c, d, cesta) {
    var bg = R.pozadi[c.pozadi] || {}, sp = R.druhy[c.druh] || {}, bj = c.boj || {}, o = c.osobnost || {}, key = "ps-hp:" + (cesta || c.jmeno);
    var initials = String(c.jmeno || "?").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2);
    var h = '<div class="ps ps2">';
    // ---- hlavička ----
    h += '<header class="p2-hero"><div class="p2-crest">' + (c.portret ? '<img src="' + esc(c.portret) + '" alt="">' : '<span>' + esc(initials) + '</span>') + '<div class="p2-lvl" title="Celková úroveň">' + d.lvl + '</div></div>'
      + '<div class="p2-id"><h2 class="p2-name">' + esc(c.jmeno) + '</h2><div class="p2-title">' + esc(c.titul || "") + '</div><div class="p2-chips">'
      + (c.tridy || []).map(function (t) { return '<span class="p2-chip p2-class">' + esc(t.trida) + ' ' + t.uroven + (t.podtrida ? ' · ' + esc(t.podtrida) : '') + '</span>'; }).join("")
      + '<span class="p2-chip">' + esc(c.druh || "—") + '</span><span class="p2-chip">' + esc(c.pozadi || "—") + '</span><span class="p2-chip">' + esc(c.zarovnani || "—") + '</span><span class="p2-chip">' + esc(c.velikost || "Medium") + '</span></div></div>'
      + '<div class="p2-cr"><div class="p2-cr-v" title="obrana CR ' + d.cr.def + ' · útok CR ' + d.cr.off + '">' + d.cr.cr + '</div><div class="p2-cr-l">CR (odhad)</div><div class="p2-cr-x">' + d.cr.xp + ' XP' + (bj.cr_rucne ? '<br>' + esc(bj.cr_rucne) : '') + '</div></div></header>';
    if (cesta && document.body.classList.contains("ed-on")) h += '<div class="ps-edit"><button class="ed-btn ed-primary" data-ps-edit>✎ Upravit postavu</button></div>';
    // ---- životní hodnoty ----
    h += '<div class="p2-vitals"><div class="p2-shield"><div class="p2-v">' + d.ac + '</div><div class="p2-l">Armor Class</div></div>'
      + '<div class="p2-hp ps-hptrack" data-key="' + esc(key) + '" data-max="' + d.hp + '"><div class="p2-l">Hit Points</div><div class="p2-hp-row"><button data-hp="-5">−5</button><button data-hp="-1">−1</button><input class="ps-hpcur" type="number"><span class="p2-hp-max">/ ' + d.hp + '</span><button data-hp="1">+1</button><button data-hp="5">+5</button></div><div class="p2-hpbar"><i></i></div><div class="p2-hp-row p2-small"><label>dočasné <input class="ps-hptmp" type="number"></label><button data-hp="reset" title="Plné HP">↺ plné</button></div></div>'
      + stat("Iniciativa", '<a class="ps-roll" data-roll="1d20' + sg(d.init) + '" data-label="Iniciativa">' + sg(d.init) + '</a>') + stat("Rychlost", d.speed + ' ft') + stat("Proficiency", sg(d.pb)) + stat("Pasivní Perception", d.passive) + stat("Hit Dice", d.dice) + stat("DPR", esc(bj.dpr || "?")) + '</div>';
    // ---- atributy ----
    h += '<div class="p2-abil">' + AB.map(function (a) { return '<div class="p2-ab"><div class="p2-ab-n">' + AB_CZ[a] + '</div><a class="p2-ab-mod ps-roll" data-roll="1d20' + sg(d.mods[a]) + '" data-label="' + AB_CZ[a] + '">' + sg(d.mods[a]) + '</a><div class="p2-ab-s">' + esc((c.atributy || {})[a]) + '</div><a class="p2-ab-save ps-roll' + (d.saveProf.indexOf(a) >= 0 ? ' p' : '') + '" data-roll="1d20' + sg(d.saves[a]) + '" data-label="Záchrana ' + a + '">záchrana ' + sg(d.saves[a]) + '</a></div>'; }).join("") + '</div>';
    // ---- záložky ----
    var tabs = [];
    // Boj
    var atk = '<table class="p2-tab"><tr><th>Útok</th><th>Zásah</th><th>Zranění</th><th>Mastery / pozn.</th></tr>' + (c.utoky || []).map(function (u) {
      var a = u.atribut === "FIN" ? Math.max(d.mods.STR, d.mods.DEX) : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0;
      var bon = a + d.pb + (Number(u.bonus) || 0), dm = (u.bez_modu ? 0 : a) + (Number(u.bonus) || 0) + (Number(u.bonus_zraneni) || 0);
      return '<tr><td><b>' + esc(u.nazev) + '</b>' + (u.dosah ? '<br><small>' + esc(u.dosah) + '</small>' : '') + '</td><td>' + (u.bez_hodu ? "—" : '<a class="p2-pill ps-roll" data-roll="1d20' + sg(bon) + '" data-label="' + esc(u.nazev) + ' – útok">' + sg(bon) + '</a>') + '</td><td>' + (u.kostka ? '<a class="p2-pill p2-dmg ps-roll" data-roll="' + esc(u.kostka) + (dm ? sg(dm) : "") + '" data-label="' + esc(u.nazev) + ' – zásah">' + esc(u.kostka) + (dm ? " " + sg(dm) : "") + '</a> ' : '') + '<small>' + esc(u.typ || "") + '</small></td><td><small>' + esc([u.mastery, u.poznamka].filter(Boolean).join(" · ")) + '</small></td></tr>';
    }).join("") + '</table>';
    var res = [];
    (c.tridy || []).forEach(function (t) { var r = row(t.trida, t.uroven); Object.keys(r).forEach(function (k) { if (SKIP_COLS.indexOf(k) < 0 && r[k] && r[k] !== "-") res.push([t.trida + ": " + k, r[k]]); }); });
    (c.zdroje || []).forEach(function (z) { res.push([z.nazev, z.pocet + (z.obnova ? " / " + z.obnova : "")]); });
    tabs.push(["Boj", '<div class="p2-2col"><div>' + card("Útoky", atk) + (res.length ? card("Zdroje povolání", '<ul class="p2-res">' + res.map(function (r) { return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></li>"; }).join("") + '</ul>') : '') + '</div><div>'
      + card("V tahu", actList("Akce", bj.akce) + actList("Bonusové akce", bj.bonusove_akce) + actList("Reakce", bj.reakce) + actList("Legendární akce", bj.legendarni) + (bj.taktika ? '<p class="p2-tactic">' + para(bj.taktika) + '</p>' : '')) + '</div></div>']);
    // Dovednosti
    tabs.push(["Dovednosti", '<div class="p2-2col"><div>' + card("Dovednosti", '<ul class="p2-skills">' + Object.keys(SKILLS).sort().map(function (s) { var k = d.skills[s]; return '<li class="' + (k.exp ? "e" : k.prof ? "p" : "") + '"><i></i><span>' + s + ' <small>' + SKILLS[s] + '</small></span><a class="ps-roll" data-roll="1d20' + sg(k.val) + '" data-label="' + s + '">' + sg(k.val) + '</a></li>'; }).join("") + '</ul>') + '</div><div>'
      + card("Výcvik a zdatnosti", '<dl class="p2-dl"><dt>Zbroj</dt><dd>' + esc(train(c, "Armor Training")) + '</dd><dt>Zbraně</dt><dd>' + esc(train(c, "Weapon Proficiencies")) + '</dd>' + (c.mastery && c.mastery.length ? '<dt>Weapon Mastery</dt><dd>' + esc(c.mastery.join(", ")) + '</dd>' : '') + '<dt>Nástroje</dt><dd>' + esc((c.nastroje || []).join(", ") || "—") + '</dd><dt>Jazyky</dt><dd>' + esc((c.jazyky || []).join(", ") || "—") + '</dd>' + (c.zbroj && c.zbroj.nazev ? '<dt>Zbroj na sobě</dt><dd>' + esc(c.zbroj.nazev) + (c.zbroj.stit ? " + Shield" : "") + '</dd>' : '') + '</dl>') + '</div></div>']);
    // Kouzla
    if (d.casting.length || (c.kouzla || []).length) {
      var s = '<div class="p2-cast">' + d.casting.map(function (x) { var r = row(x.trida.split(" ")[0], lvlOf(c, x.trida.split(" ")[0])); return '<div class="p2-castbox"><div class="p2-l">' + esc(x.trida) + ' · ' + x.ab + '</div><div><b>DC ' + x.dc + '</b> · útok <a class="ps-roll" data-roll="1d20' + sg(x.atk) + '" data-label="Spell attack">' + sg(x.atk) + '</a></div><small>' + (r["Prepared Spells"] ? "připravených " + r["Prepared Spells"] : "") + (r.Cantrips ? " · cantripů " + r.Cantrips : "") + '</small></div>'; }).join("") + '</div>';
      var byLvl = {}; (c.kouzla || []).forEach(function (k) { var l = k.uroven != null ? Number(k.uroven) : ((R.spell(k.nazev) || {}).uroven); if (l == null) l = "?"; (byLvl[l] = byLvl[l] || []).push(k); });
      s += '<div class="p2-spells">';
      for (var l = 0; l <= 9; l++) {
        var slots = l ? (d.slots[l - 1] || 0) : 0, pact = d.pact && Number(d.pact.uroven) === l ? Number(d.pact.pocet) : 0;
        if (!byLvl[l] && !slots && !pact) continue;
        s += '<div class="p2-sl"><div class="p2-sl-h"><span>' + (l ? l + '. úroveň' : 'Cantripy') + '</span><span class="p2-pips" data-k="' + esc(key + ':s' + l) + '">' + pips(slots) + (pact ? ' <em title="Pact Magic">pakt ' + pips(pact) + '</em>' : '') + '</span></div><ul>' + (byLvl[l] || []).map(function (k) { var r = R.spell(k.nazev); return '<li><a href="#" class="kz-link" data-kouzlo="' + esc(k.nazev) + '">' + esc(k.nazev) + '</a>' + (r ? ' <small>' + esc(r.skola) + '</small>' : ' <small class="ps-warn">mimo seznam 2024?</small>') + (k.poznamka ? ' <small>– ' + esc(k.poznamka) + '</small>' : '') + '</li>'; }).join("") + '</ul></div>';
      }
      if (byLvl["?"]) s += '<div class="p2-sl"><div class="p2-sl-h">Neznámá úroveň</div><ul>' + byLvl["?"].map(function (k) { return "<li>" + esc(k.nazev) + "</li>"; }).join("") + '</ul></div>';
      tabs.push(["Kouzla", s + '</div>']);
    }
    // Rysy
    var feats = features(c);
    tabs.push(["Rysy", '<div class="p2-2col"><div>' + card("Rysy povolání", feats.map(function (f) { return det(f.nazev + ' <small>' + esc(f.zdroj) + ' ' + (f.urovne ? f.urovne.join(", ") : f.uroven) + '</small>', f.text); }).join("")) + '</div><div>'
      + card("Rysy druhu – " + esc(c.druh), Object.keys(sp.rysy || {}).map(function (k) { return det(k, sp.rysy[k]); }).join("") + (c.druh_volby ? '<p class="ps-note">Volba: ' + esc(c.druh_volby) + '</p>' : ''))
      + card("Featy", (c.featy || []).map(function (f) { var r = R.featy[f.nazev] || {}; return det(esc(f.nazev) + ' <small>' + esc(f.zdroj || "") + '</small>', (f.poznamka ? "Volba: " + f.poznamka + "\n\n" : "") + (r.text || "")); }).join(""))
      + (c.vlastni_rysy && c.vlastni_rysy.length ? card("Zvláštní a božské rysy", c.vlastni_rysy.map(function (f) { return det(esc(f.nazev), f.text); }).join("")) : '') + '</div></div>']);
    // Výbava
    tabs.push(["Výbava", '<div class="p2-2col"><div>' + card("Výbava", '<ul class="p2-gear">' + (c.vybava || []).map(function (v) { return "<li>" + esc(v) + "</li>"; }).join("") + '</ul>') + '</div><div>' + (c.penize ? card("Peníze", '<div class="p2-coins">' + Object.keys(c.penize).map(function (k) { return '<span><b>' + esc(c.penize[k]) + '</b> ' + esc(k) + '</span>'; }).join("") + '</div>') : '') + '</div></div>']);
    // Příběh
    tabs.push(["Příběh", '<div class="p2-2col"><div>' + card("Osobnost", '<dl class="p2-dl"><dt>Rysy</dt><dd>' + esc(o.rysy || "—") + '</dd><dt>Ideály</dt><dd>' + esc(o.idealy || "—") + '</dd><dt>Pouta</dt><dd>' + esc(o.pouta || "—") + '</dd><dt>Vady</dt><dd>' + esc(o.vady || "—") + '</dd></dl>') + (c.vzhled ? card("Vzhled", '<p>' + para(c.vzhled) + '</p>') : '') + '</div><div>'
      + card("Pozadí: " + esc(c.pozadi || "—"), bg.feat ? '<dl class="p2-dl"><dt>Atributy</dt><dd>' + esc(bg.atributy) + '</dd><dt>Origin feat</dt><dd>' + esc(bg.feat) + '</dd><dt>Dovednosti</dt><dd>' + esc(bg.dovednosti) + '</dd><dt>Nástroj</dt><dd>' + esc(bg.nastroj) + '</dd></dl>' : '<p>—</p>')
      + (c.puvod_atributu || c.prevod_2024 || c.poznamky ? card("Poznámky", (c.puvod_atributu ? '<p><b>Atributy:</b> ' + para(c.puvod_atributu) + '</p>' : '') + (c.prevod_2024 ? '<p><b>Převod na 2024:</b> ' + para(c.prevod_2024) + '</p>' : '') + (c.poznamky ? '<p>' + para(c.poznamky) + '</p>' : '')) : '') + '</div></div>']);
    h += '<nav class="p2-tabs">' + tabs.map(function (x, i) { return '<button class="p2-tabbtn' + (i ? '' : ' on') + '" data-tab="' + i + '">' + x[0] + '</button>'; }).join("") + '<button class="p2-tabbtn" data-tab="all" title="Zobrazit vše (i pro tisk)">Vše (tisk)</button></nav>';
    h += tabs.map(function (x, i) { return '<section class="p2-pane' + (i ? '' : ' on') + '" data-pane="' + i + '"><h3 class="p2-pane-h">' + x[0] + '</h3>' + x[1] + '</section>'; }).join("");
    return h + '</div>';
  }
  function stat(l, v) { return '<div class="p2-stat"><div class="p2-v">' + v + '</div><div class="p2-l">' + l + '</div></div>'; }
  function card(t, body) { return '<section class="p2-card"><h4>' + t + '</h4>' + body + '</section>'; }
  function actList(t, arr) { if (!arr || !arr.length) return ""; return '<div class="p2-act"><div class="p2-act-h">' + t + '</div>' + arr.map(function (a) { return '<p>' + (typeof a === "string" ? esc(a) : '<b>' + esc(a.nazev) + '.</b> ' + esc(a.text || "")) + '</p>'; }).join("") + '</div>'; }
  function sheetUi(root) {
    if (root.dataset.ui) { restorePips(root); return; } root.dataset.ui = "1";
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".p2-tabbtn"); if (b) {
        root.querySelectorAll(".p2-tabbtn").forEach(function (x) { x.classList.toggle("on", x === b); });
        root.querySelectorAll(".p2-pane").forEach(function (p) { p.classList.toggle("on", b.dataset.tab === "all" || p.dataset.pane === b.dataset.tab); });
        root.querySelector(".ps2").classList.toggle("p2-all", b.dataset.tab === "all");
      }
      var pip = e.target.closest(".p2-pip"); if (pip) { pip.classList.toggle("used"); var w = pip.closest(".p2-pips"); localStorage.setItem(w.dataset.k, w.querySelectorAll(".used").length); }
    });
    restorePips(root);
  }
  function restorePips(root) { root.querySelectorAll(".p2-pips").forEach(function (w) { var n = Number(localStorage.getItem(w.dataset.k) || 0); w.querySelectorAll(".p2-pip").forEach(function (p, i) { if (i < n) p.classList.add("used"); }); }); }
  function fightList(t, arr) { if (!arr || !arr.length) return ""; return '<div class="ps-fl"><b>' + t + ':</b><ul>' + arr.map(function (a) { return "<li>" + (typeof a === "string" ? esc(a) : "<b>" + esc(a.nazev) + ".</b> " + esc(a.text || "")) + "</li>"; }).join("") + '</ul></div>'; }
  function roll(expr) {
    var m = String(expr).replace(/\s/g, "").match(/^(\d*)d(\d+)([+-]\d+)?$/); if (!m) return null;
    var n = Number(m[1] || 1), s = Number(m[2]), rolls = [], sum = 0;
    for (var i = 0; i < n; i++) { var r = 1 + Math.floor(Math.random() * s); rolls.push(r); sum += r; }
    return { total: sum + Number(m[3] || 0), rolls: rolls, mod: Number(m[3] || 0) };
  }
  function toast(html) { var e = document.createElement("div"); e.className = "ps-toast"; e.innerHTML = html; document.body.appendChild(e); setTimeout(function () { e.remove(); }, 4000); }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".ps-roll"); if (!a) return; e.preventDefault();
    var r = roll(a.dataset.roll); if (!r) return;
    var crit = /^1d20/.test(a.dataset.roll) && r.rolls[0] === 20 ? " <b>KRITICKÝ!</b>" : /^1d20/.test(a.dataset.roll) && r.rolls[0] === 1 ? " <b>fail</b>" : "";
    toast((a.dataset.label || a.dataset.roll) + ": <b>" + r.total + "</b> <small>[" + r.rolls.join(", ") + "]" + (r.mod ? sg(r.mod) : "") + "</small>" + crit);
  });
  function hpTracker(root) {
    var w = root.querySelector(".ps-hptrack"); if (!w) return;
    var key = w.dataset.key, max = Number(w.dataset.max), cur = w.querySelector(".ps-hpcur"), tmp = w.querySelector(".ps-hptmp");
    var st = JSON.parse(localStorage.getItem(key) || "null") || { hp: max, tmp: "" };
    function save() { localStorage.setItem(key, JSON.stringify(st)); cur.value = st.hp; tmp.value = st.tmp; w.classList.toggle("ps-bloodied", st.hp <= max / 2); w.classList.toggle("ps-down", st.hp <= 0); var bar = w.querySelector(".p2-hpbar i"); if (bar) bar.style.width = Math.max(0, Math.min(100, 100 * st.hp / max)) + "%"; }
    w.addEventListener("click", function (e) {
      var b = e.target.dataset.hp; if (!b) return;
      if (b === "reset") { st.hp = max; st.tmp = ""; }
      else { var v = Number(b); if (v < 0 && Number(st.tmp) > 0) { var left = Number(st.tmp) + v; st.tmp = left > 0 ? left : ""; v = Math.min(0, left); } st.hp = Math.max(0, Math.min(max, st.hp + v)); }
      save();
    });
    cur.addEventListener("change", function () { st.hp = Number(cur.value); save(); });
    tmp.addEventListener("change", function () { st.tmp = tmp.value; save(); });
    save();
  }
  function box(l, v, cls) { return '<div class="ps-box ' + (cls || "") + '"><div class="ps-lbl">' + l + '</div><div class="ps-val">' + v + '</div></div>'; }
  function sect(t, body) { return '<section class="ps-sect"><h4>' + t + '</h4>' + body + '</section>'; }
  function det(t, body) { return '<details><summary>' + t + '</summary><div>' + para(body || "") + '</div></details>'; }
  function pips(n) { var s = ""; for (var i = 0; i < n; i++) s += '<i class="p2-pip" title="Klikni = slot použit"></i>'; return s; }
  function train(c, key) { var t = c.tridy && c.tridy[0] && R.tridy[c.tridy[0].trida]; return t ? t.core[key] || "—" : "—"; }

  // ---------- formulář ----------
  function editor(c, cesta) {
    var E = window.MontelienEditor; if (!E) return;
    var data = JSON.parse(JSON.stringify(c)), el = E.el, body = el("div", { class: "pf" });
    var tabs = el("div", { class: "pf-tabs" }), panes = el("div");
    function tab(name, build) {
      var b = el("button", { class: "ed-btn" }, name), p = el("div", { class: "pf-pane" }); build(p);
      b.addEventListener("click", function () { panes.querySelectorAll(".pf-pane").forEach(function (x) { x.style.display = "none"; }); p.style.display = ""; });
      tabs.appendChild(b); panes.appendChild(p); if (panes.children.length > 1) p.style.display = "none";
    }
    function field(p, obj, key, label, type, opts) {
      var l = el("label", {}, label), i;
      if (opts) { i = el("select"); [""].concat(opts).forEach(function (o) { var op = el("option", { value: o }, o || "—"); if (o === obj[key]) op.selected = true; i.appendChild(op); }); }
      else if (type === "area") { i = el("textarea", { rows: 3 }); i.value = obj[key] || ""; }
      else if (type === "check") { i = el("input", { type: "checkbox" }); i.checked = !!obj[key]; }
      else { i = el("input", { type: type || "text" }); i.value = obj[key] != null ? obj[key] : ""; }
      i.addEventListener("change", function () { obj[key] = type === "check" ? i.checked : type === "number" ? (i.value === "" ? null : Number(i.value)) : i.value; if (obj[key] === "" || obj[key] === null) delete obj[key]; });
      l.appendChild(i); p.appendChild(l); return i;
    }
    function list(p, obj, key, label, cols) {
      obj[key] = obj[key] || []; var wrap = el("div", { class: "pf-list" }); wrap.appendChild(el("h5", {}, label));
      var tbl = el("table", { class: "ed-table" }); wrap.appendChild(tbl);
      function draw() {
        tbl.innerHTML = "<tr>" + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "<th></th></tr>";
        obj[key].forEach(function (it, idx) {
          var tr = el("tr");
          cols.forEach(function (cdef) {
            var td = el("td"), k = cdef[0], i;
            if (cdef[2] === "check") { i = el("input", { type: "checkbox" }); i.checked = !!it[k]; }
            else if (Array.isArray(cdef[2])) { i = el("select"); [""].concat(cdef[2]).forEach(function (o) { var op = el("option", { value: o }, o || "—"); if (o === it[k]) op.selected = true; i.appendChild(op); }); }
            else { i = el("input", { type: cdef[2] === "number" ? "number" : "text" }); i.value = it[k] != null ? it[k] : ""; }
            i.addEventListener("change", function () { it[k] = cdef[2] === "check" ? i.checked : cdef[2] === "number" ? Number(i.value) : i.value; });
            td.appendChild(i); tr.appendChild(td);
          });
          var td = el("td"); td.appendChild(el("button", { class: "ed-btn ed-danger", on: { click: function () { obj[key].splice(idx, 1); draw(); } } }, "×")); tr.appendChild(td);
          tbl.appendChild(tr);
        });
      }
      draw();
      wrap.appendChild(el("button", { class: "ed-btn", on: { click: function () { var o = {}; cols.forEach(function (c) { o[c[0]] = c[2] === "number" ? 0 : ""; }); obj[key].push(o); draw(); } } }, "+ přidat"));
      p.appendChild(wrap);
    }
    function strList(p, obj, key, label) {
      var l = el("label", {}, label + " <small>(jedna položka na řádek)</small>"), t = el("textarea", { rows: 5 });
      t.value = (obj[key] || []).join("\n"); t.addEventListener("change", function () { obj[key] = t.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean); });
      l.appendChild(t); p.appendChild(l);
    }
    var classes = Object.keys(R.tridy), subs = Object.keys(R.podtridy).sort(), species = Object.keys(R.druhy).sort(), bgs = Object.keys(R.pozadi).sort(), feats = Object.keys(R.featy).sort();
    tab("Základ", function (p) {
      field(p, data, "jmeno", "Jméno"); field(p, data, "titul", "Titul / role");
      var ds = field(p, data, "druh", "Druh (Species) – PHB 2024 nebo vlastní"); ds.setAttribute("list", "pf-species");
      var dl = el("datalist", { id: "pf-species" }); species.forEach(function (s) { dl.appendChild(el("option", { value: s })); }); p.appendChild(dl);
      field(p, data, "druh_volby", "Volby druhu (lineage, ancestry…)"); field(p, data, "pozadi", "Pozadí (Background)", null, bgs);
      field(p, data, "zarovnani", "Přesvědčení (alignment)"); field(p, data, "velikost", "Velikost", null, ["Small", "Medium", "Large"]);
      field(p, data, "vzhled", "Vzhled", "area"); field(p, data, "prevod_2024", "Převod na 2024", "area");
    });
    tab("Povolání a atributy", function (p) {
      list(p, data, "tridy", "Povolání", [["trida", "Třída", classes], ["uroven", "Úroveň", "number"], ["podtrida", "Subclass", subs]]);
      data.atributy = data.atributy || {}; var g = el("div", { class: "pf-abil" });
      AB.forEach(function (a) { field(g, data.atributy, a, AB_CZ[a] + " (" + a + ")", "number"); }); p.appendChild(g);
      field(p, data, "puvod_atributu", "Původ atributů (array/point buy, pozadí, ASI)", "area");
      var sv = el("div", { class: "pf-checks" }); sv.appendChild(el("h5", {}, "Záchranné hody navíc (Resilient apod.)"));
      AB.forEach(function (a) { var l = el("label", {}, " " + a), i = el("input", { type: "checkbox" }); i.checked = (data.zachrany_navic || []).indexOf(a) >= 0; i.addEventListener("change", function () { data.zachrany_navic = AB.filter(function (x) { return x === a ? i.checked : (data.zachrany_navic || []).indexOf(x) >= 0; }); }); l.prepend(i); sv.appendChild(l); });
      p.appendChild(sv);
    });
    tab("Dovednosti a featy", function (p) {
      var g = el("div", { class: "pf-checks pf-skills" }); g.appendChild(el("h5", {}, "Dovednosti: proficiency / expertise"));
      Object.keys(SKILLS).forEach(function (s) {
        var l = el("label", {}), a = el("input", { type: "checkbox" }), b = el("input", { type: "checkbox", title: "Expertise" });
        a.checked = (data.dovednosti || []).indexOf(s) >= 0; b.checked = (data.expertiza || []).indexOf(s) >= 0;
        a.addEventListener("change", function () { data.dovednosti = Object.keys(SKILLS).filter(function (x) { return x === s ? a.checked : (data.dovednosti || []).indexOf(x) >= 0; }); });
        b.addEventListener("change", function () { data.expertiza = Object.keys(SKILLS).filter(function (x) { return x === s ? b.checked : (data.expertiza || []).indexOf(x) >= 0; }); });
        l.appendChild(a); l.appendChild(b); l.appendChild(document.createTextNode(" " + s + " (" + SKILLS[s] + ")")); g.appendChild(l);
      });
      p.appendChild(g);
      list(p, data, "featy", "Featy", [["nazev", "Feat", feats], ["zdroj", "Odkud (pozadí, úroveň…)"], ["poznamka", "Volba / poznámka"]]);
      strList(p, data, "mastery", "Weapon Mastery"); strList(p, data, "jazyky", "Jazyky"); strList(p, data, "nastroje", "Nástroje");
    });
    tab("Boj", function (p) {
      data.zbroj = data.zbroj || { typ: "none" };
      field(p, data.zbroj, "nazev", "Zbroj"); field(p, data.zbroj, "typ", "Typ zbroje", null, ["none", "light", "medium", "heavy"]);
      field(p, data.zbroj, "zakladni_ac", "Základní AC zbroje", "number"); field(p, data.zbroj, "stit", "Štít (+2)", "check"); field(p, data.zbroj, "bonus", "Bonus k AC (magie…)", "number");
      field(p, data, "ac_rucne", "AC ručně (přepíše výpočet)", "number"); field(p, data, "hp_rucne", "HP ručně (přepíše výpočet)", "number"); field(p, data, "rychlost_rucne", "Rychlost ručně", "number");
      list(p, data, "utoky", "Útoky", [["nazev", "Název"], ["atribut", "Atribut", ["STR", "DEX", "FIN", "SPELL", "CON", "INT", "WIS", "CHA"]], ["kostka", "Kostka"], ["typ", "Typ zranění"], ["mastery", "Mastery"], ["dosah", "Dosah"], ["bonus", "Bonus (útok i zásah)", "number"], ["bonus_zraneni", "Bonus jen k zásahu", "number"], ["poznamka", "Pozn."]]);
      list(p, data, "zdroje", "Další zdroje", [["nazev", "Název"], ["pocet", "Počet"], ["obnova", "Obnova"]]);
    });
    tab("Připravenost na boj", function (p) {
      data.boj = data.boj || {};
      field(p, data.boj, "dpr", "Průměrné zranění za kolo (DPR) – pro výpočet CR", "number"); field(p, data.boj, "cr_rucne", "CR ručně / avatar (volitelné)");
      [["akce", "Akce"], ["bonusove_akce", "Bonusové akce"], ["reakce", "Reakce"], ["legendarni", "Legendární akce"]].forEach(function (x) { list(p, data.boj, x[0], x[1], [["nazev", "Název"], ["text", "Popis"]]); });
      field(p, data.boj, "taktika", "Taktika", "area");
    });
    tab("Kouzla", function (p) {
      p.appendChild(el("p", { class: "ed-pozn" }, "Úroveň se doplní ze seznamu kouzel 2024, když ji necháš prázdnou."));
      list(p, data, "kouzla", "Kouzla", [["nazev", "Kouzlo"], ["uroven", "Úroveň"], ["trida", "Třída"], ["poznamka", "Pozn."]]);
    });
    tab("Výbava a osobnost", function (p) {
      strList(p, data, "vybava", "Výbava");
      data.penize = data.penize || {}; ["GP", "SP", "CP", "PP"].forEach(function (k) { field(p, data.penize, k, k, "number"); });
      data.osobnost = data.osobnost || {}; [["rysy", "Rysy osobnosti"], ["idealy", "Ideály"], ["pouta", "Pouta"], ["vady", "Vady"]].forEach(function (x) { field(p, data.osobnost, x[0], x[1], "area"); });
      field(p, data, "poznamky", "Poznámky", "area");
    });
    tab("Vlastní rysy", function (p) { list(p, data, "vlastni_rysy", "Zvláštní / božské rysy", [["nazev", "Název"], ["text", "Popis"]]); });
    var raw;
    tab("Vše (JSON)", function (p) {
      p.appendChild(el("p", { class: "ed-pozn" }, "Úplná data postavy. Úprava tady má přednost před ostatními záložkami."));
      raw = el("textarea", { rows: 24, class: "pf-raw" }); raw.value = JSON.stringify(data, null, 2); raw.dataset.orig = raw.value; p.appendChild(raw);
    });
    body.appendChild(tabs); body.appendChild(panes);
    var m = E.modal("Upravit postavu – " + (c.jmeno || ""), body, [{ text: "Uložit", primary: true, click: function () {
      var out = data;
      if (raw && raw.value !== raw.dataset.orig) { try { out = JSON.parse(raw.value); } catch (e) { return alert("Chybný JSON: " + e.message); } }
      document.body.classList.add("ed-busy");
      E.api("PUT", "postava", { cesta: cesta, postava: out }).then(function () { location.reload(); })
        .catch(function (e) { document.body.classList.remove("ed-busy"); alert("Chyba: " + e.message); });
    } }]);
    m.box.classList.add("ed-wide");
  }

  function init() {
    var holder = document.querySelector(".postava-sheet"), dataEl = document.querySelector(".postava-data");
    if (!holder || !dataEl || holder.dataset.done) return;
    holder.dataset.done = "1";
    var c = JSON.parse(dataEl.textContent), src = document.getElementById("zdroj-stranky"), cesta = src && src.dataset.cesta;
    rules().then(function () {
      var draw = function () {
        holder.innerHTML = render(c, compute(c), cesta); hpTracker(holder); sheetUi(holder);
        var b = holder.querySelector("[data-ps-edit]"); if (b) b.addEventListener("click", function () { editor(c, cesta); });
      };
      draw();
      var tries = 0, t = setInterval(function () { if (document.body.classList.contains("ed-on") || ++tries > 20) { clearInterval(t); if (document.body.classList.contains("ed-on")) draw(); } }, 150);
    });
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
