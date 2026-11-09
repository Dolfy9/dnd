(function () {
  "use strict";
  var data = null;
  function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
  function load() {
    if (data) return Promise.resolve(data);
    return fetch("/druhy_index.json").then(function (r) { if (!r.ok) throw Error(r.status); return r.json(); }).then(function (v) { data = v; return v; });
  }
  function open(name) {
    load().then(function (items) {
      var d = items.find(function (x) { return norm(x.nazev) === norm(name); });
      if (!d) return;
      var old = document.querySelector(".druh-dialog"); if (old) old.remove();
      var dialog = document.createElement("div"); dialog.className = "druh-dialog"; dialog.setAttribute("role", "presentation");
      dialog.innerHTML = '<section role="dialog" aria-modal="true" aria-label="' + esc(d.nazev) + '"><button class="druh-close" aria-label="Zavřít">×</button><div class="druh-modal-overview">'
        + (d.obrazek ? '<img class="druh-modal-image" src="/13_Druhy/obrazky/' + encodeURIComponent(d.stem) + '.webp" alt="Ilustrace druhu ' + esc(d.nazev) + '">' : '')
        + '<div><h2>' + esc(d.nazev) + '</h2>'
        + (d.legacy ? '<p><strong class="druh-legacy">legacy, kompatibilní</strong> · alternativa 2024: ' + esc(d.alternativa_2024) + '</p>' : '')
        + '<p>' + esc(d.zdroj) + ' · ' + esc(d.velikost) + ' · ' + esc(d.rychlost) + ' · ' + esc(d.typ) + '</p>'
        + '</div></div><div class="druh-modal-traits">' + Object.keys(d.rysy || {}).map(function (key) { return '<details><summary>' + esc(key) + '</summary><p>' + esc(typeof d.rysy[key] === "string" ? d.rysy[key] : d.rysy[key].text) + '</p></details>'; }).join("")
        + '</div><a class="md-button" href="/' + esc(d.stranka.replace(/\.md$/, "/")) + '">Otevřít úplný popis</a></section>';
      document.body.appendChild(dialog);
      dialog.addEventListener("click", function (e) { if (e.target === dialog || e.target.closest(".druh-close")) dialog.remove(); });
      dialog.querySelector(".druh-close").focus();
    }).catch(function (e) { console.error(e); });
  }
  window.MontelienDruhy = { open: open };
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-species]");
    if (trigger) { event.preventDefault(); event.stopPropagation(); open(trigger.dataset.species); }
  });
  function catalog(items) {
    var root = document.getElementById("druhy-katalog"); if (!root) return;
    var filters = [["zdroj","Zdroj"],["edice","Edice"],["velikost","Velikost"],["typ","Typ"],["rychlost","Rychlost"]];
    root.innerHTML = '<input class="druhy-search" type="search" placeholder="Hledat druh…" aria-label="Hledat druh"><div class="druhy-filters"></div><div class="druhy-grid"></div>';
    var filterRoot = root.querySelector(".druhy-filters");
    filters.forEach(function (pair) {
      var vals = pair[0] === "edice" ? ["2024+","legacy"] : Array.from(new Set(items.map(function (x) { return String(pair[0] === "edice" ? (x.legacy ? "legacy" : "2024+") : x[pair[0]]); }))).sort();
      var s = document.createElement("select"); s.dataset.field = pair[0]; s.innerHTML = '<option value="">' + pair[1] + ' – vše</option>' + vals.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join(""); filterRoot.appendChild(s);
    });
    function draw() {
      var q = norm(root.querySelector("input").value), selected = {};
      root.querySelectorAll("select").forEach(function (s) { selected[s.dataset.field] = s.value; });
      var found = items.filter(function (x) {
        return (!q || norm(x.nazev + " " + x.zdroj).includes(q)) && Object.keys(selected).every(function (k) {
          var value = k === "edice" ? (x.legacy ? "legacy" : "2024+") : String(x[k]);
          return !selected[k] || selected[k] === value;
        });
      });
      root.querySelector(".druhy-grid").innerHTML = found.map(function (x) {
        var img = '../13_Druhy/obrazky/' + encodeURIComponent(x.stem) + '.webp';
        return '<article class="druh-card"><button class="druh-card-open" data-species="' + esc(x.nazev) + '">' + (x.obrazek ? '<img src="' + img + '" alt="" loading="lazy">' : '<span class="druh-card-image-placeholder">Ilustrace bude doplněna</span>') + '<strong>' + esc(x.nazev) + '</strong></button><small>' + esc(x.zdroj) + '</small><small>' + esc(x.velikost) + ' · ' + esc(x.rychlost) + ' · ' + esc(x.typ) + '</small>' + (x.legacy ? '<b class="druh-legacy">legacy, kompatibilní</b>' : '') + '<a href="../' + esc(x.stranka.replace(/\.md$/, "/")) + '">Popis</a></article>';
      }).join("") || "<p>Žádné druhy neodpovídají filtrům.</p>";
    }
    root.addEventListener("input", draw); root.addEventListener("change", draw); draw();
  }
  load().then(function (items) {
    catalog(items);
    document.querySelectorAll(".druh-hero[data-druh-obrazek]").forEach(function (box) {
      var item = items.find(function (x) { return x.stem === box.dataset.druhObrazek; });
      if (!item || !item.obrazek) { box.hidden = true; return; }
      var img = new Image(); img.alt = "Ilustrace druhu";
      img.onload = function () { box.appendChild(img); };
      img.src = "/13_Druhy/obrazky/" + encodeURIComponent(item.stem) + ".webp";
    });
    var source = document.getElementById("zdroj-stranky"), path = source && source.dataset.cesta;
    var current = items.find(function (x) { return x.stranka === path; });
    if (current) fetch("/postavy_index.json").then(function (r) { return r.json(); }).then(function (people) {
      var content = document.querySelector(".md-content__inner");
      if (content && Array.from(content.querySelectorAll("h2")).some(function (heading) {
        return heading.textContent.replace(/\u00b6/g, "").trim() === "Postavy tohoto druhu";
      })) return;
      var related = people.filter(function (p) { return norm(p.druh) === norm(current.nazev); });
      var section = document.createElement("section"); section.className = "druhy-related";
      section.innerHTML = '<h2>Postavy tohoto druhu</h2>' + (related.length ? related.map(function (p) { return '<a href="/' + esc(p.cesta.replace(/\.md$/, "/")) + '">' + esc(p.jmeno) + '</a>'; }).join(" · ") : "<p>V katalogu zatím není uvedena žádná postava tohoto druhu.</p>");
      if (content) content.appendChild(section);
    }).catch(function () {});
  }).catch(function () {});
})();
