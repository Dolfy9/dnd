(function () {
  "use strict";
  var configs = {};
  function base() {
    var script = document.querySelector('script[src*="assets/katalog.js"]');
    return script ? script.src.replace(/assets\/katalog\.js.*$/, "") : "/";
  }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("cs");
  }
  function label(config, item) {
    var title = config.card.title;
    return typeof title === "function" ? title(item) : item[title || "name"];
  }
  function options(config, items, filter) {
    var values = typeof filter.values === "function" ? filter.values(items) : filter.values;
    if (!values) values = Array.from(new Set(items.map(function (item) { return String(item[filter.key] || ""); }).filter(Boolean)));
    return values.map(function (value) {
      return typeof value === "string" ? { value: value, label: value } : value;
    }).sort(function (a, b) { return a.label.localeCompare(b.label, "cs"); });
  }
  function updateUrl(config, query, selected) {
    var params = new URLSearchParams(location.search);
    params.delete("q");
    if (query) params.set("q", query);
    config.filters.forEach(function (filter) {
      var key = filter.param || filter.key;
      params.delete(key);
      if (selected[key]) params.set(key, selected[key]);
    });
    var suffix = params.toString();
    history.replaceState(null, "", location.pathname + (suffix ? "?" + suffix : "") + location.hash);
  }
  function badge(kind, text) {
    var classes = { "2024": "kat-badge-2024", "třetí strana": "kat-badge-third", legacy: "kat-badge-legacy", oznámeno: "kat-badge-announced" };
    return '<span class="kat-badge ' + (classes[kind] || "") + '">' + esc(text || kind) + "</span>";
  }
  function imageHtml(config, item, modal) {
    if (!config.card.image) return "";
    var source = config.card.image ? config.card.image(item) : "";
    if (!source) return config.imagePlaceholder ? '<div class="kat-image-placeholder">' + esc(config.imagePlaceholder) + "</div>" : "";
    var src = typeof source === "string" ? source : source.src;
    var alt = typeof source === "string" ? label(config, item) : source.alt || label(config, item);
    return '<img class="' + (modal ? "kat-modal-image" : "kat-card-image") + '" src="' + esc(src) + '" alt="' + esc(alt) + '"' + (modal ? "" : ' loading="lazy"') + ">";
  }
  function show(id, item) {
    var config = configs[id];
    if (!config || !item) return;
    if (typeof item === "string") {
      item = (config.items || []).filter(function (entry) { return String(label(config, entry)) === item; })[0];
      if (!item) return;
    }
    var old = document.querySelector(".kat-modal-backdrop");
    if (old) old.remove();
    var backdrop = document.createElement("div");
    var modalImage = config.modalImage ? imageHtml(config, item, true) : "";
    backdrop.className = "kat-modal-backdrop";
    backdrop.innerHTML = '<section class="kat-modal' + (modalImage ? "" : " kat-modal-no-image") + '" role="dialog" aria-modal="true" aria-label="' + esc(label(config, item)) + '">'
      + '<button type="button" class="kat-modal-close" aria-label="Zavřít">×</button>'
      + modalImage
      + '<div class="kat-modal-content">' + config.modal(item) + "</div></section>";
    document.body.appendChild(backdrop);
    var closeButton = backdrop.querySelector(".kat-modal-close"), previous = document.activeElement;
    function close() {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (previous && previous.focus) previous.focus();
    }
    function onKey(event) { if (event.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    backdrop.addEventListener("click", function (event) { if (event.target === backdrop || event.target === closeButton) close(); });
    closeButton.focus();
  }
  function init(config) {
    var root = typeof config.root === "string" ? document.querySelector(config.root) : config.root;
    configs[config.id] = config;
    if (!root) {
      if (config.preload && !config.items) {
        fetch(base() + config.index).then(function (response) { return response.json(); }).then(function (items) { config.items = items; })
          .catch(function (error) { console.error(error); });
      }
      return;
    }
    if (root.dataset.katalogReady) return;
    root.dataset.katalogReady = "1";
    fetch(base() + config.index).then(function (response) {
      if (!response.ok) throw new Error("Katalog se nepodařilo načíst: " + config.index);
      return response.json();
    }).then(function (items) {
      config.items = items;
      var params = new URLSearchParams(location.search), query = params.get("q") || "", selected = {};
      config.filters = config.filters || [];
      config.filters.forEach(function (filter) { selected[filter.param || filter.key] = params.get(filter.param || filter.key) || ""; });
      var search = document.createElement("input");
      search.type = "search"; search.className = "kat-search"; search.placeholder = config.searchPlaceholder || "Hledat…";
      search.setAttribute("aria-label", config.searchLabel || "Hledat v katalogu"); search.value = query;
      var controls = document.createElement("div"); controls.className = "kat-filters";
      config.filters.forEach(function (filter) {
        var select = document.createElement("select"), key = filter.param || filter.key;
        select.dataset.filter = key; select.setAttribute("aria-label", filter.label);
        select.innerHTML = '<option value="">' + esc(filter.label) + " – vše</option>"
          + options(config, items, filter).map(function (option) {
            return '<option value="' + esc(option.value) + '">' + esc(option.label) + "</option>";
          }).join("");
        select.value = selected[key]; controls.appendChild(select);
      });
      var count = document.createElement("p"); count.className = "kat-count";
      var grid = document.createElement("div"); grid.className = "kat-grid";
      var bar = document.createElement("div"); bar.className = "kat-toolbar";
      bar.append(search, controls); root.replaceChildren(bar, count, grid);
      function draw() {
        var q = norm(search.value), found = items.filter(function (item) {
          var text = (config.searchFields || []).map(function (key) {
            return typeof key === "function" ? key(item) : item[key];
          }).join(" ");
          return (!q || norm(text).indexOf(q) >= 0) && config.filters.every(function (filter) {
            var key = filter.param || filter.key, value = selected[key];
            var itemValue = filter.value ? filter.value(item) : item[filter.key];
            return !value || String(itemValue == null ? "" : itemValue) === value;
          });
        });
        count.textContent = found.length + " z " + items.length + " položek";
        grid.innerHTML = found.map(function (item, index) {
          var title = label(config, item), subtitle = config.card.subtitle
            ? (typeof config.card.subtitle === "function" ? config.card.subtitle(item) : item[config.card.subtitle]) : "";
          var badges = config.card.badges ? config.card.badges(item, badge) : "";
          var chips = config.card.chips ? config.card.chips(item, esc) : "";
          var href = config.pageUrl ? config.pageUrl(item) : item.url;
          return '<article class="kat-card">' + imageHtml(config, item, false)
            + '<div class="kat-card-body"><button type="button" class="kat-card-title" data-open="' + index + '">' + esc(title) + "</button>"
            + (subtitle ? '<p class="kat-card-subtitle">' + esc(subtitle) + "</p>" : "")
            + '<div class="kat-badges">' + badges + '</div><div class="kat-card-chips">' + chips + "</div>"
            + (href ? '<a class="kat-card-page" href="' + esc(href) + '">Otevřít</a>' : "") + "</div></article>";
        }).join("") || '<p class="kat-empty">Žádné položky neodpovídají hledání a filtrům.</p>';
        grid.querySelectorAll("[data-open]").forEach(function (button) {
          button.addEventListener("click", function () { show(config.id, found[Number(button.dataset.open)]); });
        });
      }
      search.addEventListener("input", function () { query = search.value; draw(); updateUrl(config, query, selected); });
      controls.addEventListener("change", function (event) {
        var key = event.target.dataset.filter;
        if (!key) return;
        selected[key] = event.target.value; draw(); updateUrl(config, search.value, selected);
      });
      window.addEventListener("popstate", function () { location.reload(); });
      draw();
    }).catch(function (error) { root.innerHTML = '<p class="kat-empty">' + esc(error.message) + "</p>"; console.error(error); });
  }
  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-katalog-id][data-katalog-item]");
    if (!trigger) return;
    var config = configs[trigger.dataset.katalogId], name = trigger.dataset.katalogItem;
    if (!config || !config.items) return;
    var item = config.items.find(function (entry) { return String(label(config, entry)) === name; });
    if (item) { event.preventDefault(); show(trigger.dataset.katalogId, item); }
  });
  window.MontelienKatalog = { init: init, open: show, esc: esc, norm: norm, badge: badge, base: base };
})();
