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
