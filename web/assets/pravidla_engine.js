// Pravidla D&D 2024: tvorba postavy, level up, nabídka featů a kontrola. Funguje v prohlížeči i v Node (testy).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(); else root.MontelienPravidla = factory();
})(this, function () {
  var AB = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  var AB_EN = { Strength: "STR", Dexterity: "DEX", Constitution: "CON", Intelligence: "INT", Wisdom: "WIS", Charisma: "CHA" };
  var SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation",
    "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
  // primární atributy (pro multiclass): seznam alternativ, každá alternativa = atributy, které musí mít 13+
  var PRIMARY = { Barbarian: [["STR"]], Bard: [["CHA"]], Cleric: [["WIS"]], Druid: [["WIS"]], Fighter: [["STR"], ["DEX"]], Monk: [["DEX", "WIS"]],
    Paladin: [["STR", "CHA"]], Ranger: [["DEX", "WIS"]], Rogue: [["DEX"]], Sorcerer: [["CHA"]], Warlock: [["CHA"]], Wizard: [["INT"]] };
  // co získáš, když do třídy vstoupíš multiclassem (PHB 2024)
  var MULTI_PROF = { Barbarian: { armor: ["Shields"], skills: 0 }, Bard: { armor: ["Light"], skills: 1 }, Cleric: { armor: ["Light", "Medium", "Shields"], skills: 0 },
    Druid: { armor: ["Light", "Shields"], skills: 0 }, Fighter: { armor: ["Light", "Medium", "Shields"], skills: 0 }, Monk: { armor: [], skills: 0 },
    Paladin: { armor: ["Light", "Medium", "Shields"], skills: 0 }, Ranger: { armor: ["Light", "Medium", "Shields"], skills: 1 },
    Rogue: { armor: ["Light"], skills: 1 }, Sorcerer: { armor: [], skills: 0 }, Warlock: { armor: ["Light"], skills: 0 }, Wizard: { armor: [], skills: 0 } };
  var FULL = { Bard: 1, Cleric: 1, Druid: 1, Sorcerer: 1, Wizard: 1 }, HALF = { Paladin: 1, Ranger: 1 }, THIRD = { "Eldritch Knight": "INT", "Arcane Trickster": "INT" };
  var CAST_AB = { Bard: "CHA", Cleric: "WIS", Druid: "WIS", Sorcerer: "CHA", Wizard: "INT", Paladin: "CHA", Ranger: "WIS", Warlock: "CHA" };
  var MULTI = [[], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
    [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
  var SLOT_COLS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  var R = null;

  function init(rules) { R = rules; return api; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mod(s) { return Math.floor(((Number(s) || 10) - 10) / 2); }
  function num(v) { var n = parseInt(String(v || "").replace(/[^\d-]/g, ""), 10); return isNaN(n) ? 0 : n; }
  function cls(n) { return R.tridy[n]; }
  function row(n, lv) { return ((cls(n) || {}).tabulka || {})[lv] || {}; }
  function feats(r) { return String(r.Features || r["Class Features"] || ""); }
  function totalLevel(c) { return (c.tridy || []).reduce(function (a, t) { return a + (Number(t.uroven) || 0); }, 0); }
  function lvlOf(c, n) { return (c.tridy || []).filter(function (t) { return t.trida === n; }).reduce(function (a, t) { return a + Number(t.uroven); }, 0); }
  function pb(lvl) { return 2 + Math.floor((Math.max(1, lvl) - 1) / 4); }
  function featName(n) { return String(n || "").replace(/\s*\(.*\)$/, "").replace("Two Weapon Fighting", "Two-Weapon Fighting"); }
  function featInfo(n) { return R.featy[featName(n)] || null; }
  function hasFeat(c, n) { return (c.featy || []).some(function (f) { return featName(f.nazev) === n; }); }
  function abilityList(s) { var out = []; Object.keys(AB_EN).forEach(function (k) { if (String(s).indexOf(k) >= 0) out.push(AB_EN[k]); }); return out; }

  // ---------- úrovně rysů ----------
  function classMilestones(n) {
    var t = (cls(n) || {}).tabulka || {}, m = { asi: [], boon: null, fs: null, subclass: 3 };
    Object.keys(t).forEach(function (lv) {
      var f = feats(t[lv]); lv = Number(lv);
      if (/Ability Score Improvement/.test(f)) m.asi.push(lv);
      if (/Epic Boon/.test(f)) m.boon = lv;
      if (/Fighting Style/.test(f)) m.fs = lv;
    });
    m.asi.sort(function (a, b) { return a - b; });
    return m;
  }
  function featSlots(c) {
    var out = [], bg = R.pozadi[c.pozadi];
    if (bg) out.push({ typ: "origin", zdroj: "Pozadí (" + c.pozadi + ")", pevny: bg.feat });
    if (/^Human\b/.test(c.druh || "") && R.druhy.Human) out.push({ typ: "origin", zdroj: "Human – Versatile" });
    (c.tridy || []).forEach(function (t) {
      var m = classMilestones(t.trida), lv = Number(t.uroven);
      if (m.fs && lv >= m.fs) out.push({ typ: "fs", zdroj: "Fighting Style (" + t.trida + " " + m.fs + ")", trida: t.trida, uroven: m.fs });
      m.asi.forEach(function (a) { if (lv >= a) out.push({ typ: "asi", zdroj: t.trida + " " + a, trida: t.trida, uroven: a }); });
      if (m.boon && lv >= m.boon) out.push({ typ: "boon", zdroj: "Epic Boon (" + t.trida + " " + m.boon + ")", trida: t.trida, uroven: m.boon });
    });
    return out;
  }

  // ---------- proficiency ze zbrojí, kouzlení ----------
  function armorTraining(c) {
    var a = {}, first = c.tridy && c.tridy[0] && cls(c.tridy[0].trida);
    if (first) { var s = first.core["Armor Training"] || ""; ["Light", "Medium", "Heavy"].forEach(function (k) { if (s.indexOf(k) >= 0) a[k] = 1; }); if (/Shield/.test(s)) a.Shields = 1; }
    (c.tridy || []).slice(1).forEach(function (t) { (MULTI_PROF[t.trida] || { armor: [] }).armor.forEach(function (k) { a[k] = 1; }); });
    if (hasFeat(c, "Lightly Armored")) { a.Light = 1; a.Shields = 1; }
    if (hasFeat(c, "Moderately Armored")) { a.Medium = 1; a.Shields = 1; }
    if (hasFeat(c, "Heavily Armored")) a.Heavy = 1;
    return a;
  }
  function hasSpellcasting(c) {
    return (c.tridy || []).some(function (t) {
      if (t.trida === "Warlock" || FULL[t.trida] || HALF[t.trida]) return true;
      return THIRD[t.podtrida] && Number(t.uroven) >= 3;
    }) || hasFeat(c, "Magic Initiate");
  }
  function hasFightingStyle(c) {
    return (c.tridy || []).some(function (t) { var m = classMilestones(t.trida); return m.fs && Number(t.uroven) >= m.fs; });
  }

  // ---------- předpoklady featů ----------
  function checkPrereq(c, name, lvl) {
    var f = featInfo(name); if (!f) return "Feat není v pravidlech 2024.";
    var p = f.predpoklad || "", ab = c.atributy || {}, why = [];
    if (f.kategorie === "Epic Boon" && lvl < 19) why.push("vyžaduje úroveň 19+");
    var lm = p.match(/Level (\d+)\+/); if (lm && lvl < Number(lm[1])) why.push("vyžaduje úroveň " + lm[1] + "+");
    var am = p.match(/((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,? (?:or )?(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*) (\d+)\+/);
    if (am) { var need = Number(am[2]), list = abilityList(am[1]); if (!list.some(function (a) { return (Number(ab[a]) || 0) >= need; })) why.push(list.join(" nebo ") + " " + need + "+"); }
    var tr = armorTraining(c);
    if (/Light Armor Training/.test(p) && !tr.Light) why.push("Light Armor Training");
    if (/Medium Armor Training/.test(p) && !tr.Medium) why.push("Medium Armor Training");
    if (/Heavy Armor Training/.test(p) && !tr.Heavy) why.push("Heavy Armor Training");
    if (/Shield Training/.test(p) && !tr.Shields) why.push("Shield Training");
    if (/Spellcasting or Pact Magic/.test(p) && !hasSpellcasting(c)) why.push("rys Spellcasting nebo Pact Magic");
    if (/Fighting Style Feature/.test(p) && !hasFightingStyle(c)) why.push("rys Fighting Style");
    return why.length ? "Nesplňuje: " + why.join(", ") : "";
  }
  function repeatable(n) { var f = featInfo(n); return !!(f && /Repeatable/.test(f.text)); }
  // nabídka featů pro slot: [{nazev, kategorie, ok, duvod}]
  function featOptions(c, slot, lvl) {
    lvl = lvl || totalLevel(c);
    var allowed = slot.typ === "origin" ? ["Origin"] : slot.typ === "fs" ? ["Fighting Style"] : slot.typ === "boon" ? ["Epic Boon", "General", "Origin", "Fighting Style"] : ["General", "Origin", "Fighting Style"];
    var taken = {}; (c.featy || []).forEach(function (f) { if (f.zdroj !== slot.zdroj) taken[featName(f.nazev)] = 1; });
    return Object.keys(R.featy).sort().filter(function (n) { return allowed.indexOf(R.featy[n].kategorie) >= 0; }).map(function (n) {
      var why = checkPrereq(c, n, lvl);
      if (!why && taken[n] && !repeatable(n)) why = "Už ho má (nelze opakovat).";
      return { nazev: n, kategorie: R.featy[n].kategorie, ok: !why, duvod: why };
    });
  }

  // ---------- multiclass ----------
  function multiclassCheck(c, nova) {
    var ab = c.atributy || {}, why = [];
    function okFor(n) { return (PRIMARY[n] || [[]]).some(function (alt) { return alt.every(function (a) { return (Number(ab[a]) || 0) >= 13; }); }); }
    function txt(n) { return (PRIMARY[n] || []).map(function (alt) { return alt.join(" a ") + " 13+"; }).join(" nebo "); }
    var classes = (c.tridy || []).map(function (t) { return t.trida; });
    if (classes.indexOf(nova) < 0 && classes.length) {
      if (!okFor(nova)) why.push(nova + ": " + txt(nova));
      classes.forEach(function (n) { if (!okFor(n)) why.push(n + ": " + txt(n)); });
    }
    return why;
  }

  // ---------- odvozené hodnoty ----------
  function derive(c) {
    var d = {}, tr = c.tridy || [];
    d.lvl = totalLevel(c) || 1; d.pb = pb(d.lvl);
    d.mods = {}; AB.forEach(function (a) { d.mods[a] = mod((c.atributy || {})[a]); });
    var first = tr[0] && cls(tr[0].trida);
    d.saveProf = first ? abilityList(first.core["Saving Throw Proficiencies"] || "") : [];
    var hp = 0, dice = {};
    tr.forEach(function (t, i) {
      var k = cls(t.trida); if (!k) return; var hd = k.hit_die, n = Number(t.uroven) || 0;
      dice["d" + hd] = (dice["d" + hd] || 0) + n;
      hp += i === 0 ? hd + (n - 1) * (hd / 2 + 1) : n * (hd / 2 + 1);
    });
    hp += d.lvl * d.mods.CON;
    if (hasFeat(c, "Tough")) hp += 2 * d.lvl;
    if (/Dwarf/.test(c.druh || "")) hp += d.lvl;
    if (hasFeat(c, "Boon of Fortitude")) hp += 40;
    d.hp = hp; d.dice = dice;
    var cl = 0, casters = [];
    tr.forEach(function (t) {
      var lv = Number(t.uroven) || 0;
      if (FULL[t.trida]) { cl += lv; casters.push(t); }
      else if (HALF[t.trida]) { cl += Math.ceil(lv / 2); casters.push(t); }
      else if (THIRD[t.podtrida] && lv >= 3) { cl += Math.floor(lv / 3); casters.push(t); }
      if (t.trida === "Warlock") { var r = row("Warlock", lv); d.pact = { pocet: num(r["Spell Slots"]), uroven: num(r["Slot Level"]) }; }
    });
    if (casters.length === 1) {
      var t1 = casters[0], l1 = Number(t1.uroven);
      if (FULL[t1.trida] || HALF[t1.trida]) { var r1 = row(t1.trida, l1); d.slots = SLOT_COLS.map(function (k) { return num(r1[k]); }).filter(function (x, i, a) { return a.slice(i).some(Boolean); }); }
      else d.slots = MULTI[Math.ceil(l1 / 3)].slice();
    } else d.slots = (MULTI[Math.min(cl, 20)] || []).slice();
    d.casterLevel = cl;
    d.prepared = tr.map(function (t) { var r = row(t.trida, Number(t.uroven)); return { trida: t.trida, cantrips: num(r.Cantrips), pripravena: num(r["Prepared Spells"]), ab: CAST_AB[t.trida] || THIRD[t.podtrida] || null }; })
      .filter(function (x) { return x.ab; });
    return d;
  }

  // ---------- kontrola postavy ----------
  function validate(c) {
    var out = [], lvl = totalLevel(c), ab = c.atributy || {}, god = !!c.bozska_vyjimka || !R.druhy[(c.druh || "").split(" ")[0]];
    function err(t) { out.push({ typ: "chyba", text: t }); } function warn(t) { out.push({ typ: "varovani", text: t }); }
    if (!(c.tridy || []).length) err("Postava nemá žádné povolání.");
    if (lvl > 20) err("Celková úroveň " + lvl + " je nad 20.");
    var seen = {};
    (c.tridy || []).forEach(function (t) {
      if (!cls(t.trida)) { err("Neznámé povolání: " + t.trida); return; }
      if (seen[t.trida]) err("Povolání " + t.trida + " je uvedeno dvakrát."); seen[t.trida] = 1;
      var lv = Number(t.uroven);
      if (lv < 1 || lv > 20) err(t.trida + ": úroveň " + lv + " mimo 1–20.");
      if (lv >= 3 && !t.podtrida) err(t.trida + " " + lv + ": chybí subclass (volí se na 3. úrovni).");
      if (lv < 3 && t.podtrida) warn(t.trida + " " + lv + ": subclass " + t.podtrida + " se získává až na 3. úrovni.");
      if (t.podtrida) { var s = R.podtridy[t.podtrida]; if (!s) warn("Subclass " + t.podtrida + " není v pravidlech 2024+."); else if (s.trida !== t.trida) err("Subclass " + t.podtrida + " patří povolání " + s.trida + ", ne " + t.trida + "."); }
    });
    if ((c.tridy || []).length > 1) {
      var mc = [], probe = { atributy: ab, tridy: [] };
      (c.tridy || []).forEach(function (t, i) { if (i) mc = mc.concat(multiclassCheck(probe, t.trida)); probe.tridy.push(t); });
      if (mc.length) warn("Multiclass vyžaduje 13+ v primárních atributech (" + mc.filter(function (x, i) { return mc.indexOf(x) === i; }).join("; ") + "). Ověř, že to platilo v době multiclassu.");
    }
    var hasBoon = (c.featy || []).some(function (f) { return /^Boon of/.test(f.nazev); });
    AB.forEach(function (a) { var v = Number(ab[a]); if (v > 20 && !(god || (hasBoon && v <= 30))) err(a + " " + v + " je nad maximem 20."); if (v > 30) err(a + " " + v + " je nad absolutním maximem 30."); });
    if (!god) {
      if (!R.druhy[(c.druh || "").split(" ")[0]]) warn("Druh " + c.druh + " není v pravidlech 2024+.");
      if (c.pozadi && !R.pozadi[c.pozadi]) warn("Pozadí " + c.pozadi + " není v pravidlech 2024+.");
      if (!c.pozadi) err("Chybí pozadí (Background).");
    }
    // featy vs. sloty
    var slots = featSlots(c), used = {};
    (c.featy || []).forEach(function (f) {
      var info = featInfo(f.nazev); if (!info) { warn("Feat " + f.nazev + " není v pravidlech 2024+."); return; }
      var slot = slots.filter(function (s) { return !used[s.zdroj] && s.zdroj === f.zdroj; })[0];
      if (!slot) slot = slots.filter(function (s) { return !used[s.zdroj] && (f.zdroj || "").indexOf(s.zdroj) >= 0; })[0];
      if (!slot) { warn("Feat " + f.nazev + " (" + (f.zdroj || "bez zdroje") + ") neodpovídá žádnému volnému slotu (pozadí, ASI, Fighting Style, Epic Boon)."); return; }
      used[slot.zdroj] = 1;
      if (slot.pevny && featName(slot.pevny) !== featName(f.nazev)) err("Pozadí " + c.pozadi + " dává feat " + slot.pevny + ", ne " + f.nazev + ".");
      var opt = featOptions(c, slot, slot.uroven ? lvlAtSlot(c, slot) : 1).filter(function (o) { return o.nazev === featName(f.nazev); })[0];
      if (!opt) err("Feat " + f.nazev + " (" + info.kategorie + ") nejde vzít ve slotu " + slot.zdroj + ".");
      else if (!opt.ok && !/Už ho má/.test(opt.duvod)) warn("Feat " + f.nazev + ": " + opt.duvod + " (ověř hodnoty v době výběru).");
      else if (!opt.ok) err("Feat " + f.nazev + " je vzatý vícekrát, ale nejde opakovat.");
    });
    slots.forEach(function (s) { if (!used[s.zdroj]) (god && s.typ === "origin" ? null : warn("Nevyužitý slot: " + s.zdroj + (s.pevny ? " (" + s.pevny + ")" : "") + ".")); });
    // dovednosti
    if (!god && c.tridy && c.tridy[0] && cls(c.tridy[0].trida)) {
      var exp = expectedSkills(c), have = (c.dovednosti || []).length;
      if (have < exp.pocet) warn("Dovedností je " + have + ", podle pravidel by mělo být aspoň " + exp.pocet + " (" + exp.rozpis.join(", ") + ").");
      exp.povinne.forEach(function (s) { if ((c.dovednosti || []).indexOf(s) < 0) warn("Chybí dovednost z pozadí: " + s + "."); });
    }
    return out;
  }
  function lvlAtSlot(c, s) {
    // celková úroveň v okamžiku, kdy postava slot získala (přibližně: úrovně ostatních tříd jsou už započtené)
    var other = (c.tridy || []).filter(function (t) { return t.trida !== s.trida; }).reduce(function (a, t) { return a + Number(t.uroven); }, 0);
    return Math.min(totalLevel(c), s.uroven + other);
  }
  function classSkillRule(n) {
    var s = (cls(n) || { core: {} }).core["Skill Proficiencies"] || "", m = s.match(/Choose (?:any )?(\d+)/);
    var list = /any/.test(s) ? SKILLS.slice() : SKILLS.filter(function (k) { return s.indexOf(k) >= 0; });
    return { pocet: m ? Number(m[1]) : 0, z: list };
  }
  function expectedSkills(c) {
    var r = [], n = 0, bg = R.pozadi[c.pozadi], pov = [];
    var k = classSkillRule(c.tridy[0].trida); n += k.pocet; r.push(c.tridy[0].trida + " " + k.pocet);
    if (bg) { pov = String(bg.dovednosti || "").split(/ and |, /).map(function (x) { return x.trim(); }).filter(function (x) { return SKILLS.indexOf(x) >= 0; }); n += pov.length; r.push("pozadí " + pov.length); }
    if (/^Human\b/.test(c.druh || "")) { n += 1; r.push("Human Skillful 1"); }
    if (/^Elf\b/.test(c.druh || "")) { n += 1; r.push("Elf Keen Senses 1"); }
    (c.tridy || []).slice(1).forEach(function (t) { var m = (MULTI_PROF[t.trida] || {}).skills || 0; if (m) { n += m; r.push(t.trida + " (multiclass) " + m); } });
    (c.featy || []).forEach(function (f) { if (featName(f.nazev) === "Skilled") { n += 3; r.push("Skilled 3"); } });
    return { pocet: n, rozpis: r, povinne: pov };
  }

  // ---------- level up ----------
  // vrátí plán: [{celkova, trida, uroven, hp, rysy:[], volby:[{typ:'podtrida'|'feat'|'dovednost', klic, moznosti}] , info:{}}]
  function planLevelUp(c, trida, n) {
    var tmp = clone(c), steps = [], errs = [];
    if (!cls(trida)) return { chyby: ["Neznámé povolání " + trida + "."], kroky: [] };
    var mc = multiclassCheck(tmp, trida); if (mc.length) errs.push("Multiclass do " + trida + " nesplňuje: " + mc.join("; "));
    if (totalLevel(tmp) + n > 20) errs.push("Celková úroveň by přesáhla 20.");
    if (errs.length) return { chyby: errs, kroky: [] };
    for (var i = 0; i < n; i++) {
      var t = (tmp.tridy = tmp.tridy || []).filter(function (x) { return x.trida === trida; })[0], nova = !t;
      if (nova) { t = { trida: trida, uroven: 0 }; tmp.tridy.push(t); }
      t.uroven = Number(t.uroven) + 1;
      var lv = t.uroven, k = cls(trida), r = row(trida, lv), m = classMilestones(trida), first = tmp.tridy[0] === t && totalLevel(tmp) === 1;
      var st = { celkova: totalLevel(tmp), trida: trida, uroven: lv, hp: first ? k.hit_die : k.hit_die / 2 + 1, rysy: feats(r).split(/,\s*(?![^()]*\))/).filter(function (x) { return x && x !== "-"; }), volby: [], info: {} };
      if (nova && tmp.tridy.length > 1) { var mp = MULTI_PROF[trida]; st.info.multiclass = "Získáš: " + (mp.armor.length ? mp.armor.join(", ") + " training" : "žádný armor training") + (mp.skills ? ", 1 dovednost z nabídky povolání" : ""); if (mp.skills) st.volby.push({ typ: "dovednost", klic: "mc_" + trida, moznosti: classSkillRule(trida).z.filter(function (s) { return (tmp.dovednosti || []).indexOf(s) < 0; }) }); }
      if (lv === m.subclass && !t.podtrida) st.volby.push({ typ: "podtrida", klic: "podtrida_" + trida, moznosti: Object.keys(R.podtridy).filter(function (s) { return R.podtridy[s].trida === trida; }).sort() });
      var slot = null;
      if (m.fs === lv) slot = { typ: "fs", zdroj: "Fighting Style (" + trida + " " + lv + ")", trida: trida, uroven: lv };
      if (slot) st.volby.push({ typ: "feat", klic: slot.zdroj, slot: slot, moznosti: featOptions(tmp, slot, st.celkova) });
      if (m.asi.indexOf(lv) >= 0) { slot = { typ: "asi", zdroj: trida + " " + lv, trida: trida, uroven: lv }; st.volby.push({ typ: "feat", klic: slot.zdroj, slot: slot, moznosti: featOptions(tmp, slot, st.celkova) }); }
      if (m.boon === lv) { slot = { typ: "boon", zdroj: "Epic Boon (" + trida + " " + lv + ")", trida: trida, uroven: lv }; st.volby.push({ typ: "feat", klic: slot.zdroj, slot: slot, moznosti: featOptions(tmp, slot, st.celkova) }); }
      var before = derive(c), d = derive(tmp);
      st.info.pb = d.pb; st.info.sloty = d.slots; st.info.pakt = d.pact; st.info.kouzla = d.prepared.filter(function (x) { return x.trida === trida; })[0];
      steps.push(st);
    }
    return { chyby: [], kroky: steps };
  }
  // volby: { "podtrida_Fighter": "Champion", "Fighter 4": {nazev:"Ability Score Improvement", atributy:{STR:2}}, "mc_Rogue": "Stealth" }
  function applyLevelUp(c, trida, n, volby) {
    volby = volby || {};
    var plan = planLevelUp(c, trida, n), out = clone(c), errs = plan.chyby.slice();
    if (errs.length) return { postava: c, chyby: errs };
    out.tridy = out.tridy || []; out.featy = out.featy || []; out.atributy = out.atributy || {};
    plan.kroky.forEach(function (st) {
      var t = out.tridy.filter(function (x) { return x.trida === trida; })[0];
      if (!t) { t = { trida: trida, uroven: 0 }; out.tridy.push(t); }
      t.uroven = st.uroven;
      st.volby.forEach(function (v) {
        var val = volby[v.klic];
        if (v.typ === "podtrida") { if (!val || v.moznosti.indexOf(val) < 0) errs.push(trida + " " + st.uroven + ": vyber subclass."); else t.podtrida = val; }
        if (v.typ === "dovednost") { if (!val || v.moznosti.indexOf(val) < 0) errs.push(trida + ": vyber dovednost z multiclassu."); else out.dovednosti = (out.dovednosti || []).concat([val]); }
        if (v.typ === "feat") {
          if (!val || !val.nazev) { errs.push(v.klic + ": vyber feat."); return; }
          var opt = featOptions(out, v.slot, st.celkova).filter(function (o) { return o.nazev === val.nazev; })[0];
          if (!opt) { errs.push(v.klic + ": feat " + val.nazev + " nejde v tomto slotu vzít."); return; }
          if (!opt.ok) { errs.push(v.klic + ": " + val.nazev + " – " + opt.duvod); return; }
          var e2 = applyAbilityIncrease(out, val.nazev, val.atributy || {}); if (e2) { errs.push(v.klic + ": " + e2); return; }
          var f = { nazev: val.nazev, zdroj: v.klic }; if (val.atributy && Object.keys(val.atributy).length) f.poznamka = Object.keys(val.atributy).map(function (a) { return "+" + val.atributy[a] + " " + a; }).join(", ");
          if (val.poznamka) f.poznamka = (f.poznamka ? f.poznamka + "; " : "") + val.poznamka;
          out.featy.push(f);
        }
      });
    });
    return { postava: errs.length ? c : out, chyby: errs, plan: plan };
  }
  // zvýšení atributů podle featu: ASI = +2 jednomu nebo +1 dvěma (max 20); ostatní featy s Ability Score Increase = +1 (max 20, Epic Boon max 30)
  function applyAbilityIncrease(c, nazev, inc) {
    var f = featInfo(nazev); if (!f) return "neznámý feat";
    var keys = Object.keys(inc).filter(function (k) { return inc[k]; }), total = keys.reduce(function (a, k) { return a + Number(inc[k]); }, 0);
    var cap = f.kategorie === "Epic Boon" ? 30 : 20;
    if (nazev === "Ability Score Improvement") { if (!(total === 2 && keys.length <= 2 && keys.every(function (k) { return inc[k] <= 2; }))) return "ASI: +2 jednomu atributu, nebo +1 dvěma."; }
    else if (/Ability Score Increase/.test(f.text)) {
      if (total !== 1) return "feat " + nazev + " dává +1 k jednomu atributu – vyber který.";
      var line = (f.text.match(/Ability Score Increase\.[^\n]*/) || [""])[0], allowed = /one ability score of your choice/.test(line) ? AB : abilityList(line);
      if (allowed.indexOf(keys[0]) < 0) return "feat " + nazev + " může zvýšit jen " + allowed.join("/") + ".";
    } else if (total) return "feat " + nazev + " nezvyšuje atributy.";
    for (var i = 0; i < keys.length; i++) { var nv = (Number(c.atributy[keys[i]]) || 10) + Number(inc[keys[i]]); if (nv > cap) return keys[i] + " by přesáhl " + cap + "."; }
    keys.forEach(function (k) { c.atributy[k] = (Number(c.atributy[k]) || 10) + Number(inc[k]); });
    return "";
  }
  function featAbilityChoices(nazev) {
    var f = featInfo(nazev); if (!f) return { typ: "zadne", atributy: [] };
    if (nazev === "Ability Score Improvement") return { typ: "asi", atributy: AB };
    if (!/Ability Score Increase/.test(f.text)) return { typ: "zadne", atributy: [] };
    var line = (f.text.match(/Ability Score Increase\.[^\n]*/) || [""])[0];
    return { typ: "plus1", atributy: /one ability score of your choice/.test(line) ? AB : abilityList(line), max: f.kategorie === "Epic Boon" ? 30 : 20 };
  }

  // ---------- nová postava (úroveň 1) ----------
  var STANDARD = [15, 14, 13, 12, 10, 8], COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  // spec: {jmeno, druh, druh_volby, pozadi, trida, metoda:'standard'|'pointbuy'|'rucne', zaklad:{STR..}, bonus:{STR:2,CHA:1}, dovednosti:[], origin_feat (Human), skillful (Human), keen (Elf)}
  function createCharacter(s) {
    var errs = [], bg = R.pozadi[s.pozadi], k = cls(s.trida), base = s.zaklad || {};
    if (!k) errs.push("Vyber povolání.");
    if (!bg) errs.push("Vyber pozadí.");
    if (!R.druhy[s.druh]) errs.push("Vyber druh.");
    var vals = AB.map(function (a) { return Number(base[a]); });
    if (vals.some(function (v) { return !v; })) errs.push("Zadej všech šest atributů.");
    if (s.metoda === "standard" && vals.slice().sort(function (a, b) { return b - a; }).join() !== STANDARD.join()) errs.push("Standard Array musí použít přesně 15, 14, 13, 12, 10, 8.");
    if (s.metoda === "pointbuy") { var cost = vals.reduce(function (a, v) { return a + (COST[v] == null ? 99 : COST[v]); }, 0); if (cost > 27) errs.push("Point Buy: utraceno " + (cost >= 99 ? "neplatné hodnoty (8–15)" : cost) + " z 27 bodů."); }
    var bonus = s.bonus || {}, bk = Object.keys(bonus).filter(function (a) { return bonus[a]; }), bsum = bk.reduce(function (a, x) { return a + Number(bonus[x]); }, 0);
    if (bg) {
      var allowed = abilityList(bg.atributy);
      if (bk.some(function (a) { return allowed.indexOf(a) < 0; })) errs.push("Pozadí " + s.pozadi + " zvyšuje jen " + allowed.join(", ") + ".");
      var okShape = bsum === 3 && ((bk.length === 2 && bk.some(function (a) { return bonus[a] == 2; })) || (bk.length === 3 && bk.every(function (a) { return bonus[a] == 1; })));
      if (!okShape) errs.push("Bonus z pozadí: +2 a +1, nebo +1/+1/+1.");
    }
    var at = {}; AB.forEach(function (a) { at[a] = (Number(base[a]) || 0) + (Number(bonus[a]) || 0); if (at[a] > 20) errs.push(a + " nad 20."); });
    var c = { jmeno: s.jmeno || "Nová postava", druh: s.druh, druh_volby: s.druh_volby || "", pozadi: s.pozadi, velikost: s.velikost || "Medium", zarovnani: s.zarovnani || "",
      tridy: [{ trida: s.trida, uroven: 1 }], atributy: at, dovednosti: [], featy: [], puvod_atributu: (s.metoda || "") + " " + JSON.stringify(base) + "; " + s.pozadi + " " + bk.map(function (a) { return "+" + bonus[a] + " " + a; }).join(", ") };
    if (bg) {
      c.featy.push({ nazev: featName(bg.feat), zdroj: "Pozadí (" + s.pozadi + ")", poznamka: /\(/.test(bg.feat) ? bg.feat.replace(/^.*\((.*)\)$/, "$1") : undefined });
      String(bg.dovednosti || "").split(/ and |, /).forEach(function (x) { x = x.trim(); if (SKILLS.indexOf(x) >= 0) c.dovednosti.push(x); });
      if (bg.nastroj) c.nastroje = [bg.nastroj];
    }
    if (s.druh === "Human") {
      if (!s.origin_feat || !R.featy[s.origin_feat] || R.featy[s.origin_feat].kategorie !== "Origin") errs.push("Human – Versatile: vyber Origin feat.");
      else if (featName(s.origin_feat) === featName(bg && bg.feat) && !repeatable(s.origin_feat)) errs.push("Origin feat z Versatile nesmí být stejný jako z pozadí (nejde opakovat).");
      else c.featy.push({ nazev: s.origin_feat, zdroj: "Human – Versatile" });
      if (!s.skillful || SKILLS.indexOf(s.skillful) < 0) errs.push("Human – Skillful: vyber dovednost.");
    }
    if (s.druh === "Elf" && ["Insight", "Perception", "Survival"].indexOf(s.keen) < 0) errs.push("Elf – Keen Senses: vyber Insight, Perception nebo Survival.");
    var rule = k ? classSkillRule(s.trida) : { pocet: 0, z: [] }, picks = (s.dovednosti || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
    if (picks.length !== rule.pocet) errs.push(s.trida + ": vyber přesně " + rule.pocet + " dovednosti z nabídky povolání.");
    picks.forEach(function (x) { if (rule.z.indexOf(x) < 0) errs.push(x + " není v nabídce povolání " + s.trida + "."); });
    var extra = [].concat(picks, s.druh === "Human" && s.skillful ? [s.skillful] : [], s.druh === "Elf" && s.keen ? [s.keen] : []);
    extra.forEach(function (x) { if (c.dovednosti.indexOf(x) >= 0) errs.push("Dovednost " + x + " už máš (z pozadí/druhu) – vyber jinou."); else c.dovednosti.push(x); });
    if (k && classMilestones(s.trida).fs === 1) { if (!s.fighting_style || !R.featy[s.fighting_style] || R.featy[s.fighting_style].kategorie !== "Fighting Style") errs.push("Fighter 1: vyber Fighting Style feat."); else c.featy.push({ nazev: s.fighting_style, zdroj: "Fighting Style (" + s.trida + " 1)" }); }
    if (k) { var a = String(k.core["Armor Training"] || ""); c.zbroj = { typ: "none" }; }
    c.featy.forEach(function (f) { if (f.poznamka === undefined) delete f.poznamka; });
    return { postava: c, chyby: errs };
  }

  var api = { init: init, AB: AB, SKILLS: SKILLS, PRIMARY: PRIMARY, MULTI_PROF: MULTI_PROF, STANDARD: STANDARD, COST: COST, totalLevel: totalLevel, pb: pb,
    classMilestones: classMilestones, featSlots: featSlots, featOptions: featOptions, checkPrereq: checkPrereq, multiclassCheck: multiclassCheck,
    derive: derive, validate: validate, planLevelUp: planLevelUp, applyLevelUp: applyLevelUp, featAbilityChoices: featAbilityChoices,
    classSkillRule: classSkillRule, expectedSkills: expectedSkills, createCharacter: createCharacter, armorTraining: armorTraining };
  return api;
});
