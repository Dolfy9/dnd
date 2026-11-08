// Katalog kouzel 2024 a detail kouzla (popup) – použito na sheetech i v katalogu
(function () {
  var K = null;
  function base() { var s = document.querySelector('script[src*="assets/kouzla.js"]'); return s ? s.src.replace(/assets\/kouzla\.js.*$/, "") : "/"; }
  var CS = null;
  function lang() { return localStorage.getItem("mont-lang") || "cs"; }
  function loadCs() { return CS ? Promise.resolve(CS) : fetch(base() + "assets/preklad/kouzla_cs.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (j) { CS = j; return j; }); }
  function load() { return loadCs().then(function () { return K ? K : fetch(base() + "assets/kouzla2024.json").then(function (r) { return r.json(); }).then(function (j) { K = j; K._low = {}; Object.keys(j).forEach(function (k) { K._low[k.toLowerCase()] = k; }); return K; }); }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function find(n) { var k = K[n] ? n : K._low[String(n).toLowerCase()]; return k ? [k, K[k]] : null; }
  function show(name) {
    load().then(function () {
      var f = find(name), bg = document.createElement("div"); bg.className = "ed-modal-bg";
      var h = '<div class="ed-modal kz-modal"><h2>' + esc(f ? f[0] : name) + '</h2>';
      if (!f) h += '<p>Kouzlo není v seznamu pravidel 2024.</p>';
      else {
        var s = f[1];
        h += '<p class="kz-meta"><i>' + esc(s.typ || ((s.uroven ? s.uroven + ". úroveň " : "Cantrip ") + (s.skola || ""))) + '</i></p><table class="kz-tab">'
          + [["Čas sesílání", s.cas], ["Dosah", s.dosah], ["Složky", s.slozky], ["Trvání", s.trvani], ["Povolání", s.tridy], ["Zdroj", s.zdroj]].filter(function (r) { return r[1]; }).map(function (r) { return "<tr><th>" + r[0] + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("")
          + '</table>' + langBar(CS[f[0]]) + '<div class="kz-text">' + txt(CS[f[0]], s.text) + '</div>';
      }
      h += '<div class="ed-bar"><button class="ed-btn">Zavřít</button></div></div>';
      bg.innerHTML = h; document.body.appendChild(bg);
      bg.addEventListener("click", function (e) { if (e.target === bg || e.target.tagName === "BUTTON") bg.remove(); });
    });
  }
  function langBar(cs) { return '<div class="lang-bar">' + (cs ? '<button class="lang-btn' + (lang() === "cs" ? ' on' : '') + '" data-lang="cs">CZ</button><button class="lang-btn' + (lang() === "en" ? ' on' : '') + '" data-lang="en">EN</button>' : '<small>Překlad zatím není – zobrazen originál.</small>') + '</div>'; }
  function txt(cs, en) { var s = cs && lang() === "cs" ? cs : en; return s ? '<div class="lt" data-cs="' + esc(cs || "") + '" data-en="' + esc(en || "") + '">' + esc(s).replace(/\n/g, "<br>") + '</div>' : "<i>Popis zatím nestažen.</i>"; }
  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest(".lang-btn"); if (!b) return; e.preventDefault(); e.stopPropagation(); localStorage.setItem("mont-lang", b.dataset.lang);
    var m = b.closest(".ed-modal"); m.querySelectorAll(".lang-btn").forEach(function (x) { x.classList.toggle("on", x === b); }); m.querySelectorAll(".lt").forEach(function (d) { var hh = esc(d.dataset[b.dataset.lang] || d.dataset.en).replace(/\n/g, "<br>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); d.innerHTML = d.classList.contains("sb-t") && window.MontelienSbFmt ? window.MontelienSbFmt(hh) : hh; }); }, true);
  window.MontelienLang = { bar: langBar, txt: txt, lang: lang };
  window.MontelienKouzla = { show: show, load: load, cache: function () { return K; } };
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest(".kz-link"); if (a) { e.preventDefault(); show(a.dataset.kouzlo); } });
  function catalog() {
    var el = document.getElementById("katalog-kouzel"); if (!el || el.dataset.ready) return; el.dataset.ready = "1";
    load().then(function () {
      var names = Object.keys(K).filter(function (k) { return k !== "_low"; }).sort();
      var classes = {}, schools = {}, sources = {};
      names.forEach(function (n) { var s = K[n]; (s.tridy || "").split(/,\s*/).forEach(function (c) { if (c) classes[c] = 1; }); if (s.skola) schools[s.skola] = 1; if (s.zdroj) sources[s.zdroj] = 1; });
      function opts(o, label) { return '<option value="">' + label + '</option>' + Object.keys(o).sort().map(function (k) { return '<option>' + esc(k) + '</option>'; }).join(""); }
      el.innerHTML = '<div class="kz-filtr"><input id="kz-q" placeholder="Hledat kouzlo…"><select id="kz-l"><option value="">Všechny úrovně</option><option value="0">Cantrip</option>' + [1,2,3,4,5,6,7,8,9].map(function (i) { return '<option>' + i + '</option>'; }).join("") + '</select><select id="kz-c">' + opts(classes, "Všechna povolání") + '</select><select id="kz-s">' + opts(schools, "Všechny školy") + '</select><select id="kz-z">' + opts(sources, "Všechny zdroje") + '</select><span id="kz-n"></span></div><table class="kz-list"><thead><tr><th>Kouzlo</th><th>Úr.</th><th>Škola</th><th>Čas</th><th>Dosah</th><th>Povolání</th></tr></thead><tbody></tbody></table>';
      var tb = el.querySelector("tbody");
      function draw() {
        var q = el.querySelector("#kz-q").value.toLowerCase(), l = el.querySelector("#kz-l").value, c = el.querySelector("#kz-c").value, s = el.querySelector("#kz-s").value, z = el.querySelector("#kz-z").value;
        var rows = names.filter(function (n) { var k = K[n]; return (!q || n.toLowerCase().indexOf(q) >= 0) && (l === "" || String(k.uroven) === l) && (!c || (k.tridy || "").indexOf(c) >= 0) && (!s || k.skola === s) && (!z || k.zdroj === z); });
        el.querySelector("#kz-n").textContent = rows.length + " kouzel";
        tb.innerHTML = rows.map(function (n) { var k = K[n]; return '<tr><td><a href="#" class="kz-link" data-kouzlo="' + esc(n) + '">' + esc(n) + '</a></td><td>' + (k.uroven === 0 ? "C" : esc(k.uroven)) + '</td><td>' + esc(k.skola || "") + '</td><td>' + esc(k.cas || "") + '</td><td>' + esc(k.dosah || "") + '</td><td>' + esc(k.tridy || "") + '</td></tr>'; }).join("");
      }
      el.querySelectorAll("input,select").forEach(function (i) { i.addEventListener("input", draw); });
      draw();
    });
  }
  if (window.document$) window.document$.subscribe(catalog); else document.addEventListener("DOMContentLoaded", catalog);
})();
