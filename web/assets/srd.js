// Katalogy SRD 5.2.1: bestiář, předměty, glosář + popupy (.srd-link data-typ data-nazev)
(function () {
  var C = {}, F = { bestiar: "bestiar.json", predmety: "predmety.json", glosar: "glosar.json", featy: "puvod_a_featy.json" };
  function base() { var s = document.querySelector('script[src*="assets/srd.js"]'); return s ? s.src.replace(/assets\/srd\.js.*$/, "") : "/"; }
  var CS = {};
  function loadCs(t) { return CS[t] ? Promise.resolve(CS[t]) : fetch(base() + "assets/preklad/" + t + "_cs.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { CS[t] = j; return j; }); }
  function load(t) { return loadCs(t).then(function () { return C[t] ? C[t] : fetch(base() + "assets/srd/" + F[t]).then(function (r) { return r.json(); }).then(function (j) { C[t] = j; return j; }); }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(n) { return Math.floor((n - 10) / 2); } function sg(n) { return (n >= 0 ? "+" : "") + n; }
  function lt(en) { var cs = (CS.bestiar || {})[en], L = window.MontelienLang ? window.MontelienLang.lang() : "cs"; return '<span class="lt" data-cs="' + esc(cs || en) + '" data-en="' + esc(en) + '">' + esc(cs && L === "cs" ? cs : en).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + '</span>'; }
  function list(t, a) { return a && a.length ? '<h4>' + t + '</h4>' + a.map(function (x) { return '<p><b><i>' + esc(x.nazev) + '.</i></b> ' + lt(x.text) + '</p>'; }).join("") : ""; }
  function statblock(m) {
    var sp = Object.keys(m.rychlost || {}).map(function (k) { return (k === "walk" ? "" : k + " ") + m.rychlost[k] + " ft"; }).join(", ");
    var all = [].concat(m.rysy || [], m.akce || [], m.bonusove_akce || [], m.reakce || [], m.legendarni || []), hasCs = all.some(function (x) { return (CS.bestiar || {})[x.text]; });
    return '<div class="sb"><h2>' + esc(m.nazev) + '</h2><p class="sb-sub">' + esc(m.velikost + " " + m.typ + ", " + m.zarovnani) + '</p>' + (window.MontelienLang && all.length ? window.MontelienLang.bar(hasCs) : '') + '<hr>'
      + '<p><b>AC</b> ' + m.ac + ' &nbsp; <b>HP</b> ' + m.hp + ' (' + esc(m.hp_vzorec || "") + ') &nbsp; <b>Rychlost</b> ' + esc(sp || "30 ft") + '</p>'
      + '<table class="sb-ab"><tr>' + Object.keys(m.atributy).map(function (k) { return '<th>' + k + '</th>'; }).join("") + '</tr><tr>' + Object.keys(m.atributy).map(function (k) { var v = m.atributy[k]; return '<td>' + v + ' (' + sg(md(v)) + ')' + '' + '</td>'; }).join("") + '</tr></table>'
      + (m.zachrany.length ? '<p><b>Záchrany</b> ' + esc(m.zachrany.join(", ")) + '</p>' : '') + (m.dovednosti.length ? '<p><b>Dovednosti</b> ' + esc(m.dovednosti.join(", ")) + '</p>' : '') + (m.imunity ? '<p><b>Imunity</b> ' + esc(m.imunity) + '</p>' : '') + (m.odolnosti ? '<p><b>Odolnosti</b> ' + esc(m.odolnosti) + '</p>' : '')
      + '<p><b>Smysly</b> ' + esc(Object.keys(m.smysly || {}).map(function (k) { return k + " " + m.smysly[k] + " ft"; }).join(", ") || "—") + ' &nbsp; <b>Jazyky</b> ' + esc(m.jazyky || "—") + ' &nbsp; <b>CR</b> ' + esc(m.cr) + '</p><hr>'
      + list("Rysy", m.rysy) + list("Akce", m.akce) + list("Bonusové akce", m.bonusove_akce) + list("Reakce", m.reakce) + list("Legendární akce", m.legendarni) + '<p class="sb-src">SRD 5.2.1 (CC-BY 4.0)</p></div>';
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
    load(t).then(function (d) {
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
