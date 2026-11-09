// Character sheet D&D 2024: výpočet odvozených hodnot, vykreslení a formulář pro úpravy
(function () {
  var AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  var AB_CZ = { STR: "Síla", DEX: "Obratnost", CON: "Odolnost", INT: "Inteligence", WIS: "Moudrost", CHA: "Charisma" };
  var AB_EN = { Strength: "STR", Dexterity: "DEX", Constitution: "CON", Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA" };
  var SKILLS = { "Acrobatics": "DEX", "Animal Handling": "WIS", "Arcana": "INT", "Athletics": "STR", "Deception": "CHA", "History": "INT",
    "Insight": "WIS", "Intimidation": "CHA", "Investigation": "INT", "Medicine": "WIS", "Nature": "INT", "Perception": "WIS",
    "Performance": "CHA", "Persuasion": "CHA", "Religion": "INT", "Sleight of Hand": "DEX", "Stealth": "DEX", "Survival": "WIS" };
  var CONDITIONS = ["Blinded", "Charmed", "Deafened", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];
  var XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  var CASTER = { Bard: [1, "CHA"], Cleric: [1, "WIS"], Druid: [1, "WIS"], Sorcerer: [1, "CHA"], Wizard: [1, "INT"], Paladin: [2, "CHA"], Ranger: [2, "WIS"] };
  var THIRD = { "Eldritch Knight": "INT", "Arcane Trickster": "INT" };
  var MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  var SKIP_COLS = ["Proficiency Bonus", "Features", "Class Features", "Cantrips", "Prepared Spells", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "Spell Slots", "Slot Level"];
  var R = null, CS = {};
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
      R = j; if (window.MontelienPravidla) window.MontelienPravidla.init(j).setSpells(j.kouzla); var low = {}; Object.keys(j.kouzla).forEach(function (k) { low[k.toLowerCase()] = j.kouzla[k]; });
      R.spell = function (n) { return j.kouzla[n] || low[String(n || "").toLowerCase()]; };
      return fetch(base() + "assets/preklad/pravidla_cs.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (cs) {
        CS = cs || {};
        return fetch(base() + "assets/kouzla2024.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (spells) {
          R.spellDetails = spells || {}; R.spellDetailsLow = {};
          Object.keys(R.spellDetails).forEach(function (n) { R.spellDetailsLow[n.toLowerCase()] = R.spellDetails[n]; });
          return j;
        });
      }); });
  }
  function mod(s) { return Math.floor((Number(s) || 10) - 10) >> 1; }
  function sg(n) { return (n >= 0 ? "+" : "") + n; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function speciesSort(a, b) {
    var al = !!(R.druhy[a] && R.druhy[a].legacy), bl = !!(R.druhy[b] && R.druhy[b].legacy);
    return al === bl ? a.localeCompare(b) : al ? 1 : -1;
  }
  function speciesLabel(name) { return name + ((R.druhy[name] || {}).legacy ? " — legacy, kompatibilní" : ""); }
  function has(list, name) { return (list || []).some(function (f) { return (f.nazev || f) === name; }); }
  function para(t) { return esc(t).replace(/\n/g, "<br>"); }
  function sessionState(key) {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(key + ":session") || "{}") || {}; } catch (e) {}
    return {
      inspiration: !!s.inspiration,
      successes: Math.max(0, Math.min(3, Number(s.successes) || 0)),
      failures: Math.max(0, Math.min(3, Number(s.failures) || 0)),
      exhaustion: Math.max(0, Math.min(6, Number(s.exhaustion) || 0)),
      conditions: Array.isArray(s.conditions) ? s.conditions.filter(function (x) { return CONDITIONS.indexOf(x) >= 0; }) : [],
      concentrating: !!s.concentrating,
      concentrationSpell: String(s.concentrationSpell || "")
    };
  }
  function saveSession(key, state) { localStorage.setItem(key + ":session", JSON.stringify(state)); }
  function spellMeta(name) { return R.spellDetails[name] || R.spellDetailsLow[String(name || "").toLowerCase()] || null; }
  function listValues(value) {
    return Array.isArray(value) ? value.map(String).map(function (x) { return x.trim(); }).filter(Boolean) : String(value || "").split(/[\n,]/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function sensesFor(c, species) {
    var senses = listValues(c.smysly);
    Object.keys(species.rysy || {}).forEach(function (name) {
      if (!/^(Darkvision|Blindsight|Tremorsense|Truesight)$/i.test(name)) return;
      var range = String(species.rysy[name]).match(/(\d+)\s*(?:feet|ft\.?)/i);
      senses.push(name + (range ? " " + range[1] + " ft" : ""));
    });
    return senses.filter(function (x, i) { return senses.indexOf(x) === i; });
  }
  function concentrationSpells(c) {
    return (c.kouzla || []).map(function (k) { var m = spellMeta(k.nazev); return m && /concentration/i.test(m.trvani || "") ? k.nazev : ""; }).filter(Boolean);
  }
  function inspirationHtml(key) {
    var active = sessionState(key).inspiration;
    return '<button type="button" class="p2-inspiration' + (active ? " on" : "") + '" data-inspiration aria-pressed="' + active + '"><span aria-hidden="true">' + (active ? "★" : "☆") + '</span> Inspirace</button>';
  }
  function trackerHtml(c, key) {
    var s = sessionState(key), known = concentrationSpells(c), spellOptions = known.map(function (n) { return '<option value="' + esc(n) + '"' + (s.concentrationSpell === n ? " selected" : "") + '>' + esc(n) + '</option>'; }).join(""),
      concentrationInput = known.length ? '<select data-concentration-spell><option value="">Vyber kouzlo</option>' + spellOptions + '</select>' : '<input data-concentration-spell type="text" value="' + esc(s.concentrationSpell) + '" placeholder="Spell name">';
    var activeConditions = s.conditions.map(function (name) {
      return '<span class="p2-condition on"><button type="button" data-condition="' + esc(name) + '" aria-label="Remove ' + esc(name) + '">' + esc(name) + ' ×</button><a href="#srd-glosar-' + encodeURIComponent(name).replace(/%20/g, "_") + '" aria-label="Glossary: ' + esc(name) + '" title="Open glossary">?</a></span>';
    }).join(""), available = CONDITIONS.filter(function (name) { return s.conditions.indexOf(name) < 0; });
    return '<div class="p2-trackers p2-status"><div class="p2-tr-card p2-death-card"><b>Death Saves</b><div class="p2-death"><span aria-label="Successes">✓</span>' + [1, 2, 3].map(function (i) { return '<button type="button" class="p2-death-pip' + (i <= s.successes ? " on" : "") + '" data-death="success" data-step="' + i + '" aria-label="Success ' + i + '"></button>'; }).join("") + '<span aria-label="Failures">✕</span>' + [1, 2, 3].map(function (i) { return '<button type="button" class="p2-death-pip fail' + (i <= s.failures ? " on" : "") + '" data-death="failure" data-step="' + i + '" aria-label="Failure ' + i + '"></button>'; }).join("") + '</div></div>'
      + '<div class="p2-tr-card p2-exhaust-card"><b>Exhaustion</b><div class="p2-exhaustion"><button type="button" data-exhaustion="-1" aria-label="Snížit Exhaustion">−</button><strong>' + s.exhaustion + '</strong><button type="button" data-exhaustion="1" aria-label="Zvýšit Exhaustion">+</button></div>' + (s.exhaustion ? '<small class="p2-exhaust-effect">−' + (s.exhaustion * 2) + ' D20 · −' + (s.exhaustion * 5) + ' ft' + (s.exhaustion === 6 ? ' · Death' : '') + '</small>' : '') + '</div>'
      + '<div class="p2-tr-card p2-concentration"><b>Concentration</b><label><input type="checkbox" data-concentrating' + (s.concentrating ? " checked" : "") + '> Aktivní</label>' + concentrationInput + '</div>'
      + '<div class="p2-condition-list"><b>Conditions</b><div class="p2-active-conditions">' + (activeConditions || '<span class="p2-condition-empty">Žádné</span>') + '</div><select data-condition-add aria-label="Přidat stav"><option value="">+ Stav</option>' + available.map(function (name) { return '<option value="' + esc(name) + '">' + esc(name) + '</option>'; }).join("") + '</select></div>'
      + '<div class="p2-rest"><button class="ed-btn" data-rest="short" title="Short Rest: utratit Hit Dice, obnovit Pact Magic a zdroje na krátký odpočinek">☀ Short Rest</button><button class="ed-btn ed-primary" data-rest="long" title="Long Rest: plné HP, všechny sloty, zdroje a Hit Dice">☾ Long Rest</button></div></div>';
  }
  function bindTrackers(root, key, draw) {
    if (root.dataset.trackersBound) return;
    root.dataset.trackersBound = "1";
    root.addEventListener("click", function (e) {
      var s = sessionState(key), b = e.target.closest("button");
      if (!b || !root.contains(b)) return;
      if (b.hasAttribute("data-inspiration")) s.inspiration = !s.inspiration;
      else if (b.hasAttribute("data-exhaustion")) s.exhaustion = Math.max(0, Math.min(6, s.exhaustion + Number(b.dataset.exhaustion)));
      else if (b.hasAttribute("data-death")) s[b.dataset.death === "success" ? "successes" : "failures"] = Number(b.dataset.step) <= s[b.dataset.death === "success" ? "successes" : "failures"] ? Number(b.dataset.step) - 1 : Number(b.dataset.step);
      else if (b.hasAttribute("data-condition")) {
        var at = s.conditions.indexOf(b.dataset.condition);
        if (at < 0) s.conditions.push(b.dataset.condition); else s.conditions.splice(at, 1);
      } else return;
      saveSession(key, s); draw();
    });
    root.addEventListener("change", function (e) {
      var s = sessionState(key);
      if (e.target.hasAttribute("data-condition-add")) { var name = e.target.value; if (name && s.conditions.indexOf(name) < 0) s.conditions.push(name); }
      else if (e.target.hasAttribute("data-concentrating")) { s.concentrating = e.target.checked; if (!s.concentrating) s.concentrationSpell = ""; }
      else if (e.target.hasAttribute("data-concentration-spell")) { s.concentrationSpell = e.target.value; s.concentrating = !!e.target.value || s.concentrating; }
      else return;
      saveSession(key, s); draw();
    });
  }
  function compactPostava(value) {
    if (Array.isArray(value)) {
      var items = value.map(compactPostava).filter(function (x) { return x !== undefined; });
      return items.length ? items : undefined;
    }
    if (value && typeof value === "object") {
      var out = {};
      Object.keys(value).forEach(function (k) { var v = compactPostava(value[k]); if (v !== undefined) out[k] = v; });
      return Object.keys(out).length ? out : undefined;
    }
    return value === "" || value === null || value === undefined ? undefined : value;
  }

  function compute(c, cesta) {
    var d = {}, tridy = c.tridy || [];
    d.lvl = tridy.reduce(function (a, t) { return a + (Number(t.uroven) || 0); }, 0) || 1;
    d.exhaustion = sessionState("ps-hp:" + (cesta || c.jmeno)).exhaustion;
    d.exhaustPenalty = 2 * d.exhaustion;
    d.pb = 2 + Math.floor((d.lvl - 1) / 4);
    d.mods = {}; AB.forEach(function (a) { d.mods[a] = mod((c.atributy || {})[a]); });
    d.checkMods = {}; AB.forEach(function (a) { d.checkMods[a] = d.mods[a] - d.exhaustPenalty; });
    var first = tridy[0] && R.tridy[tridy[0].trida];
    d.saveProf = (c.zachrany_navic || []).slice();
    if (first) Object.keys(AB_EN).forEach(function (k) { if ((first.core["Saving Throw Proficiencies"] || "").indexOf(k) >= 0) d.saveProf.push(AB_EN[k]); });
    d.saves = {}; AB.forEach(function (a) { d.saves[a] = d.mods[a] + (d.saveProf.indexOf(a) >= 0 ? d.pb : 0) - d.exhaustPenalty; });
    var bardLvl = lvlOf(c, "Bard"), jack = bardLvl >= 2;
    d.skills = {};
    Object.keys(SKILLS).forEach(function (s) {
      var prof = (c.dovednosti || []).indexOf(s) >= 0, exp = (c.expertiza || []).indexOf(s) >= 0;
      d.skills[s] = { val: d.mods[SKILLS[s]] + (prof ? d.pb : 0) + (exp ? d.pb : 0) + (!prof && jack ? Math.floor(d.pb / 2) : 0) - d.exhaustPenalty, prof: prof, exp: exp };
    });
    d.passive = 10 + d.skills.Perception.val + d.exhaustPenalty;
    d.init = d.mods.DEX + (has(c.featy, "Alert") ? d.pb : 0) - d.exhaustPenalty;
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
    d.speed = Math.max(0, Number(c.rychlost_rucne || sp) - d.exhaustion * 5);
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
    if (window.MontelienPravidla) { var ed = window.MontelienPravidla.init(R).derive(c); d.slots = ed.slots; if (ed.pact) d.pact = { pocet: ed.pact.pocet, uroven: ed.pact.uroven }; }
    d.casting.forEach(function (x) { x.dc = 8 + d.pb + d.mods[x.ab]; x.atk = d.pb + d.mods[x.ab] - d.exhaustPenalty; });
    var b = c.boj || {}, bestAtk = 0;
    (c.utoky || []).forEach(function (u) { var a = u.atribut === "FIN" ? Math.max(d.mods.STR, d.mods.DEX) : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0; bestAtk = Math.max(bestAtk, a + d.pb + (Number(u.bonus) || 0) - d.exhaustPenalty); });
    var bestDc = d.casting.reduce(function (m, x) { return Math.max(m, x.dc); }, 0);
    var au = autoDpr(c, d); d.dprAuto = au.dpr; d.dprPopis = au.popis; if (!bestAtk) bestAtk = au.atk - d.exhaustPenalty;
    d.dpr = Number(b.dpr) || d.dprAuto;
    d.cr = computeCR(d.hp, d.ac, d.dpr, bestAtk, bestDc);
    return d;
  }
  function avgDice(e) { var m = String(e || "").match(/(\d+)d(\d+)/); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; }
  function autoDpr(c, d) {
    var L = function (t) { return lvlOf(c, t); }, mx = Math.max(d.mods.STR, d.mods.DEX), atk = d.pb + mx, best = 0, popis = [];
    var nAtk = 1; if (L("Fighter") >= 20) nAtk = 4; else if (L("Fighter") >= 11) nAtk = 3; else if (L("Fighter") >= 5 || L("Barbarian") >= 5 || L("Monk") >= 5 || L("Paladin") >= 5 || L("Ranger") >= 5) nAtk = 2;
    var per = 0;
    (c.utoky || []).forEach(function (u) { if (!u.kostka) return; var a = u.atribut === "FIN" ? mx : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0; per = Math.max(per, avgDice(u.kostka) + (u.bez_modu ? 0 : a) + (Number(u.bonus) || 0) + (Number(u.bonus_zraneni) || 0)); });
    var monk = L("Monk");
    if (monk) { var ma = avgDice(row("Monk", monk)["Martial Arts"] || "1d6") + mx; per = Math.max(per, ma); }
    if (!per && (L("Fighter") || L("Barbarian") || L("Paladin") || L("Ranger") || L("Rogue"))) per = 4.5 + mx;
    if (per) { best = per * nAtk; popis.push(nAtk + "× útok ~" + per.toFixed(1)); }
    if (monk >= 2) { var fb = monk >= 10 ? 3 : 2, ma2 = avgDice(row("Monk", monk)["Martial Arts"] || "1d6") + mx; best += fb * ma2; popis.push("Flurry of Blows " + fb + "×"); }
    else if (L("Barbarian")) { var rd = Number((row("Barbarian", L("Barbarian"))["Rage Damage"] || "2").replace(/\D/g, "")) || 2; best += rd * nAtk; popis.push("Rage +" + rd); }
    var rg = L("Rogue"); if (rg) { var sa = Math.ceil(rg / 2) * 3.5; best += sa; popis.push("Sneak Attack " + Math.ceil(rg / 2) + "d6"); }
    var pal = L("Paladin"); if (pal >= 11) { best += nAtk * 4.5; popis.push("Radiant Strikes"); }
    // kouzelník: cantrip nebo nejvyšší slot
    if (d.casting.length) {
      var x = d.casting[0], m = d.mods[x.ab], tier = d.lvl >= 17 ? 4 : d.lvl >= 11 ? 3 : d.lvl >= 5 ? 2 : 1, cant = tier * 5.5 + (L("Warlock") >= 2 ? tier * m : 0);
      var top = 0; (d.slots || []).forEach(function (n, i) { if (n) top = i + 1; }); if (d.pact) top = Math.max(top, Number(d.pact.uroven) || 0);
      var slot = top ? 7 + top * 5.5 : 0, sp = Math.max(cant, slot);
      if (sp > best) { best = sp; popis = [slot > cant ? "kouzlo " + top + ". úrovně" : "cantrip"]; atk = Math.max(atk, x.atk); }
    }
    return { dpr: Math.round(best), atk: atk, popis: popis.join(", ") };
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
          var nn = function (x) { return x.replace(/[’']/g, "'").toLowerCase(); }, key = Object.keys(cl.rysy).filter(function (k) { return nn(k) === nn(name) || nn(k) === nn(name.replace(/s$/, "")); })[0];
          var desc = ((key && cl.rysy[key]) || {}).text || "";
          seen[name] = { zdroj: t.trida, uroven: lv, urovne: [lv], nazev: name, text: desc }; out.push(seen[name]);
        });
      }
    });
    return out;
  }

  function render(c, d, cesta, portraitUrl) {
    var bg = R.pozadi[c.pozadi] || {}, sp = R.druhy[c.druh] || {}, bj = c.boj || {}, o = c.osobnost || {}, key = "ps-hp:" + (cesta || c.jmeno);
    var initials = String(c.jmeno || "?").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2);
    var xpHtml = "";
    if (c.xp != null && c.xp !== "" && Number.isFinite(Number(c.xp))) xpHtml = '<div class="p2-xp">XP ' + Number(c.xp).toLocaleString("cs-CZ") + (d.lvl < 20 ? ' / ' + XP_LEVELS[d.lvl].toLocaleString("cs-CZ") + ' · další úroveň ' + (d.lvl + 1) : ' · Level 20') + '</div>';
    var senses = sensesFor(c, sp), languages = listValues(c.jazyky);
    var defenses = [["Resistance", listValues(c.odolnosti)], ["Immunity", listValues(c.imunity)], ["Vulnerability", listValues(c.zranitelnosti)]].filter(function (x) { return x[1].length; });
    var castingSummary = d.casting.map(function (x) { return '<span><b>' + esc(x.trida) + '</b> ' + x.ab + ' DC ' + x.dc + ' <a class="ps-roll" data-roll="1d20' + sg(x.atk) + '" data-label="Spell attack">' + sg(x.atk) + '</a></span>'; }).join(' <span class="p2-overview-slash">/</span> ');
    var overview = '<aside class="p2-overview" aria-label="Přehled"><b class="p2-overview-title">Přehled</b>'
      + (senses.length ? '<span class="p2-overview-group"><b>Senses</b> ' + esc(senses.join(", ")) + '</span>' : '')
      + (languages.length ? '<span class="p2-overview-group"><b>Languages</b> ' + esc(languages.join(", ")) + '</span>' : '')
      + (defenses.length ? '<span class="p2-overview-group"><b>Defenses</b> ' + defenses.map(function (x) { return esc(x[0]) + ': ' + esc(x[1].join(", ")); }).join(" · ") + '</span>' : '')
      + (castingSummary ? '<span class="p2-overview-group p2-overview-spellcasting"><b>Spellcasting</b> ' + castingSummary + '</span>' : '')
      + '<span class="p2-overview-group"><b>Weapon Mastery</b> ' + ((c.mastery || []).length) + '</span></aside>';
    var toolbar = cesta && document.body.classList.contains("ed-on") ? '<div class="p2-toolbar"><button class="ed-btn" data-ps-lvl title="Level up">⬆</button><button class="ed-btn ed-primary" data-ps-edit title="Upravit postavu">✎</button></div>' : '';
    var badgeXp = c.xp != null && c.xp !== "" && Number.isFinite(Number(c.xp)) ? xpHtml : "";
    var diceCompact = String(d.dice).split(" + ").map(function (die) { var m = die.match(/(\d+)d(\d+)/); return m ? "d" + m[2] + "×" + m[1] : die; }).join(" · ");
    var h = '<div class="ps ps2"><div class="p2-top">';
    h += '<aside class="p2-portrait"><div class="p2-crest' + (portraitUrl ? ' p2-crest-portret' : ' p2-crest-initial') + '">'
      + (portraitUrl ? '<a class="p2-portret" href="' + esc(portraitUrl) + '" target="_blank" rel="noopener"><img src="' + esc(portraitUrl) + '" alt="' + esc(c.jmeno) + '"></a>' : '<span>' + esc(initials) + '</span>')
      + '<div class="p2-lvl" title="Celková úroveň">' + ((c.tridy || []).length ? d.lvl : "—") + '</div></div></aside>';
    h += '<div class="p2-top-main"><header class="p2-hero"><div class="p2-id"><div class="p2-identity-head"><div><h2 class="p2-name">' + esc(c.jmeno) + '</h2><div class="p2-title">' + esc(c.titul || "") + '</div></div>' + toolbar + '</div><div class="p2-chips">'
      + ((c.tridy || []).length ? (c.tridy || []).map(function (t) { return '<span class="p2-chip p2-class">' + esc(t.trida) + ' ' + t.uroven + (t.podtrida ? ' · ' + esc(t.podtrida) : '') + '</span>'; }).join("")
        : '<span class="p2-chip p2-class">' + esc(c.statblok ? "Bez povolání · " + c.statblok : "Bez povolání") + '</span>')
      + '<button type="button" class="p2-chip" data-species="' + esc(c.druh || "") + '">' + esc(c.druh || "—") + '</button>' + (sp.legacy ? '<span class="p2-chip p2-legacy">legacy, kompatibilní</span>' : '') + '<span class="p2-chip">' + esc(c.pozadi || "—") + '</span><span class="p2-chip">' + esc(c.zarovnani || "—") + '</span><span class="p2-chip">' + esc(c.velikost || "Medium") + '</span></div>'
      + (d.exhaustion ? '<span class="p2-exhaust-warning">Exhaustion ' + d.exhaustion + ' · −' + d.exhaustPenalty + ' D20 · −' + (d.exhaustion * 5) + ' ft Speed' + (d.exhaustion === 6 ? ' · Death' : '') + '</span>' : '') + '</div>'
      + '<div class="p2-badges"><div class="p2-cr"><strong class="p2-cr-v" title="obrana CR ' + d.cr.def + ' · útok CR ' + d.cr.off + '">' + d.cr.cr + '</strong><span class="p2-cr-l">CR</span><small class="p2-cr-x">' + d.cr.xp + ' XP' + (bj.cr_rucne ? '<br>' + esc(bj.cr_rucne) : '') + '</small></div>' + inspirationHtml(key) + badgeXp + '</div></header>';
    // ---- životní hodnoty ----
    h += '<div class="p2-vitals"><div class="p2-shield"><div class="p2-v">' + d.ac + '</div><div class="p2-l">Armor Class</div></div>'
      + '<div class="p2-hp ps-hptrack" data-key="' + esc(key) + '" data-max="' + d.hp + '"><div class="p2-l">Hit Points</div><div class="p2-hp-row"><button data-hp="-1" aria-label="Snížit HP">−</button><input class="ps-hpcur" type="number"><span class="p2-hp-max">/ ' + d.hp + '</span><button data-hp="1" aria-label="Zvýšit HP">+</button></div><div class="p2-hpbar"><i></i></div><div class="p2-hp-utility"><label>Temp <input class="ps-hptmp" type="number"></label><label>Δ <input class="p2-hp-delta" type="number" placeholder="±" aria-label="Změnit HP o zadanou hodnotu; Enter"></label><button data-hp="reset" title="Plné HP">↺</button></div></div>'
      + stat('<span class="p2-l-long">Iniciativa</span><span class="p2-l-short">Init.</span>', '<a class="ps-roll" data-roll="1d20' + sg(d.init) + '" data-label="Iniciativa">' + sg(d.init) + '</a>', "p2-initiative") + stat('<span class="p2-l-long">Rychlost</span><span class="p2-l-short">Rych.</span>', d.speed + ' ft', "p2-speed")
      + stat('<span class="p2-l-long">Prof. Bonus</span><span class="p2-l-short">PB</span>', sg(d.pb)) + stat('<span class="p2-l-long" title="Passive Perception">Passive Perc.</span><span class="p2-l-short" title="Passive Perception">PP</span>', d.passive)
      + stat("Hit Dice", (c.tridy || []).length ? '<span class="p2-hd-left ps-hdleft" data-key="' + esc(key) + '" data-total="' + d.lvl + '"></span>/' + d.lvl + '<small class="p2-hd-dice">' + esc(diceCompact) + '</small>' : "—", "p2-hd-stat")
      + stat("DPR", bj.dpr ? esc(bj.dpr) : '<span title="Automatický odhad: ' + esc(d.dprPopis || "") + ' (ručně: Upravit postavu → Připravenost na boj)">~' + d.dprAuto + '</span>') + '</div>'
      + '<div class="p2-abil">' + AB.map(function (a) { return '<div class="p2-ab" title="' + AB_CZ[a] + '"><div class="p2-ab-n"><span class="p2-ab-name-wide">' + AB_CZ[a] + '</span><span class="p2-ab-name-short">' + a + '</span></div><a class="p2-ab-mod ps-roll" data-roll="1d20' + sg(d.checkMods[a]) + '" data-label="' + AB_CZ[a] + '">' + sg(d.checkMods[a]) + '</a><div class="p2-ab-s">' + esc((c.atributy || {})[a]) + '</div><a class="p2-ab-save ps-roll' + (d.saveProf.indexOf(a) >= 0 ? ' p' : '') + '" data-roll="1d20' + sg(d.saves[a]) + '" data-label="Záchrana ' + a + '">save ' + sg(d.saves[a]) + '</a></div>'; }).join("") + '</div>';
    h += trackerHtml(c, key) + overview + '</div></div>';
    // ---- záložky ----
    var tabs = [];
    // Boj
    var atk = '<table class="p2-tab"><tr><th>Útok</th><th>Zásah</th><th>Zranění</th><th>Mastery / pozn.</th></tr>' + (c.utoky || []).map(function (u) {
      var a = u.atribut === "FIN" ? Math.max(d.mods.STR, d.mods.DEX) : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0;
      var bon = a + d.pb + (Number(u.bonus) || 0) - d.exhaustPenalty, dm = (u.bez_modu ? 0 : a) + (Number(u.bonus) || 0) + (Number(u.bonus_zraneni) || 0);
      return '<tr><td><b>' + esc(u.nazev) + '</b>' + (u.dosah ? '<br><small>' + esc(u.dosah) + '</small>' : '') + '</td><td>' + (u.bez_hodu ? "—" : '<a class="p2-pill ps-roll" data-roll="1d20' + sg(bon) + '" data-label="' + esc(u.nazev) + ' – útok">' + sg(bon) + '</a>') + '</td><td>' + (u.kostka ? '<a class="p2-pill p2-dmg ps-roll" data-roll="' + esc(u.kostka) + (dm ? sg(dm) : "") + '" data-label="' + esc(u.nazev) + ' – zásah">' + esc(u.kostka) + (dm ? " " + sg(dm) : "") + '</a> ' : '') + '<small>' + esc(u.typ || "") + '</small></td><td><small>' + esc([u.mastery, u.poznamka].filter(Boolean).join(" · ")) + '</small></td></tr>';
    }).join("") + '</table>';
    var res = [];
    var defenseRows = [["Resistance", listValues(c.odolnosti).join(", ")], ["Immunity", listValues(c.imunity).join(", ")], ["Vulnerability", listValues(c.zranitelnosti).join(", ")], ["Senses", sensesFor(c, sp).join(", ")]].filter(function (x) { return x[1]; });
    var defenseCard = defenseRows.length ? card("Obrany a smysly", '<dl class="p2-dl">' + defenseRows.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join("") + '</dl>') : "";
    (c.tridy || []).forEach(function (t) { var r = row(t.trida, t.uroven); Object.keys(r).forEach(function (k) { if (SKIP_COLS.indexOf(k) < 0 && r[k] && r[k] !== "-") res.push([t.trida + ": " + k, r[k]]); }); });
    (c.zdroje || []).forEach(function (z) { res.push([z.nazev, z.pocet + (z.obnova ? " / " + z.obnova : "")]); });
    tabs.push(["Boj", '<div class="p2-2col"><div>' + card("Útoky", atk) + defenseCard + (res.length ? card("Zdroje povolání", '<ul class="p2-res">' + res.map(function (r) { var n = /^\d+$/.test(String(r[1]).trim()) ? Number(r[1]) : 0, nm = String(r[0]).replace(/^.*?: /, ""), sr = SR_RES[nm] || (/short|krátk/i.test(String(r[1])) ? "all" : ""); return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b>" + (n && n <= 20 ? ' <span class="p2-pips" data-k="' + esc(key + ':z:' + r[0]) + '" data-sr="' + sr + '">' + pips(n) + '</span>' : '') + "</li>"; }).join("") + '</ul>') : '') + '</div><div>'
      + card("V tahu", actList("Akce", bj.akce) + actList("Bonusové akce", bj.bonusove_akce) + actList("Reakce", bj.reakce) + actList("Legendární akce", bj.legendarni) + (bj.taktika ? '<p class="p2-tactic">' + para(bj.taktika) + '</p>' : '')) + '</div></div>']);
    // Dovednosti
    tabs.push(["Dovednosti", '<div class="p2-2col"><div>' + card("Dovednosti", '<ul class="p2-skills">' + Object.keys(SKILLS).sort().map(function (s) { var k = d.skills[s]; return '<li class="' + (k.exp ? "e" : k.prof ? "p" : "") + '"><i></i><span>' + s + ' <small>' + SKILLS[s] + '</small></span><a class="ps-roll" data-roll="1d20' + sg(k.val) + '" data-label="' + s + '">' + sg(k.val) + '</a></li>'; }).join("") + '</ul>') + '</div><div>'
      + card("Výcvik a zdatnosti", '<dl class="p2-dl"><dt>Zbroj</dt><dd>' + esc(train(c, "Armor Training")) + '</dd><dt>Zbraně</dt><dd>' + esc(train(c, "Weapon Proficiencies")) + '</dd>' + (c.mastery && c.mastery.length ? '<dt>Weapon Mastery</dt><dd>' + esc(c.mastery.join(", ")) + '</dd>' : '') + '<dt>Nástroje</dt><dd>' + esc((c.nastroje || []).join(", ") || "—") + '</dd><dt>Jazyky</dt><dd>' + esc((c.jazyky || []).join(", ") || "—") + '</dd>' + (c.zbroj && c.zbroj.nazev ? '<dt>Zbroj na sobě</dt><dd>' + esc(c.zbroj.nazev) + (c.zbroj.stit ? " + Shield" : "") + '</dd>' : '') + '</dl>') + '</div></div>']);
    // Kouzla
    if (true) {
      var s = '<div class="p2-cast">' + d.casting.map(function (x) { var r = row(x.trida.split(" ")[0], lvlOf(c, x.trida.split(" ")[0])); return '<div class="p2-castbox"><div class="p2-l">' + esc(x.trida) + ' · Spellcasting ability ' + x.ab + '</div><div><b>Spell save DC ' + x.dc + '</b> · Spell attack <a class="ps-roll" data-roll="1d20' + sg(x.atk) + '" data-label="Spell attack">' + sg(x.atk) + '</a></div><small>' + (r["Prepared Spells"] ? "připravených " + r["Prepared Spells"] : "") + (r.Cantrips ? " · cantripů " + r.Cantrips : "") + '</small></div>'; }).join("") + '</div>';
      var byLvl = {}; (c.kouzla || []).forEach(function (k) { var l = k.uroven != null ? Number(k.uroven) : ((R.spell(k.nazev) || {}).uroven); if (l == null) l = "?"; (byLvl[l] = byLvl[l] || []).push(k); });
      s += '<div class="p2-spells">';
      for (var l = 0; l <= 9; l++) {
        var slots = l ? (d.slots[l - 1] || 0) : 0, pact = d.pact && Number(d.pact.uroven) === l ? Number(d.pact.pocet) : 0;
        if (!byLvl[l] && !slots && !pact) continue;
        s += '<div class="p2-sl"><div class="p2-sl-h"><span>' + (l ? l + '. úroveň' : 'Cantripy') + '</span><span class="p2-pips" data-k="' + esc(key + ':s' + l) + '">' + pips(slots) + '</span>' + (pact ? ' <em title="Pact Magic (obnova po Short i Long Rest)">pakt <span class="p2-pips" data-k="' + esc(key + ':p') + '">' + pips(pact) + '</span></em>' : '') + '</div><ul>' + (byLvl[l] || []).map(function (k) { var r = R.spell(k.nazev), meta = spellMeta(k.nazev), markers = meta ? (/(?:^|, )?ritual|ritual/i.test(meta.cas || "") ? " · R" : "") + (/concentration/i.test(meta.trvani || "") ? " · C" : "") : "", timing = meta ? [meta.cas, meta.dosah].filter(Boolean).join(" · ") : ""; return '<li><a href="#" class="kz-link" data-kouzlo="' + esc(k.nazev) + '">' + esc(k.nazev) + '</a>' + (r ? ' <small>' + esc(r.skola) + '</small>' : ' <small class="ps-warn">mimo seznam 2024?</small>') + (timing || markers ? '<br><small class="p2-spell-meta">' + esc(timing + markers) + '</small>' : '') + (k.poznamka ? ' <small>– ' + esc(k.poznamka) + '</small>' : '') + '</li>'; }).join("") + '</ul></div>';
      }
      if (byLvl["?"]) s += '<div class="p2-sl"><div class="p2-sl-h">Neznámá úroveň</div><ul>' + byLvl["?"].map(function (k) { return "<li>" + esc(k.nazev) + "</li>"; }).join("") + '</ul></div>';
      if (!d.casting.length && !(c.kouzla || []).length) s += '<p class="ps-note">Postava nemá rys Spellcasting. Kouzla jí může přidat PJ (např. z featu, předmětu nebo požehnání) tlačítkem <b>+ Kouzlo dle PJ</b> v režimu úprav.</p>';
      if (cesta && document.body.classList.contains("ed-on")) s = '<div class="ps-spell-bar">' + (d.casting.length ? '<button class="ed-btn ed-primary" data-ps-spells>✦ Vybrat kouzla</button> ' : '') + '<button class="ed-btn" data-ps-dmspell>+ Kouzlo dle PJ</button></div>' + s;
      tabs.push(["Kouzla", s + '</div>']);
    }
    // Rysy
    var feats = features(c);
    tabs.push(["Rysy", '<div class="p2-2col"><div>' + card("Rysy povolání", feats.map(function (f) { return detR(f.nazev + ' <small>' + esc(f.zdroj) + ' ' + (f.urovne ? f.urovne.join(", ") : f.uroven) + '</small>', f.text); }).join("")) + '</div><div>'
      + card("Rysy druhu – " + esc(c.druh), Object.keys(sp.rysy || {}).map(function (k) { return detR(esc(k), sp.rysy[k]); }).join("") + (c.druh_volby ? '<p class="ps-note">Volba: ' + esc(c.druh_volby) + '</p>' : ''))
      + card("Featy", (c.featy || []).map(function (f) { var r = R.featy[f.nazev] || {}; return detR(esc(f.nazev) + ' <small>' + esc(f.zdroj || "") + '</small>', (f.poznamka ? "Volba: " + f.poznamka + "\n" : "") + (r.text || "")); }).join(""))
      + (c.vlastni_rysy && c.vlastni_rysy.length ? card("Zvláštní a božské rysy", c.vlastni_rysy.map(function (f) { return det(esc(f.nazev), f.text); }).join("")) : '') + '</div></div>']);
    // Výbava
    var attunement = listValues(c.naladeni), attSlots = [0, 1, 2].map(function (i) { return '<li' + (attunement[i] ? ' class="filled"' : '') + '>' + (attunement[i] ? esc(attunement[i]) : 'Empty') + '</li>'; }).join("");
    tabs.push(["Výbava", '<div class="p2-2col"><div>' + card("Výbava", '<ul class="p2-gear">' + (c.vybava || []).map(function (v) { return "<li>" + esc(v) + "</li>"; }).join("") + '</ul>') + card("Attunement", '<ol class="p2-attunement">' + attSlots + '</ol>' + (attunement.length > 3 ? '<p class="ps-warn">More than 3 items are attuned; the limit is three.</p>' : '')) + '</div><div>' + (c.penize ? card("Peníze", '<div class="p2-coins">' + Object.keys(c.penize).map(function (k) { return '<span><b>' + esc(c.penize[k]) + '</b> ' + esc(k) + '</span>'; }).join("") + '</div>') : '') + '</div></div>']);
    // Příběh
    tabs.push(["Příběh", '<div class="p2-2col"><div>' + card("Osobnost", '<dl class="p2-dl"><dt>Rysy</dt><dd>' + esc(o.rysy || "—") + '</dd><dt>Ideály</dt><dd>' + esc(o.idealy || "—") + '</dd><dt>Pouta</dt><dd>' + esc(o.pouta || "—") + '</dd><dt>Vady</dt><dd>' + esc(o.vady || "—") + '</dd></dl>') + (c.vzhled ? card("Vzhled", '<p>' + para(c.vzhled) + '</p>') : '') + '</div><div>'
      + card("Pozadí: " + esc(c.pozadi || "—"), bg.feat ? '<dl class="p2-dl"><dt>Atributy</dt><dd>' + esc(bg.atributy) + '</dd><dt>Origin feat</dt><dd>' + esc(bg.feat) + '</dd><dt>Dovednosti</dt><dd>' + esc(bg.dovednosti) + '</dd><dt>Nástroj</dt><dd>' + esc(bg.nastroj) + '</dd></dl>' : '<p>—</p>')
      + (c.puvod_atributu || c.prevod_2024 || c.poznamky ? card("Poznámky", (c.puvod_atributu ? '<p><b>Atributy:</b> ' + para(c.puvod_atributu) + '</p>' : '') + (c.prevod_2024 ? '<p><b>Převod na 2024:</b> ' + para(c.prevod_2024) + '</p>' : '') + (c.poznamky ? '<p>' + para(c.poznamky) + '</p>' : '')) : '') + '</div></div>']);
    var PV = window.MontelienPravidla ? window.MontelienPravidla.init(R).validate(c) : [];
    tabs.push(["Kontrola" + (PV.some(function (x) { return x.typ === "chyba"; }) ? " ⚠" : PV.length ? " ·" : " ✓"), card("Kontrola pravidel 2024", PV.length ? '<ul class="pv-list">' + PV.map(function (x) { return '<li class="pv-' + x.typ + '">' + (x.typ === "chyba" ? "Chyba: " : x.typ === "informace" ? "Informace: " : "Upozornění: ") + esc(x.text) + '</li>'; }).join("") + '</ul>' : '<p class="pv-ok">Vše odpovídá pravidlům 2024: povolání, subclass, featy a jejich předpoklady, sloty ASI / Fighting Style / Epic Boon, atributy, dovednosti.</p>')
      + card("Featy podle úrovní", window.MontelienPravidla ? '<ul>' + window.MontelienPravidla.featSlots(c).map(function (sl) { var f = (c.featy || []).filter(function (x) { return x.zdroj === sl.zdroj; })[0]; return '<li><b>' + esc(sl.zdroj) + ':</b> ' + (f ? esc(f.nazev) + (f.poznamka ? ' <small>(' + esc(f.poznamka) + ')</small>' : '') : '<i>nevybráno</i>') + '</li>'; }).join("") + '</ul>' : '')]);
    var ICO = { "Boj": "⚔", "Dovednosti": "◎", "Kouzla": "✦", "Rysy": "❖", "Výbava": "⚒", "Příběh": "❡" }, CNT = { "Kouzla": (c.kouzla || []).length, "Rysy": feats.length + (c.featy || []).length, "Výbava": (c.vybava || []).length };
    h += '<nav class="p2-tabs" role="tablist">' + tabs.map(function (x, i) { var nm = x[0].replace(/ .*/, ""); return '<button class="p2-tabbtn' + (i ? '' : ' on') + '" role="tab" data-tab="' + i + '" data-name="' + esc(nm) + '"><span class="p2-ti">' + (ICO[nm] || (/Kontrola/.test(nm) ? "✔" : "•")) + '</span><span class="p2-tl">' + x[0] + '</span>' + (CNT[nm] ? '<span class="p2-tc">' + CNT[nm] + '</span>' : '') + '</button>'; }).join("") + '<button class="p2-tabbtn p2-taball" data-tab="all" title="Zobrazit vše (i pro tisk)"><span class="p2-ti">☰</span><span class="p2-tl">Vše</span></button></nav>';
    h += tabs.map(function (x, i) { return '<section class="p2-pane' + (i ? '' : ' on') + '" data-pane="' + i + '"><h3 class="p2-pane-h">' + x[0] + '</h3>' + x[1] + '</section>'; }).join("");
    return h + '</div>';
  }
  function stat(l, v, cls) { return '<div class="p2-stat' + (cls ? ' ' + cls : '') + '"><div class="p2-v">' + v + '</div><div class="p2-l">' + l + '</div></div>'; }
  function card(t, body) { return '<section class="p2-card"><h4>' + t + '</h4>' + body + '</section>'; }
  function actList(t, arr) { if (!arr || !arr.length) return ""; return '<div class="p2-act"><div class="p2-act-h">' + t + '</div>' + arr.map(function (a) { return '<p>' + (typeof a === "string" ? esc(a) : '<b>' + esc(a.nazev) + '.</b> ' + esc(a.text || "")) + '</p>'; }).join("") + '</div>'; }
  function sheetUi(root) {
    var last = localStorage.getItem("p2-tab"), lb = last && root.querySelector('.p2-tabbtn[data-name="' + last + '"]' + (last === "all" ? ', .p2-tabbtn[data-tab="all"]' : ''));
    if (lb && !lb.classList.contains("on")) setTimeout(function () { lb.click(); }, 0);
    if (root.dataset.ui) { restorePips(root); return; } root.dataset.ui = "1";
    root.addEventListener("click", function (e) {
      var b = e.target.closest(".p2-tabbtn"); if (b) {
        root.querySelectorAll(".p2-tabbtn").forEach(function (x) { x.classList.toggle("on", x === b); });
        root.querySelectorAll(".p2-pane").forEach(function (p) { p.classList.toggle("on", b.dataset.tab === "all" || p.dataset.pane === b.dataset.tab); });
        root.querySelector(".ps2").classList.toggle("p2-all", b.dataset.tab === "all");
        try { localStorage.setItem("p2-tab", b.dataset.name || b.dataset.tab); } catch (er) {}
        if (!e.isTrusted) return; b.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
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
    function save() {
      localStorage.setItem(key, JSON.stringify(st));
      if (Number(st.hp) > 0) { var session = sessionState(key); if (session.successes || session.failures) { session.successes = 0; session.failures = 0; saveSession(key, session); } }
      cur.value = st.hp; tmp.value = st.tmp; w.classList.toggle("ps-bloodied", st.hp <= max / 2); w.classList.toggle("ps-down", st.hp <= 0);
      var bar = w.querySelector(".p2-hpbar i"); if (bar) bar.style.width = Math.max(0, Math.min(100, 100 * st.hp / max)) + "%";
    }
    w.addEventListener("click", function (e) {
      var button = e.target.closest("[data-hp]"), b = button && button.dataset.hp; if (!b) return;
      if (b === "reset") { st.hp = max; st.tmp = ""; }
      else { var v = Number(b); if (v < 0 && Number(st.tmp) > 0) { var left = Number(st.tmp) + v; st.tmp = left > 0 ? left : ""; v = Math.min(0, left); } st.hp = Math.max(0, Math.min(max, st.hp + v)); }
      save();
    });
    cur.addEventListener("change", function () { st.hp = Math.max(0, Math.min(max, Number(cur.value) || 0)); save(); });
    tmp.addEventListener("change", function () { st.tmp = tmp.value; save(); });
    var delta = w.querySelector(".p2-hp-delta");
    if (delta) delta.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var v = Number(delta.value); if (!Number.isFinite(v) || !v) return;
      if (v < 0 && Number(st.tmp) > 0) { var left = Number(st.tmp) + v; st.tmp = left > 0 ? left : ""; v = Math.min(0, left); }
      st.hp = Math.max(0, Math.min(max, Number(st.hp) + v)); delta.value = ""; save();
    });
    save();
  }
  function box(l, v, cls) { return '<div class="ps-box ' + (cls || "") + '"><div class="ps-lbl">' + l + '</div><div class="ps-val">' + v + '</div></div>'; }
  function sect(t, body) { return '<section class="ps-sect"><h4>' + t + '</h4>' + body + '</section>'; }
  function cz(x) { x = String(x).trim(); return (localStorage.getItem("mont-lang") || "cs") === "en" ? x : (CS[x] || x); }
  function rysTable(title, cells) {
    var k = 2, long = []; cells.forEach(function (c, i) { if (c.length > 45) long.push(i); });
    if (long.length && long[0] - 1 >= 2 && cells.length % (long[0] - 1) === 0) k = long[0] - 1; else if (cells.length % 2) k = cells.length % 3 === 0 ? 3 : 2;
    if (cells[0] === "Name") k = 1;
    var h = (title ? '<div class="p2-rt-t">' + esc(title) + '</div>' : '') + '<table class="p2-rt">';
    for (var i = 0; i < cells.length; i += k) { var tag = i ? "td" : "th"; h += "<tr>"; for (var j = 0; j < k; j++) h += "<" + tag + ">" + esc(cells[i + j] || "") + "</" + tag + ">"; h += "</tr>"; }
    return h + "</table>";
  }
  function rysHtml(t) {
    var L = String(t || "").split("\n"), out = [], i = 0;
    while (i < L.length) {
      var l = L[i].trim();
      if (l.charAt(0) === "|") {
        var title = out.length && /^<p>[^<]{1,70}<\/p>$/.test(out[out.length - 1]) && !/\.<\/p>$/.test(out[out.length - 1]) ? out.pop().replace(/<\/?p>/g, "") : "";
        var cells = []; while (i < L.length && L[i].trim().charAt(0) === "|") { cells.push(cz(L[i].trim().slice(1))); i++; }
        out.push(rysTable(title, cells)); continue;
      }
      if (l) { var x = esc(cz(l)).replace(/^([A-Z][A-Za-z’'\-() ]{2,50}\.)\s/, "<b>$1</b> "); out.push("<p>" + x + "</p>"); }
      i++;
    }
    return out.join("");
  }
  function detR(t, body) { return '<details><summary>' + t + '</summary><div>' + (body ? rysHtml(body) : '<p class="ps-warn">Popis chybí.</p>') + '</div></details>'; }
  function det(t, body) { return '<details><summary>' + t + '</summary><div>' + para(body || "") + '</div></details>'; }
  function pips(n) { var s = ""; for (var i = 0; i < n; i++) s += '<i class="p2-pip" title="Klikni = slot použit"></i>'; return s; }
  function train(c, key) { var t = c.tridy && c.tridy[0] && R.tridy[c.tridy[0].trida]; return t ? t.core[key] || "—" : "—"; }

  // ---------- formulář ----------
  function editor(c, cesta) {
    var E = window.MontelienEditor; if (!E) return;
    var data = JSON.parse(JSON.stringify(c)), armorDefault = !data.zbroj, el = E.el, body = el("div", { class: "pf" });
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
    var strom = E.api("GET", "strom");
    function relationSelect(p, key, label, prefix) {
      var l = el("label", {}, label + " <small>(Ctrl/Cmd pro více výběrů)</small>"), select = el("select", { multiple: "multiple", size: 6 });
      select.setAttribute("aria-label", label);
      strom.then(function (tree) {
        (tree.soubory || []).filter(function (path) { return path.indexOf(prefix) === 0; }).forEach(function (path) {
          var name = path.split("/").pop().replace(/\.md$/, "").replace(/_/g, " ");
          var option = el("option", { value: path }, name);
          option.selected = (data[key] || []).indexOf(path) >= 0;
          select.appendChild(option);
        });
      }).catch(function () { select.disabled = true; });
      select.addEventListener("change", function () {
        data[key] = Array.from(select.selectedOptions).map(function (option) { return option.value; });
      });
      l.appendChild(select); p.appendChild(l);
    }
    var classes = Object.keys(R.tridy), subs = Object.keys(R.podtridy).sort(), species = Object.keys(R.druhy).sort(speciesSort), bgs = Object.keys(R.pozadi).sort(), feats = Object.keys(R.featy).sort();
    tab("Základ", function (p) {
      field(p, data, "jmeno", "Jméno"); field(p, data, "titul", "Titul / role");
      var ds = field(p, data, "druh", "Druh (Species) – 2024 nebo legacy, kompatibilní"); ds.setAttribute("list", "pf-species");
      var dl = el("datalist", { id: "pf-species" }); species.forEach(function (s) { dl.appendChild(el("option", { value: s, label: speciesLabel(s) })); }); p.appendChild(dl);
      var legacyNote = el("small", { class: "pf-legacy-note" }, "legacy, kompatibilní");
      function updateLegacyNote() { legacyNote.hidden = !(R.druhy[ds.value] || {}).legacy; }
      ds.addEventListener("input", updateLegacyNote); ds.addEventListener("change", updateLegacyNote); updateLegacyNote(); p.appendChild(legacyNote);
      field(p, data, "druh_volby", "Volby druhu (lineage, ancestry…)"); field(p, data, "pozadi", "Pozadí (Background)", null, bgs);
      field(p, data, "zarovnani", "Přesvědčení (alignment)"); field(p, data, "velikost", "Velikost", null, ["Small", "Medium", "Large"]);
      field(p, data, "xp", "Experience Points (XP)", "number"); strList(p, data, "smysly", "Senses");
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
      field(p, data, "statblok", "Statblock (Monster Manual 2025)");
      field(p, data.zbroj, "nazev", "Zbroj"); field(p, data.zbroj, "typ", "Typ zbroje", null, ["none", "light", "medium", "heavy"]);
      field(p, data.zbroj, "zakladni_ac", "Základní AC zbroje", "number"); field(p, data.zbroj, "stit", "Štít (+2)", "check"); field(p, data.zbroj, "bonus", "Bonus k AC (magie…)", "number");
      strList(p, data, "odolnosti", "Resistances"); strList(p, data, "imunity", "Immunities"); strList(p, data, "zranitelnosti", "Vulnerabilities");
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
      strList(p, data, "naladeni", "Attunement");
      data.penize = data.penize || {}; ["GP", "SP", "CP", "PP"].forEach(function (k) { field(p, data.penize, k, k, "number"); });
      data.osobnost = data.osobnost || {}; [["rysy", "Rysy osobnosti"], ["idealy", "Ideály"], ["pouta", "Pouta"], ["vady", "Vady"]].forEach(function (x) { field(p, data.osobnost, x[0], x[1], "area"); });
      field(p, data, "poznamky", "Poznámky", "area");
    });
    tab("Vlastní rysy", function (p) { list(p, data, "vlastni_rysy", "Zvláštní / božské rysy", [["nazev", "Název"], ["text", "Popis"]]); });
    tab("Vazby a štítky", function (p) {
      relationSelect(p, "zeme", "Země", "02_Zeme/");
      relationSelect(p, "mesta", "Města", "03_Mesta/");
      relationSelect(p, "frakce", "Frakce", "05_Frakce/");
      relationSelect(p, "kampane", "Kampaně", "07_Kampane/");
      strList(p, data, "stitky", "Štítky");
    });
    var raw;
    tab("Vše (JSON)", function (p) {
      p.appendChild(el("p", { class: "ed-pozn" }, "Úplná data postavy. Úprava tady má přednost před ostatními záložkami."));
      raw = el("textarea", { rows: 24, class: "pf-raw" }); raw.value = JSON.stringify(data, null, 2); raw.dataset.orig = raw.value; p.appendChild(raw);
    });
    body.appendChild(tabs); body.appendChild(panes);
    var m = E.modal("Upravit postavu – " + (c.jmeno || ""), body, [{ text: "Uložit", primary: true, click: function () {
      var out = data;
      if (raw && raw.value !== raw.dataset.orig) { try { out = JSON.parse(raw.value); } catch (e) { return alert("Chybný JSON: " + e.message); } }
      else if (armorDefault && data.zbroj && data.zbroj.typ === "none" && Object.keys(data.zbroj).length === 1) delete data.zbroj;
      var cleaned = compactPostava(out) || {};
      out = JSON.stringify(cleaned) === JSON.stringify(compactPostava(c) || {}) ? JSON.parse(JSON.stringify(c)) : cleaned;
      document.body.classList.add("ed-busy");
      E.api("PUT", "postava", { cesta: cesta, postava: out }).then(function () { location.reload(); })
        .catch(function (e) { document.body.classList.remove("ed-busy"); alert("Chyba: " + e.message); });
    } }]);
    m.box.classList.add("ed-wide");
  }

  // ---------- level up a nová postava ----------
  function featPicker(E, v, store) {
    var el = E.el, w = el("div", { class: "lu-feat" }), sel = el("select"), ab = el("span", { class: "lu-ab" });
    sel.appendChild(el("option", { value: "" }, "— vyber feat —"));
    ["Origin", "General", "Fighting Style", "Epic Boon"].forEach(function (kat) {
      var g = v.moznosti.filter(function (o) { return o.kategorie === kat; }); if (!g.length) return;
      var og = document.createElement("optgroup"); og.label = kat;
      g.forEach(function (o) { var op = el("option", { value: o.nazev }, o.nazev + (o.ok ? "" : " – " + o.duvod)); if (!o.ok) op.disabled = true; og.appendChild(op); });
      sel.appendChild(og);
    });
    var P = window.MontelienPravidla;
    function drawAb() {
      ab.innerHTML = ""; store[v.klic] = sel.value ? { nazev: sel.value, atributy: {} } : null; if (!sel.value) return;
      var ch = P.featAbilityChoices(sel.value);
      if (ch.typ === "zadne") return;
      var n = ch.typ === "asi" ? 2 : 1, sels = [];
      for (var i = 0; i < n; i++) { var s2 = el("select"); ch.atributy.forEach(function (a) { s2.appendChild(el("option", { value: a }, "+1 " + a)); }); sels.push(s2); ab.appendChild(s2); }
      function upd() { var a = {}; sels.forEach(function (x) { a[x.value] = (a[x.value] || 0) + 1; }); store[v.klic].atributy = a; }
      sels.forEach(function (x) { x.addEventListener("change", upd); }); upd();
      if (ch.typ === "asi") ab.appendChild(el("small", {}, " (stejný atribut dvakrát = +2)"));
    }
    sel.addEventListener("change", drawAb);
    var t = el("div", { class: "lu-txt" });
    sel.addEventListener("change", function () { var f = R.featy[sel.value]; t.textContent = f ? f.text.slice(0, 400) + (f.text.length > 400 ? "…" : "") : ""; });
    w.appendChild(sel); w.appendChild(ab); w.appendChild(t); return w;
  }
  function renderPlan(E, plan, store, holder) {
    var el = E.el; holder.innerHTML = "";
    if (plan.chyby.length) { holder.appendChild(el("div", { class: "lu-err" }, plan.chyby.map(esc).join("<br>"))); return; }
    plan.kroky.forEach(function (st) {
      var box = el("div", { class: "lu-step" });
      var inf = st.info, sl = (inf.sloty || []).map(function (n, i) { return (i + 1) + ".: " + n; }).join(", ");
      box.appendChild(el("h5", {}, "Úroveň " + st.celkova + " – " + st.trida + " " + st.uroven));
      box.appendChild(el("p", { class: "lu-meta" }, "HP +" + st.hp + " + CON · PB +" + inf.pb + (sl ? " · sloty " + sl : "") + (inf.pakt ? " · Pact " + inf.pakt.pocet + "× " + inf.pakt.uroven + ". úr." : "") +
        (inf.kouzla && (inf.kouzla.cantrips || inf.kouzla.pripravena) ? " · cantripy " + inf.kouzla.cantrips + ", připravená kouzla " + inf.kouzla.pripravena : "")));
      if (st.rysy.length) box.appendChild(el("p", {}, "<b>Rysy:</b> " + st.rysy.map(esc).join(", ")));
      if (inf.multiclass) box.appendChild(el("p", {}, "<b>Multiclass:</b> " + esc(inf.multiclass)));
      st.volby.forEach(function (v) {
        var row = el("label", { class: "lu-choice" }, v.typ === "podtrida" ? "Subclass" : v.typ === "dovednost" ? "Dovednost (multiclass)" : "Feat – " + esc(v.klic));
        if (v.typ === "feat") row.appendChild(featPicker(E, v, store));
        else { var s = el("select"); s.appendChild(el("option", { value: "" }, "— vyber —")); v.moznosti.forEach(function (o) { s.appendChild(el("option", { value: o }, o)); }); s.addEventListener("change", function () { store[v.klic] = s.value; }); row.appendChild(s); }
        box.appendChild(row);
      });
      holder.appendChild(box);
    });
  }
  function levelUpUi(c, cesta, nova) {
    var E = window.MontelienEditor, P = window.MontelienPravidla; if (!E || !P) return; P.init(R);
    var el = E.el, body = el("div", { class: "lu" }), store = {};
    var total = P.totalLevel(c), top = el("div", { class: "lu-top" }), sc = el("select"), n = el("input", { type: "number", min: 1, max: 20 - total, value: nova ? nova.n : 1 });
    Object.keys(R.tridy).forEach(function (k) {
      var why = P.multiclassCheck(c, k), cur = (c.tridy || []).filter(function (t) { return t.trida === k; })[0];
      var op = el("option", { value: k }, k + (cur ? " (teď " + cur.uroven + ")" : (c.tridy || []).length ? " – multiclass" + (why.length ? ": nesplňuje " + why.join("; ") : "") : ""));
      if (why.length) op.disabled = true; sc.appendChild(op);
    });
    sc.value = nova ? nova.trida : (c.tridy && c.tridy[0] ? c.tridy[0].trida : "Fighter");
    var lt = el("label", {}, "Povolání"); lt.appendChild(sc); top.appendChild(lt);
    var ln = el("label", {}, "Počet úrovní (teď " + total + ", max " + (20 - total) + ")"); ln.appendChild(n); top.appendChild(ln);
    var planEl = el("div", { class: "lu-plan" });
    function replan() { store = {}; var k = Number(n.value) || 1; renderPlan(E, P.planLevelUp(c, sc.value, k), store, planEl); }
    sc.addEventListener("change", replan); n.addEventListener("change", replan);
    body.appendChild(top); body.appendChild(planEl); replan();
    var m = E.modal((nova ? "Nová postava – úrovně 2+ – " : "Level up – ") + (c.jmeno || ""), body, [{ text: nova ? "Vytvořit postavu" : "Použít a uložit", primary: true, click: function () {
      var r = P.applyLevelUp(c, sc.value, Number(n.value) || 1, store);
      if (r.chyby.length) return alert("Nejde použít:\n" + r.chyby.join("\n"));
      save(r.postava);
    } }]);
    m.box.classList.add("ed-wide");
    function save(out) {
      document.body.classList.add("ed-busy");
      var hash = window.MontelienPravidla.spellRules(out).length ? "#kouzla-lvl-" + (Number(n.value) || 1) : "";
      E.api(nova ? "POST" : "PUT", "postava", { cesta: cesta, postava: out }).then(function () { if (nova) { location.href = base() + cesta.replace(/\.md$/, "/") + hash; return; } if (hash) { history.replaceState(null, "", location.pathname + hash); } location.reload(); })
        .catch(function (e) { document.body.classList.remove("ed-busy"); alert("Chyba: " + e.message); });
    }
  }
  function newCharUi() {
    var E = window.MontelienEditor, P = window.MontelienPravidla; if (!E || !P) return; rules().then(function () {
      P.init(R); var el = E.el, b = el("div", { class: "lu nc" }), s = { metoda: "standard", zaklad: {}, bonus: {}, dovednosti: [] };
      function sel(label, opts, key, obj, onch) { var l = el("label", {}, label), x = el("select"); x.appendChild(el("option", { value: "" }, "—")); opts.forEach(function (o) { var value = typeof o === "string" ? o : o.value, text = typeof o === "string" ? o : o.label; x.appendChild(el("option", { value: value }, text)); }); x.addEventListener("change", function () { (obj || s)[key] = x.value; if (onch) onch(); }); l.appendChild(x); return l; }
      var g1 = el("div", { class: "lu-top" });
      var jm = el("label", {}, "Jméno"), ji = el("input", { type: "text" }); ji.addEventListener("change", function () { s.jmeno = ji.value; }); jm.appendChild(ji); g1.appendChild(jm);
      g1.appendChild(sel("Složka", ["04_Postavy/NPC", "04_Postavy/Vladci", "04_Postavy/Stavitele_a_Bohove"], "slozka"));
      var lvl = el("label", {}, "Cílová úroveň"), li = el("input", { type: "number", min: 1, max: 20, value: 1 }); lvl.appendChild(li); g1.appendChild(lvl);
      b.appendChild(g1);
      var origin = Object.keys(R.featy).filter(function (k) { return R.featy[k].kategorie === "Origin"; }).sort();
      var fs = Object.keys(R.featy).filter(function (k) { return R.featy[k].kategorie === "Fighting Style"; }).sort();
      var g2 = el("div", { class: "lu-top" }), dyn = el("div", { class: "lu-dyn" });
      g2.appendChild(sel("Druh (Species)", Object.keys(R.druhy).sort(speciesSort).map(function (name) { return { value: name, label: speciesLabel(name) }; }), "druh", null, draw));
      g2.appendChild(sel("Pozadí (Background)", Object.keys(R.pozadi).sort(), "pozadi", null, draw));
      g2.appendChild(sel("Povolání", Object.keys(R.tridy), "trida", null, draw));
      g2.appendChild(sel("Atributy", ["standard", "pointbuy", "rucne"], "metoda", null, draw));
      b.appendChild(g2); b.appendChild(dyn);
      var errEl = el("div", { class: "lu-err" }); b.appendChild(errEl);
      function draw() {
        dyn.innerHTML = ""; s.dovednosti = []; s.bonus = {};
        if ((R.druhy[s.druh] || {}).legacy) dyn.appendChild(el("p", { class: "pf-legacy-note" }, "legacy, kompatibilní · alternativa 2024: " + (R.druhy[s.druh].alternativa_2024 || "žádná přímá")));
        var bg = R.pozadi[s.pozadi];
        var ab = el("div", { class: "pf-abil" });
        P.AB.forEach(function (a) { var l = el("label", {}, a + (s.metoda === "standard" ? " (15/14/13/12/10/8)" : s.metoda === "pointbuy" ? " (8–15, 27 bodů)" : "")), i = el("input", { type: "number", min: 3, max: 20, value: s.zaklad[a] || "" }); i.addEventListener("change", function () { s.zaklad[a] = Number(i.value); cost(); }); l.appendChild(i); ab.appendChild(l); });
        var cw = el("small", { class: "lu-cost" }); function cost() { if (s.metoda !== "pointbuy") return cw.textContent = ""; var t = P.AB.reduce(function (x, a) { return x + (P.COST[s.zaklad[a]] == null ? 0 : P.COST[s.zaklad[a]]); }, 0); cw.textContent = "Point Buy: " + t + " / 27"; }
        dyn.appendChild(el("h5", {}, "Atributy (před bonusem z pozadí)")); dyn.appendChild(ab); dyn.appendChild(cw); cost();
        if (bg) {
          var al = []; ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].forEach(function (x, i) { if (bg.atributy.indexOf(x) >= 0) al.push(P.AB[i]); });
          dyn.appendChild(el("p", {}, "<b>" + esc(s.pozadi) + ":</b> atributy " + al.join(", ") + " · feat " + esc(bg.feat) + " · dovednosti " + esc(bg.dovednosti) + " · nástroj " + esc(bg.nastroj)));
          var bm = el("div", { class: "lu-top" }), mode = el("select"); ["+2 / +1", "+1 / +1 / +1"].forEach(function (o) { mode.appendChild(el("option", { value: o }, o)); });
          var a1 = el("select"), a2 = el("select"); al.forEach(function (a) { a1.appendChild(el("option", { value: a }, "+2 " + a)); a2.appendChild(el("option", { value: a }, "+1 " + a)); }); a2.value = al[1];
          function ub() { s.bonus = {}; if (mode.value === "+2 / +1") { s.bonus[a1.value] = 2; s.bonus[a2.value] = (s.bonus[a2.value] || 0) + 1; a1.style.display = a2.style.display = ""; } else { al.forEach(function (a) { s.bonus[a] = 1; }); a1.style.display = a2.style.display = "none"; } }
          [mode, a1, a2].forEach(function (x) { x.addEventListener("change", ub); }); ub();
          var lb = el("label", {}, "Bonus z pozadí"); lb.appendChild(mode); bm.appendChild(lb); bm.appendChild(a1); bm.appendChild(a2); dyn.appendChild(bm);
        }
        if (s.druh === "Human") { var hr = el("div", { class: "lu-top" }); hr.appendChild(sel("Versatile – Origin feat", origin, "origin_feat")); hr.appendChild(sel("Skillful – dovednost", P.SKILLS, "skillful")); dyn.appendChild(hr); }
        if (s.druh === "Elf") dyn.appendChild(sel("Keen Senses", ["Insight", "Perception", "Survival"], "keen"));
        if (s.druh) dyn.appendChild(el("label", {}, "Volby druhu (lineage, ancestry…)")).appendChild((function () { var i = el("input", { type: "text" }); i.addEventListener("change", function () { s.druh_volby = i.value; }); return i; })());
        if (s.trida) {
          var r = P.classSkillRule(s.trida), sk = el("div", { class: "pf-checks pf-skills" }); sk.appendChild(el("h5", {}, s.trida + ": vyber " + r.pocet + " dovednosti"));
          r.z.forEach(function (x) { var l = el("label", {}), i = el("input", { type: "checkbox" }); i.addEventListener("change", function () { if (i.checked) s.dovednosti.push(x); else s.dovednosti = s.dovednosti.filter(function (y) { return y !== x; }); if (s.dovednosti.length > r.pocet) { i.checked = false; s.dovednosti.pop(); } }); l.appendChild(i); l.appendChild(document.createTextNode(" " + x)); sk.appendChild(l); });
          dyn.appendChild(sk);
          if (P.classMilestones(s.trida).fs === 1) dyn.appendChild(sel("Fighting Style (feat)", fs, "fighting_style"));
        }
      }
      draw();
      E.modal("Nová postava (pravidla 2024)", b, [{ text: "Pokračovat", primary: true, click: function () {
        var r = P.createCharacter(s);
        if (!s.slozka) r.chyby.push("Vyber složku.");
        if (!s.jmeno) r.chyby.push("Zadej jméno.");
        if (r.chyby.length) { errEl.innerHTML = r.chyby.map(esc).join("<br>"); return false; }
        var slug = s.jmeno.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
        var cesta = s.slozka + "/Postava_" + slug + ".md", target = Math.max(1, Math.min(20, Number(li.value) || 1));
        r.postava.prevod_2024 = "Vytvořeno průvodcem podle pravidel 2024.";
        document.querySelectorAll(".ed-modal-bg").forEach(function (x) { x.remove(); });
        if (target > 1) levelUpUi(r.postava, cesta, { trida: s.trida, n: target - 1 });
        else E.api("POST", "postava", { cesta: cesta, postava: r.postava }).then(function () { location.href = base() + cesta.replace(/\.md$/, "/") + (P.spellRules(r.postava).length ? "#kouzla-lvl-1" : ""); }).catch(function (e) { alert("Chyba: " + e.message); });
      } }]).box.classList.add("ed-wide");
    });
  }
  // ---------- výběr kouzel ----------
  var SR_RES = { "Focus Points": "all", "Second Wind": "1", "Channel Divinity": "1", "Wild Shape": "1", "Rages": "1" };
  var REZIM_TXT = { free: "Úpravy: volný výběr (hlídají se jen limity).", lvl: "Level up: doplň nová kouzla do limitu a případně vyměň, co pravidla dovolí.", lr: "Long Rest: změny podle pravidel povolání.", sr: "Short Rest: Memorize Spell (Wizard 5+) – vyměň jedno připravené kouzlo ze spellbooku." };
  function dmSpellUi(c, cesta) {
    var E = window.MontelienEditor; if (!E) return; var el = E.el, body = el("div", { class: "sp" });
    var names = Object.keys(R.kouzla).sort(), pick = {};
    body.appendChild(el("p", { class: "sp-mode" }, "Libovolná kouzla mimo pravidla povolání (rozhodnutí PJ). Přidají se jako vždy připravená; počet použití a zdroj zapiš do poznámky."));
    var f = el("div", { class: "kz-filtr" }), q = el("input", { placeholder: "Hledat kouzlo…" }), lv = el("select"), note = el("input", { placeholder: "Poznámka (např. 1× za Long Rest, Ring of …)" });
    lv.appendChild(el("option", { value: "" }, "Všechny úrovně")); for (var i = 0; i <= 9; i++) lv.appendChild(el("option", { value: i }, i ? i + ". úroveň" : "Cantripy"));
    f.appendChild(q); f.appendChild(lv); f.appendChild(note); body.appendChild(f);
    var tbl = el("table", { class: "kz-tab sp-tab" }); body.appendChild(tbl);
    var have = {}; (c.kouzla || []).forEach(function (k) { have[k.nazev] = 1; });
    function draw() {
      var qq = q.value.toLowerCase(), ll = lv.value, rows = names.filter(function (n) { var k = R.kouzla[n]; return (!qq || n.toLowerCase().indexOf(qq) >= 0) && (ll === "" || String(k.uroven) === ll); }).slice(0, 150);
      tbl.innerHTML = "<tr><th></th><th>Kouzlo</th><th>Úr.</th><th>Škola</th><th>Povolání</th></tr>" + rows.map(function (n) { var k = R.kouzla[n]; return '<tr><td><input type="checkbox" data-n="' + esc(n) + '"' + (pick[n] || have[n] ? " checked" : "") + (have[n] ? " disabled" : "") + '></td><td><a href="#" class="kz-link" data-kouzlo="' + esc(n) + '">' + esc(n) + '</a></td><td>' + (k.uroven || "C") + '</td><td>' + esc(k.skola || "") + '</td><td><small>' + esc(k.tridy || "") + '</small></td></tr>'; }).join("");
    }
    tbl.addEventListener("change", function (e) { var n = e.target.dataset.n; if (n) { if (e.target.checked) pick[n] = 1; else delete pick[n]; } });
    q.addEventListener("input", draw); lv.addEventListener("change", draw); draw();
    var m = E.modal("Kouzla dle PJ – " + (c.jmeno || ""), body, [{ text: "Přidat vybraná", primary: true, click: function () {
      var add = Object.keys(pick); if (!add.length) return m.close ? m.close() : null;
      var out = JSON.parse(JSON.stringify(c)); out.kouzla = out.kouzla || [];
      add.forEach(function (n) { out.kouzla.push({ nazev: n, uroven: Number(R.kouzla[n].uroven) || 0, trida: "PJ", vzdy: true, poznamka: note.value || "dle PJ" }); });
      document.body.classList.add("ed-busy");
      E.api("PUT", "postava", { cesta: cesta, postava: out }).then(function () { location.reload(); }).catch(function (e) { document.body.classList.remove("ed-busy"); alert("Chyba: " + e.message); });
    } }]);
    m.box.classList.add("ed-wide");
  }
  function spellUi(c, cesta, rezim, nLvl) {
    var E = window.MontelienEditor, P = window.MontelienPravidla; if (!E || !P) return; P.init(R);
    var rulesL = P.spellRules(c); if (!rulesL.length) return alert("Postava nemá rys Spellcasting.");
    var el = E.el, body = el("div", { class: "sp" }), tabs = el("div", { class: "pf-tabs" }), panes = el("div"), state = {};
    body.appendChild(el("p", { class: "sp-mode" }, esc(REZIM_TXT[rezim] || "")));
    rulesL.forEach(function (r, idx) {
      var st = state[r.trida] = {}, mine = (c.kouzla || []).filter(function (k) { return k.trida === r.trida; });
      mine.forEach(function (k) { if (!k.vzdy) st[k.nazev] = { prep: !k.kniha, kniha: !!k.kniha || !!(r.kniha && Number(k.uroven) > 0), uroven: Number(k.uroven != null ? k.uroven : ((R.spell(k.nazev) || {}).uroven || 0)), poznamka: k.poznamka }; });
      var orig = JSON.parse(JSON.stringify(st));
      var pane = el("div", { class: "pf-pane" }); if (idx) pane.style.display = "none";
      var btn = el("button", { class: "ed-btn" + (idx ? "" : " ed-primary") }, r.trida + (r.podtrida ? " (" + r.podtrida + ")" : ""));
      btn.addEventListener("click", function () { panes.querySelectorAll(".pf-pane").forEach(function (x) { x.style.display = "none"; }); pane.style.display = ""; tabs.querySelectorAll("button").forEach(function (b) { b.classList.remove("ed-primary"); }); btn.classList.add("ed-primary"); });
      tabs.appendChild(btn);
      var head = el("div", { class: "sp-head" });
      pane.appendChild(head);
      pane.appendChild(el("ul", { class: "sp-rules" }, P.changeRulesText(r).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("")));
      var vz = mine.filter(function (k) { return k.vzdy; });
      if (vz.length) pane.appendChild(el("p", { class: "sp-vzdy" }, "<b>Vždy připravená</b> (subclass, feat, druh, Mystic Arcanum – nepočítají se do limitu): " + vz.map(function (k) { return '<a href="#" class="kz-link" data-kouzlo="' + esc(k.nazev) + '">' + esc(k.nazev) + '</a>'; }).join(", ")));
      var f = el("div", { class: "kz-filtr" }), q = el("input", { placeholder: "Hledat kouzlo…" }), lv = el("select"), only = el("label", {}, " jen vybraná");
      lv.appendChild(el("option", { value: "" }, "Všechny úrovně")); for (var i = 0; i <= r.maxUroven; i++) lv.appendChild(el("option", { value: i }, i ? i + ". úroveň" : "Cantripy"));
      var oc = el("input", { type: "checkbox" }); only.insertBefore(oc, only.firstChild);
      f.appendChild(q); f.appendChild(lv); f.appendChild(only); pane.appendChild(f);
      var tbl = el("table", { class: "kz-tab sp-tab" }); pane.appendChild(tbl);
      var all = r.moznosti.concat(Object.keys(st).filter(function (n) { return r.moznosti.indexOf(n) < 0; }));
      function counts() { var a = { c: 0, p: 0, b: 0 }; Object.keys(st).forEach(function (n) { var x = st[n]; if (x.uroven === 0) { if (x.prep) a.c++; } else { if (x.prep) a.p++; if (x.kniha || x.prep) a.b++; } }); return a; }
      function drawHead() {
        var n = counts(), cls = function (v, m) { return v > m ? ' class="sp-over"' : v === m ? ' class="sp-full"' : ''; };
        head.innerHTML = '<span' + cls(n.c, r.cantrips) + '>Cantripy <b>' + n.c + ' / ' + r.cantrips + '</b></span><span' + cls(n.p, r.pripravena) + '>Připravená <b>' + n.p + ' / ' + r.pripravena + '</b></span>' + (r.kniha ? '<span' + cls(n.b, r.kniha) + '>Spellbook <b>' + n.b + ' / ' + r.kniha + '</b></span>' : '') + '<span>Max. úroveň kouzel <b>' + r.maxUroven + '</b></span><span>Seznam <b>' + esc(r.seznam) + '</b> · ' + r.ab + '</span>';
      }
      function draw() {
        var qq = q.value.toLowerCase(), ll = lv.value;
        tbl.innerHTML = '<tr><th>' + (r.kniha ? "Připraveno" : "Vybráno") + '</th>' + (r.kniha ? '<th>Ve spellbooku</th>' : '') + '<th>Kouzlo</th><th>Úr.</th><th>Škola</th></tr>';
        all.filter(function (n) { var s = R.spell(n) || {}, x = st[n]; return (!qq || n.toLowerCase().indexOf(qq) >= 0) && (ll === "" || Number(s.uroven) === Number(ll)) && (!oc.checked || (x && (x.prep || x.kniha))); })
          .sort(function (a, b) { return (((R.spell(a) || {}).uroven || 0) - ((R.spell(b) || {}).uroven || 0)) || a.localeCompare(b); }).slice(0, 400)
          .forEach(function (n) {
            var s = R.spell(n) || {}, x = st[n] || { prep: false, kniha: false, uroven: Number(s.uroven) || 0 }, tr = el("tr", { class: x.prep ? "sp-on" : "" });
            var cb = el("input", { type: "checkbox" }); cb.checked = !!x.prep;
            if (r.kniha && x.uroven > 0 && (rezim === "lr" || rezim === "sr") && !(orig[n] && (orig[n].kniha || orig[n].prep))) { cb.disabled = true; cb.title = "Není ve spellbooku"; }
            cb.addEventListener("change", function () { st[n] = st[n] || x; st[n].prep = cb.checked; if (cb.checked && r.kniha && x.uroven > 0) st[n].kniha = true; drawHead(); draw(); });
            var td = el("td"); td.appendChild(cb); tr.appendChild(td);
            if (r.kniha) { var td2 = el("td"); if (x.uroven > 0) { var kb = el("input", { type: "checkbox" }); kb.checked = !!(x.kniha || x.prep); if (rezim === "lr" || rezim === "sr") kb.disabled = true; kb.addEventListener("change", function () { st[n] = st[n] || x; st[n].kniha = kb.checked; if (!kb.checked) st[n].prep = false; drawHead(); draw(); }); td2.appendChild(kb); } tr.appendChild(td2); }
            tr.appendChild(el("td", {}, '<a href="#" class="kz-link" data-kouzlo="' + esc(n) + '">' + esc(n) + '</a>' + (r.moznosti.indexOf(n) < 0 ? ' <small class="ps-warn">mimo seznam / nad úrovní</small>' : '')));
            tr.appendChild(el("td", {}, x.uroven ? String(x.uroven) : "C")); tr.appendChild(el("td", {}, esc(s.skola || ""))); tbl.appendChild(tr);
          });
      }
      q.addEventListener("input", draw); lv.addEventListener("change", draw); oc.addEventListener("change", draw);
      drawHead(); draw(); panes.appendChild(pane);
    });
    body.appendChild(tabs); body.appendChild(panes);
    function build() {
      var out = JSON.parse(JSON.stringify(c)), keep = (out.kouzla || []).filter(function (k) { return !state[k.trida] || k.vzdy; });
      rulesL.forEach(function (r) { var st = state[r.trida]; Object.keys(st).forEach(function (n) { var x = st[n]; if (!x.prep && !x.kniha) return; var o = { nazev: n, uroven: x.uroven, trida: r.trida }; if (!x.prep && x.kniha) o.kniha = true; if (x.poznamka) o.poznamka = x.poznamka; keep.push(o); }); });
      out.kouzla = keep; return out;
    }
    var m = E.modal("Kouzla – " + (c.jmeno || ""), body, [{ text: "Uložit kouzla", primary: true, click: function () {
      var out = build(), errs = [];
      rulesL.forEach(function (r) { P.checkSpellChange(c, out, r.trida, rezim, nLvl).forEach(function (e) { errs.push(r.trida + ": " + e); }); });
      if (errs.length && rezim !== "free") { alert("Podle pravidel to nejde:\n" + errs.join("\n")); return false; }
      if (errs.length && !confirm("Upozornění:\n" + errs.join("\n") + "\n\nUložit i tak?")) return false;
      document.body.classList.add("ed-busy");
      E.api("PUT", "postava", { cesta: cesta, postava: out }).then(function () { location.reload(); }).catch(function (e) { document.body.classList.remove("ed-busy"); alert("Chyba: " + e.message); });
    } }]);
    m.box.classList.add("ed-wide");
  }
  // ---------- odpočinek ----------
  function hdLeft(root) { root.querySelectorAll(".ps-hdleft").forEach(function (x) { var used = Number(localStorage.getItem(x.dataset.key + ":hd") || 0); x.textContent = Math.max(0, Number(x.dataset.total) - used); }); }
  function rest(kind, c, d, cesta, key) {
    var st = JSON.parse(localStorage.getItem(key) || "null") || { hp: d.hp, tmp: "" }, used = Number(localStorage.getItem(key + ":hd") || 0), msg = [];
    function clear(prefix) { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(prefix) === 0 && k !== key + ":session") localStorage.removeItem(k); }); }
    if (kind === "long") {
      if (!confirm("Long Rest (8 hodin): plné HP, všechny spell sloty, zdroje a Hit Dice. Pokračovat?")) return;
      st = { hp: d.hp, tmp: "" }; used = 0; clear(key + ":s"); clear(key + ":p"); clear(key + ":z:");
      var session = sessionState(key); session.successes = 0; session.failures = 0; session.exhaustion = Math.max(0, session.exhaustion - 1); session.concentrating = false; session.concentrationSpell = ""; saveSession(key, session);
      msg.push("Long Rest: HP " + d.hp + ", sloty a zdroje obnoveny, Hit Dice " + d.lvl + "/" + d.lvl + ".");
    } else {
      var left = d.lvl - used, n = prompt("Short Rest (1 hodina). Kolik Hit Dice utratíš? Zbývá " + left + " (" + d.dice + ").", left > 0 && st.hp < d.hp ? "1" : "0");
      if (n === null) return; n = Math.max(0, Math.min(left, Number(n) || 0));
      var die = Number((String(d.dice).match(/d(\d+)/) || [0, 8])[1]), heal = 0, rolls = [];
      for (var i = 0; i < n; i++) { var r = 1 + Math.floor(Math.random() * die); rolls.push(r); heal += Math.max(1, r + d.mods.CON); }
      st.hp = Math.min(d.hp, Number(st.hp) + heal); used += n;
      clear(key + ":p");
      document.querySelectorAll('.p2-pips[data-sr]').forEach(function (w) { var k = w.dataset.k, v = Number(localStorage.getItem(k) || 0); if (w.dataset.sr === "all") localStorage.removeItem(k); else if (w.dataset.sr === "1" && v) localStorage.setItem(k, v - 1); });
      msg.push("Short Rest: " + (n ? n + "× d" + die + " [" + rolls.join(", ") + "] → +" + heal + " HP. " : "") + "Pact Magic a zdroje na krátký odpočinek obnoveny.");
    }
    localStorage.setItem(key, JSON.stringify(st)); localStorage.setItem(key + ":hd", used);
    toast(msg.join(" "));
    var P = window.MontelienPravidla, rl = P ? P.spellRules(c) : [], canEdit = cesta && document.body.classList.contains("ed-on");
    var offer = rl.filter(function (r) { var z = r.zmena || {}; return kind === "long" ? (z.lr || z.cLr) : (z.sr && r.uroven >= 5); });
    if (canEdit && offer.length && confirm(kind === "long" ? "Chceš teď změnit připravená kouzla podle pravidel Long Rest?" : "Memorize Spell: vyměnit jedno připravené kouzlo?")) { spellUi(c, cesta, kind === "long" ? "lr" : "sr"); return; }
    setTimeout(function () { location.reload(); }, 1200);
  }
  window.MontelienPostava = { novaPostava: newCharUi, compute: compute, rules: rules, autoDpr: autoDpr };
  function toolbarBtn() {
    var bar = document.getElementById("ed-toolbar"); if (!bar || bar.querySelector("[data-nova-postava]")) return;
    var b = document.createElement("button"); b.className = "ed-btn"; b.dataset.novaPostava = "1"; b.textContent = "+ Nová postava"; b.addEventListener("click", newCharUi); bar.appendChild(b);
  }
  setInterval(toolbarBtn, 700);

  function init() {
    var holder = document.querySelector(".postava-sheet"), dataEl = document.querySelector(".postava-data");
    if (!holder || !dataEl || holder.dataset.done) return;
    holder.dataset.done = "1";
    var c = JSON.parse(dataEl.textContent), portraitUrl = holder.dataset.portretUrl || "", src = document.getElementById("zdroj-stranky"), cesta = src && src.dataset.cesta;
    rules().then(function () {
      var draw = function () {
        holder.innerHTML = render(c, compute(c, cesta), cesta, portraitUrl); hpTracker(holder); sheetUi(holder); bindTrackers(holder, "ps-hp:" + (cesta || c.jmeno), draw);
        var b = holder.querySelector("[data-ps-edit]"); if (b) b.addEventListener("click", function () { editor(c, cesta); });
        var lb = holder.querySelector("[data-ps-lvl]"); if (lb) lb.addEventListener("click", function () { levelUpUi(c, cesta); });
        var sb = holder.querySelector("[data-ps-spells]"); if (sb) sb.addEventListener("click", function () { spellUi(c, cesta, "free"); });
        var db = holder.querySelector("[data-ps-dmspell]"); if (db) db.addEventListener("click", function () { dmSpellUi(c, cesta); });
        holder.querySelectorAll("[data-rest]").forEach(function (b) { b.addEventListener("click", function () { rest(b.dataset.rest, c, compute(c, cesta), cesta, "ps-hp:" + (cesta || c.jmeno)); }); });
        hdLeft(holder);
        var hm = location.hash.match(/^#kouzla-(lvl|lr|sr|free)(?:-(\d+))?$/);
        if (hm && cesta) { var tt = setInterval(function () { if (document.body.classList.contains("ed-on")) { clearInterval(tt); history.replaceState(null, "", location.pathname); spellUi(c, cesta, hm[1], Number(hm[2]) || 1); } }, 200); setTimeout(function () { clearInterval(tt); }, 6000); }
      };
      draw();
      var tries = 0, t = setInterval(function () { if (document.body.classList.contains("ed-on") || ++tries > 20) { clearInterval(t); if (document.body.classList.contains("ed-on")) draw(); } }, 150);
    });
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
