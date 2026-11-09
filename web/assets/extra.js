// Režim DM / hráč, zvýraznění stavu návrh/kánon
(function () {
  function oznac() {
    document.querySelectorAll(".md-typeset blockquote").forEach(function (bq) {
      var t = bq.textContent.trim();
      if (/^Stav:/i.test(t)) {
        bq.classList.add("stav", /návrh/i.test(t) ? "stav-navrh" : "stav-kanon");
      }
    });
    document.querySelectorAll(".md-typeset h2").forEach(function (h) {
      if (!/^Pro DM/i.test(h.textContent.trim()) || h.classList.contains("dm-nadpis")) return;
      h.classList.add("dm-nadpis");
      var wrap = document.createElement("div");
      wrap.className = "dm-sekce";
      var n = h.nextElementSibling;
      while (n && !/^H[12]$/.test(n.tagName)) { var next = n.nextElementSibling; wrap.appendChild(n); n = next; }
      h.after(wrap);
      wrap.prepend(h);
      h.classList.remove("dm-nadpis");
    });
  }
  function rezim() {
    var hrac = localStorage.getItem("montelien-rezim") === "hrac";
    document.body.classList.toggle("rezim-hrac", hrac);
    var b = document.getElementById("rezim-prepinac");
    if (b) {
      b.setAttribute("aria-pressed", String(!hrac));
      b.textContent = hrac ? "DM režim" : "DM režim";
    }
  }
  window.MontelienMode = { toggle: function () {
    localStorage.setItem("montelien-rezim", localStorage.getItem("montelien-rezim") === "hrac" ? "dm" : "hrac");
    rezim();
  }, refresh: rezim };
  window.addEventListener("montelien:mode", rezim);
  function init() { oznac(); rezim(); }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
// Barevná schémata
(function () {
  var T = [["pergamen", "Pergamen", "#b8892b"], ["noc", "Noc", "#d9a53c"], ["krev", "Krev a zlato", "#e3b94a"],
    ["popel", "Popel", "#c4a2ff"], ["hvozd", "Hvozd", "#4f9a45"], ["mraz", "Mráz", "#3d8cc4"], ["poust", "Poušť", "#c58b2a"]];
  var M = [["light", "Světlá"], ["dark", "Tmavá"], ["auto", "Auto"]];
  function apply() {
    var t = localStorage.getItem("mont-theme") || "pergamen";
    var mode = localStorage.getItem("mont-theme-mode") || "auto";
    var dark = mode === "dark" || (mode === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-mont-theme", t);
    document.documentElement.setAttribute("data-mont-mode", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-mont-mode-choice", mode);
    document.body.setAttribute("data-md-color-scheme", dark ? "slate" : "default");
    var w = document.getElementById("tema-prepinac");
    if (!w) {
      w = document.createElement("div"); w.id = "tema-prepinac";
      w.innerHTML = '<button class="nav-appearance-button" type="button" aria-label="Vzhled" aria-expanded="false"><span aria-hidden="true">☼</span><span>Vzhled</span></button><div class="nav-appearance-popover" hidden>'
        + '<strong>Schéma</strong><div class="nav-swatches">' + T.map(function (x) {
          return '<button type="button" data-theme="' + x[0] + '" aria-label="' + x[1] + '"><i style="--nav-swatch:' + x[2] + '"></i><span>' + x[1] + '</span></button>';
        }).join("") + '</div><strong>Režim</strong><div class="nav-modes">' + M.map(function (x) {
          return '<button type="button" data-mode="' + x[0] + '">' + x[1] + '</button>';
        }).join("") + '</div></div>';
      w.addEventListener("click", function (event) {
        var target = event.target.closest("button");
        if (!target) return;
        if (target.dataset.theme) { localStorage.setItem("mont-theme", target.dataset.theme); apply(); }
        if (target.dataset.mode) { localStorage.setItem("mont-theme-mode", target.dataset.mode); apply(); }
        if (target.classList.contains("nav-appearance-button")) {
          var panel = w.querySelector(".nav-appearance-popover");
          panel.hidden = !panel.hidden;
          target.setAttribute("aria-expanded", String(!panel.hidden));
        }
      });
      var header = document.getElementById("nav-header-actions") || document.querySelector(".md-header__inner");
      if (header) header.appendChild(w); else document.body.appendChild(w);
    }
    w.querySelectorAll("[data-theme]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.theme === t)); });
    w.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.mode === mode)); });
  }
  window.MontelienTheme = { apply: apply, themes: T };
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    if ((localStorage.getItem("mont-theme-mode") || "auto") === "auto") apply();
  });
  if (window.document$) window.document$.subscribe(apply); else document.addEventListener("DOMContentLoaded", apply);
})();

// Boje přiřazené ke kampani / questu / sezení (boje_index.json z web/build.py nebo serveru)
(function () {
  function base() { var s = document.querySelector('script[src*="assets/extra.js"]'); return s ? s.src.replace(/assets\/extra\.js.*$/, "") : "/"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var STAV = { priprava: "Příprava", probiha: "Probíhá", dokonceno: "Dokončeno", archiv: "Archiv" };
  function box() {
    var b = base(), rel = decodeURIComponent(location.href.split("#")[0].split("?")[0].replace(b, "")).replace(/index\.html$/, "");
    if (!/^(07_Kampane|08_Questy|10_Sezeni)\/[^/]+\/$/.test(rel)) return;
    var path = rel.replace(/\/$/, "") + ".md", art = document.querySelector(".md-content__inner"); if (!art || art.querySelector(".boje-box")) return;
    fetch(b + "api/boje").then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return fetch(b + "boje_index.json").then(function (r) { return r.ok ? r.json() : {}; }); }).then(function (ix) {
      var key = path.indexOf("07_") === 0 ? "kampan" : path.indexOf("08_") === 0 ? "quest" : "sezeni";
      var L = (ix.boje || []).filter(function (x) { return x[key] === path; });
      var q = key === "quest" ? (ix.questy || []).filter(function (x) { return x.cesta === path; })[0] : null;
      var nov = b + "boj/?novy=1&" + key + "=" + encodeURIComponent(path) + (q && q.kampan ? "&kampan=" + encodeURIComponent(q.kampan) : "");
      var d = document.createElement("div"); d.className = "boje-box";
      d.innerHTML = "<b>⚔ Boje</b> (" + L.length + ") · <a href='" + nov + "'>+ připravit boj</a> · <a href='" + b + "boje/'>správa bojů</a>" + (L.length ? "<ul>" + L.map(function (x) {
        return "<li><a href='" + b + "boj/?boj=" + encodeURIComponent(x.id) + "'>" + esc(x.nazev) + "</a> – " + (STAV[x.stav] || x.stav) + ", kolo " + (x.kola || 0) + (x.vysledek ? " – <i>" + esc(x.vysledek) + "</i>" : "") + "</li>";
      }).join("") + "</ul>" : "");
      var h1 = art.querySelector("h1"); if (h1) h1.insertAdjacentElement("afterend", d); else art.prepend(d);
    }).catch(function () { });
  }
  if (window.document$) window.document$.subscribe(box); else document.addEventListener("DOMContentLoaded", box);
})();
