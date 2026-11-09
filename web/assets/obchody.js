(function () {
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function base() { var s = document.querySelector('script[src*="assets/obchody.js"]'); return s ? s.src.replace(/assets\/obchody\.js.*$/, "") : "/"; }
  function norm(v) { return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function link(p) { return '<a class="postava-link" data-cesta="' + esc(p.cesta) + '" href="' + esc(p.url) + '">' + esc(p.jmeno) + '</a>'; }
  function init() {
    var catalog = document.getElementById("obchody-katalog"), detail = document.querySelector(".obchod-page");
    if ((!catalog || catalog.dataset.ready) && (!detail || detail.dataset.ready)) return;
    if (catalog) catalog.dataset.ready = "1";
    if (detail) detail.dataset.ready = "1";
    Promise.all([fetch(base() + "obchody_index.json").then(function (r) { return r.json(); }),
      fetch(base() + "assets/srd/predmety.json").then(function (r) { return r.json(); })])
      .then(function (data) {
        var shops = data[0], items = data[1], params = new URLSearchParams(location.search);
        if (catalog) {
          catalog.innerHTML = '<div class="obchody-controls"><input type="search" placeholder="Hledat obchod nebo položku">'
            + ['mesto','zeme','typ','stitek'].map(function (k) { return '<select data-filter="' + k + '"><option value="">Vše — ' + ({mesto:'města',zeme:'země',typ:'typy',stitek:'štítky'}[k]) + '</option></select>'; }).join("")
            + '</div><p class="obchody-count"></p><div class="obchody-list"></div>';
          var q = catalog.querySelector('input[type="search"]'), list = catalog.querySelector(".obchody-list"), count = catalog.querySelector(".obchody-count");
          q.value = params.get("q") || "";
          var selects = Array.from(catalog.querySelectorAll("select"));
          function options() {
            selects.forEach(function (sel) {
              var key = sel.dataset.filter, pool = shops.filter(function (s) { return selects.every(function (other) { return other === sel || !other.value || values(s, other.dataset.filter).indexOf(other.value) >= 0; }); });
              var counts = {}; pool.forEach(function (s) { values(s, key).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; }); });
              var selected = sel.value || params.get(key) || ""; sel.innerHTML = '<option value="">Vše — ' + ({mesto:'města',zeme:'země',typ:'typy',stitek:'štítky'}[key]) + '</option>'
                + Object.keys(counts).sort().map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + ' (' + counts[v] + ')</option>'; }).join("");
              sel.value = selected;
            });
          }
          function values(s, k) { return k === "mesto" ? [s.mesto.nazev] : k === "zeme" ? [s.zeme.nazev] : k === "typ" ? [s.typ] : s.stitky || []; }
          function draw() {
            var term = norm(q.value), found = shops.filter(function (s) {
              return norm(s.nazev + " " + s.nabidka.map(function (i) { return i.nazev; }).join(" ")).includes(term)
                && selects.every(function (sel) { return !sel.value || values(s, sel.dataset.filter).indexOf(sel.value) >= 0; });
            });
            count.textContent = found.length + (found.length === 1 ? " obchod" : found.length >= 2 && found.length <= 4 ? " obchody" : " obchodů");
            list.innerHTML = found.map(function (s) {
              var owner = s.majitel[0] || {}, img = owner.portret ? '<img src="' + esc(owner.portret) + '" alt="">' : "";
              return '<article class="obchod-card">' + img + '<div><h2><a href="' + esc(s.url) + '">' + esc(s.nazev) + '</a></h2><p>' + esc(s.typ) + ' · ' + esc(s.mesto.nazev) + ' · ' + esc(s.zeme.nazev) + '</p><p>' + s.majitel.map(link).join(", ") + '</p><small>' + s.nabidka.map(function (i) { return esc(i.nazev); }).join(" · ") + '</small></div></article>';
            }).join("");
            if (q.value) params.set("q", q.value); else params.delete("q");
            selects.forEach(function (s) { if (s.value) params.set(s.dataset.filter, s.value); else params.delete(s.dataset.filter); });
            history.replaceState(null, "", location.pathname + "?" + params.toString());
          }
          selects.forEach(function (s) { s.addEventListener("change", function () { options(); draw(); }); });
          q.addEventListener("input", draw); options(); draw();
        }
        if (detail) {
          var src = document.getElementById("zdroj-stranky");
          var shop = shops.find(function (s) { return src && s.cesta === src.dataset.cesta; }); if (!shop) return;
          function rows(items, services) {
            return '<div class="obchod-table-wrap"><table><thead><tr><th>' + (services ? "Služba" : "Předmět") + '</th><th>Kategorie</th><th>Cena</th><th>' + (services ? "Doba" : "Skladem") + '</th><th>Pozn.</th></tr></thead><tbody>'
              + items.map(function (i) { var href = i.srd ? '<a href="#srd-predmety-' + esc(i.srd.replace(/ /g, "_")) + '">' : "";
                return '<tr><td>' + href + esc(i.nazev) + (i.srd ? '</a>' : '') + '</td><td>' + esc(i.kategorie) + '</td><td>' + esc(i.cena) + '</td><td>' + esc(services ? i.doba : i.skladem) + '</td><td>' + esc(i.pozn) + '</td></tr>'; }).join("") + '</tbody></table></div>';
          }
          detail.innerHTML = '<p>Majitelé: ' + shop.majitel.map(link).join(", ") + (shop.personal.length ? ' · Personál: ' + shop.personal.map(link).join(", ") : "") + '</p>'
            + '<p>Otevírací doba: ' + esc(shop.oteviraci_doba) + ' · ' + esc(shop.ctvrt) + '</p><h2>Nabídka</h2>' + rows(shop.nabidka, false)
            + '<h2>Služby</h2>' + rows(shop.sluzby, true) + '<p><a href="' + esc(shop.mesto.url) + '">' + esc(shop.mesto.nazev) + '</a> · <a href="' + esc(shop.zeme.url) + '">' + esc(shop.zeme.nazev) + '</a></p>';
          function ensureEditor() {
            if (document.body.classList.contains("ed-on") && window.MontelienEditor && !detail.querySelector(".obchod-editor")) editor(detail, shop, items);
          }
          ensureEditor();
          new MutationObserver(ensureEditor).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        }
      }).catch(function (e) { if (catalog) catalog.innerHTML = '<p>Katalog obchodů se nenačetl: ' + esc(e.message) + '</p>'; });
  }
  function editor(host, shop, srdItems) {
    var box = document.createElement("section"); box.className = "obchod-editor";
    box.innerHTML = '<h2>Úprava nabídky a služeb</h2><datalist id="obchod-srd-items"></datalist>'
      + '<div class="obchod-editor-offers"></div><button type="button" data-add="offer">+ položka</button>'
      + '<div class="obchod-editor-services"></div><button type="button" data-add="service">+ služba</button> <button type="button" data-save>Uložit</button>';
    box.querySelector("datalist").innerHTML = srdItems.map(function (i) { return '<option value="' + esc(i.nazev) + '"></option>'; }).join("");
    var offers = box.querySelector(".obchod-editor-offers"), services = box.querySelector(".obchod-editor-services");
    function build(parent, rows, service) {
      var fields = service ? ["nazev","cena","doba","kategorie","pozn"] : ["nazev","srd","cena","skladem","kategorie","pozn"];
      parent.innerHTML = rows.map(function (r, n) { return '<div class="obchod-edit-row" data-index="' + n + '">' + fields.map(function (k) { return '<input data-key="' + k + '" placeholder="' + k + '" value="' + esc(r[k]) + '"' + (k === "nazev" && !service ? ' list="obchod-srd-items"' : "") + '>'; }).join("") + '<button type="button" data-remove>×</button></div>'; }).join("");
    }
    build(offers, shop.zdroj.nabidka || [], false); build(services, shop.zdroj.sluzby || [], true);
    box.addEventListener("click", function (e) {
      var add = e.target.closest("[data-add]"), rem = e.target.closest("[data-remove]");
      if (add) { var p = add.dataset.add === "offer" ? offers : services, fields = p === offers ? ["nazev","srd","cena","skladem","kategorie","pozn"] : ["nazev","cena","doba","kategorie","pozn"]; p.insertAdjacentHTML("beforeend", '<div class="obchod-edit-row">' + fields.map(function (k) { return '<input data-key="' + k + '" placeholder="' + k + '"' + (k === "nazev" && p === offers ? ' list="obchod-srd-items"' : "") + '>'; }).join("") + '<button type="button" data-remove>×</button></div>'); }
      if (rem) rem.closest(".obchod-edit-row").remove();
    });
    box.addEventListener("change", function (e) { if (e.target.matches('[data-key="nazev"]')) { var item=srdItems.find(function (x) { return x.nazev === e.target.value; }); if (item) { var row=e.target.closest(".obchod-edit-row"); row.querySelector('[data-key="srd"]').value=item.nazev; row.querySelector('[data-key="cena"]').value=item.cena+" GP"; } } });
    box.querySelector("[data-save]").addEventListener("click", function () {
      function read(parent) { return Array.from(parent.querySelectorAll(".obchod-edit-row")).map(function (r) { var o={}; r.querySelectorAll("[data-key]").forEach(function (i) { if (i.value) o[i.dataset.key]=i.dataset.key === "skladem" && /^\d+$/.test(i.value) ? Number(i.value) : i.value; }); return o; }); }
      var source = JSON.parse(JSON.stringify(shop.zdroj)); source.nabidka=read(offers); source.sluzby=read(services);
      window.MontelienEditor.api("POST","obchod/pole",{cesta:shop.cesta,obchod:source}).then(function(){location.reload();}).catch(function(e){alert("Chyba ukládání: "+e.message);});
    });
    host.appendChild(box);
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
