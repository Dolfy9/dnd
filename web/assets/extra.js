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
    if (!b) {
      b = document.createElement("button");
      b.id = "rezim-prepinac";
      b.title = "Skrýt/zobrazit sekce Pro DM";
      b.onclick = function () {
        localStorage.setItem("montelien-rezim", hrac ? "dm" : "hrac");
        rezim();
      };
      document.body.appendChild(b);
    }
    b.textContent = hrac ? "Režim: hráč (DM skryto)" : "Režim: DM";
  }
  function init() { oznac(); rezim(); }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
})();
// Barevná schémata
(function () {
  var T = [["", "Schéma: podle režimu"], ["pergamen", "Pergamen"], ["noc", "Noc"], ["krev", "Krev a zlato"], ["popel", "Popel (Antemius)"], ["hvozd", "Hvozd"], ["mraz", "Mráz"], ["poust", "Poušť"]];
  var DARK = { noc: 1, krev: 1, popel: 1 };
  function apply() {
    var t = localStorage.getItem("mont-theme") || "";
    if (t) { document.documentElement.setAttribute("data-mont-theme", t); document.body.setAttribute("data-md-color-scheme", DARK[t] ? "slate" : "default"); }
    else document.documentElement.removeAttribute("data-mont-theme");
    var w = document.getElementById("tema-prepinac");
    if (!w) {
      w = document.createElement("div"); w.id = "tema-prepinac"; var hd = document.querySelector(".md-header__inner .md-search") || null;
      w.innerHTML = '<select title="Barevné schéma">' + T.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join("") + '</select>';
      w.firstChild.onchange = function () { localStorage.setItem("mont-theme", this.value); if (!this.value) location.reload(); else apply(); };
      if (hd) hd.parentNode.insertBefore(w, hd); else document.body.appendChild(w);
    }
    w.firstChild.value = t;
  }
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
