(function () {
  var D = window.MONTELIEN_MISTA, el = document.getElementById("mapa");
  if (!D || !el || el.dataset.ready) return;
  el.dataset.ready = "1";
  var W = D.sirka, H = D.vyska, bounds = [[0, 0], [H, W]], KM_PX = 1.7;
  var map = L.map(el, { crs: L.CRS.Simple, minZoom: -1.5, maxZoom: 2.5, zoomSnap: 0.25, attributionControl: false });
  var ilu = L.imageOverlay("../11_Mapy/Montelien_mapa_ilustrovana.jpg", bounds);
  var barevna = L.imageOverlay("../11_Mapy/Montelien_mapa.jpg", bounds);
  var kresba = L.imageOverlay("../11_Mapy/Montelien_mapa_vyrovnana.jpg", bounds);
  var vrstvy = { "Ilustrovaná mapa": ilu, "Věrná barevná mapa": barevna, "Původní kresba (DM)": kresba };
  var pam = localStorage.getItem("mapa-vrstva"); (vrstvy[pam] || ilu).addTo(map);
  L.control.layers(vrstvy).addTo(map);
  map.on("baselayerchange", function (e) { localStorage.setItem("mapa-vrstva", e.name); });
  map.fitBounds(bounds);
  map.setMaxBounds([[-200, -200], [H + 200, W + 200]]);
  var coord = document.createElement("div"); coord.className = "mapa-souradnice"; el.appendChild(coord);
  var barvy = { mapa: "#c0392b", kanon: "#2e8b57", odhad: "#f0b429" };
  var jistotaText = { mapa: "popsáno na mapě DM", kanon: "potvrzeno DM", odhad: "odhad – čeká na potvrzení" };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var boje = { boje: [] };
  fetch("../boje_index.json").then(function (r) { return r.ok ? r.json() : boje; }).then(function (j) { boje = j; }).catch(function () { });
  function bojHtml(m) {
    var bm = (D.boj || []).filter(function (b) { return b.misto && b.misto === m.odkaz; });
    if (!bm.length) return "";
    return "<p><b>⚔ Bojové mapy:</b><br>" + bm.map(function (b) {
      var n = (boje.boje || []).filter(function (x) { return x.mapa === b.id; }).length;
      return "<a href='../boj/?mapa=" + encodeURIComponent(b.id) + "'>" + esc(b.nazev) + "</a>" + (n ? " <small>(" + n + " ulož. bojů)</small>" : "");
    }).join("<br>") + "</p>";
  }
  var body = L.layerGroup().addTo(map), sidla = L.layerGroup(), bojL = L.layerGroup().addTo(map), byName = {};
  D.mista.forEach(function (m) {
    var c = L.circleMarker([H - m.y, m.x], {
      radius: m.typ === "zeme" ? 8 : 6, color: "#3a2412", weight: 2,
      fillColor: barvy[m.jistota] || "#999", fillOpacity: .95
    });
    c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6] });
    c.bindPopup(function () {
      return "<h4>" + esc(m.nazev) + "</h4><p>" + esc(m.pozn || "") + "</p>" + bojHtml(m) + "<p><small>" + jistotaText[m.jistota] + "</small></p><a href='" + m.url + "'>Otevřít stránku →</a>";
    });
    if (m.typ === "sidlo") { c.setRadius(4); sidla.addLayer(c); } else body.addLayer(c);
    byName[m.nazev.toLowerCase()] = { m: m, c: c };
    if ((D.boj || []).some(function (b) { return b.misto && b.misto === m.odkaz; })) {
      var ic = L.divIcon({ className: "mapa-boj", html: "⚔", iconSize: [18, 18], iconAnchor: [-4, 22] });
      bojL.addLayer(L.marker([H - m.y, m.x], { icon: ic, interactive: false }));
    }
  });
  var dl = document.getElementById("mapa-seznam");
  if (dl) dl.innerHTML = D.mista.filter(function (m) { return m.typ !== "sidlo"; }).map(function (m) { return "<option value='" + esc(m.nazev) + "'>"; }).join("");
  function najdi(q) {
    var x = byName[String(q || "").toLowerCase()];
    if (!x) { var k = Object.keys(byName).filter(function (n) { return n.indexOf(String(q).toLowerCase()) >= 0; })[0]; x = k && byName[k]; }
    if (!x) return;
    if (x.m.typ === "sidlo") map.addLayer(sidla); else map.addLayer(body);
    map.flyTo([H - x.m.y, x.m.x], 1, { duration: .8 }); setTimeout(function () { x.c.openPopup(); }, 850);
  }
  var hl = document.getElementById("mapa-hledat");
  if (hl) hl.addEventListener("change", function () { najdi(this.value); });
  var qs = new URLSearchParams(location.search); if (qs.get("misto")) setTimeout(function () { najdi(qs.get("misto")); }, 300);
  function tog(id, layer) { var e = document.getElementById(id); if (e) e.addEventListener("change", function (ev) { if (ev.target.checked) map.addLayer(layer); else map.removeLayer(layer); }); }
  tog("mapa-sidla", sidla); tog("mapa-body", body); tog("mapa-boj", bojL);
  var st = document.getElementById("mapa-stitky");
  if (st) st.addEventListener("change", function (e) {
    D.mista.forEach(function (m) { if (m.typ !== "mesto" && m.typ !== "misto") return; var c = byName[m.nazev.toLowerCase()].c; c.unbindTooltip(); c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6], permanent: e.target.checked }); if (e.target.checked) c.openTooltip(); });
  });
  // měření trasy
  var mer = null, mb = document.getElementById("mapa-meric");
  function merInfo() {
    var km = mer.pts.reduce(function (s, p, i) { return i ? s + Math.hypot(p.lng - mer.pts[i - 1].lng, p.lat - mer.pts[i - 1].lat) * KM_PX : 0; }, 0);
    var mi = km / 1.609, d = function (x) { return (mi / x).toFixed(1); };
    return "<b>" + Math.round(km) + " km</b> (" + Math.round(mi) + " mil) · pěšky: Normal " + d(24) + " dne, Fast " + d(30) + ", Slow " + d(18);
  }
  function merStop() { if (mer) { map.removeLayer(mer.line); map.removeLayer(mer.lab); } mer = null; el.style.cursor = ""; if (mb) mb.classList.remove("on"); }
  if (mb) mb.addEventListener("click", function () {
    if (mer) { merStop(); return; }
    mer = { pts: [], line: L.polyline([], { color: "#7a1f12", weight: 3, dashArray: "6 6" }).addTo(map), lab: L.marker([0, 0], { opacity: 0 }) };
    el.style.cursor = "crosshair"; mb.classList.add("on");
  });
  map.on("click", function (e) {
    coord.textContent = "x " + Math.round(e.latlng.lng) + ", y " + Math.round(H - e.latlng.lat);
    if (!mer) return;
    mer.pts.push(e.latlng); mer.line.setLatLngs(mer.pts);
    if (mer.pts.length > 1) { map.removeLayer(mer.lab); mer.lab = L.marker(e.latlng, { opacity: 0 }).addTo(map).bindTooltip(merInfo() + "<br><small>klik = další bod · tlačítko = konec</small>", { permanent: true, className: "mapa-stitek", direction: "right" }); }
  });
})();
