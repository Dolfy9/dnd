(function () {
  "use strict";
  var K = window.MontelienKatalog;
  if (!K) return;
  var esc = K.esc;
  function badge(item, render) {
    if (item.oznameno) return (item.treti_strana ? render("třetí strana") : "") + render("oznámeno");
    if (item.treti_strana) return render("třetí strana");
    if (item.legacy) return render("legacy", "legacy, kompatibilní");
    return render("2024");
  }
  function chips(values) {
    return values.filter(function (entry) { return entry[1]; }).map(function (entry) {
      return '<span class="kat-chip">' + esc(entry[0]) + ": " + esc(entry[1]) + "</span>";
    }).join("");
  }
  function modalChips(values) {
    return values.filter(function (entry) { return entry[1]; }).map(function (entry) {
      return '<span class="kat-modal-chip"><small>' + esc(entry[0]) + "</small>" + esc(entry[1]) + "</span>";
    }).join("");
  }
  function meta(item) {
    return '<p class="kat-modal-source">' + esc(item.source || "Zdroj neověřen") + "</p>"
      + '<div class="kat-badges">' + badge(item, K.badge) + "</div>";
  }
  function pageLink(item, label) {
    return item.url ? '<a class="md-button md-button--primary" href="' + esc(item.url) + '">' + esc(label || "Otevřít pravidla") + "</a>" : "";
  }
  function hitDie(value) { return typeof value === "number" ? "d" + value : value || ""; }
  function classSubclassList(item) {
    var groups = [
      { title: "2024", items: [] },
      { title: "Třetí strana", items: [] },
      { title: "Legacy", items: [] }
    ];
    (item.subclasses || []).forEach(function (subclass) {
      var group = subclass.legacy ? groups[2] : subclass.treti_strana ? groups[1] : groups[0];
      group.items.push(subclass);
    });
    return groups.filter(function (group) { return group.items.length; }).map(function (group) {
      return '<section class="kat-modal-subclass-group"><h3>' + esc(group.title) + "</h3><ul>"
        + group.items.map(function (subclass) {
          var href = "/podtridy/?trida=" + encodeURIComponent(item.name) + "&edice=" + encodeURIComponent(subclass.edition)
            + "&q=" + encodeURIComponent(subclass.name);
          return '<li><a href="' + esc(href) + '">' + esc(subclass.name) + "</a>"
            + (subclass.oznameno ? ' <span class="kat-badge kat-badge-announced">oznámeno</span>' : "")
            + (subclass.alternative_2024 ? '<small> · alternativa 2024: ' + esc(subclass.alternative_2024) + "</small>" : "")
            + "</li>";
        }).join("") + "</ul></section>";
    }).join("");
  }
  function classModal(item) {
    var related = "/podtridy/?trida=" + encodeURIComponent(item.name);
    var spells = "/kouzla/?trida=" + encodeURIComponent(item.name);
    var characters = "/postavy/?trida=" + encodeURIComponent(item.name);
    return "<h2>" + esc(item.name) + "</h2>" + meta(item)
      + '<div class="kat-modal-chips">' + modalChips([["Hit Die", hitDie(item.hit_die)],
        ["Primary Ability", item.primary_ability], ["Saving Throws", item.saves], ["Caster Type", item.caster_type]]) + "</div>"
      + (item.overview ? '<p class="kat-modal-overview">' + esc(item.overview) + "</p>" : "")
      + '<section class="kat-modal-proficiencies"><h3>Základní údaje</h3><dl>'
      + [["Skill Proficiencies", item.skills], ["Weapon Proficiencies", item.weapons], ["Armor Training", item.armor],
        ["Tool Proficiencies", item.tools], ["Starting Equipment", item.starting_equipment]]
        .filter(function (entry) { return entry[1]; })
        .map(function (entry) { return "<dt>" + esc(entry[0]) + "</dt><dd>" + esc(entry[1]) + "</dd>"; }).join("")
      + "</dl></section>"
      + (item.subclasses && item.subclasses.length ? '<section class="kat-modal-subclasses"><h3>Podtřídy</h3>'
        + classSubclassList(item) + "</section>" : "")
      + '<div class="kat-modal-actions">' + pageLink(item, "Pravidla povolání")
      + '<a class="md-button" href="' + related + '">Podtřídy tohoto povolání</a>'
      + '<a class="md-button" href="' + spells + '">Kouzla tohoto povolání</a>'
      + '<a class="md-button" href="' + characters + '">Postavy tohoto povolání</a></div>';
  }
  function subclassModal(item) {
    var levels = {};
    (item.features || []).forEach(function (feature) {
      var level = String(feature.level || "neověřeno");
      (levels[level] || (levels[level] = [])).push(feature);
    });
    var featureHtml = Object.keys(levels).sort(function (a, b) {
      var an = Number(a), bn = Number(b);
      if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
      if (Number.isFinite(an)) return -1;
      if (Number.isFinite(bn)) return 1;
      return a.localeCompare(b, "cs");
    }).map(function (level) {
      return '<section class="kat-modal-level-group"><h3>' + (Number.isFinite(Number(level))
        ? esc(level) + ". úroveň" : "Úroveň " + esc(level)) + "</h3>"
        + levels[level].map(function (feature) {
          return '<article class="kat-modal-feature"><h4>' + esc(feature.name) + "</h4>"
            + (feature.text ? "<p>" + esc(feature.text).replace(/\n/g, "<br>") + "</p>" : "") + "</article>";
        }).join("") + "</section>";
    }).join("");
    var alternative = item.alternative_2024
      ? '<p><strong>Alternativa 2024:</strong> ' + esc(item.alternative_2024) + "</p>" : "";
    var altLink = item.alternative_2024
      ? '<a class="md-button" href="/podtridy/?trida=' + encodeURIComponent(item.trida) + '&edice=2024&q='
        + encodeURIComponent(item.alternative_2024) + '">Najít alternativu 2024</a>' : "";
    var announcement = item.oznameno
      ? '<p class="kat-modal-notice"><strong>Oznámeno.</strong> ' + esc(item.source)
        + (item.revision ? " " + esc(item.revision) : "") + "</p>" : "";
    return "<h2>" + esc(item.name) + "</h2>" + meta(item)
      + '<div class="kat-modal-chips">' + modalChips([["Povolání", item.trida], ["Edice", item.edition]]) + "</div>"
      + (item.overview ? '<p class="kat-modal-overview">' + esc(item.overview) + "</p>" : "")
      + announcement + (item.revision ? '<p><strong>Revize:</strong> ' + esc(item.revision) + "</p>" : "")
      + alternative + '<div class="kat-modal-features">' + featureHtml + "</div>"
      + '<div class="kat-modal-actions"><a class="md-button" href="/povolani/?q=' + encodeURIComponent(item.trida) + '">Povolání ' + esc(item.trida) + "</a>"
      + pageLink(item, "Otevřít pravidla podtřídy") + altLink + "</div>";
  }
  function backgroundModal(item) {
    return "<h2>" + esc(item.name) + "</h2>" + meta(item)
      + '<div class="kat-modal-chips">' + modalChips([["Zvýšení vlastností", item.ability_scores], ["Feat", item.feat],
        ["Dovednosti", item.skills]]) + "</div>" + (item.overview ? '<p>' + esc(item.overview) + "</p>" : "")
      + '<div class="kat-modal-actions">' + pageLink(item, "Pozadí v pravidlech") + "</div>";
  }
  function featModal(item) {
    return "<h2>" + esc(item.name) + "</h2>" + meta(item)
      + '<div class="kat-modal-chips">' + modalChips([["Kategorie", item.category], ["Předpoklad", item.prerequisite]]) + "</div>"
      + (item.text ? '<p class="kat-modal-overview">' + esc(item.text) + "</p>" : "")
      + '<div class="kat-modal-actions">' + pageLink(item, "Featy v pravidlech") + "</div>";
  }
  function init() {
    K.init({
      id: "povolani", root: "#povolani-katalog", index: "tridy_index.json",
      searchFields: ["name", "source", "primary_ability", "saves", "overview"],
      filters: [{ key: "edition", param: "edice", label: "Edice" }],
      card: {
        title: "name", subtitle: function (item) { return item.primary_ability || item.source; },
        image: function (item) { return item.image ? K.base() + "14_Povolani/obrazky/" + encodeURIComponent(item.stem) + ".webp" : ""; },
        badges: badge, chips: function (item) { return chips([["Hit Die", hitDie(item.hit_die)], ["Sesílání", item.caster_type]]); }
      },
      modalImage: true, modal: classModal, pageUrl: function (item) { return item.url; }
    });
    K.init({
      id: "podtridy", root: "#podtridy-katalog", index: "podtridy_index.json",
      searchFields: ["name", "source", "publisher", "trida", "alternative_2024", function (item) { return (item.features || []).map(function (f) { return f.name; }).join(" "); }],
      filters: [
        { key: "trida", label: "Povolání" },
        { key: "edition", param: "edice", label: "Edice" },
        { key: "source", param: "kniha", label: "Kniha" },
        { key: "publisher", param: "vydavatel", label: "Vydavatel" }
      ],
      card: {
        title: "name", subtitle: function (item) { return item.trida + " · " + item.source; },
        image: function (item) { return item.image ? K.base() + "15_Podtridy/obrazky/" + encodeURIComponent(item.stem) + ".webp" : ""; },
        badges: badge, chips: function (item) { return chips([["Povolání", item.trida], ["Rysy", (item.features || []).map(function (f) { return f.name; }).join(", ")]]); }
      },
      modalImage: true, modal: subclassModal, pageUrl: function (item) { return item.url; }
    });
    K.init({
      id: "pozadi", root: "#pozadi-katalog", index: "pozadi_index.json",
      searchFields: ["name", "source", "ability_scores", "feat", "skills"],
      filters: [{ key: "edition", param: "edice", label: "Edice" }, { key: "source", param: "kniha", label: "Kniha" }],
      card: {
        title: "name", subtitle: function (item) { return item.feat; },
        badges: badge, chips: function (item) { return chips([["Vlastnosti", item.ability_scores], ["Dovednosti", item.skills]]); }
      },
      modal: backgroundModal, pageUrl: function (item) { return item.url; }
    });
    K.init({
      id: "featy", root: "#featy-katalog", index: "featy_index.json",
      searchFields: ["name", "source", "category", "prerequisite", "text"],
      filters: [{ key: "category", param: "kategorie", label: "Kategorie" }, { key: "edition", param: "edice", label: "Edice" }],
      card: {
        title: "name", subtitle: function (item) { return item.category; },
        badges: badge, chips: function (item) { return chips([["Předpoklad", item.prerequisite]]); }
      },
      modal: featModal, pageUrl: function (item) { return item.url; }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
