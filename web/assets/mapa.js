(function () {
  var D = window.MONTELIEN_MISTA, el = document.getElementById("mapa");
  if (!D || !el || el.dataset.ready) return;
  el.dataset.ready = "1";
  var W = D.sirka, H = D.vyska, bounds = [[0, 0], [H, W]];
  var map = L.map(el, { crs: L.CRS.Simple, minZoom: -1.5, maxZoom: 2.5, zoomSnap: 0.25, attributionControl: false });
  var barevna = L.imageOverlay("../11_Mapy/Montelien_mapa.jpg", bounds).addTo(map);
  var kresba = L.imageOverlay("../11_Mapy/Montelien_mapa_vyrovnana.jpg", bounds);
  L.control.layers({ "Barevná mapa": barevna, "Původní kresba (DM)": kresba }).addTo(map);
  var sidla = L.layerGroup();
  map.fitBounds(bounds);
  map.setMaxBounds([[-200, -200], [H + 200, W + 200]]);
  var barvy = { mapa: "#c0392b", kanon: "#2e8b57", odhad: "#f0b429" };
  var jistotaText = { mapa: "popsáno na mapě DM", kanon: "potvrzeno DM", odhad: "odhad – čeká na potvrzení" };
  var body = L.layerGroup().addTo(map);
  D.mista.forEach(function (m) {
    var c = L.circleMarker([H - m.y, m.x], {
      radius: m.typ === "zeme" ? 8 : 6, color: "#3a2412", weight: 2,
      fillColor: barvy[m.jistota] || "#999", fillOpacity: .95
    });
    c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6] });
    c.bindPopup("<h4>" + m.nazev + "</h4><p>" + (m.pozn || "") + "</p><p><small>" +
      jistotaText[m.jistota] + "</small></p><a href='" + m.url + "'>Otevřít stránku →</a>");
    if (m.typ === "sidlo") { c.setRadius(4); sidla.addLayer(c); } else body.addLayer(c);
  });
  document.getElementById("mapa-sidla").addEventListener("change", function (e) {
    if (e.target.checked) map.addLayer(sidla); else map.removeLayer(sidla);
  });
  document.getElementById("mapa-body").addEventListener("change", function (e) {
    if (e.target.checked) map.addLayer(body); else map.removeLayer(body);
  });
})();
