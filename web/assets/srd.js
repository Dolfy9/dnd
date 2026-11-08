// Katalogy SRD 5.2.1: bestiář, předměty, glosář + popupy (.srd-link data-typ data-nazev)
(function () {
  var C = {}, F = { bestiar: "bestiar.json", predmety: "predmety.json", glosar: "glosar.json", featy: "puvod_a_featy.json" };
  function base() { var s = document.querySelector('script[src*="assets/srd.js"]'); return s ? s.src.replace(/assets\/srd\.js.*$/, "") : "/"; }
  var CS = {};
  function loadCs(t) { return CS[t] ? Promise.resolve(CS[t]) : fetch(base() + "assets/preklad/" + t + "_cs.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { CS[t] = j; return j; }); }
  function load(t) { return loadCs(t).then(function () { return C[t] ? C[t] : fetch(base() + "assets/srd/" + F[t]).then(function (r) { return r.json(); }).then(function (j) { C[t] = j; return j; }); }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(n) { return Math.floor((n - 10) / 2); } function sg(n) { return (n >= 0 ? "+" : "") + n; }
  var SB_RE = /((?:Melee or Ranged|Melee|Ranged) Attack Roll:|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:|Neúspěch i úspěch:|První neúspěch:|Druhý neúspěch:|Další neúspěchy:|Neúspěch o \d+ a více:|Neúspěch:|Úspěch:|Zásah i minutí:|Zásah:|Failure or Success:|First Failure|Second Failure|Failure:|Success:|Hit or Miss:|Hit:|_?Spouštěč:_?|_?Reakce:_?|_?Trigger:_?|_?Response:_?)/g;
  function sbFmt0(html) { return html.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(SB_RE, function (m) { return "<em>" + m.replace(/_/g, "") + "</em>"; }).replace(/_([^_<]+)_/g, "<em>$1</em>"); }
  var LINK_RE = null, LINK = {}, CUR = "";
  var GLOS_EXTRA = ["Advantage", "Disadvantage", "Concentration", "Bloodied", "Difficult Terrain", "Total Cover", "Half Cover", "Three-Quarters Cover", "Heavily Obscured", "Lightly Obscured", "Temporary Hit Points", "Exhaustion", "Opportunity Attack", "Bright Light", "Dim Light", "Darkness", "Darkvision", "Blindsight", "Tremorsense", "Truesight", "Resistance", "Vulnerability", "Immunity", "Critical Hit", "Long Rest", "Short Rest", "Heroic Inspiration", "Teleportation", "Suffocation"];
  function buildLinks() {
    if (LINK_RE || !C.glosar) return;
    C.glosar.forEach(function (g) { if (/Condition|Area of Effect|Hazard|Action/.test(g.stitek || "") || GLOS_EXTRA.indexOf(g.nazev) >= 0) LINK[g.nazev] = "g"; });
    var K = window.MontelienKouzla && window.MontelienKouzla.cache ? window.MontelienKouzla.cache() : null;
    if (K) Object.keys(K).forEach(function (n) { if (n !== "_low" && n.length > 3) LINK[n] = "k"; });
    (C.bestiar || []).forEach(function (m) { if (!LINK[m.nazev]) LINK[m.nazev] = "b"; });
    ["Action", "Attack", "Magic", "Help", "Search", "Study", "Utilize", "Influence"].forEach(function (x) { delete LINK[x]; });
    var names = Object.keys(LINK).sort(function (a, b) { return b.length - a.length; }).map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
    LINK_RE = new RegExp("\\b(" + names.join("|") + ")(?![\\w-])", "g");
  }
  function linkify(html) {
    buildLinks(); if (!LINK_RE) return html;
    var inA = false;
    return html.split(/(<[^>]+>)/).map(function (part) {
      if (part.charAt(0) === "<") { if (/^<a\b/.test(part)) inA = true; if (/^<\/a>/.test(part)) inA = false; return part; }
      if (inA) return part;
      return part.replace(LINK_RE, function (m) {
        if (m === CUR) return m; var t = LINK[m];
        if (t === "k") return '<a href="#" class="kz-link sb-a" data-kouzlo="' + m + '">' + m + '</a>';
        return '<a href="#srd-' + (t === "g" ? "glosar" : "bestiar") + '-' + m.replace(/ /g, "_") + '" class="sb-a sb-a-' + t + '">' + m + '</a>';
      });
    }).join("");
  }
  function lists(html) {
    var lines = html.split("<br>"), out = [], li = false;
    lines.forEach(function (l) {
      var m = l.match(/^\s*-\s+(.*)$/);
      if (m) { out.push('<span class="sb-li">' + m[1] + '</span>'); li = true; }
      else if (!l.trim() && li) { } else { if (l.trim() || !li) out.push((out.length && !/sb-li/.test(out[out.length - 1]) ? "<br>" : "") + l); }
    });
    return out.join("").replace(/^(<br>)+/, "");
  }
  function sbFmt(html) { return linkify(lists(sbFmt0(html))); }
  window.MontelienSbFmt = sbFmt;
  function lt(en) { var cs = (CS.bestiar || {})[en], L = window.MontelienLang ? window.MontelienLang.lang() : "cs"; return '<span class="lt sb-t" data-cs="' + esc(cs || en) + '" data-en="' + esc(en) + '">' + sbFmt(esc(cs && L === "cs" ? cs : en).replace(/\n/g, "<br>")) + '</span>'; }
  function list(t, a, intro) { return a && a.length ? '<h3 class="sb-h">' + t + '</h3>' + (intro || '') + a.map(function (x) { return '<p class="sb-e"><b><i>' + esc(x.nazev) + '.</i></b> ' + lt(x.text) + '</p>'; }).join("") : ""; }
  function pbOf(cr) { return cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9; }
  function statblock(m) {
    var sp = Object.keys(m.rychlost || {}).map(function (k) { return (k === "walk" ? "" : k + " ") + m.rychlost[k] + " ft."; }).join(", ");
    var all = [].concat(m.rysy || [], m.akce || [], m.bonusove_akce || [], m.reakce || [], m.legendarni || []), hasCs = all.some(function (x) { return (CS.bestiar || {})[x.text]; });
    var sv = {}; (m.zachrany || []).forEach(function (z) { var p = z.split(" "); sv[p[0]] = p[1]; });
    function cell(k) { var v = m.atributy[k], md = sg(md2(v)); return '<td class="sb-an">' + k + '</td><td>' + v + '</td><td class="sb-am">' + md + '</td><td class="sb-am">' + (sv[k] || md) + '</td>'; }
    function md2(v) { return Math.floor((v - 10) / 2); }
    var head = '<tr><th></th><th></th><th>MOD</th><th>SAVE</th></tr>';
    var abil = '<div class="sb-abil">' + [["STR", "DEX", "CON"], ["INT", "WIS", "CHA"]].map(function (g) { return '<table class="sb-at">' + head + g.map(function (k) { return '<tr>' + cell(k) + '</tr>'; }).join("") + '</table>'; }).join("") + '</div>';
    var senses = Object.keys(m.smysly || {}).map(function (k) { return k + " " + m.smysly[k] + " ft."; }).concat(["Passive Perception " + (m.pasivni_vnimani || 10)]).join(", ");
    var crn = m.cr_num || 0, line = function (l, v) { return v ? '<div class="sb-l"><b>' + l + '</b> ' + esc(v) + '</div>' : ''; };
    var leg = m.legendarni && m.legendarni.length ? '<p class="sb-intro"><i>Legendary Action Uses: 3 (4 v doupěti). Hned po tahu jiného tvora může ' + esc(m.nazev) + ' utratit jedno použití a provést jednu z následujících akcí. Použití obnoví na začátku svého tahu.</i></p>' : '';
    return '<div class="sb2"><div class="sb-top"><h2>' + esc(m.nazev) + '</h2><p class="sb-sub">' + esc(m.velikost + " " + m.typ + ", " + m.zarovnani) + '</p>' + (window.MontelienLang && all.length ? window.MontelienLang.bar(hasCs) : '') + '</div>'
      + '<div class="sb-rule"></div>'
      + '<div class="sb-core"><div class="sb-l"><b>AC</b> ' + m.ac + (m.ac_detail ? ' <small>(' + esc(m.ac_detail) + ')</small>' : '') + '<span class="sb-sep"></span><b>Initiative</b> ' + sg(m.iniciativa != null ? m.iniciativa : md2(m.atributy.DEX)) + ' (' + (10 + (m.iniciativa != null ? m.iniciativa : md2(m.atributy.DEX))) + ')</div>'
      + '<div class="sb-l"><b>HP</b> ' + m.hp + ' <small>(' + esc(m.hp_vzorec || "") + ')</small></div><div class="sb-l"><b>Speed</b> ' + esc(sp || "30 ft.") + '</div></div>'
      + '<div class="sb-rule"></div>' + abil + '<div class="sb-rule"></div>'
      + '<div class="sb-props">' + line("Skills", (m.dovednosti || []).join(", ")) + line("Resistances", m.odolnosti) + line("Immunities", m.imunity) + line("Senses", senses) + line("Languages", m.jazyky || "—")
      + '<div class="sb-l"><b>CR</b> ' + esc(m.cr) + ' <small>(XP ' + (m.xp || 0).toLocaleString("cs-CZ") + '; PB +' + pbOf(crn) + ')</small></div></div>'
      + '<div class="sb-body">' + list("Rysy", m.rysy) + list("Akce", m.akce) + list("Bonusové akce", m.bonusove_akce) + list("Reakce", m.reakce) + list("Legendární akce", m.legendarni, leg) + '</div>'
      + '<p class="sb-src">SRD 5.2.1 (CC-BY 4.0)</p></div>';
  }
  function detail(t, x) {
    if (t === "bestiar") return statblock(x);
    return '<h2>' + esc(x.nazev) + '</h2>' + (x.stitek ? '<p><i>' + esc(x.stitek) + '</i></p>' : '') + (x.kategorie ? '<p><i>' + esc(x.kategorie + (x.vzacnost ? " · " + x.vzacnost : "") + (x.attunement ? " · attunement" : "")) + '</i></p>' : '') + (window.MontelienLang ? window.MontelienLang.bar((CS[t] || {})[x.nazev]) + '<div class="kz-text">' + window.MontelienLang.txt((CS[t] || {})[x.nazev], x.text) : '<div class="kz-text">' + esc(x.text).replace(/\n/g, "<br>")) + '</div><p class="sb-src">SRD 5.2.1 (CC-BY 4.0)</p>';
  }
  function toMd(m) {
    var L = function (ttl, a) { return a && a.length ? "\n### " + ttl + "\n" + a.map(function (x) { return "- **" + x.nazev + ".** " + x.text.replace(/\n/g, " "); }).join("\n") + "\n" : ""; };
    var sp = Object.keys(m.rychlost || {}).map(function (k) { return (k === "walk" ? "" : k + " ") + m.rychlost[k] + " ft"; }).join(", ");
    return "# Netvor: " + m.nazev + "\n\n> **Stav:** návrh (statblok ze SRD 5.2.1, CC-BY 4.0 – upravuj volně pro Montelien)\n\n## Role v Montelienu\n- Kde žije: \n- Proč tu je: \n\n## Statblok\n*" + m.velikost + " " + m.typ + ", " + m.zarovnani + "*\n\n"
      + "| AC | HP | Rychlost | CR |\n|---|---|---|---|\n| " + m.ac + " | " + m.hp + " (" + (m.hp_vzorec || "") + ") | " + (sp || "30 ft") + " | " + m.cr + " (" + (m.xp || "") + " XP) |\n\n"
      + "| " + Object.keys(m.atributy).join(" | ") + " |\n|" + Object.keys(m.atributy).map(function () { return "---"; }).join("|") + "|\n| " + Object.keys(m.atributy).map(function (k) { var v = m.atributy[k]; return v + " (" + sg(md(v)) + ")"; }).join(" | ") + " |\n\n"
      + (m.zachrany.length ? "- **Záchrany:** " + m.zachrany.join(", ") + "\n" : "") + (m.dovednosti.length ? "- **Dovednosti:** " + m.dovednosti.join(", ") + "\n" : "") + (m.imunity ? "- **Imunity:** " + m.imunity + "\n" : "") + (m.odolnosti ? "- **Odolnosti:** " + m.odolnosti + "\n" : "")
      + "- **Smysly:** " + (Object.keys(m.smysly || {}).map(function (k) { return k + " " + m.smysly[k] + " ft"; }).join(", ") || "—") + "; **Jazyky:** " + (m.jazyky || "—") + "\n"
      + L("Rysy", m.rysy) + L("Akce", m.akce) + L("Bonusové akce", m.bonusove_akce) + L("Reakce", m.reakce) + L("Legendární akce", m.legendarni)
      + "\n## Pro DM (tajné)\n- \n";
  }
  function addToWiki(m) {
    var slug = m.nazev.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_"), cesta = "04_Postavy/Netvori/Netvor_" + slug + ".md";
    window.MontelienEditor.api("POST", "soubor", { cesta: cesta, obsah: toMd(m) })
      .then(function () { location.href = base() + cesta.replace(/\.md$/, "/"); })
      .catch(function (e) { alert("Chyba: " + e.message); });
  }
  function show(t, n) {
    var pre = t === "bestiar" ? Promise.all([load("glosar"), window.MontelienKouzla ? window.MontelienKouzla.load() : null]).then(function () { return load(t); }) : load(t);
    if (t === "bestiar") CUR = String(n);
    pre.then(function (d) {
      var x = d.filter(function (e) { return e.nazev.toLowerCase() === String(n).toLowerCase(); })[0];
      var bg = document.createElement("div"); bg.className = "ed-modal-bg";
      var add = x && t === "bestiar" && document.body.classList.contains("ed-on") ? '<button class="ed-btn ed-primary srd-add">+ Přidat do wiki jako netvora</button> ' : '';
      var cp = x ? '<button class="ed-btn srd-copy" title="Zkopíruje Markdown odkaz pro vložení do stránky">Kopírovat odkaz</button> ' : '';
      bg.innerHTML = '<div class="ed-modal kz-modal">' + (x ? detail(t, x) : '<h2>' + esc(n) + '</h2><p>Není v SRD 5.2.1.</p>') + '<div class="ed-bar">' + add + cp + '<button class="ed-btn srd-close">Zavřít</button></div></div>';
      var ad = bg.querySelector(".srd-add"); if (ad) ad.addEventListener("click", function (e) { e.stopPropagation(); addToWiki(x); });
      var c = bg.querySelector(".srd-copy"); if (c) c.addEventListener("click", function (e) { e.stopPropagation(); navigator.clipboard && navigator.clipboard.writeText("[" + x.nazev + "](#srd-" + t + "-" + x.nazev.replace(/ /g, "_") + ")"); c.textContent = "Zkopírováno ✓"; });
      document.body.appendChild(bg); bg.addEventListener("click", function (e) { if (e.target === bg || e.target.classList.contains("srd-close")) bg.remove(); });
    });
  }
  window.MontelienSRD = { show: show, load: load };
  document.addEventListener("click", function (e) {
    var h = e.target.closest && e.target.closest('a[href^="#srd-"]');
    if (h) { var mm = h.getAttribute("href").match(/^#srd-(bestiar|predmety|glosar|featy)-(.+)$/); if (mm) { e.preventDefault(); show(mm[1], decodeURIComponent(mm[2]).replace(/_/g, " ")); return; } }
    var a = e.target.closest && e.target.closest(".srd-link"); if (a) { e.preventDefault(); show(a.dataset.typ, a.dataset.nazev); } });
  var COLS = { bestiar: [["nazev", "Netvor"], ["cr", "CR"], ["typ", "Typ"], ["velikost", "Velikost"], ["ac", "AC"], ["hp", "HP"]], predmety: [["nazev", "Předmět"], ["kategorie", "Kategorie"], ["vzacnost", "Vzácnost"], ["druh", "Druh"]], glosar: [["nazev", "Heslo"], ["stitek", "Štítek"]] };
  function catalog() {
    document.querySelectorAll(".srd-katalog").forEach(function (el) {
      if (el.dataset.ready) return; el.dataset.ready = "1"; var t = el.dataset.typ, cols = COLS[t];
      load(t).then(function (d) {
        if (el.dataset.pole) { var P = el.dataset.pole.split("|"), H = el.dataset.hodnoty.split("|"); d = d.filter(function (x) { return P.every(function (p, i) { return H[i].split(",").indexOf(String(x[p])) >= 0; }); }); }
        if (el.dataset.crmin) d = d.filter(function (x) { return x.cr_num >= Number(el.dataset.crmin) && x.cr_num <= Number(el.dataset.crmax); });
        var f2 = cols[2] ? cols[2][0] : null, vals = {}; d.forEach(function (x) { if (f2 && x[f2]) vals[x[f2]] = 1; });
        el.innerHTML = '<div class="kz-filtr"><input class="q" placeholder="Hledat…">' + (f2 ? '<select class="f"><option value="">' + cols[2][1] + ': vše</option>' + Object.keys(vals).sort().map(function (v) { return '<option>' + esc(v) + '</option>'; }).join("") + '</select>' : '') + (t === "bestiar" ? '<input class="crmin" type="number" placeholder="CR od" style="width:6em"><input class="crmax" type="number" placeholder="CR do" style="width:6em">' : '') + '<span class="n"></span></div><table class="kz-list"><thead><tr>' + cols.map(function (c) { return '<th>' + c[1] + '</th>'; }).join("") + '</tr></thead><tbody></tbody></table>';
        var tb = el.querySelector("tbody");
        function draw() {
          var q = el.querySelector(".q").value.toLowerCase(), f = el.querySelector(".f") ? el.querySelector(".f").value : "", lo = el.querySelector(".crmin"), hi = el.querySelector(".crmax");
          var rows = d.filter(function (x) { return (!q || (x.nazev + " " + (x.text || "")).toLowerCase().indexOf(q) >= 0) && (!f || x[f2] === f) && (!lo || lo.value === "" || x.cr_num >= Number(lo.value)) && (!hi || hi.value === "" || x.cr_num <= Number(hi.value)); });
          el.querySelector(".n").textContent = rows.length + " položek";
          tb.innerHTML = rows.slice(0, 700).map(function (x) { return '<tr>' + cols.map(function (c, i) { return '<td>' + (i ? esc(x[c[0]]) : '<a href="#" class="srd-link" data-typ="' + t + '" data-nazev="' + esc(x.nazev) + '">' + esc(x.nazev) + '</a>') + '</td>'; }).join("") + '</tr>'; }).join("");
        }
        el.querySelectorAll("input,select").forEach(function (i) { i.addEventListener("input", draw); }); draw();
      });
    });
  }
  function fromHash() { var m = location.pathname.match(/\/(bestiar|predmety|glosar)\/$/); if (m && location.hash.length > 1) show(m[1], decodeURIComponent(location.hash.slice(1)).replace(/_/g, " ")); }
  if (window.document$) window.document$.subscribe(fromHash); else document.addEventListener("DOMContentLoaded", fromHash);
  if (window.document$) window.document$.subscribe(catalog); else document.addEventListener("DOMContentLoaded", catalog);
})();
