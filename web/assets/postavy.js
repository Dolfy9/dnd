(function () {
  var FACETS = [
    ["kategorie", "Kategorie", "kategorie"],
    ["zeme", "Země", "zeme"],
    ["mesto", "Město", "mesta"],
    ["frakce", "Frakce", "frakce"],
    ["kampan", "Kampaň", "kampane"],
    ["trida", "Povolání", "tridy"],
    ["stitek", "Štítek", "stitky"],
    ["obchod", "Obchod", "obchody"]
  ];
  var PARAMS = FACETS.map(function (x) { return x[0]; }).concat("q");

  function base() {
    var s = document.querySelector('script[src*="assets/postavy.js"]');
    return s ? s.src.replace(/assets\/postavy\.js.*$/, "") : "/";
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs");
  }
  function records(person, facet) {
    if (facet === "kategorie") return person.kategorie ? [{ value: person.kategorie, name: person.kategorie }] : [];
    if (facet === "stitek") return (person.stitky || []).map(function (value) { return { value: value, name: value }; });
    if (facet === "trida") {
      var classNames = ["Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
      return classNames.filter(function (name) { return norm(person.tridy).indexOf(norm(name)) >= 0; })
        .map(function (name) { return { value: name, name: name }; });
    }
    var field = FACETS.filter(function (x) { return x[0] === facet; })[0];
    return field ? (person[field[2]] || []).map(function (item) {
      return { value: item.cesta, name: item.nazev, odvozeno: !!item.odvozeno, url: item.url };
    }) : [];
  }
  function relatedChips(person) {
    var out = [];
    ["zeme", "mesto", "frakce", "kampan", "obchod"].forEach(function (key) {
      var facet = FACETS.filter(function (x) { return x[0] === key; })[0];
      if (!facet) return;
      records(person, facet[0]).forEach(function (item) {
        out.push('<a class="postavy-chip' + (item.odvozeno ? " odvozeno" : "") + '" href="' + esc(item.url) + '"' +
          (item.odvozeno ? ' title="odvozeno z odkazů"' : "") + '>' + esc(item.name) + "</a>");
      });
    });
    (person.stitky || []).forEach(function (label) { out.push('<span class="postavy-chip stitek">' + esc(label) + "</span>"); });
    return out.join("");
  }
  function card(person, editable) {
    var portrait = person.portret
      ? '<img src="' + esc(person.portret) + '" alt="" loading="lazy">'
      : '<span class="postavy-initial">' + esc((person.jmeno || "?").slice(0, 1)) + "</span>";
    return '<article class="postavy-card">' + (editable
      ? '<label class="postavy-select" title="Vybrat postavu"><input type="checkbox" data-select="' + esc(person.cesta) + '"></label>' : "")
      + '<a class="postava-link postavy-card-main" data-cesta="' + esc(person.cesta) + '" href="' + esc(person.url) + '">'
      + '<span class="postavy-card-portrait">' + portrait + "</span>"
      + '<span class="postavy-card-copy"><strong>' + esc(person.jmeno) + "</strong>"
      + (person.titul ? "<small>" + esc(person.titul) + "</small>" : "")
      + '<small class="postavy-meta">' + esc(person.kategorie) + (person.druh ? " · " + esc(person.druh) : "")
      + (person.tridy ? " · " + esc(person.tridy) : "") + (person.uroven ? " · úroveň " + esc(person.uroven) : "") + "</small></span></a>"
      + '<div class="postavy-card-chips">' + (person.druh ? '<button type="button" class="postavy-chip" data-species="' + esc(person.druh) + '">' + esc(person.druh) + '</button>' : "") + relatedChips(person) + "</div>"
      + (person.perex ? '<p class="postavy-perex">' + esc(person.perex) + "</p>" : "")
      + "</article>";
  }
  function table(persons, editable) {
    return '<div class="postavy-table-wrap"><table class="postavy-table"><thead><tr>'
      + (editable ? "<th></th>" : "") + "<th>Jméno</th><th>Kategorie</th><th>Druh</th><th>Třídy</th><th>Úroveň</th><th>Štítky</th>"
      + "</tr></thead><tbody>" + persons.map(function (person) {
        return "<tr>" + (editable ? '<td><input type="checkbox" data-select="' + esc(person.cesta) + '" aria-label="Vybrat ' + esc(person.jmeno) + '"></td>' : "")
          + '<td><a class="postava-link" data-cesta="' + esc(person.cesta) + '" href="' + esc(person.url) + '">' + esc(person.jmeno) + "</a>"
          + (person.titul ? "<small>" + esc(person.titul) + "</small>" : "") + "</td><td>" + esc(person.kategorie)
          + "</td><td>" + esc(person.druh) + "</td><td>" + esc(person.tridy) + "</td><td>" + esc(person.uroven || "—")
          + '</td><td>' + (person.stitky || []).map(function (tag) { return '<span class="postavy-chip stitek">' + esc(tag) + "</span>"; }).join(" ") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  function initCatalog() {
    var host = document.getElementById("postavy-katalog");
    if (!host || host.dataset.ready) return;
    host.dataset.ready = "1";
    fetch(base() + "postavy_index.json").then(function (response) {
      if (!response.ok) throw new Error("Index postav se nenačetl.");
      return response.json();
    }).then(function (people) {
      var query = new URLSearchParams(location.search), selected = {};
      FACETS.forEach(function (facet) { selected[facet[0]] = new Set(query.getAll(facet[0])); });
      var q = document.createElement("input");
      q.type = "search"; q.placeholder = "Hledat jméno, titul, druh, třídu, štítek…"; q.value = query.get("q") || "";
      q.setAttribute("aria-label", "Hledat postavy");
      var sort = document.createElement("select");
      sort.setAttribute("aria-label", "Řazení");
      [["jmeno", "Jméno"], ["uroven", "Úroveň"], ["kategorie", "Kategorie"]].forEach(function (entry) {
        var option = document.createElement("option"); option.value = entry[0]; option.textContent = "Řadit: " + entry[1]; sort.appendChild(option);
      });
      sort.value = query.get("razeni") || "jmeno";
      var view = query.get("zobrazeni") === "tabulka" ? "tabulka" : "karty";
      var layout = document.createElement("div"); layout.className = "postavy-layout";
      var searchRow = document.createElement("div"); searchRow.className = "postavy-search";
      searchRow.appendChild(q); searchRow.appendChild(sort);
      [["karty", "Karty"], ["tabulka", "Tabulka"]].forEach(function (entry) {
        var button = document.createElement("button");
        button.type = "button"; button.className = "postavy-view"; button.dataset.view = entry[0]; button.textContent = entry[1];
        searchRow.appendChild(button);
      });
      var bulk = document.createElement("div"); bulk.className = "postavy-bulk";
      bulk.innerHTML = '<label for="postavy-bulk-tag">Štítek</label><input id="postavy-bulk-tag" list="postavy-tags" placeholder="např. boj"><datalist id="postavy-tags"></datalist>'
        + '<button type="button" data-bulk="add">+ štítek</button><button type="button" data-bulk="remove">− štítek</button>';
      var facets = document.createElement("div"); facets.className = "postavy-facets";
      var count = document.createElement("p"); count.className = "postavy-count";
      var results = document.createElement("div"); results.className = "postavy-results";
      layout.append(searchRow, bulk, facets, count, results); host.replaceChildren(layout);

      var datalist = bulk.querySelector("datalist");
      var tags = Array.from(new Set(people.reduce(function (all, person) { return all.concat(person.stitky || []); }, [])));
      datalist.innerHTML = tags.sort(function (a, b) { return a.localeCompare(b, "cs"); }).map(function (tag) { return '<option value="' + esc(tag) + '"></option>'; }).join("");
      var chosen = new Set();

      function filterParams() {
        var params = new URLSearchParams(location.search);
        PARAMS.concat(["razeni", "zobrazeni"]).forEach(function (key) { params.delete(key); });
        FACETS.forEach(function (facet) {
          selected[facet[0]].forEach(function (value) { params.append(facet[0], value); });
        });
        if (q.value) params.set("q", q.value);
        if (sort.value !== "jmeno") params.set("razeni", sort.value);
        if (view !== "karty") params.set("zobrazeni", view);
        var suffix = params.toString();
        history.replaceState(null, "", location.pathname + (suffix ? "?" + suffix : "") + location.hash);
      }
      function matchesText(person) {
        var queryText = norm(q.value);
        if (!queryText) return true;
        var searchable = [person.jmeno, person.titul, person.druh, person.tridy, person.perex]
          .concat(person.stitky || []).join(" ");
        return norm(searchable).indexOf(queryText) >= 0;
      }
      function matchesFacets(person, skip) {
        return FACETS.every(function (facet) {
          if (facet[0] === skip || !selected[facet[0]].size) return true;
          var values = records(person, facet[0]).map(function (entry) { return entry.value; });
          return Array.from(selected[facet[0]]).some(function (value) { return values.indexOf(value) >= 0; });
        });
      }
      function facetValues(persons, facet) {
        var values = {};
        persons.forEach(function (person) {
          records(person, facet[0]).forEach(function (entry) {
            if (!values[entry.value]) values[entry.value] = { name: entry.name, odvozeno: entry.odvozeno };
            else if (entry.odvozeno === false) values[entry.value].odvozeno = false;
          });
        });
        return values;
      }
      function drawFacets(searchable) {
        facets.innerHTML = FACETS.map(function (facet) {
          var candidates = facetValues(searchable.filter(function (person) { return matchesFacets(person, facet[0]); }), facet);
          var options = Object.keys(candidates).sort(function (a, b) { return candidates[a].name.localeCompare(candidates[b].name, "cs"); });
          return '<section class="postavy-facet"><h2>' + esc(facet[1]) + "</h2><div>"
            + options.map(function (value) {
              var n = searchable.filter(function (person) {
                return matchesFacets(person, facet[0]) && records(person, facet[0]).some(function (entry) { return entry.value === value; });
              }).length;
              var active = selected[facet[0]].has(value);
              var derived = candidates[value].odvozeno ? " odvozeno" : "";
              return '<button type="button" class="postavy-chip postavy-filter' + (active ? " on" : "") + derived
                + '" data-facet="' + esc(facet[0]) + '" data-value="' + esc(value) + '"'
                + (candidates[value].odvozeno ? ' title="odvozeno z odkazů"' : "") + ">"
                + esc(candidates[value].name) + " <small>" + n + "</small></button>";
            }).join("") + "</div></section>";
        }).join("");
      }
      function ordered(list) {
        return list.slice().sort(function (a, b) {
          if (sort.value === "uroven") return (Number(a.uroven) || 0) - (Number(b.uroven) || 0) || a.jmeno.localeCompare(b.jmeno, "cs");
          if (sort.value === "kategorie") return a.kategorie.localeCompare(b.kategorie, "cs") || a.jmeno.localeCompare(b.jmeno, "cs");
          return a.jmeno.localeCompare(b.jmeno, "cs");
        });
      }
      function draw() {
        var editable = document.body.classList.contains("ed-on");
        bulk.hidden = !editable;
        var searchable = people.filter(matchesText);
        drawFacets(searchable);
        var filtered = ordered(searchable.filter(function (person) { return matchesFacets(person); }));
        count.textContent = filtered.length + " z " + people.length + " postav";
        layout.querySelectorAll("[data-view]").forEach(function (button) { button.classList.toggle("on", button.dataset.view === view); });
        if (!filtered.length) results.innerHTML = '<p class="postavy-empty">Žádná postava neodpovídá zadanému hledání a filtrům.</p>';
        else if (view === "tabulka") results.innerHTML = table(filtered, editable);
        else results.innerHTML = '<div class="postavy-grid">' + filtered.map(function (person) { return card(person, editable); }).join("") + "</div>";
        results.querySelectorAll("[data-select]").forEach(function (checkbox) { checkbox.checked = chosen.has(checkbox.dataset.select); });
      }
      q.addEventListener("input", function () { draw(); filterParams(); });
      sort.addEventListener("change", function () { draw(); filterParams(); });
      layout.addEventListener("click", function (event) {
        var facetButton = event.target.closest("[data-facet]");
        if (facetButton) {
          var values = selected[facetButton.dataset.facet], value = facetButton.dataset.value;
          if (values.has(value)) values.delete(value); else values.add(value);
          draw(); filterParams(); return;
        }
        var viewButton = event.target.closest("[data-view]");
        if (viewButton) { view = viewButton.dataset.view; draw(); filterParams(); return; }
        var bulkButton = event.target.closest("[data-bulk]");
        if (bulkButton) {
          var label = bulk.querySelector("#postavy-bulk-tag").value.trim();
          var selectedPeople = people.filter(function (person) { return chosen.has(person.cesta); });
          if (!selectedPeople.length) { alert("Nejprve vyber postavy."); return; }
          if (!label) { alert("Zadej štítek."); return; }
          var editor = window.MontelienEditor;
          if (!editor || !editor.api) { alert("Úpravy štítků vyžadují lokální editační server."); return; }
          document.body.classList.add("ed-busy");
          Promise.all(selectedPeople.map(function (person) {
            var labels = (person.stitky || []).slice();
            if (bulkButton.dataset.bulk === "add") {
              if (!labels.some(function (item) { return item.toLocaleLowerCase("cs") === label.toLocaleLowerCase("cs"); })) labels.push(label);
            } else labels = labels.filter(function (item) { return item.toLocaleLowerCase("cs") !== label.toLocaleLowerCase("cs"); });
            return editor.api("POST", "postava/pole", { cesta: person.cesta, pole: { stitky: labels } });
          })).then(function () { location.reload(); }).catch(function (error) {
            document.body.classList.remove("ed-busy"); alert("Štítky se nepodařilo uložit: " + error.message);
          });
        }
      });
      layout.addEventListener("change", function (event) {
        if (!event.target.matches("[data-select]")) return;
        if (event.target.checked) chosen.add(event.target.dataset.select); else chosen.delete(event.target.dataset.select);
      });
      window.addEventListener("popstate", function () { location.reload(); });
      new MutationObserver(draw).observe(document.body, { attributes: true, attributeFilter: ["class"] });
      draw();
    }).catch(function (error) {
      host.innerHTML = '<p class="postavy-empty">Katalog postav se nenačetl: ' + esc(error.message) + "</p>";
    });
  }

  if (window.document$) window.document$.subscribe(initCatalog);
  else document.addEventListener("DOMContentLoaded", initCatalog);
})();

(function () {
  var indexPromise = null;
  function base() {
    var s = document.querySelector('script[src*="assets/postavy.js"]');
    return s ? s.src.replace(/assets\/postavy\.js.*$/, "") : "/";
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function loadIndex() {
    if (!indexPromise) indexPromise = fetch(base() + "postavy_index.json").then(function (response) {
      if (!response.ok) throw new Error("Index postav se nenačetl.");
      return response.json();
    });
    return indexPromise;
  }
  function allLabels(people) {
    return Array.from(new Set(people.reduce(function (all, person) { return all.concat(person.stitky || []); }, [])))
      .sort(function (a, b) { return a.localeCompare(b, "cs"); });
  }
  function tagListMarkup(tags, editable) {
    return (tags || []).map(function (tag, index) {
      return '<span class="postavy-chip stitek" data-tag-index="' + index + '">' + esc(tag)
        + (editable ? '<button type="button" data-remove-label="' + index + '" aria-label="Odebrat štítek ' + esc(tag) + '">×</button>' : "") + "</span>";
    }).join("");
  }
  function relationLinks(person) {
    return ["zeme", "mesta", "frakce", "kampane", "questy", "sezeni", "obchody"].map(function (field) {
      return (person[field] || []).map(function (item) {
        return '<a class="postavy-rel-link' + (item.odvozeno ? " odvozeno" : "") + '" href="' + esc(item.url) + '"'
          + (item.odvozeno ? ' title="odvozeno z odkazů"' : "") + ">" + esc(item.nazev) + "</a>";
      }).join("");
    }).join("");
  }
  function closeDialog(bg, restore) {
    bg.remove();
    if (restore && restore.focus) restore.focus();
  }
  function dialog(person, people) {
    var restore = document.activeElement;
    var bg = document.createElement("div");
    bg.className = "ed-modal-bg postavy-modal-bg";
    var data = person.data || {}, abilities = data.atributy || {}, attributes = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    var editable = document.body.classList.contains("ed-on");
    bg.innerHTML = '<section class="ed-modal kz-modal postavy-modal" role="dialog" aria-modal="true" aria-label="' + esc(person.jmeno) + '" tabindex="-1">'
      + '<button type="button" class="postavy-modal-close" data-close aria-label="Zavřít">×</button>'
      + '<div class="postavy-modal-head">' + (person.portret
        ? '<img src="' + esc(person.portret) + '" alt="' + esc(person.jmeno) + '" loading="lazy">'
        : '<div class="postavy-modal-initial">' + esc((person.jmeno || "?").slice(0, 1)) + "</div>")
      + '<div><p class="postavy-modal-category">' + esc(person.kategorie) + "</p><h2>" + esc(person.jmeno) + "</h2>"
      + (person.titul ? "<p>" + esc(person.titul) + "</p>" : "")
      + (person.druh || person.tridy ? '<p class="postavy-modal-class">' + (person.druh ? '<button type="button" data-species="' + esc(person.druh) + '">' + esc(person.druh) + '</button> · ' : "") + esc(person.tridy || "Bez povolání") + "</p>" : "")
      + '<div class="postavy-modal-vitals"><span>AC <b data-stat="ac">—</b></span><span>HP <b data-stat="hp">—</b></span>'
      + '<span>Speed <b data-stat="speed">—</b></span><span>Úroveň / CR <b data-stat="level">—</b></span></div></div></div>'
      + '<div class="postavy-modal-attrs">' + attributes.map(function (key) {
        return "<span><b>" + key + "</b> " + esc(abilities[key] == null ? "—" : abilities[key]) + "</span>";
      }).join("") + "</div>"
      + (person.perex ? '<p class="postavy-modal-excerpt">' + esc(person.perex) + "</p>" : "")
      + '<div class="postavy-modal-rel"><h3>Vazby</h3><div>' + (relationLinks(person) || "<span>Bez evidovaných vazeb.</span>") + "</div></div>"
      + '<div class="postavy-modal-tags"><h3>Štítky</h3><div class="postavy-modal-tag-list">'
      + tagListMarkup(person.stitky, editable) + "</div>"
      + (editable ? '<div class="postavy-tag-editor"><input list="postavy-modal-labels" placeholder="Přidat štítek" aria-label="Přidat štítek">'
        + '<datalist id="postavy-modal-labels">' + allLabels(people).map(function (tag) { return '<option value="' + esc(tag) + '"></option>'; }).join("") + "</datalist>"
        + '<button type="button" class="ed-btn" data-add-label>+ Přidat</button><button type="button" class="ed-btn ed-primary" data-save-labels>Uložit štítky</button></div>' : "")
      + '</div><div class="ed-bar"><a class="ed-btn" href="' + esc(person.url) + '">Otevřít stránku</a>'
      + '<a class="ed-btn ed-primary" href="' + esc(base() + "boj/?postava=" + encodeURIComponent(person.cesta)) + '">Přidat do boje</a>'
      + '<button type="button" class="ed-btn" data-copy>Kopírovat odkaz</button></div></section>';
    var box = bg.querySelector(".postavy-modal");
    document.body.appendChild(bg);
    var previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    var close = function () {
      document.body.style.overflow = previousOverflow;
      closeDialog(bg, restore);
    };
    bg.querySelectorAll("[data-stat]").forEach(function (node) {
      var p = window.MontelienPostava;
      if (!p || !p.compute) return;
      p.rules().then(function () {
        var stats = p.compute(data, person.cesta);
        var values = { ac: stats.ac, hp: stats.hp, speed: stats.speed + " ft", level: (stats.lvl || person.uroven || "—") + " / " + (stats.cr ? stats.cr.cr : "—") };
        node.textContent = values[node.dataset.stat] == null ? "—" : values[node.dataset.stat];
      }).catch(function () {});
    });
    box.addEventListener("click", function (event) {
      if (event.target.closest("[data-close]") || event.target === bg) close();
      if (event.target.closest("[data-copy]")) {
        var link = new URL(person.url, location.href).href;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link);
        event.target.closest("[data-copy]").textContent = "Zkopírováno ✓";
      }
      if (event.target.closest("[data-remove-label]")) {
        person.stitky.splice(Number(event.target.closest("[data-remove-label]").dataset.removeLabel), 1);
        box.querySelector(".postavy-modal-tag-list").innerHTML = tagListMarkup(person.stitky, true);
      }
      if (event.target.closest("[data-add-label]")) {
        var input = box.querySelector(".postavy-tag-editor input"), value = input.value.trim(), labels = person.stitky || [];
        if (value && !labels.some(function (tag) { return tag.toLocaleLowerCase("cs") === value.toLocaleLowerCase("cs"); })) labels.push(value);
        person.stitky = labels;
        input.value = "";
        box.querySelector(".postavy-modal-tag-list").innerHTML = tagListMarkup(labels, true);
      }
      if (event.target.closest("[data-save-labels]")) {
        var tags = (person.stitky || []).slice();
        var editor = window.MontelienEditor;
        if (!editor || !editor.api) return alert("Úpravy štítků vyžadují lokální editační server.");
        document.body.classList.add("ed-busy");
        editor.api("POST", "postava/pole", { cesta: person.cesta, pole: { stitky: tags } }).then(function () { location.reload(); })
          .catch(function (error) { document.body.classList.remove("ed-busy"); alert("Štítky se nepodařilo uložit: " + error.message); });
      }
    });
    box.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      var focusable = Array.from(box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (item) { return item.offsetParent !== null; });
      if (!focusable.length) { event.preventDefault(); box.focus(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    bg.addEventListener("click", function (event) { if (event.target === bg) close(); });
    box.querySelector("[data-close]").focus();
    return bg;
  }
  function open(cesta) {
    return loadIndex().then(function (people) {
      var person = people.find(function (entry) { return entry.cesta === cesta; });
      if (person) dialog(person, people);
    }).catch(function (error) { console.error(error); });
  }
  function sourcePath() {
    var source = document.getElementById("zdroj-stranky");
    return source ? source.dataset.cesta : "";
  }
  function injectRelations() {
    var path = sourcePath(), prefix = path.indexOf("02_Zeme/") === 0 ? "zeme"
      : path.indexOf("03_Mesta/") === 0 ? "mesto" : path.indexOf("05_Frakce/") === 0 ? "frakce"
        : path.indexOf("07_Kampane/") === 0 ? "kampan" : "";
    var content = document.querySelector(".md-content__inner");
    if (!prefix || !content || content.querySelector(".postavy-related")) return;
    loadIndex().then(function (people) {
      var relationField = prefix === "mesto" ? "mesta" : prefix === "kampan" ? "kampane" : prefix;
      var related = people.filter(function (person) { return (person[relationField] || []).some(function (link) { return link.cesta === path; }); });
      var section = document.createElement("section");
      section.className = "postavy-related";
      var href = base() + "postavy/?" + prefix + "=" + encodeURIComponent(path);
      section.innerHTML = '<header><h2>Postavy</h2><a class="md-button" href="' + esc(href) + '">Zobrazit v katalogu</a></header>'
        + (related.length ? '<div class="postavy-related-grid">' + related.map(function (person) {
          return '<a class="postava-link postavy-related-card" data-cesta="' + esc(person.cesta) + '" href="' + esc(person.url) + '">'
            + (person.portret ? '<img src="' + esc(person.portret) + '" alt="" loading="eager">' : "")
            + "<span><b>" + esc(person.jmeno) + "</b><small>" + esc(person.kategorie) + "</small></span></a>";
        }).join("") + "</div>" : '<p class="postavy-empty">Zatím nejsou přiřazeny žádné postavy.</p>');
      content.appendChild(section);
    }).catch(function () {});
  }
  function enrichSheet() {
    var holder = document.querySelector(".postava-sheet"), path = sourcePath();
    if (!holder || !path) return;
    loadIndex().then(function (people) {
      var person = people.find(function (entry) { return entry.cesta === path; });
      if (!person) return;
      function addRow() {
        var chips = holder.querySelector(".p2-chips");
        if (!chips || chips.dataset.vazby) return;
        chips.dataset.vazby = "1";
        var row = document.createElement("div"); row.className = "postavy-sheet-rel";
        row.innerHTML = '<span><b>Štítky:</b> ' + ((person.stitky || []).map(function (tag) { return '<span class="postavy-chip stitek">' + esc(tag) + "</span>"; }).join(" ") || "—") + "</span>"
          + '<span><b>Vazby:</b> ' + (relationLinks(person) || "—") + "</span>"
          + (document.body.classList.contains("ed-on") ? '<button type="button" class="ed-btn" data-sheet-labels>Upravit štítky</button>' : "");
        chips.insertAdjacentElement("afterend", row);
        var editLabels = row.querySelector("[data-sheet-labels]");
        if (editLabels) editLabels.addEventListener("click", function () { dialog(person, people); });
      }
      addRow();
      new MutationObserver(addRow).observe(holder, { childList: true, subtree: true });
      new MutationObserver(function () {
        holder.querySelectorAll(".postavy-sheet-rel").forEach(function (row) {
          if (document.body.classList.contains("ed-on") && !row.querySelector("[data-sheet-labels]")) {
            var button = document.createElement("button"); button.type = "button"; button.className = "ed-btn"; button.dataset.sheetLabels = "1"; button.textContent = "Upravit štítky";
            button.addEventListener("click", function () { dialog(person, people); }); row.appendChild(button);
          }
        });
      }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }).catch(function () {});
  }
  function interceptLinks(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var anchor = event.target.closest && event.target.closest("a[href]");
    if (!anchor || !anchor.closest(".md-content")) return;
    if (anchor.closest(".md-nav, .md-sidebar, .md-tabs, .md-header, .md-footer, .md-breadcrumbs, nav, .toc")) return;
    var cesta = anchor.dataset.cesta;
    var pathname = new URL(anchor.href, location.href).pathname;
    if (!cesta && pathname.indexOf("/04_Postavy/") < 0) return;
    event.preventDefault();
    loadIndex().then(function (people) {
      if (!cesta) {
        var person = people.find(function (entry) { return new URL(entry.url, location.href).pathname === pathname; });
        cesta = person && person.cesta;
      }
      if (cesta && people.some(function (entry) { return entry.cesta === cesta; })) {
        dialog(people.find(function (entry) { return entry.cesta === cesta; }), people);
      } else location.href = anchor.href;
    }).catch(function () { location.href = anchor.href; });
  }
  function init() {
    injectRelations();
    enrichSheet();
    if (!document.body.dataset.postavyLinks) {
      document.body.dataset.postavyLinks = "1";
      document.addEventListener("click", interceptLinks, true);
    }
  }
  window.MontelienPostavy = { load: loadIndex, open: open };
  if (window.document$) window.document$.subscribe(init);
  else document.addEventListener("DOMContentLoaded", init);
})();
