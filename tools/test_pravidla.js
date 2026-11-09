// Testy pravidel 2024: node tools/test_pravidla.js [postavy.json]
const R = require("../web/assets/pravidla2024.json"), E = require("../web/assets/pravidla_engine.js").init(R).setSpells(R.kouzla);
let fails = 0, ok = 0;
function eq(a, b, msg) { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fails++; console.log("FAIL", msg, "\n  čekáno", JSON.stringify(b), "\n  dostal ", JSON.stringify(a)); } }
function t(cond, msg) { eq(!!cond, true, msg); }
const num = v => parseInt(String(v || "").replace(/[^\d-]/g, ""), 10) || 0;
const SLOTS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
const base = { STR: 15, DEX: 14, CON: 13, INT: 12, WIS: 10, CHA: 8 };
t(!R.podtridy.Metamagic && !R.podtridy["Eldritch Invocation"], "volby povolání nejsou subclassy");
eq([R.volby_trid.Metamagic.trida, R.volby_trid["Eldritch Invocation"].trida], ["Sorcerer", "Warlock"], "volby povolání jsou v samostatném mapě");
const legacySubclasses = Object.values(R.podtridy).filter(s => s.legacy);
eq(legacySubclasses.length, 53, "úplný seznam legacy subclass");
t(legacySubclasses.every(s => s.alternativa_2024 && s.rok && s.overeno && s.overeno.length), "každá legacy subclass má alternativu a zdroj");
const officialSubclasses = Object.values(R.podtridy).filter(s => !s.legacy && !s.treti_strana);
t(officialSubclasses.every(s => s.rok && s.overeno && s.overeno.length), "každá vydaná oficiální subclass má rok a ověřovací URL");
const groupedRules = JSON.parse(JSON.stringify(R));
groupedRules.podtridy["ZZ Test Core"] = { trida: "Rogue" };
groupedRules.podtridy["ZZ Test Third Party"] = { trida: "Rogue", treti_strana: true };
groupedRules.podtridy["ZZ Test Legacy"] = { trida: "Rogue", legacy: true, alternativa_2024: "Thief" };
E.init(groupedRules);
const subclassOptions = E.subclassOptions("Rogue");
t(subclassOptions.indexOf("ZZ Test Core") < subclassOptions.indexOf("ZZ Test Third Party") && subclassOptions.indexOf("ZZ Test Third Party") < subclassOptions.indexOf("ZZ Test Legacy"), "subclassy jsou seskupené 2024, třetí strana, legacy");
["ZZ Test Legacy", "ZZ Test Third Party"].forEach(name => {
  const c = fresh("Rogue"); c.tridy[0].uroven = 3; c.tridy[0].podtrida = name;
  t(E.validate(c).some(x => x.typ === "informace" && x.text.includes(name)), name + " má informační poznámku");
});
E.init(R);
function pickChoices(plan, c, prefer) {
  const v = {};
  plan.kroky.forEach(st => st.volby.forEach(x => {
    if (x.typ === "podtrida") v[x.klic] = x.moznosti[0];
    if (x.typ === "dovednost") v[x.klic] = x.moznosti[0];
    if (x.typ === "feat") {
      const okOpts = x.moznosti.filter(o => o.ok);
      const asi = okOpts.find(o => o.nazev === (prefer || "Ability Score Improvement")) || okOpts[0];
      const ch = E.featAbilityChoices(asi.nazev);
      v[x.klic] = { nazev: asi.nazev, atributy: ch.typ === "asi" ? { CON: 1, WIS: 1 } : ch.typ === "plus1" ? { [ch.atributy.find(a => true)]: 1 } : {} };
    }
  }));
  return v;
}
function lvlUp(c, cls, n, prefer) { const p = E.planLevelUp(c, cls, n); if (p.chyby.length) return { chyby: p.chyby }; return E.applyLevelUp(c, cls, n, pickChoices(p, c, prefer)); }
function fresh(cls, extra) {
  const rule = E.classSkillRule(cls), bgSkills = ["Insight", "Religion"];
  const picks = rule.z.filter(s => bgSkills.indexOf(s) < 0).slice(0, rule.pocet);
  const r = E.createCharacter(Object.assign({ jmeno: "Test " + cls, druh: "Dwarf", pozadi: "Acolyte", trida: cls, metoda: "standard", zaklad: base, bonus: { WIS: 2, INT: 1 }, dovednosti: picks, fighting_style: "Defense" }, extra || {}));
  if (r.chyby.length) console.log("create", cls, r.chyby);
  return r.postava;
}

// 1) každá třída 1→20 po jedné úrovni: PB, HP, sloty, sloty featů, subclass
Object.keys(R.tridy).forEach(cls => {
  let c = fresh(cls); const k = R.tridy[cls];
  t(c && c.tridy[0].uroven === 1, cls + " vytvořena na úrovni 1");
  for (let lv = 1; lv <= 20; lv++) {
    if (lv > 1) { const r = lvlUp(c, cls, 1); if (r.chyby && r.chyby.length) { console.log("FAIL lvl", cls, lv, r.chyby); fails++; break; } c = r.postava; }
    const d = E.derive(c), row = k.tabulka[lv];
    eq(d.pb, num(row["Proficiency Bonus"]), cls + " " + lv + " PB");
    const hd = k.hit_die, con = Math.floor((c.atributy.CON - 10) / 2);
    eq(d.hp, hd + (lv - 1) * (hd / 2 + 1) + lv * con + lv /*Dwarf*/, cls + " " + lv + " HP");
    if (row["1st"] !== undefined) eq(d.slots, SLOTS.map(s => num(row[s])).filter((x, i, a) => a.slice(i).some(Boolean)), cls + " " + lv + " sloty");
    if (cls === "Warlock") eq(d.pact, { pocet: num(row["Spell Slots"]), uroven: num(row["Slot Level"]) }, "Warlock " + lv + " pakt");
    const m = E.classMilestones(cls), exp = m.asi.filter(a => a <= lv).length + (m.boon && lv >= m.boon ? 1 : 0) + (m.fs && lv >= m.fs ? 1 : 0) + 1;
    eq(E.featSlots(c).length, exp, cls + " " + lv + " počet slotů featů");
    eq(c.featy.length, exp, cls + " " + lv + " počet featů");
    if (lv >= 3) t(c.tridy[0].podtrida && R.podtridy[c.tridy[0].podtrida].trida === cls, cls + " " + lv + " má platnou subclass");
    const v = E.validate(c).filter(x => x.typ === "chyba"); eq(v, [], cls + " " + lv + " bez chyb validace");
  }
  // 2) skok o víc úrovní = postupně po jedné
  const a = lvlUp(fresh(cls), cls, 19).postava; let b = fresh(cls); for (let i = 0; i < 19; i++) b = lvlUp(b, cls, 1).postava;
  eq(a, b, cls + " level up 1→20 najednou = po jedné");
  const c7 = lvlUp(fresh(cls), cls, 6).postava, c7b = lvlUp(lvlUp(fresh(cls), cls, 2).postava, cls, 4).postava;
  eq(c7, c7b, cls + " 1→3→7 = 1→7");
});

// 3) multiclass
let f = fresh("Fighter"); f = lvlUp(f, "Fighter", 4).postava;
f.atributy.INT = 12; t(E.planLevelUp(f, "Wizard", 1).chyby.length > 0, "multiclass Wizard s INT 12 odmítnut");
f.atributy.INT = 13; t(E.planLevelUp(f, "Wizard", 1).chyby.length === 0, "multiclass Wizard s INT 13 povolen");
const fw = lvlUp(f, "Wizard", 3).postava; eq(fw.tridy.map(x => [x.trida, x.uroven]), [["Fighter", 5], ["Wizard", 3]], "Fighter5/Wizard3");
eq(E.derive(fw).slots, [4, 2], "Fighter 5 / Wizard 3 = sloty Wizard 3");
eq(E.derive(fw).pb, 3, "PB z celkové úrovně 8");
eq(E.derive(fw).hp, 10 + 4 * 6 + 3 * 4 + 8 * Math.floor((fw.atributy.CON - 10) / 2) + 8, "HP multiclass (Wizard bez lvl-1 maxima)");
eq(E.derive({ tridy: [{ trida: "Ranger", uroven: 4 }, { trida: "Sorcerer", uroven: 3 }], atributy: base }).slots, [4, 3, 2], "SRD příklad Ranger 4 / Sorcerer 3 = caster 5");
eq(E.derive({ tridy: [{ trida: "Paladin", uroven: 5 }, { trida: "Cleric", uroven: 5 }], atributy: base }).casterLevel, 8, "Paladin 5 / Cleric 5 = caster 8");
eq(E.derive({ tridy: [{ trida: "Fighter", uroven: 9, podtrida: "Eldritch Knight" }, { trida: "Wizard", uroven: 3 }], atributy: base }).casterLevel, 6, "EK 9 (=3) + Wizard 3 = 6");
eq(E.derive({ tridy: [{ trida: "Fighter", uroven: 7, podtrida: "Eldritch Knight" }], atributy: base }).slots, [4, 2], "EK 7 sám = 4/2");
const wl = E.derive({ tridy: [{ trida: "Warlock", uroven: 5 }, { trida: "Sorcerer", uroven: 2 }], atributy: base });
eq([wl.slots, wl.pact], [[3], { pocet: 2, uroven: 3 }], "Warlock 5 / Sorcerer 2: Pact zvlášť + sloty Sorcerer 2");
eq([1, 2, 5].map(lv => E.derive({ tridy: [{ trida: "Artificer", uroven: lv }] }).slots), [[2], [2], [4, 2]], "Artificer 1/2/5 slots");
eq(E.derive({ tridy: [{ trida: "Artificer", uroven: 3 }, { trida: "Wizard", uroven: 2 }] }).slots, [4, 3], "Artificer 3 / Wizard 2 multiclass slots");
let artReq = fresh("Wizard"); artReq = lvlUp(artReq, "Wizard", 2).postava;
artReq.atributy.INT = 12; t(E.planLevelUp(artReq, "Artificer", 1).chyby.length > 0, "multiclass Artificer s INT 12 odmítnut");
artReq.atributy.INT = 13; t(E.planLevelUp(artReq, "Artificer", 1).chyby.length === 0, "multiclass Artificer s INT 13 povolen");
const rog = lvlUp(lvlUp(fresh("Fighter"), "Fighter", 1).postava, "Rogue", 1); t(!rog.chyby.length && rog.postava.dovednosti.length === fresh("Fighter").dovednosti.length + 1, "multiclass Rogue přidá 1 dovednost");
// 4) featy
let w = lvlUp(fresh("Wizard"), "Wizard", 3).postava; const slot4 = { typ: "asi", zdroj: "Wizard 4" };
const opts = Object.fromEntries(E.featOptions(w, slot4, 4).map(o => [o.nazev, o]));
t(!opts["Heavy Armor Master"].ok, "Wizard bez Heavy Armor Training nemá Heavy Armor Master");
t(!opts["Archery"] || !opts["Archery"].ok, "Fighting Style feat Wizard (bez rysu Fighting Style) vzít nemůže");
t(!opts["Boon of Fate"], "Epic Boon se na 4. úrovni nenabízí");
t(opts["War Caster"].ok, "Wizard má Spellcasting → War Caster");
t(opts["Magic Initiate"].ok, "Magic Initiate je opakovatelný");
t(!opts["Athlete"].ok === (w.atributy.STR < 13 && w.atributy.DEX < 13), "Athlete podle STR/DEX 13+");
let fi = lvlUp(fresh("Fighter"), "Fighter", 3).postava; const fo = Object.fromEntries(E.featOptions(fi, { typ: "asi", zdroj: "Fighter 4" }, 4).map(o => [o.nazev, o]));
t(fo["Heavy Armor Master"].ok, "Fighter má Heavy Armor Training"); t(fo["Archery"] && fo["Archery"].ok, "Fighter může vzít další Fighting Style feat"); t(!fo["Defense"].ok, "Defense už má → nelze znovu");
const b19 = E.featOptions(lvlUp(fresh("Rogue"), "Rogue", 17).postava, { typ: "boon", zdroj: "Epic Boon (Rogue 19)" }, 19);
t(b19.some(o => o.nazev === "Boon of Fate" && o.ok), "na 19 nabídka Epic Boon");
// ASI pravidla
const bad = E.applyLevelUp(lvlUp(fresh("Fighter"), "Fighter", 2).postava, "Fighter", 1, { "Fighter 4": { nazev: "Ability Score Improvement", atributy: { STR: 3 } } });
t(bad.chyby.length, "ASI +3 odmítnuto");
const cap = fresh("Fighter"); cap.atributy.STR = 20; const capr = E.applyLevelUp(lvlUp(cap, "Fighter", 2).postava, "Fighter", 1, { "Fighter 4": { nazev: "Ability Score Improvement", atributy: { STR: 2 } } });
t(capr.chyby.length, "ASI nad 20 odmítnuto");
// 5) tvorba postavy – pravidla pozadí
t(E.createCharacter({ druh: "Elf", pozadi: "Sage", trida: "Wizard", metoda: "standard", zaklad: base, bonus: { STR: 2, INT: 1 }, dovednosti: ["Investigation", "Medicine"], keen: "Perception" }).chyby.length, "bonus mimo atributy pozadí odmítnut");
t(E.createCharacter({ druh: "Elf", pozadi: "Sage", trida: "Wizard", metoda: "pointbuy", zaklad: { STR: 15, DEX: 15, CON: 15, INT: 15, WIS: 8, CHA: 8 }, bonus: { INT: 2, WIS: 1 }, dovednosti: ["Investigation", "Medicine"], keen: "Perception" }).chyby.length, "Point Buy nad 27 odmítnut");
const okc = E.createCharacter({ druh: "Elf", pozadi: "Sage", trida: "Wizard", metoda: "standard", zaklad: { STR: 8, DEX: 14, CON: 13, INT: 15, WIS: 12, CHA: 10 }, bonus: { INT: 2, CON: 1 }, dovednosti: ["Investigation", "Medicine"], keen: "Perception" });
eq(okc.chyby, [], "platný Elf Sage Wizard"); eq(okc.postava.featy[0].nazev, "Magic Initiate", "Sage dává Magic Initiate");
eq(E.validate(okc.postava).filter(x => x.typ === "chyba"), [], "validace nové postavy");
const classless = { jmeno: "Test classless", druh: "Lorwyn Changeling", pozadi: "Farmer", tridy: [],
  statblok: "Commoner (MM 2025)", hp_rucne: 4, ac_rucne: 10, rychlost_rucne: 30, atributy: base };
const classlessValidation = E.validate(classless);
t(!classlessValidation.some(x => x.typ === "chyba" && /povolání/.test(x.text)), "classless NPC se statblokem je povolen");
t(!classlessValidation.some(x => /Druh Lorwyn Changeling/.test(x.text)), "víceslovný druh se vyhledává jako celý klíč");
const legacyValidation = E.validate(Object.assign({}, classless, { druh: "Kenku" }));
t(!legacyValidation.some(x => x.typ === "chyba"), "legacy druh nezpůsobuje chybu validace");
t(!legacyValidation.some(x => x.typ === "varovani" && /není v pravidlech 2024/.test(x.text)), "známý legacy druh není označen jako neznámý");
t(legacyValidation.some(x => x.typ === "informace" && /legacy, kompatibilní/.test(x.text)), "legacy druh má informační poznámku");
const thirdPartyValidation = E.validate(Object.assign({}, classless, { druh: "Geppettin" }));
t(!thirdPartyValidation.some(x => x.typ === "chyba"), "druh třetí strany nezpůsobuje chybu validace");
t(!thirdPartyValidation.some(x => x.typ === "varovani" && /není v pravidlech 2024/.test(x.text)), "známý druh třetí strany není označen jako neznámý");
t(thirdPartyValidation.some(x => x.typ === "informace" && /třetí strany/.test(x.text)), "druh třetí strany má informační poznámku");


// 7) kouzla
const wz = E.spellRules({ tridy: [{ trida: "Wizard", uroven: 5 }] })[0];
eq([wz.cantrips, wz.pripravena, wz.maxUroven, wz.kniha], [4, 9, 3, 14], "Wizard 5: cantripy, připravená, max úroveň, spellbook");
t(wz.moznosti.indexOf("Fireball") >= 0 && wz.moznosti.indexOf("Cone of Cold") < 0, "Wizard 5 nabídka do 3. úrovně");
const pl = E.spellRules({ tridy: [{ trida: "Paladin", uroven: 5 }] })[0]; eq([pl.cantrips, pl.maxUroven], [0, 2], "Paladin 5: bez cantripů, max 2. úroveň");
const wl5 = E.spellRules({ tridy: [{ trida: "Warlock", uroven: 5 }] })[0]; eq(wl5.maxUroven, 3, "Warlock 5: Pact sloty 3. úrovně");
const ek = E.spellRules({ tridy: [{ trida: "Fighter", uroven: 7, podtrida: "Eldritch Knight" }] })[0]; eq([ek.seznam, ek.cantrips, ek.pripravena, ek.maxUroven], ["Wizard", 2, 5, 2], "EK 7");
const mk = (cls, lv, sp) => ({ tridy: [{ trida: cls, uroven: lv }], kouzla: sp.map(([n, u, k]) => ({ nazev: n, uroven: u, trida: cls, kniha: k })) });
const cl0 = mk("Cleric", 3, [["Bless", 1], ["Cure Wounds", 1], ["Guiding Bolt", 1], ["Shield of Faith", 1], ["Aid", 2], ["Prayer of Healing", 2]]);
const cl1 = mk("Cleric", 3, [["Bless", 1], ["Cure Wounds", 1], ["Command", 1], ["Sanctuary", 1], ["Aid", 2], ["Spiritual Weapon", 2]]);
eq(E.checkSpellChange(cl0, cl1, "Cleric", "lr"), [], "Cleric po Long Rest smí vyměnit cokoli");
const pa0 = mk("Paladin", 5, [["Bless", 1], ["Command", 1], ["Heroism", 1], ["Aid", 2], ["Find Steed", 2], ["Divine Favor", 1]]);
const pa1 = JSON.parse(JSON.stringify(pa0)); pa1.kouzla[0].nazev = "Shield of Faith"; const pa2 = JSON.parse(JSON.stringify(pa1)); pa2.kouzla[1].nazev = "Searing Smite";
eq(E.checkSpellChange(pa0, pa1, "Paladin", "lr"), [], "Paladin po Long Rest vymění 1 kouzlo");
t(E.checkSpellChange(pa0, pa2, "Paladin", "lr").length, "Paladin po Long Rest nevymění 2 kouzla");
const so0 = mk("Sorcerer", 3, [["Burning Hands", 1], ["Detect Magic", 1], ["Shield", 1], ["Scorching Ray", 2]]); const so1 = JSON.parse(JSON.stringify(so0)); so1.kouzla[0].nazev = "Sleep";
t(E.checkSpellChange(so0, so1, "Sorcerer", "lr").length, "Sorcerer po Long Rest neměnní");
eq(E.checkSpellChange(so0, so1, "Sorcerer", "lvl"), [], "Sorcerer při level upu vymění 1");
const wi0 = mk("Wizard", 5, [["Shield", 1], ["Sleep", 1, true]]); const wi1 = mk("Wizard", 5, [["Shield", 1, true], ["Sleep", 1]]); const wi2 = mk("Wizard", 5, [["Shield", 1], ["Fireball", 3]]);
eq(E.checkSpellChange(wi0, wi1, "Wizard", "lr"), [], "Wizard připraví jiné kouzlo ze spellbooku po Long Rest");
t(E.checkSpellChange(wi0, wi2, "Wizard", "lr").length, "Wizard nepřipraví kouzlo, které nemá ve spellbooku");
eq(E.checkSpellChange(wi0, wi1, "Wizard", "sr"), [], "Wizard 5 Memorize Spell po Short Rest");

// 6) existující postavy
if (process.argv[2]) {
  const P = require(require("path").resolve(process.argv[2]));
  Object.keys(P).forEach(n => { const v = E.validate(P[n]); if (v.length) { console.log("\n" + n); v.forEach(x => console.log("  " + x.typ + ": " + x.text)); } });
}
console.log("\nOK " + ok + ", FAIL " + fails); process.exit(fails ? 1 : 0);
