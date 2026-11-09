// Úpravy wiki přímo z webu (funguje jen se serverem web/server.py)
(function () {
  var API = null;
  function root() {
    var s = document.querySelector('script[src*="assets/editor.js"]');
    return s ? s.src.replace(/assets\/editor\.js.*$/, "") : "/";
  }
  function api(method, path, data) {
    return fetch(root() + "api/" + path, {
      method: method, headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.chyba || r.status); return j; }); });
  }
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "on") Object.keys(attrs.on).forEach(function (ev) { e.addEventListener(ev, attrs.on[ev]); }); else e.setAttribute(k, attrs[k]); });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function modal(title, body, buttons) {
    var bg = el("div", { class: "ed-modal-bg" }), box = el("div", { class: "ed-modal" });
    box.appendChild(el("h2", {}, title)); box.appendChild(body);
    var bar = el("div", { class: "ed-bar" });
    (buttons || []).forEach(function (b) { bar.appendChild(el("button", { class: "ed-btn" + (b.primary ? " ed-primary" : "") + (b.danger ? " ed-danger" : ""), on: { click: function () { b.click(close); } } }, b.text)); });
    bar.appendChild(el("button", { class: "ed-btn", on: { click: function () { close(); } } }, "Zavřít"));
    box.appendChild(bar); bg.appendChild(box); document.body.appendChild(bg);
    function close() { bg.remove(); }
    return { close: close, box: box };
  }
  window.MontelienEditor = { api: api, modal: modal, el: el, root: root };
  function busy(on) { document.body.classList.toggle("ed-busy", !!on); }
  function pageUrl(cesta) {
    var u = cesta.replace(/(README|index)\.md$/, "").replace(/\.md$/, "/");
    return root() + u;
  }

  function editPage(cesta) {
    api("GET", "soubor?cesta=" + encodeURIComponent(cesta)).then(function (d) {
      var ta = el("textarea");
      var body = el("div", {}); body.appendChild(el("p", { class: "ed-pozn" }, "Soubor <code>" + cesta + "</code>. Upravit jde úplně cokoliv (Markdown, odkazy, tabulky, i hlavička <code>---</code> u postav)."));
      body.appendChild(ta);
      var m = modal("Upravit stránku", body, [{ text: "Uložit", primary: true, click: function (close) {
        busy(true);
        api("PUT", "soubor", { cesta: cesta, obsah: mde.value() }).then(function () { location.reload(); })
          .catch(function (e) { busy(false); alert("Chyba: " + e.message); });
      } }]);
      m.box.classList.add("ed-wide");
      var mde = new EasyMDE({ element: ta, initialValue: d.obsah, spellChecker: false, autofocus: true, status: false,
        toolbar: ["bold", "italic", "heading", "|", "quote", "unordered-list", "ordered-list", "table", "link", "|",
          { name: "srd", className: "fa fa-dragon", text: "SRD", title: "Vložit odkaz na netvora / předmět / pravidlo (SRD 5.2.1)", action: function (ed) {
            var typ = prompt("Typ: bestiar / predmety / glosar", "bestiar"); if (!typ) return; var n = prompt("Přesný anglický název (např. Ghoul, Longsword, Prone)"); if (!n) return;
            ed.codemirror.replaceSelection("[" + n + "](#srd-" + typ + "-" + n.replace(/ /g, "_") + ")"); } },
          { name: "pdm", className: "fa fa-eye-slash", text: "Pro DM", title: "Vložit tajnou sekci Pro DM", action: function (ed) { ed.codemirror.replaceSelection("\n## Pro DM (tajné)\n- "); } },
          { name: "navrh", className: "fa fa-pen", text: "Návrh", title: "Označit jako návrh", action: function (ed) { ed.codemirror.replaceSelection("> **Stav:** návrh\n"); } },
          "|", "preview", "side-by-side", "fullscreen"] });
      function sv() { m.box.querySelector(".ed-primary").click(); } mde.codemirror.setOption("extraKeys", { "Ctrl-S": sv, "Cmd-S": sv });
    }).catch(function (e) { alert("Nelze načíst: " + e.message); });
  }

  function newPage(cesta) {
    api("GET", "strom").then(function (t) {
      var here = cesta.indexOf("/") > 0 ? cesta.replace(/\/[^\/]*$/, "") : t.slozky[0];
      var body = el("div", { class: "ed-form" });
      var sel = el("select"); t.slozky.forEach(function (s) { var o = el("option", { value: s }, s); if (s === here) o.selected = true; sel.appendChild(o); });
      var name = el("input", { placeholder: "např. Město Nové Město" });
      var tpl = el("select"); tpl.appendChild(el("option", { value: "" }, "(prázdná)"));
      t.soubory.filter(function (f) { return f.indexOf("_Sablony/") === 0; }).forEach(function (f) { tpl.appendChild(el("option", { value: f }, f.replace("_Sablony/", ""))); });
      [["Složka", sel], ["Název stránky", name], ["Šablona", tpl]].forEach(function (r) { var l = el("label", {}, r[0]); l.appendChild(r[1]); body.appendChild(l); });
      modal("Nová stránka", body, [{ text: "Vytvořit", primary: true, click: function () {
        var title = name.value.trim(); if (!title) return alert("Zadej název.");
        var file = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + ".md";
        var path = sel.value + "/" + file;
        var make = function (text) {
          busy(true);
          api("POST", "soubor", { cesta: path, obsah: text }).then(function () { location.href = pageUrl(path); })
            .catch(function (e) { busy(false); alert("Chyba: " + e.message); });
        };
        if (tpl.value) api("GET", "soubor?cesta=" + encodeURIComponent(tpl.value)).then(function (d) {
          make(d.obsah.replace(/^# .*$/m, "# " + title));
        }); else make("# " + title + "\n\n> **Stav:** návrh\n\n");
      } }]);
    });
  }
  window.MontelienEditor = {
    newPage: function () { var src = document.getElementById("zdroj-stranky"); newPage(src ? src.dataset.cesta : "mapa.md"); },
    newCharacter: function () { newPage("04_Postavy/NPC/Postava_Nova.md"); }
  };

  function deletePage(cesta) {
    if (!confirm("Opravdu smazat stránku " + cesta + "?\n(Smazání jde vrátit přes git.)")) return;
    busy(true);
    api("DELETE", "soubor?cesta=" + encodeURIComponent(cesta)).then(function () { location.href = root(); })
      .catch(function (e) { busy(false); alert("Chyba: " + e.message); });
  }

  function editMap() {
    api("GET", "soubor?cesta=11_Mapy/mista.json").then(function (d) {
      var data = JSON.parse(d.obsah), cols = ["nazev", "x", "y", "typ", "jistota", "odkaz", "pozn"];
      var body = el("div", {});
      body.appendChild(el("p", { class: "ed-pozn" }, "Souřadnice jsou v px vyrovnané mapy (2048×1440). Tip: klikni do mapy na stránce a souřadnice se ukážou v rohu. Typ: zeme / mesto / misto / more / sidlo. Jistota: mapa / kanon / odhad."));
      var tbl = el("table", { class: "ed-table" }), head = el("tr");
      cols.concat([""]).forEach(function (c) { head.appendChild(el("th", {}, c)); }); tbl.appendChild(head);
      function row(m) {
        var tr = el("tr");
        cols.forEach(function (c) { var td = el("td"), i = el("input", { value: m[c] != null ? m[c] : "" }); i.dataset.k = c; td.appendChild(i); tr.appendChild(td); });
        var td = el("td"); td.appendChild(el("button", { class: "ed-btn ed-danger", on: { click: function () { tr.remove(); } } }, "×")); tr.appendChild(td);
        tr._orig = m; tbl.appendChild(tr);
      }
      data.mista.forEach(row);
      var wrap = el("div", { class: "ed-scroll" }); wrap.appendChild(tbl); body.appendChild(wrap);
      body.appendChild(el("button", { class: "ed-btn", on: { click: function () { row({ nazev: "Nové místo", x: 1024, y: 720, typ: "misto", jistota: "odhad", odkaz: "11_Mapy/Analyza_mapy.md", pozn: "" }); } } }, "+ Přidat místo"));
      var redraw = el("label", {}, " překreslit popisky v obrázku mapy (trvá pár sekund)"); var cb = el("input", { type: "checkbox" }); redraw.prepend(cb); body.appendChild(redraw);
      var m = modal("Místa na mapě", body, [{ text: "Uložit", primary: true, click: function () {
        data.mista = Array.prototype.slice.call(tbl.querySelectorAll("tr")).slice(1).map(function (tr) {
          var o = JSON.parse(JSON.stringify(tr._orig));
          tr.querySelectorAll("input").forEach(function (i) { var k = i.dataset.k, v = i.value; o[k] = (k === "x" || k === "y") ? Number(v) : v; });
          return o;
        });
        busy(true);
        api("PUT", "soubor", { cesta: "11_Mapy/mista.json", obsah: JSON.stringify(data, null, 1), prekreslit_mapu: cb.checked })
          .then(function () { location.reload(); }).catch(function (e) { busy(false); alert("Chyba: " + e.message); });
      } }]);
      m.box.classList.add("ed-wide");
    });
  }

  function toolbar() {
    var src = document.getElementById("zdroj-stranky"), inner = document.querySelector(".md-content__inner");
    if (!src || !inner || document.getElementById("ed-toolbar")) return;
    var cesta = src.dataset.cesta, bar = el("div", { id: "ed-toolbar" });
    if (cesta === "mapa.md") {
      bar.appendChild(el("button", { class: "ed-btn", on: { click: editMap } }, "✎ Upravit místa"));
    } else {
      bar.appendChild(el("button", { class: "ed-btn", on: { click: function () { editPage(cesta); } } }, "✎ Upravit stránku"));
      bar.appendChild(el("button", { class: "ed-btn", on: { click: function () { newPage(cesta); } } }, "+ Nová stránka"));
      if (!/README\.md$/.test(cesta) && cesta.indexOf("/") > 0)
        bar.appendChild(el("button", { class: "ed-btn ed-danger", on: { click: function () { deletePage(cesta); } } }, "Smazat"));
    }
    inner.prepend(bar);
  }
  function init() {
    if (API === false) return;
    if (API === true) return toolbar();
    api("GET", "strom").then(function () { API = true; document.body.classList.add("ed-on"); toolbar(); })
      .catch(function () { API = false; });
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
