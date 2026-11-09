(function () {
  "use strict";
  var K = window.MontelienKatalog;
  if (!K) return;
  var esc = K.esc;
  function edition(item, render) {
    if (item.treti_strana) return render("třetí strana");
    if (item.legacy) return render("legacy", "legacy, kompatibilní");
    return render("2024", "2024+");
  }
  function chip(label, value) {
    return value ? '<span class="kat-modal-chip"><small>' + esc(label) + "</small>" + esc(value) + "</span>" : "";
  }
  K.init({
    id: "druhy", root: "#druhy-katalog", index: "druhy_index.json", preload: true,
    searchPlaceholder: "Hledat druh…", searchLabel: "Hledat druh",
    searchFields: ["nazev", "zdroj", "prehled", "velikost", "rychlost", "typ"],
    imagePlaceholder: "Ilustrace bude doplněna",
    filters: [
      { key: "zdroj", label: "Zdroj" },
      { key: "edice", label: "Edice", values: ["2024+", "třetí strana", "legacy"], value: function (item) { return item.treti_strana ? "třetí strana" : item.legacy ? "legacy" : "2024+"; } },
      { key: "velikost", label: "Velikost" },
      { key: "typ", label: "Typ" },
      { key: "rychlost", label: "Rychlost" }
    ],
    card: {
      title: "nazev",
      subtitle: "zdroj",
      image: function (item) { return item.obrazek ? K.base() + "13_Druhy/obrazky/" + encodeURIComponent(item.stem) + ".webp" : ""; },
      badges: edition,
      chips: function (item) { return [item.velikost, typeof item.rychlost === "number" ? item.rychlost + " ft" : item.rychlost, item.typ]
        .filter(Boolean).map(function (value) { return '<span class="kat-chip">' + esc(value) + "</span>"; }).join(""); }
    },
    modalImage: true,
    modal: function (item) {
      var href = "/" + item.stranka.replace(/\.md$/, "/");
      var editionName = item.treti_strana ? "třetí strana" : item.legacy ? "legacy, kompatibilní" : "2024+";
      var traits = Object.keys(item.rysy || {}).map(function (name) {
        var value = item.rysy[name], text = typeof value === "string" ? value : value && (value.text || value.popis) || "";
        return '<article class="kat-modal-feature"><h4>' + esc(name) + "</h4><p>" + esc(text) + "</p></article>";
      }).join("");
      return "<h2>" + esc(item.nazev) + "</h2>"
        + '<p class="kat-modal-source">' + esc(item.zdroj || "Zdroj neověřen") + "</p>"
        + '<div class="kat-badges">' + edition(item, K.badge) + "</div>"
        + '<div class="kat-modal-chips">' + chip("Kategorie", editionName) + chip("Velikost", item.velikost)
        + chip("Speed", typeof item.rychlost === "number" ? item.rychlost + " ft" : item.rychlost)
        + chip("Creature Type", item.typ) + chip("Délka života", item.delka_zivota)
        + (item.legacy ? chip("Alternativa 2024", item.alternativa_2024) : "") + "</div>"
        + (item.prehled ? '<p class="kat-modal-overview">' + esc(item.prehled) + "</p>" : "")
        + "<h3>Traits</h3><div class=\"kat-modal-features\">" + traits + "</div>"
        + '<div class="kat-modal-actions"><a class="md-button md-button--primary" href="' + esc(href) + '">Otevřít úplný popis</a></div>';
    },
    pageUrl: function (item) { return "/" + item.stranka.replace(/\.md$/, "/"); }
  });
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest && event.target.closest("[data-species]");
    if (!trigger) return;
    event.preventDefault(); event.stopPropagation(); K.open("druhy", trigger.dataset.species);
  });
  fetch(K.base() + "druhy_index.json").then(function (response) { return response.json(); }).then(function (items) {
    document.querySelectorAll(".druh-hero[data-druh-obrazek]").forEach(function (box) {
      var item = items.filter(function (entry) { return entry.stem === box.dataset.druhObrazek; })[0];
      if (!item || !item.obrazek) { box.hidden = true; return; }
      var img = new Image(); img.alt = "Ilustrace druhu";
      img.onload = function () { box.appendChild(img); };
      img.src = K.base() + "13_Druhy/obrazky/" + encodeURIComponent(item.stem) + ".webp";
    });
    var source = document.getElementById("zdroj-stranky"), path = source && source.dataset.cesta;
    var current = items.filter(function (item) { return item.stranka === path; })[0];
    if (!current) return;
    fetch(K.base() + "postavy_index.json").then(function (response) { return response.json(); }).then(function (people) {
      var content = document.querySelector(".md-content__inner");
      if (content && Array.from(content.querySelectorAll("h2")).some(function (heading) {
        return heading.textContent.replace(/\u00b6/g, "").trim() === "Postavy tohoto druhu";
      })) return;
      var related = people.filter(function (person) { return K.norm(person.druh) === K.norm(current.nazev); });
      var section = document.createElement("section"); section.className = "druhy-related";
      section.innerHTML = "<h2>Postavy tohoto druhu</h2>" + (related.length
        ? related.map(function (person) { return '<a href="/' + esc(person.cesta.replace(/\.md$/, "/")) + '">' + esc(person.jmeno) + "</a>"; }).join(" · ")
        : "<p>V katalogu zatím není uvedena žádná postava tohoto druhu.</p>");
      if (content) content.appendChild(section);
    }).catch(function () {});
  }).catch(function (error) { console.error(error); });
})();
