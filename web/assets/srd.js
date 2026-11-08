// Katalogy SRD 5.2.1: bestiář, předměty, glosář + popupy (.srd-link data-typ data-nazev)
(function () {
  var C = {}, F = { bestiar: "bestiar.json", predmety: "predmety.json", glosar: "glosar.json", featy: "puvod_a_featy.json" };
  function base() { var s = document.querySelector('script[src*="assets/srd.js"]'); return s ? s.src.replace(/assets\/srd\.js.*$/, "") : "/"; }
  function load(t) { return C[t] ? Promise.resolve(C[t]) : fetch(base() + "assets/srd/" + F[t]).then(function (r) { return r.json(); }).then(function (j) { C[t] = j; return j; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function md(n) { return Math.floor((n - 10) / 2); } function sg(n) { return (n >= 0 ? "+" : "") + n; }
  function list(t, a) { return a && a.length ? '<h4>' + t + '</h4>' + a.map(function (x) { return '<p><b><i>' + esc(x.nazev) + '.</i></b> ' + esc(x.text).replace(/\n/g, "<br>") + '</p>'; }).join("") : ""; }
  function statblock(m) {
    var sp = Object.keys(m.rychlost || {}).map(function (k) { return (k === "walk" ? "" : k + " ") + m.rychlost[k] + " ft"; }).join(", ");
    return '<div class="sb"><h2>' + esc(m.nazev) + '</h2><p class="sb-sub">' + esc(m.velikost + " " + m.typ + ", " + m.zarovnani) + '</p><hr>'
      + '<p><b>AC</b> ' + m.ac + ' &nbsp; <b>HP</b> ' + m.hp + ' (' + esc(m.hp_vzorec || "") + ') &nbsp; <b>Rychlost</b> ' + esc(sp || "30 ft") + '</p>'
      + '<table class="sb-ab"><tr>' + Object.keys(m.atributy).map(function (k) { return '<th>' + k + '</th>'; }).join("") + '</tr><tr>' + Object.keys(m.atributy).map(function (k) { var v = m.atributy[k]; return '<td>' + v + ' (' + sg(md(v)) + ')' + (m.zachrany.indexOf(k) >= 0 ? '<br><small>save</small>' : '') + '</td>'; }).join("") + '</tr></table>'
      + (m.dovednosti.length ? '<p><b>Dovednosti</b> ' + esc(m.dovednosti.join(", ")) + '</p>' : '') + (m.imunity ? '<p><b>Imunity</b> ' + esc(m.imunity) + '</p>' : '') + (m.odolnosti ? '<p><b>Odolnosti</b> ' + esc(m.odolnosti) + '</p>' : '')
      + '<p><b>Smysly</b> ' + esc(Object.keys(m.smysly || {}).map(function (k) { return k + " " + m.smysly[k] + " ft"; }).join(", ") || "—") + ' &nbsp; <b>Jazyky</b> ' + esc(m.jazyky || "—") + ' &nbsp; <b>CR</b> ' + esc(m.cr) + '</p><hr>'
      + list("Rysy", m.rysy) + list("Akce", m.akce) + list("Bonusové akce", m.bonusove_akce) + list("Reakce", m.reakce) + list("Legendární akce", m.legendarni) + '<p class="sb-src">SRD 5.2.1 (CC-BY 4.0)</p></div>';
  }
  function detail(t, x) {
    if (t === "bestiar") return statblock(x);
    return '<h2>' + esc(x.nazev) + '</h2>' + (x.stitek ? '<p><i>' + esc(x.stitek) + '</i></p>' : '') + (x.kategorie ? '<p><i>' + esc(x.kategorie + (x.vzacnost ? " · " + x.vzacnost : "") + (x.attunement ? " · attunement" : "")) + '</i></p>' : '') + '<div class="kz-text">' + esc(x.text).replace(/\n/g, "<br>") + '</div><p class="sb-src">SRD 5.2.1 (CC-BY 4.0)</p>';
  }
  function show(t, n) {
    load(t).then(function (d) {
      var x = d.filter(function (e) { return e.nazev.toLowerCase() === String(n).toLowerCase(); })[0];
      var bg = document.createElement("div"); bg.className = "ed-modal-bg";
      bg.innerHTML = '<div class="ed-modal kz-modal">' + (x ? detail(t, x) : '<h2>' + esc(n) + '</h2><p>Není v SRD 5.2.1.</p>') + '<div class="ed-bar"><button class="ed-btn">Zavřít</button></div></div>';
      document.body.appendChild(bg); bg.addEventListener("click", function (e) { if (e.target === bg || e.target.tagName === "BUTTON") bg.remove(); });
    });
  }
  window.MontelienSRD = { show: show, load: load };
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest(".srd-link"); if (a) { e.preventDefault(); show(a.dataset.typ, a.dataset.nazev); } });
  var COLS = { bestiar: [["nazev", "Netvor"], ["cr", "CR"], ["typ", "Typ"], ["velikost", "Velikost"], ["ac", "AC"], ["hp", "HP"]], predmety: [["nazev", "Předmět"], ["kategorie", "Kategorie"], ["vzacnost", "Vzácnost"], ["druh", "Druh"]], glosar: [["nazev", "Heslo"], ["stitek", "Štítek"]] };
  function catalog() {
    document.querySelectorAll(".srd-katalog").forEach(function (el) {
      if (el.dataset.ready) return; el.dataset.ready = "1"; var t = el.dataset.typ, cols = COLS[t];
      load(t).then(function (d) {
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
  if (window.document$) window.document$.subscribe(catalog); else document.addEventListener("DOMContentLoaded", catalog);
})();
