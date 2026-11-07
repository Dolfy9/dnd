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
    var bg = R.pozadi[c.pozadi] || {}, sp = R.druhy[c.druh] || {};
    var h = '<div class="ps">';
    h += '<div class="ps-head"><div class="ps-name"><div class="ps-big">' + esc(c.jmeno) + '</div><div class="ps-sub">' + esc(c.titul || "") + '</div></div>';
    h += '<div class="ps-meta">' + box("Povolání", (c.tridy || []).map(function (t) { return esc(t.trida + " " + t.uroven) + (t.podtrida ? " <small>(" + esc(t.podtrida) + ")</small>" : ""); }).join(" / "))
      + box("Úroveň", d.lvl) + box("Druh (Species)", esc(c.druh) + (c.druh_volby ? " <small>– " + esc(c.druh_volby) + "</small>" : ""))
      + box("Pozadí (Background)", esc(c.pozadi || "—")) + box("Přesvědčení", esc(c.zarovnani || "—")) + box("Velikost", esc(c.velikost || "Medium")) + '</div></div>';
    if (cesta && document.body.classList.contains("ed-on")) h += '<div class="ps-edit"><button class="ed-btn ed-primary" data-ps-edit>✎ Upravit postavu</button></div>';
    h += '<div class="ps-grid">';
    // atributy + dovednosti
    h += '<div class="ps-col ps-abil">';
    AB.forEach(function (a) {
      h += '<div class="ps-ab"><div class="ps-ab-top"><span class="ps-ab-n">' + AB_CZ[a] + ' <small>' + a + '</small></span><span class="ps-ab-mod">' + sg(d.mods[a]) + '</span><span class="ps-ab-s">' + esc((c.atributy || {})[a]) + '</span></div><ul>';
      h += '<li class="' + (d.saveProf.indexOf(a) >= 0 ? "p" : "") + '"><i></i>' + sg(d.saves[a]) + ' <b>Záchranný hod</b></li>';
      Object.keys(SKILLS).filter(function (s) { return SKILLS[s] === a; }).forEach(function (s) {
        var k = d.skills[s]; h += '<li class="' + (k.exp ? "e" : k.prof ? "p" : "") + '"><i></i>' + sg(k.val) + " " + s + '</li>';
      });
      h += '</ul></div>';
    });
    h += '<div class="ps-small">' + box("Proficiency Bonus", sg(d.pb)) + box("Pasivní Perception", d.passive) + '</div>';
    h += '</div>';
    // boj
    h += '<div class="ps-col">';
    h += '<div class="ps-combat">' + box("Armor Class", d.ac, "ps-ac") + box("Iniciativa", sg(d.init)) + box("Rychlost", d.speed + " ft") + box("Hit Dice", d.dice) + '</div>';
    h += '<div class="ps-hp"><div class="ps-lbl">Hit Points</div><div class="ps-big">' + d.hp + '</div>' + (c.hp_rucne ? '<small>ručně (výpočet ' + d.hpCalc + ')</small>' : '<small>průměr na úroveň</small>') + '</div>';
    if (c.zbroj && c.zbroj.nazev) h += '<div class="ps-note">Zbroj: ' + esc(c.zbroj.nazev) + (c.zbroj.stit ? " + Shield" : "") + '</div>';
    h += sect("Útoky a cantripy", '<table class="ps-tab"><tr><th>Zbraň / útok</th><th>Bonus</th><th>Zásah</th><th>Mastery / pozn.</th></tr>' + (c.utoky || []).map(function (u) {
      var a = u.atribut === "FIN" ? Math.max(d.mods.STR, d.mods.DEX) : u.atribut === "SPELL" ? (d.casting[0] ? d.mods[d.casting[0].ab] : 0) : d.mods[u.atribut || "STR"] || 0;
      var bon = a + d.pb + (Number(u.bonus) || 0), dm = (u.bez_modu ? 0 : a) + (Number(u.bonus) || 0) + (Number(u.bonus_zraneni) || 0);
      var dmg = u.kostka ? esc(u.kostka) + (dm ? " " + sg(dm) : "") : "";
      return '<tr><td>' + esc(u.nazev) + (u.dosah ? ' <small>' + esc(u.dosah) + '</small>' : '') + '</td><td>' + (u.bez_hodu ? "—" : sg(bon)) + '</td><td>' + dmg + ' ' + esc(u.typ || "") + '</td><td>' + esc([u.mastery, u.poznamka].filter(Boolean).join(" · ")) + '</td></tr>';
    }).join("") + '</table>');
    var res = [];
    (c.tridy || []).forEach(function (t) { var r = row(t.trida, t.uroven); Object.keys(r).forEach(function (k) { if (SKIP_COLS.indexOf(k) < 0 && r[k] && r[k] !== "-") res.push([t.trida + ": " + k, r[k]]); }); });
    (c.zdroje || []).forEach(function (z) { res.push([z.nazev, z.pocet + (z.obnova ? " / " + z.obnova : "")]); });
    if (res.length) h += sect("Zdroje povolání", '<ul class="ps-res">' + res.map(function (r) { return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></li>"; }).join("") + '</ul>');
    h += sect("Výcvik a zdatnosti", '<p><b>Zbroj:</b> ' + esc(train(c, "Armor Training")) + '<br><b>Zbraně:</b> ' + esc(train(c, "Weapon Proficiencies")) + (c.mastery && c.mastery.length ? '<br><b>Weapon Mastery:</b> ' + esc(c.mastery.join(", ")) : '') + '<br><b>Nástroje:</b> ' + esc((c.nastroje || []).join(", ") || "—") + '<br><b>Jazyky:</b> ' + esc((c.jazyky || []).join(", ") || "—") + '</p>');
    h += '</div>';
    // rysy
    h += '<div class="ps-col">';
    var feats = features(c);
    h += sect("Rysy povolání", feats.map(function (f) { return det(f.nazev + ' <small>' + esc(f.zdroj) + ' ' + (f.urovne ? f.urovne.join(", ") : f.uroven) + '</small>', f.text); }).join(""));
    h += sect("Rysy druhu – " + esc(c.druh), Object.keys(sp.rysy || {}).map(function (k) { return det(k, sp.rysy[k]); }).join("") + (c.druh_volby ? '<p class="ps-note">Volba: ' + esc(c.druh_volby) + '</p>' : ''));
    h += sect("Featy", (c.featy || []).map(function (f) { var r = R.featy[f.nazev] || {}; return det(esc(f.nazev) + ' <small>' + esc(f.zdroj || "") + '</small>', (f.poznamka ? "Volba: " + f.poznamka + "\n\n" : "") + (r.text || "")); }).join(""));
    if (c.vlastni_rysy && c.vlastni_rysy.length) h += sect("Zvláštní a božské rysy", c.vlastni_rysy.map(function (f) { return det(esc(f.nazev), f.text); }).join(""));
    h += '</div></div>';
    // kouzla
    if (d.casting.length || (c.kouzla || []).length) {
      var s = '<div class="ps-cast">' + d.casting.map(function (x) { var r = row(x.trida.split(" ")[0], lvlOf(c, x.trida.split(" ")[0])); return box(x.trida + " (" + x.ab + ")", "DC " + x.dc + " · útok " + sg(x.atk) + (r["Prepared Spells"] ? " · připravených " + r["Prepared Spells"] : "") + (r.Cantrips ? " · cantripů " + r.Cantrips : "")); }).join("") + '</div>';
      var byLvl = {}; (c.kouzla || []).forEach(function (k) { var l = k.uroven != null ? Number(k.uroven) : ((R.spell(k.nazev) || {}).uroven); if (l == null) l = "?"; (byLvl[l] = byLvl[l] || []).push(k); });
      s += '<div class="ps-spells">';
      for (var l = 0; l <= 9; l++) {
        var slots = l ? (d.slots[l - 1] || 0) : 0, pact = d.pact && Number(d.pact.uroven) === l ? Number(d.pact.pocet) : 0;
        if (!byLvl[l] && !slots && !pact) continue;
        s += '<div class="ps-sl"><div class="ps-sl-h">' + (l ? l + ". úroveň" : "Cantripy") + '<span>' + pips(slots) + (pact ? ' <em title="Pact Magic">pakt ' + pips(pact) + '</em>' : '') + '</span></div><ul>' + (byLvl[l] || []).map(function (k) { var r = R.spell(k.nazev); return '<li>' + esc(k.nazev) + (r ? ' <small>' + esc(r.skola) + '</small>' : ' <small class="ps-warn">mimo seznam 2024?</small>') + (k.poznamka ? ' <small>– ' + esc(k.poznamka) + '</small>' : '') + '</li>'; }).join("") + '</ul></div>';
      }
      if (byLvl["?"]) s += '<div class="ps-sl"><div class="ps-sl-h">Neznámá úroveň</div><ul>' + byLvl["?"].map(function (k) { return "<li>" + esc(k.nazev) + "</li>"; }).join("") + '</ul></div>';
      h += sect("Kouzla", s + '</div>');
    }
    // výbava, osobnost
    var o = c.osobnost || {};
    h += '<div class="ps-grid3">' + sect("Výbava", '<ul>' + (c.vybava || []).map(function (v) { return "<li>" + esc(v) + "</li>"; }).join("") + '</ul>' + (c.penize ? '<p><b>Peníze:</b> ' + esc(Object.keys(c.penize).map(function (k) { return c.penize[k] + " " + k; }).join(", ")) + '</p>' : ''))
      + sect("Osobnost", '<p><b>Rysy:</b> ' + esc(o.rysy || "") + '</p><p><b>Ideály:</b> ' + esc(o.idealy || "") + '</p><p><b>Pouta:</b> ' + esc(o.pouta || "") + '</p><p><b>Vady:</b> ' + esc(o.vady || "") + '</p>')
      + sect("Pozadí: " + esc(c.pozadi || "—"), bg.feat ? '<p><b>Atributy:</b> ' + esc(bg.atributy) + '<br><b>Origin feat:</b> ' + esc(bg.feat) + '<br><b>Dovednosti:</b> ' + esc(bg.dovednosti) + '<br><b>Nástroj:</b> ' + esc(bg.nastroj) + '</p>' : '<p>—</p>') + '</div>';
    if (c.vzhled || c.poznamky || c.puvod_atributu || c.prevod_2024) h += sect("Poznámky", (c.vzhled ? '<p><b>Vzhled:</b> ' + para(c.vzhled) + '</p>' : '') + (c.puvod_atributu ? '<p><b>Atributy:</b> ' + para(c.puvod_atributu) + '</p>' : '') + (c.prevod_2024 ? '<p><b>Převod na 2024:</b> ' + para(c.prevod_2024) + '</p>' : '') + (c.poznamky ? '<p>' + para(c.poznamky) + '</p>' : ''));
    return h + '</div>';
  }
  function box(l, v, cls) { return '<div class="ps-box ' + (cls || "") + '"><div class="ps-lbl">' + l + '</div><div class="ps-val">' + v + '</div></div>'; }
  function sect(t, body) { return '<section class="ps-sect"><h4>' + t + '</h4>' + body + '</section>'; }
  function det(t, body) { return '<details><summary>' + t + '</summary><div>' + para(body || "") + '</div></details>'; }
  function pips(n) { var s = ""; for (var i = 0; i < n; i++) s += "◯"; return s; }
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
        holder.innerHTML = render(c, compute(c), cesta);
        var b = holder.querySelector("[data-ps-edit]"); if (b) b.addEventListener("click", function () { editor(c, cesta); });
      };
      draw();
      var tries = 0, t = setInterval(function () { if (document.body.classList.contains("ed-on") || ++tries > 20) { clearInterval(t); if (document.body.classList.contains("ed-on")) draw(); } }, 150);
    });
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
