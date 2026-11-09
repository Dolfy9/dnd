(function () {
  function base() {
    var script = document.querySelector('script[src*="assets/heraldika.js"]');
    return script ? script.src.replace(/assets\/heraldika\.js.*$/, "") : "/";
  }
  function route(path) { return "/" + path.replace(/\.md$/, "/"); }
  function img(path, cls, alt) {
    var image = document.createElement("img");
    image.className = cls; image.alt = alt; image.src = base() + path; image.loading = "lazy";
    image.addEventListener("error", function () { image.remove(); });
    return image;
  }
  function decorate(data) {
    var src = document.getElementById("zdroj-stranky"), path = src && src.dataset.cesta;
    var item = (data.zeme || []).concat(data.mesta || []).find(function (entry) { return entry.soubor === path; });
    if (item) {
      var h1 = document.querySelector(".md-content__inner h1");
      if (h1 && !h1.querySelector(".heraldika-heading")) {
        var box = document.createElement("span"); box.className = "heraldika-heading";
        var dir = item.soubor.substring(0, item.soubor.lastIndexOf("/") + 1) + "obrazky/";
        box.appendChild(img(dir + "Znak_" + item.id + ".webp", "heraldika-head-znak", "Znak"));
        if (item.vlajka) box.appendChild(img(dir + "Vlajka_" + item.id + ".webp", "heraldika-head-vlajka", "Vlajka"));
        if (box.children.length) h1.appendChild(box);
      }
    }
    document.querySelectorAll(".md-nav--primary .md-nav__link[href]").forEach(function (link) {
      var url = new URL(link.href, location.href).pathname;
      var entry = (data.zeme || []).concat(data.mesta || []).find(function (record) { return route(record.soubor) === url; });
      if (!entry || link.querySelector(".heraldika-nav-znak")) return;
      var dir = entry.soubor.substring(0, entry.soubor.lastIndexOf("/") + 1) + "obrazky/";
      link.prepend(img(dir + "Znak_" + entry.id + ".webp", "heraldika-nav-znak", ""));
    });
  }
  var pending;
  function init() {
    if (!pending) pending = fetch(base() + "heraldika_index.json").then(function (response) {
      if (!response.ok) throw new Error("Heraldika není dostupná.");
      return response.json();
    });
    pending.then(decorate).catch(function () {});
  }
  if (window.document$) window.document$.subscribe(init);
  else document.addEventListener("DOMContentLoaded", init);
})();
