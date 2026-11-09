(function () {
  var ICONS = {
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    map: "M15 5.1 9 3 3 5.1v15.8L9 18.8l6 2.1 6-2.1V3zM8 17.4l-3 1V6.5l3-1zm6 1.1-4-1.4V5.8l4 1.4zm5-.7-3 1V7.2l3-1z",
    world: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m6.9 9h-3a15 15 0 0 0-1.2-5 8 8 0 0 1 4.2 5M12 4c1 1.5 1.7 4 1.9 7h-3.8c.2-3 1-5.5 1.9-7M4.1 13h3a15 15 0 0 0 1.2 5 8 8 0 0 1-4.2-5m3-2h-3a8 8 0 0 1 4.2-5 15 15 0 0 0-1.2 5m2.9 2h4c-.2 3-1 5.5-2 7-1-1.5-1.8-4-2-7m6 5a15 15 0 0 0 1.2-5h3a8 8 0 0 1-4.2 5m1.2-7a15 15 0 0 0-1.2-5 8 8 0 0 1 4.2 5z",
    game: "M7 7h10a5 5 0 0 1 4.8 6.4l-1.2 4a2 2 0 0 1-3.2 1L14 16h-4l-3.4 2.4a2 2 0 0 1-3.2-1l-1.2-4A5 5 0 0 1 7 7m0 3v2H5v2h2v2h2v-2h2v-2H9v-2zm8 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m3 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2",
    rules: "M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2m8 1v5h5M8 12h8m-8 4h8m-8 4h5",
    project: "M3 3h8v8H3zm10 0h8v5h-8zm0 7h8v11h-8zM3 13h8v8H3z",
    places: "M12 2 4 6v12l8 4 8-4V6zm0 2.2 5.5 2.7L12 9.6 6.5 6.9zM6 8.5l5 2.5v8.4l-5-2.5zm7 10.9V11l5-2.5v8.4z",
    people: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7 9v-2a7 7 0 0 1 14 0v2zm13-9a3 3 0 1 0-2-5.2 6 6 0 0 1 0 5.2m2 2a5 5 0 0 1 3 5v2h-4v-2a8 8 0 0 0-2-5z",
    city: "M3 21V5l9-3 9 3v16zm3-2h3v-3H6zm0-5h3v-3H6zm0-5h3V6H6zm6 10h3v-3h-3zm0-5h3v-3h-3zm0-5h3V6h-3zm6 10h1v-3h-1zm0-5h1v-3h-1zm0-5h1V6h-1z",
    book: "M4 3h14a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2zm2 2v14h12V5zm2 3h8v2H8zm0 4h8v2H8z",
    quest: "M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z",
    beast: "M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6zm-3 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2m6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2m-6 5h6c-.5 2-1.5 3-3 3s-2.5-1-3-3",
    spell: "M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3z",
    item: "M12 2 3 7v10l9 5 9-5V7zm0 2.3 6.5 3.6L12 11.5 5.5 7.9zM5 9.5l6 3.3v6.7l-6-3.3zm8 10v-6.7l6-3.3v6.7z",
    glossary: "M5 3h14v18H5zm3 4h8m-8 4h8m-8 4h8",
    search: "M10.5 3a7.5 7.5 0 1 0 4.7 13.35L20.85 22 22 20.85l-5.65-5.65A7.5 7.5 0 0 0 10.5 3m0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11"
  };
  function icon(name) {
    name = ({ zeme: "places", mesta: "city", postavy: "people", frakce: "project", kampane: "game",
      questy: "quest", sezeni: "game", hadanky: "spell", knihy: "book", bestiar: "beast",
      kouzla: "spell", predmety: "item", glosar: "glossary", boj: "game" })[name] || name;
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICONS[name] || ICONS.world); svg.appendChild(path); return svg;
  }
  function expandCurrentSection(nav) {
    var list = nav && nav.querySelector(":scope > .md-nav__list");
    var active = nav && nav.querySelector(".md-nav__link--active");
    var item = active && active.closest(".md-nav__item");
    if (!list || !item) return;
    while (item.parentElement !== list) {
      var parent = item.parentElement && item.parentElement.closest(".md-nav__item");
      if (!parent) return;
      item = parent;
    }
    var toggle = item.querySelector(":scope > input.md-nav__toggle");
    if (toggle) toggle.checked = true;
  }
  function resetDrawerPosition() {
    var nav = document.querySelector(".md-nav--primary");
    var list = nav && nav.querySelector(":scope > .md-nav__list");
    if (list) list.scrollTop = 0;
    expandCurrentSection(nav);
  }
  function drawerSections(inner) {
    var tabs = document.querySelectorAll(".md-tabs__link");
    if (!tabs.length) return;
    var sections = inner.querySelector(".nav-drawer-sections");
    if (!sections) {
      sections = document.createElement("nav");
      sections.className = "nav-drawer-sections";
      sections.setAttribute("aria-label", "Hlavní sekce");
      inner.insertBefore(sections, inner.querySelector(".md-nav--primary"));
    }
    sections.replaceChildren();
    var nav = document.querySelector(".md-nav--primary");
    var list = nav && nav.querySelector(":scope > .md-nav__list");
    var activeLink = nav && nav.querySelector(".md-nav__link--active");
    var activeItem = activeLink && activeLink.closest(".md-nav__item");
    while (activeItem && activeItem.parentElement !== list) {
      activeItem = activeItem.parentElement && activeItem.parentElement.closest(".md-nav__item");
    }
    var activeLabel = activeItem && activeItem.querySelector(":scope > .md-nav__link, :scope > label.md-nav__link");
    var activeTitle = activeLabel && activeLabel.textContent.replace(/\s+\d+\s*$/, "").trim();
    var icons = { "Úvod": "home", "Mapa": "map", "Svět": "world", "Hra": "game", "Pravidla 2024": "rules", "Projekt": "project" };
    Array.prototype.forEach.call(tabs, function (tab) {
      var title = tab.textContent.trim();
      var link = document.createElement("a");
      link.className = "nav-drawer-section";
      link.href = tab.href;
      if (title === activeTitle || tab.classList.contains("md-tabs__link--active")) link.setAttribute("aria-current", "page");
      link.appendChild(icon(icons[title] || "world"));
      var label = document.createElement("span"); label.textContent = title; link.appendChild(label);
      sections.appendChild(link);
    });
  }
  function openSearch() {
    var input = document.querySelector("#nav-mobile-search input") || document.querySelector(".md-search__input");
    if (!input) return;
    if (window.innerWidth <= 600) document.body.classList.add("nav-mobile-search-open");
    input.focus();
  }
  function setupDrawer() {
    var inner = document.querySelector(".md-sidebar--primary .md-sidebar__inner");
    if (!inner) return;
    var drawer = document.getElementById("__drawer");
    if (drawer && !drawer.dataset.navDrawerReady) {
      drawer.dataset.navDrawerReady = "1";
      drawer.addEventListener("change", function () {
        if (drawer.checked) resetDrawerPosition();
      });
    }
    drawerSections(inner);
    if (inner.querySelector(".nav-drawer-header")) return;
    var header = document.createElement("div"); header.className = "nav-drawer-header";
    var title = document.createElement("strong"); title.textContent = "Menu";
    var close = document.createElement("button"); close.type = "button"; close.className = "nav-drawer-close";
    close.setAttribute("aria-label", "Zavřít menu"); close.textContent = "×";
    close.addEventListener("click", function () {
      var drawer = document.getElementById("__drawer");
      if (drawer) { drawer.checked = false; drawer.dispatchEvent(new Event("change", { bubbles: true })); }
    });
    header.appendChild(title); header.appendChild(close); inner.insertBefore(header, inner.firstChild);
  }
  function base() {
    var script = document.querySelector('script[src*="assets/navigation.js"]');
    return script ? script.src.replace(/assets\/navigation\.js.*$/, "") : "/";
  }
  var navIndex;
  function index() {
    if (!navIndex) navIndex = fetch(base() + "nav_index.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    return navIndex;
  }
  function setupHeader() {
    var header = document.querySelector(".md-header__inner");
    if (!header) return;
    var logo = header.querySelector(".md-header__button.md-logo");
    if (logo && !document.getElementById("nav-brand")) {
      var brand = document.createElement("span"); brand.id = "nav-brand"; brand.textContent = "Montelien"; logo.after(brand);
    }
    if (!document.getElementById("nav-mobile-search-trigger")) {
      var searchTrigger = document.createElement("button"); searchTrigger.id = "nav-mobile-search-trigger";
      searchTrigger.type = "button"; searchTrigger.setAttribute("aria-label", "Hledat ve světě");
      searchTrigger.appendChild(icon("search")); searchTrigger.addEventListener("click", openSearch); header.appendChild(searchTrigger);
    }
    var search = header.querySelector(".md-search");
    if (search) {
      search.classList.add("nav-header-search");
      var input = search.querySelector(".md-search__input");
      if (input) {
        input.placeholder = "Hledat ve světě…";
        input.setAttribute("aria-label", "Hledat ve světě");
      }
      var form = search.querySelector(".md-search__form");
      if (form && !form.querySelector(".nav-search-shortcut")) {
        var hint = document.createElement("span"); hint.className = "nav-search-shortcut"; hint.textContent = "/";
        form.appendChild(hint);
      }
    }
    if (!document.getElementById("nav-mobile-search")) {
      var mobileForm = document.createElement("form");
      mobileForm.id = "nav-mobile-search"; mobileForm.action = "/search/"; mobileForm.method = "get";
      var mobileInput = document.createElement("input"); mobileInput.type = "search"; mobileInput.name = "q";
      mobileInput.placeholder = "Hledat ve světě…"; mobileInput.setAttribute("aria-label", "Hledat ve světě");
      mobileForm.appendChild(mobileInput); header.appendChild(mobileForm);
    }
    var actions = document.getElementById("nav-header-actions");
    if (!actions) {
      actions = document.createElement("div"); actions.id = "nav-header-actions";
      var mode = document.createElement("button");
      mode.type = "button"; mode.id = "rezim-prepinac"; mode.className = "nav-mode-toggle";
      mode.setAttribute("aria-label", "Přepnout režim hráč / DM");
      mode.addEventListener("click", function () { if (window.MontelienMode) window.MontelienMode.toggle(); });
      actions.appendChild(mode); header.appendChild(actions);
    }
    if (window.MontelienMode) window.MontelienMode.refresh();
    var theme = document.getElementById("tema-prepinac");
    if (theme && theme.parentElement !== actions) actions.prepend(theme);
    var menuLabel = header.querySelector('label[for="__drawer"]');
    if (menuLabel) menuLabel.classList.add("nav-mobile-drawer-toggle");
    if (search) header.appendChild(search);
  }
  function setupTabs() {
    var labels = { "Úvod": "home", "Mapa": "map", "Interaktivní mapa": "map", "Svět": "world", "Hra": "game", "Pravidla 2024": "rules", "Projekt": "project" };
    document.querySelectorAll(".md-tabs__link").forEach(function (link) {
      if (link.querySelector(".nav-tab-icon")) return;
      var label = link.textContent.trim();
      var span = document.createElement("span"); span.className = "nav-tab-icon"; span.appendChild(icon(labels[label] || "world"));
      link.prepend(span);
    });
  }
  function makeSearch() {
    var nav = document.querySelector(".md-nav--primary"), inner = nav && nav.closest(".md-sidebar__inner");
    if (nav && inner) {
      var label = inner.querySelector(":scope > .nav-menu-filter") || nav.querySelector(":scope > .nav-menu-filter");
      if (!label) {
        label = document.createElement("label"); label.className = "nav-menu-filter";
        var input = document.createElement("input"); input.type = "search"; input.placeholder = "Filtrovat menu…"; input.setAttribute("aria-label", "Filtrovat menu");
        label.appendChild(input);
      }
      if (label.parentNode !== inner) inner.insertBefore(label, inner.querySelector(":scope > .nav-drawer-sections") || nav);
      var field = label.querySelector("input");
      if (field && !field.dataset.navFilter) {
        field.dataset.navFilter = "1";
        field.addEventListener("input", function () { filterMenu(nav, field.value); });
      }
    }
  }
  function norm(s) { return (s || "").toLocaleLowerCase("cs").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
  function filterMenu(nav, query) {
    var q = norm(query), items = Array.prototype.slice.call(nav.querySelectorAll(".md-nav__item"));
    items.forEach(function (item) {
      if (!item.closest(".md-nav--secondary")) item.style.display = q ? "none" : "";
    });
    if (!q) return;
    Array.prototype.slice.call(nav.querySelectorAll(".md-nav__link")).forEach(function (link) {
      var li = link.closest(".md-nav__item");
      if (!li || link.closest(".md-nav--secondary")) return;
      if (norm((link.textContent || "") + " " + (link.dataset.fullTitle || "")).indexOf(q) < 0) return;
      li.style.display = "";
      var childList = li.querySelector(":scope > .md-nav");
      if (childList) childList.querySelectorAll(".md-nav__item").forEach(function (child) { child.style.display = ""; });
      var parent = li.parentElement && li.parentElement.closest(".md-nav__item");
      while (parent && nav.contains(parent)) {
        parent.style.display = "";
        var toggle = parent.querySelector(":scope > input.md-nav__toggle");
        if (toggle) toggle.checked = true;
        parent = parent.parentElement && parent.parentElement.closest(".md-nav__item");
      }
    });
  }
  function decorateMenu(data) {
    var nav = document.querySelector(".md-nav--primary");
    if (!nav) return;
    nav.querySelectorAll(".md-nav__link[href]").forEach(function (link) {
      if (link.closest(".md-nav--secondary")) return;
      var path = new URL(link.href, location.href).pathname;
      if (data[path]) link.dataset.fullTitle = data[path];
    });
    nav.querySelectorAll(".md-nav__item--nested > .md-nav__link, .md-nav__item--nested > label.md-nav__link").forEach(function (label) {
      var ellipsis = label.querySelector(".md-ellipsis");
      if (!ellipsis || ellipsis.querySelector(".nav-section-icon")) return;
      var text = ellipsis.textContent.trim(), key = /země/i.test(text) ? "places" : /měst/i.test(text) ? "city" :
        /postav/i.test(text) ? "people" : /frak/i.test(text) ? "project" : /knih/i.test(text) ? "book" :
        /kampan|quest|sezen|hádank/i.test(text) ? "quest" : /map/i.test(text) ? "map" : "world";
      var badge = document.createElement("span"); badge.className = "nav-section-icon"; badge.appendChild(icon(key));
      var count = label.closest(".md-nav__item").querySelectorAll(".md-nav__item > a.md-nav__link").length;
      var number = document.createElement("span"); number.className = "nav-section-count"; number.textContent = count;
      ellipsis.prepend(badge); ellipsis.appendChild(number);
    });
    makeSearch();
  }
  function menuState() {
    var nav = document.querySelector(".md-nav--primary");
    if (!nav) return;
    nav.querySelectorAll(":scope .md-nav__item--nested > input.md-nav__toggle").forEach(function (toggle, i) {
      if (toggle.dataset.navStateReady) return;
      toggle.dataset.navStateReady = "1";
      var key = "mont-nav-open:" + (toggle.id || i);
      var saved = localStorage.getItem(key);
      if (saved !== null) toggle.checked = saved === "1";
      toggle.addEventListener("change", function () { localStorage.setItem(key, toggle.checked ? "1" : "0"); });
    });
    expandCurrentSection(nav);
  }
  function breadcrumbs(data) {
    var src = document.getElementById("zdroj-stranky"), inner = document.querySelector(".md-content__inner");
    var h1 = inner && inner.querySelector("h1");
    if (!src || !h1 || inner.querySelector(".nav-breadcrumbs")) return;
    var path = src.dataset.cesta;
    if (!path || path === "README.md" || path === "mapa.md") return;
    var segments = path.split("/");
    var groupNames = { "01_Svet": "Svět", Mista: "Místa", "02_Zeme": "Země", "03_Mesta": "Města", "04_Postavy": "Postavy",
      NPC: "NPC", Vladci: "Vládci", Stavitele_a_Bohove: "Stavitelé a bohové", "05_Frakce": "Frakce",
      "06_Knihy_a_Dokumenty": "Knihy", "07_Kampane": "Kampaně", "08_Questy": "Questy",
      "09_Hadanky": "Hádanky", "10_Sezeni": "Sezení", "11_Mapy": "Mapy" };
    var crumbs = [{ label: "Svět", url: "/" }];
    segments.slice(0, -1).forEach(function (segment) {
      var label = groupNames[segment];
      if (label && label !== "Svět" && !crumbs.some(function (c) { return c.label === label; })) crumbs.push({ label: label });
    });
    var title = data["/" + path.replace(/\.md$/, "/")] || h1.textContent.trim();
    title = title.replace(/^Město\s+/i, "").replace(/^(Království|Provincie|Teokracie|Elfský Stát|Klanové Země)\s+/i, "");
    if (!crumbs.some(function (c) { return c.label === title; })) crumbs.push({ label: title });
    var nav = document.createElement("nav"); nav.className = "nav-breadcrumbs"; nav.setAttribute("aria-label", "Drobečková navigace");
    crumbs.forEach(function (crumb, i) {
      if (i) { var sep = document.createElement("span"); sep.className = "nav-breadcrumb-separator"; sep.textContent = "›"; nav.appendChild(sep); }
      if (crumb.url) { var a = document.createElement("a"); a.href = crumb.url; a.textContent = crumb.label; nav.appendChild(a); }
      else { var span = document.createElement("span"); span.textContent = crumb.label; nav.appendChild(span); }
    });
    h1.before(nav);
  }
  function toolbar() {
    var bar = document.getElementById("ed-toolbar");
    if (!bar) return;
    if (bar.dataset.navReady) {
      var nativeCharacter = bar.querySelector('[data-nova-postava="1"]');
      var menu = bar.querySelector(".nav-more-menu");
      if (nativeCharacter && menu && !menu.contains(nativeCharacter)) {
        var fallback = menu.querySelector(".nav-character-fallback");
        if (fallback) fallback.remove();
        var divider = menu.querySelector("hr");
        menu.insertBefore(nativeCharacter, divider || null);
      }
      return;
    }
    bar.dataset.navReady = "1"; bar.classList.add("nav-page-actions");
    var buttons = Array.prototype.slice.call(bar.querySelectorAll("button"));
    if (!buttons.length) return;
    buttons[0].textContent = "✎ Upravit"; buttons[0].classList.add("nav-edit-primary");
    var toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "nav-more-toggle"; toggle.textContent = "⋯";
    toggle.setAttribute("aria-label", "Další akce"); toggle.setAttribute("aria-expanded", "false");
    var menu = document.createElement("div"); menu.className = "nav-more-menu"; menu.hidden = true;
    var actions = buttons.slice(1);
    var newPage = actions.find(function (button) { return /nová stránka/i.test(button.textContent); });
    if (!newPage) {
      newPage = document.createElement("button"); newPage.type = "button";
      newPage.className = buttons[0].className + " nav-page-fallback"; newPage.textContent = "+ Nová stránka";
      newPage.addEventListener("click", function () {
        if (window.MontelienEditor) window.MontelienEditor.newPage();
      });
    }
    menu.appendChild(newPage);
    var character = actions.find(function (button) { return button.hasAttribute("data-nova-postava"); });
    if (!character) {
      character = document.createElement("button"); character.type = "button";
      character.className = buttons[0].className + " nav-character-fallback"; character.textContent = "+ Nová postava";
      character.addEventListener("click", function () {
        if (window.MontelienEditor) window.MontelienEditor.newCharacter();
      });
    }
    menu.appendChild(character);
    actions.filter(function (button) { return button !== newPage && button !== character; }).forEach(function (button) {
      if (button.textContent.trim() === "Smazat") {
        menu.appendChild(document.createElement("hr")); button.classList.add("nav-delete-action");
      }
      menu.appendChild(button);
    });
    toggle.addEventListener("click", function () {
      menu.hidden = !menu.hidden; toggle.setAttribute("aria-expanded", String(!menu.hidden));
    });
    bar.appendChild(toggle); bar.appendChild(menu);
  }
  function mapButton() {
    document.querySelectorAll(".mapa-vlozena .mapa-zobrazit").forEach(function (button) {
      button.textContent = "↗ Mapa"; button.title = "Zobrazit na mapě"; button.classList.add("nav-map-open");
    });
  }
  function homepage() {
    var tiles = document.querySelector(".nav-home-tiles");
    if (tiles) tiles.querySelectorAll("[data-icon]").forEach(function (tile) {
      var holder = tile.querySelector(".nav-home-icon");
      if (holder && !holder.firstChild) holder.appendChild(icon(tile.dataset.icon));
    });
  }
  function mobileNav() {
    if (document.getElementById("nav-mobile-bar")) return;
    var bar = document.createElement("nav"); bar.id = "nav-mobile-bar"; bar.setAttribute("aria-label", "Rychlá navigace");
    [["Úvod", "/", "home"], ["Mapa", "/mapa/", "map"], ["Hledat", "#search", "world"], ["Postavy", "/postavy/", "people"], ["Menu", "#menu", "project"]]
      .forEach(function (entry) {
        var button = document.createElement("a"); button.href = entry[1]; button.className = "nav-mobile-item"; button.appendChild(icon(entry[2]));
        var span = document.createElement("span"); span.textContent = entry[0]; button.appendChild(span);
        if (entry[1] === "#search") button.addEventListener("click", function (e) {
          e.preventDefault(); openSearch();
        });
        if (entry[1] === "#menu") button.addEventListener("click", function (e) {
          e.preventDefault(); var toggle = document.getElementById("__drawer");
          if (toggle) { toggle.checked = true; toggle.dispatchEvent(new Event("change", { bubbles: true })); }
        });
        bar.appendChild(button);
      });
    document.body.appendChild(bar);
  }
  function init() {
    setupHeader(); setupDrawer(); setupTabs(); menuState(); mapButton(); homepage(); mobileNav();
    index().then(function (data) { decorateMenu(data); breadcrumbs(data); });
    toolbar();
  }
  if (window.document$) window.document$.subscribe(init); else document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("keydown", function (event) {
    var target = event.target;
    if ((event.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(target.tagName)) ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
      event.preventDefault();
      if (window.innerWidth <= 600) openSearch();
      else { var input = window.innerWidth <= 760 ? document.querySelector("#nav-mobile-search input") : document.querySelector(".md-search__input"); if (input) input.focus(); }
    }
    if (event.key === "Escape") {
      document.body.classList.remove("nav-mobile-search-open");
      document.querySelectorAll(".nav-appearance-popover:not([hidden]), .nav-more-menu:not([hidden])").forEach(function (el) { el.hidden = true; });
      document.querySelectorAll(".nav-appearance-button, .nav-more-toggle").forEach(function (button) { button.setAttribute("aria-expanded", "false"); });
      var drawer = document.getElementById("__drawer"); if (drawer && drawer.checked) { drawer.checked = false; drawer.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest("#nav-mobile-search, #nav-mobile-search-trigger, #nav-mobile-bar .nav-mobile-item[href=\"#search\"]")) document.body.classList.remove("nav-mobile-search-open");
    if (!event.target.closest("#tema-prepinac, .nav-page-actions")) {
      document.querySelectorAll(".nav-appearance-popover, .nav-more-menu").forEach(function (el) { el.hidden = true; });
      document.querySelectorAll(".nav-appearance-button, .nav-more-toggle").forEach(function (button) { button.setAttribute("aria-expanded", "false"); });
    }
  });
  var observer = new MutationObserver(toolbar);
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
