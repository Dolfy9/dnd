(function () {
  var D = window.MONTELIEN_MISTA, el = document.getElementById("mapa");
  if (!D || !el || el.dataset.ready) return;
  el.dataset.ready = "1";
  var qs = new URLSearchParams(location.search), crop = qs.get("vyrez") === "1";
  if (crop) document.body.classList.add("mapa-vyrez");
  var W = D.sirka, H = D.vyska, bounds = [[0, 0], [H, W]], KM_PX = 1.7;
  var map = L.map(el, { crs: L.CRS.Simple, minZoom: -1.5, maxZoom: 2.5, zoomSnap: 0.25, attributionControl: false });
  window.MontelienMapa = map;
  var svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  var atlas = L.svgOverlay(svgEl, bounds, { interactive: false });
  var SV = { map: map, el: el, svg: svgEl, base: "../", D: null, M: D };
  var stateData = [], stateHighlight = L.layerGroup().addTo(map), stateTip = null, activeState = null;
  function inRing(x, y, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if ((ring[i][1] > y) !== (ring[j][1] > y) && x < (ring[j][0] - ring[i][0]) * (y - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
    }
    return inside;
  }
  function clearState() {
    activeState = null;
    stateHighlight.clearLayers();
    if (stateTip) map.removeLayer(stateTip);
    stateTip = null;
  }
  function showState(z, ll) {
    if (activeState === z.nazev) return;
    activeState = z.nazev;
    stateHighlight.clearLayers();
    (z.body || []).forEach(function (ring) {
      if (ring.length < 3) return;
      stateHighlight.addLayer(L.polygon(ring.map(function (p) { return [H - p[1], p[0]]; }), {
        interactive: false, color: "#fff1a0", weight: 5, opacity: .96, fillColor: "#fff3b0", fillOpacity: .19,
        lineCap: "round", lineJoin: "round"
      }));
    });
    if (stateTip) map.removeLayer(stateTip);
    stateTip = L.tooltip({ permanent: true, direction: "top", className: "mapa-stav-stitek" })
      .setLatLng(ll).setContent(esc(z.nazev)).addTo(map);
  }
  map.on("mousemove", function (e) {
    if (crop || SV.open || !stateData.length) return;
    var x = e.latlng.lng, y = H - e.latlng.lat, found = null;
    stateData.some(function (z) {
      if ((z.body || []).some(function (ring) { return inRing(x, y, ring); })) { found = z; return true; }
      return false;
    });
    if (found) showState(found, e.latlng);
  });
  el.addEventListener("mouseleave", clearState);
  fetch("../11_Mapy/svet.json?t=" + Date.now()).then(function (r) { return r.json(); }).then(function (j) { SV.D = j; stateData = j.zeme || []; if (window.MontelienSvet) window.MontelienSvet.render(svgEl, j, D, "../"); }).catch(function () { });
  var ilu = L.imageOverlay("../11_Mapy/Montelien_mapa_ilustrovana.jpg", bounds);
  var barevna = L.imageOverlay("../11_Mapy/Montelien_mapa.jpg", bounds);
  var kresba = L.imageOverlay("../11_Mapy/Montelien_mapa_vyrovnana.jpg", bounds);
  var vrstvy = { "Atlas (z dat)": atlas, "Ilustrovaná mapa": ilu, "Věrná barevná mapa": barevna, "Původní kresba (DM)": kresba };
  var pam = localStorage.getItem("mapa-vrstva"); (crop ? atlas : (vrstvy[pam] || atlas)).addTo(map);
  L.control.layers(vrstvy).addTo(map);
  map.on("baselayerchange", function (e) { localStorage.setItem("mapa-vrstva", e.name); });
  map.fitBounds(bounds);
  map.setMaxBounds([[-200, -200], [H + 200, W + 200]]);
  var coord = document.createElement("div"); coord.className = "mapa-souradnice"; el.appendChild(coord);
  var MP = (window.SVET_PALETA || {}).markers || {};
  var barvy = { mapa: MP.mapa || "#8e4f45", kanon: MP.kanon || "#4f7657", odhad: MP.odhad || "#9a8050" };
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
  var body = L.layerGroup(), sidla = L.layerGroup(), bojL = L.layerGroup(), byName = {}, cropHighlight = null;
  D.mista.forEach(function (m) {
    var c = L.circleMarker([H - m.y, m.x], {
      radius: m.typ === "zeme" ? (MP.state_radius || 3) : (MP.radius || 2.5), color: MP.stroke || "#4e493f", weight: MP.stroke_width || .9, opacity: MP.stroke_opacity || .65,
      fillColor: barvy[m.jistota] || "#777", fillOpacity: MP.fill_opacity || .9
    });
    c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6] });
    c.bindPopup(function () {
      return "<h4>" + esc(m.nazev) + "</h4><p>" + esc(m.pozn || "") + "</p>" + bojHtml(m) + "<p><small>" + jistotaText[m.jistota] + "</small></p><a href='" + m.url + "'>Otevřít stránku →</a>";
    });
    if (m.typ === "sidlo") { c.setRadius(MP.radius || 4); sidla.addLayer(c); } else body.addLayer(c);
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
    var pos = [H - x.m.y, x.m.x];
    map.flyTo(pos, crop ? 1.2 : 1, { duration: .8 });
    if (crop) {
      if (cropHighlight) map.removeLayer(cropHighlight);
      cropHighlight = L.circleMarker(pos, { interactive: false, radius: 20, color: "#fff1a0", weight: 4, fillColor: "#fff3b0", fillOpacity: .2 }).addTo(map);
      x.c.openTooltip();
    } else setTimeout(function () { x.c.openPopup(); }, 850);
  }
  var hl = document.getElementById("mapa-hledat");
  if (hl) hl.addEventListener("change", function () { najdi(this.value); });
  if (qs.get("misto")) setTimeout(function () { najdi(qs.get("misto")); }, 300);
  function tog(id, layer) {
    var e = document.getElementById(id); if (!e) return;
    if (e.checked) map.addLayer(layer); else map.removeLayer(layer);
    e.addEventListener("change", function (ev) { if (ev.target.checked) map.addLayer(layer); else map.removeLayer(layer); });
  }
  tog("mapa-sidla", sidla); tog("mapa-body", body); tog("mapa-boj", bojL);
  var st = document.getElementById("mapa-stitky");
  if (st) st.addEventListener("change", function (e) {
    D.mista.forEach(function (m) { if (m.typ !== "mesto" && m.typ !== "misto") return; var c = byName[m.nazev.toLowerCase()].c; c.unbindTooltip(); c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6], permanent: e.target.checked }); if (e.target.checked) c.openTooltip(); });
  });
  var eb = document.getElementById("mapa-editor");
  if (eb) eb.addEventListener("click", function () {
    if (!SV.D || !window.MontelienSvet || SV.open) return;
    if (!map.pm) { alert("Knihovna editoru se nenačetla."); return; }
    clearState();
    Object.keys(vrstvy).forEach(function (k) { map.removeLayer(vrstvy[k]); }); atlas.addTo(map); map.removeLayer(body); map.removeLayer(sidla);
    SV.open = true; window.MontelienSvet.editor(SV);
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
