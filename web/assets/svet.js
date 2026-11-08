// Vektorová mapa Montelienu z dat (11_Mapy/svet.json + mista.json) a její editor.
(function () {
  var NS = "http://www.w3.org/2000/svg";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
  function pathD(b, closed) {
    if (!b || b.length < 2) return "";
    if (b.length < 3) return "M" + b.map(function (p) { return p[0] + "," + p[1]; }).join(" L") + (closed ? "Z" : "");
    var n = b.length, d = "M" + b[0][0] + "," + b[0][1], P = function (i) { return closed ? b[(i + n) % n] : b[Math.max(0, Math.min(n - 1, i))]; };
    for (var i = 0; i < (closed ? n : n - 1); i++) {
      var p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t = .18;
      d += " C" + (p1[0] + (p2[0] - p0[0]) * t).toFixed(1) + "," + (p1[1] + (p2[1] - p0[1]) * t).toFixed(1) + " " + (p2[0] - (p3[0] - p1[0]) * t).toFixed(1) + "," + (p2[1] - (p3[1] - p1[1]) * t).toFixed(1) + " " + p2[0] + "," + p2[1];
    }
    return d + (closed ? "Z" : "");
  }
  function inPoly(x, y, b) { var c = false; for (var i = 0, j = b.length - 1; i < b.length; j = i++) { if (((b[i][1] > y) !== (b[j][1] > y)) && (x < (b[j][0] - b[i][0]) * (y - b[i][1]) / (b[j][1] - b[i][1]) + b[i][0])) c = !c; } return c; }
  function bbox(b) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; b.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return [x0, y0, x1, y1]; }

  function render(svg, D, M, base) {
    var SYM = window.SVET_SYMBOLY || {}, OBL = window.SVET_OBLASTI || {}, W = D.sirka, H = D.vyska, o = [];
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    o.push('<defs><style>@font-face{font-family:MCinzel;src:url(' + base + 'assets/fonts/Cinzel.ttf)}@font-face{font-family:MFell;src:url(' + base + 'assets/fonts/IMFePIit28P.ttf)}'
      + '.sv-l{font-family:MCinzel,serif;fill:#3a2412;paint-order:stroke;stroke:#f3e6c4;stroke-width:3px;stroke-linejoin:round;text-transform:uppercase}.sv-m{font-family:MFell,serif;font-style:italic;fill:#1f4a52;paint-order:stroke;stroke:#cfe3df;stroke-width:3px}.sv-c{font-family:MFell,serif;fill:#3a2412;paint-order:stroke;stroke:#f3e6c4;stroke-width:2.5px}</style>'
      + '<filter id="sv-papir" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .016" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>'
      + '<filter id="sv-mekce" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="5"/></filter>'
      + '<radialGradient id="sv-vin" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#3a2412" stop-opacity=".45"/></radialGradient>');
    Object.keys(SYM).forEach(function (k) { o.push('<g id="sv-' + k + '">' + SYM[k].svg + "</g>"); });
    var lakes = (D.pevnina || []).filter(function (s) { return s.typ === "jezero"; });
    var landD = (D.pevnina || []).filter(function (s) { return s.typ === "pevnina"; }).map(function (s) { return pathD(s.body, true); }).join(" ");
    o.push('<clipPath id="sv-souse"><path d="' + landD + '"/></clipPath></defs>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="#a9cbc4"/>');
    o.push('<path d="' + landD + '" fill="none" stroke="#5f9294" stroke-opacity=".35" stroke-width="56" stroke-linejoin="round" filter="url(#sv-mekce)"/>');
    [22, 14, 7].forEach(function (d) { o.push('<path d="' + landD + '" fill="none" stroke="#2f6670" stroke-opacity=".45" stroke-width="' + (2 * d + 1.4) + '" stroke-linejoin="round"/><path d="' + landD + '" fill="none" stroke="#a9cbc4" stroke-width="' + 2 * d + '" stroke-linejoin="round"/>'); });
    o.push('<rect width="' + W + '" height="' + H + '" fill="#fff" filter="url(#sv-papir)"/>');
    (D.pevnina || []).forEach(function (s) {
      var d = pathD(s.body, true);
      if (s.typ === "jezero") o.push('<path d="' + d + '" fill="#a9cbc4" stroke="#3a2412" stroke-width="1.3"/><path d="' + d + '" fill="none" stroke="#2f6670" stroke-opacity=".22" stroke-width="10" clip-path="url(#sv-souse)"/>');
      else o.push('<path d="' + d + '" fill="#efdfb4" stroke="#3a2412" stroke-width="1.3" stroke-linejoin="round"/>');
    });
    o.push('<g clip-path="url(#sv-souse)"><rect width="' + W + '" height="' + H + '" fill="#fff" filter="url(#sv-papir)" opacity=".9"/>');
    (D.oblasti || []).forEach(function (a) { var c = (OBL[a.typ] || {}).barva || "#b8c47a"; o.push('<path d="' + pathD(a.body, true) + '" fill="' + c + '" opacity=".42" filter="url(#sv-mekce)"/>'); });
    lakes.forEach(function (s) { o.push('<path d="' + pathD(s.body, true) + '" fill="#a9cbc4"/>'); });
    o.push("</g>");
    (D.reky || []).forEach(function (r) { var d = pathD(r.body, false); o.push('<path d="' + d + '" fill="none" stroke="#3a2412" stroke-width="3.2" stroke-linecap="round" opacity=".55"/><path d="' + d + '" fill="none" stroke="#7fb3b8" stroke-width="2" stroke-linecap="round"/>'); });
    (D.cesty || []).forEach(function (r) { o.push('<path d="' + pathD(r.body, false) + '" fill="none" stroke="#6b4423" stroke-width="1.6" stroke-dasharray="6 5" stroke-linecap="round"/>'); });
    (D.hranice || []).forEach(function (r) { o.push('<path d="' + pathD(r.body, false) + '" fill="none" stroke="#8b2c1c" stroke-width="1.8" stroke-dasharray="10 4 2 4" opacity=".8"/>'); });
    // symboly v oblastech (seřazené podle y, aby se překrývaly správně)
    var items = [];
    (D.oblasti || []).forEach(function (a, ai) {
      var t = OBL[a.typ]; if (!t || !t.sym.length) return;
      var bb = bbox(a.body), R = rng(ai * 7919 + 13 + Math.round(bb[0] + bb[1])), st = (a.hustota || 1) * t.rozestup, row = 0;
      for (var y = bb[1] + st * .6; y < bb[3]; y += st * .8, row++) for (var x = bb[0] + (row % 2 ? st / 2 : 0); x < bb[2]; x += st) {
        var px = x + (R() - .5) * st * .7, py = y + (R() - .5) * st * .5;
        if (!inPoly(px, py, a.body) || lakes.some(function (l) { return inPoly(px, py, l.body); })) continue;
        items.push([py, '<use href="#sv-' + t.sym[Math.floor(R() * t.sym.length)] + '" transform="translate(' + px.toFixed(1) + "," + py.toFixed(1) + ") scale(" + (t.m[0] + R() * (t.m[1] - t.m[0])).toFixed(2) + (R() < .5 ? "" : ",") + (R() < .5 ? "" : "") + ')"/>']);
      }
    });
    (D.symboly || []).forEach(function (s) { if (SYM[s.typ]) items.push([s.y, '<use href="#sv-' + s.typ + '" transform="translate(' + s.x + "," + s.y + ") rotate(" + (s.rot || 0) + ") scale(" + (s.m || 1) + ')"/>']); });
    (M.mista || []).forEach(function (m) { if (m.typ === "sidlo" || m.typ === "mesto") items.push([m.y + 4, '<use href="#sv-sidlo" transform="translate(' + m.x + "," + (m.y + 4) + ") scale(" + (m.typ === "mesto" ? 1.25 : .9) + ')"/>']); });
    items.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (i) { o.push(i[1]); });
    // popisky z mista.json
    (M.mista || []).forEach(function (m) {
      var p = m.popisek; if (!p) return;
      var x = m.x + (p.dx || 0), y = m.y + (p.dy || 0), rot = -(p.rot || 0), styl = p.styl || "zeme", w = m.nazev.split(" ");
      if (styl === "more") { var sz = p.velikost || 22, half = Math.ceil(w.length / 2); [w.slice(0, half).join(" "), w.slice(half).join(" ")].forEach(function (ln, i) { if (ln) o.push('<text class="sv-m" text-anchor="middle" dominant-baseline="middle" font-size="' + sz + '" letter-spacing="' + sz * .2 + '" transform="translate(' + x + "," + y + ") rotate(" + rot + ') translate(0,' + ((i - .5) * sz * 1.1).toFixed(1) + ')">' + esc(ln.toUpperCase()) + "</text>"); }); }
      else if (styl === "zeme" && w.length === 2) o.push('<g transform="translate(' + x + "," + y + ") rotate(" + rot + ')"><text class="sv-l" text-anchor="middle" font-size="24" letter-spacing="3.6" y="-2">' + esc(w[0]) + '</text><text class="sv-l" text-anchor="middle" font-size="17" letter-spacing="5" y="17">' + esc(w[1]) + "</text></g>");
      else o.push('<text class="' + (styl === "zeme" ? "sv-l" : "sv-c") + '" text-anchor="middle" dominant-baseline="middle" font-size="' + (p.velikost || (styl === "zeme" ? 27 : 24)) + '" letter-spacing="' + (styl === "zeme" ? 4.8 : 2) + '" transform="translate(' + x + "," + y + ") rotate(" + rot + ')">' + esc(styl === "zeme" ? m.nazev : m.nazev) + "</text>");
    });
    o.push('<text class="sv-l" text-anchor="middle" font-size="48" letter-spacing="6" x="1810" y="130">Montelien</text>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="url(#sv-vin)" pointer-events="none"/>');
    svg.innerHTML = o.join("");
  }

  // ---------------- editor ----------------
  var VRSTVY = { pevnina: "Pobřeží a jezera", oblasti: "Oblasti (les, hory…)", reky: "Řeky", cesty: "Cesty", hranice: "Hranice", symboly: "Symboly", popisky: "Popisky a místa" };
  function editor(ctx) {
    var map = ctx.map, H = ctx.D.vyska, D = JSON.parse(JSON.stringify(ctx.D)), M = JSON.parse(JSON.stringify(ctx.M)), grp = L.featureGroup().addTo(map), vr = "oblasti", dirty = false, typ = "les", sym = "hora";
    var ll = function (p) { return [H - p[1], p[0]]; }, pt = function (l) { return [Math.round(l.lng), Math.round(H - l.lat)]; };
    var SYM = window.SVET_SYMBOLY, OBL = window.SVET_OBLASTI;
    var panel = document.createElement("div"); panel.className = "sv-ed";
    ctx.el.parentNode.insertBefore(panel, ctx.el);
    function rerender() { render(ctx.svg, D, M, ctx.base); }
    function mark() { dirty = true; panel.querySelector(".sv-save").classList.add("on"); rerender(); }
    function syncLayer(lay) {
      var f = lay._sv; if (!f) return;
      if (f.kind === "poly") f.obj.body = lay.getLatLngs()[0].map(pt);
      else if (f.kind === "line") f.obj.body = lay.getLatLngs().map(pt);
      else if (f.kind === "sym") { var q = pt(lay.getLatLng()); f.obj.x = q[0]; f.obj.y = q[1]; }
      else if (f.kind === "pop") { var q2 = pt(lay.getLatLng()), p = f.obj.popisek; p.dx = q2[0] - f.obj.x; p.dy = q2[1] - f.obj.y; }
      else if (f.kind === "misto") { var q3 = pt(lay.getLatLng()); f.obj.x = q3[0]; f.obj.y = q3[1]; }
      mark();
    }
    function hook(lay) {
      lay.on("pm:edit pm:dragend", function () { syncLayer(lay); });
      lay.on("dragend", function () { syncLayer(lay); });
      lay.on("pm:remove", function () { var f = lay._sv, arr = f.arr; var i = arr.indexOf(f.obj); if (i >= 0) arr.splice(i, 1); mark(); });
      lay.on("click", function (e) { if (map.pm.globalRemovalModeEnabled() || map.pm.globalDragModeEnabled()) return; if (lay.pm && (lay._sv.kind === "poly" || lay._sv.kind === "line")) { grp.eachLayer(function (o) { if (o !== lay && o.pm && o.pm.enabled()) o.pm.disable(); }); lay.pm.toggleEdit({ allowSelfIntersection: true }); } props(lay); L.DomEvent.stop(e); });
      grp.addLayer(lay);
    }
    function props(lay) {
      var f = lay._sv, box = panel.querySelector(".sv-props"), o = f.obj, h = "";
      if (vr === "oblasti") h = 'Typ oblasti <select data-p="typ">' + Object.keys(OBL).map(function (k) { return '<option value="' + k + '"' + (o.typ === k ? " selected" : "") + ">" + OBL[k].nazev + "</option>"; }).join("") + '</select> Hustota <input data-p="hustota" type="number" step=".1" min=".4" max="3" value="' + (o.hustota || 1) + '">';
      else if (vr === "pevnina") h = 'Typ <select data-p="typ"><option value="pevnina"' + (o.typ === "pevnina" ? " selected" : "") + '>pevnina / ostrov</option><option value="jezero"' + (o.typ === "jezero" ? " selected" : "") + '>jezero</option></select> Úroveň <input data-p="uroven" type="number" min="0" max="6" value="' + (o.uroven || 0) + '">';
      else if (vr === "symboly") h = 'Symbol <select data-p="typ">' + Object.keys(SYM).map(function (k) { return '<option value="' + k + '"' + (o.typ === k ? " selected" : "") + ">" + SYM[k].nazev + "</option>"; }).join("") + '</select> Velikost <input data-p="m" type="number" step=".1" value="' + (o.m || 1) + '"> Otočení <input data-p="rot" type="number" step="5" value="' + (o.rot || 0) + '">';
      else if (vr === "popisky" && f.kind === "pop") h = esc(o.nazev) + ': otočení <input data-p="popisek.rot" type="number" step="2" value="' + (o.popisek.rot || 0) + '"> velikost <input data-p="popisek.velikost" type="number" value="' + (o.popisek.velikost || "") + '" placeholder="auto"> styl <select data-p="popisek.styl"><option>zeme</option><option' + (o.popisek.styl === "mesto" ? " selected" : "") + '>mesto</option><option' + (o.popisek.styl === "more" ? " selected" : "") + ">more</option></select>";
      else if (f.kind === "misto") h = esc(o.nazev) + (o.popisek ? "" : ' <button data-addpop>+ popisek na mapě</button>');
      h += ' <input data-p="pozn" placeholder="poznámka" value="' + esc(o.pozn || "") + '">';
      box.innerHTML = h; box._f = f; box._lay = lay;
    }
    function load() {
      grp.clearLayers(); map.pm.disableGlobalEditMode && map.pm.disableGlobalEditMode();
      var arr = D[vr], st = { color: "#c0392b", weight: 2, fillOpacity: .08 };
      if (vr === "pevnina" || vr === "oblasti") arr.forEach(function (o) { var lay = L.polygon(o.body.map(ll), Object.assign({}, st, { color: vr === "oblasti" ? ((OBL[o.typ] || {}).barva || "#555") : o.typ === "jezero" ? "#1f6fb2" : "#c0392b", weight: vr === "oblasti" ? 2.5 : 1.5 })); lay._sv = { kind: "poly", obj: o, arr: arr }; hook(lay); });
      else if (vr === "reky" || vr === "cesty" || vr === "hranice") arr.forEach(function (o) { var lay = L.polyline(o.body.map(ll), { color: "#c0392b", weight: 4 }); lay._sv = { kind: "line", obj: o, arr: arr }; hook(lay); });
      else if (vr === "symboly") arr.forEach(function (o) { var lay = L.marker(ll([o.x, o.y]), { draggable: true, icon: L.divIcon({ className: "sv-h", html: "✥", iconSize: [18, 18] }) }); lay.bindTooltip((SYM[o.typ] || {}).nazev || o.typ); lay._sv = { kind: "sym", obj: o, arr: arr }; hook(lay); });
      else if (vr === "popisky") M.mista.forEach(function (o) {
        var m = L.marker(ll([o.x, o.y]), { draggable: true, icon: L.divIcon({ className: "sv-h sv-hm", html: "●", iconSize: [12, 12] }) }); m.bindTooltip(o.nazev); m._sv = { kind: "misto", obj: o, arr: M.mista }; hook(m);
        if (o.popisek) { var p = L.marker(ll([o.x + (o.popisek.dx || 0), o.y + (o.popisek.dy || 0)]), { draggable: true, icon: L.divIcon({ className: "sv-h sv-hp", html: "T", iconSize: [18, 18] }) }); p.bindTooltip("popisek: " + o.nazev); p._sv = { kind: "pop", obj: o, arr: M.mista }; hook(p); }
      });
      var line = vr === "reky" || vr === "cesty" || vr === "hranice", poly = vr === "pevnina" || vr === "oblasti";
      map.pm.addControls({ position: "topleft", drawMarker: vr === "symboly" || vr === "popisky", drawPolygon: poly, drawPolyline: line, drawCircle: false, drawCircleMarker: false, drawRectangle: false, drawText: false, cutPolygon: false, rotateMode: false, editMode: false, dragMode: true, removalMode: vr !== "popisky" });
      panel.querySelector(".sv-props").innerHTML = '<span class="sv-tip">' + (poly ? "Klikni na tvar = upravit body (táhni body, klik na střed hrany přidá bod, pravý klik bod smaže). Nový tvar: ⬠ vlevo." : line ? "Klikni na čáru = upravit body. Nová čára: ╱ vlevo, dvojklik ukončí." : "Táhni značky. Nový: 📍 vlevo, pak vyber typ.") + "</span>";
    }
    map.on("pm:create", function (e) {
      var lay = e.layer, o; map.removeLayer(lay);
      if (vr === "pevnina") o = { typ: "pevnina", uroven: 0, body: lay.getLatLngs()[0].map(pt) };
      else if (vr === "oblasti") o = { typ: typ, body: lay.getLatLngs()[0].map(pt) };
      else if (vr === "symboly") { var q = pt(lay.getLatLng()); o = { typ: sym, x: q[0], y: q[1], m: 1 }; }
      else if (vr === "popisky") { var q2 = pt(lay.getLatLng()), n = prompt("Název nového místa"); if (!n) return; M.mista.push({ nazev: n, x: q2[0], y: q2[1], typ: "misto", jistota: "odhad", odkaz: "11_Mapy/Analyza_mapy.md", pozn: "" }); mark(); load(); return; }
      else o = { typ: vr === "reky" ? "reka" : vr === "cesty" ? "cesta" : "hranice", body: lay.getLatLngs().map(pt) };
      D[vr].push(o); mark(); load();
    });
    panel.innerHTML = '<b>Editor mapy</b> Vrstva <select class="sv-vr">' + Object.keys(VRSTVY).map(function (k) { return '<option value="' + k + '"' + (k === vr ? " selected" : "") + ">" + VRSTVY[k] + "</option>"; }).join("") + '</select>'
      + ' <span class="sv-new">nová oblast: <select class="sv-typ">' + Object.keys(OBL).map(function (k) { return '<option value="' + k + '">' + OBL[k].nazev + "</option>"; }).join("") + '</select> nový symbol: <select class="sv-sym">' + Object.keys(SYM).map(function (k) { return '<option value="' + k + '"' + (k === sym ? " selected" : "") + ">" + SYM[k].nazev + "</option>"; }).join("") + "</select></span>"
      + ' Kresba DM <input type="range" class="sv-op" min="0" max="1" step=".05" value="0"> <button class="sv-save">Uložit mapu</button> <button class="sv-close">Zavřít editor</button><div class="sv-props"></div>';
    var kres = L.imageOverlay(ctx.base + "11_Mapy/Montelien_mapa_vyrovnana.jpg", [[0, 0], [H, ctx.D.sirka]], { opacity: 0 }).addTo(map);
    panel.addEventListener("change", function (e) {
      var t = e.target;
      if (t.classList.contains("sv-vr")) { vr = t.value; load(); return; }
      if (t.classList.contains("sv-typ")) { typ = t.value; return; }
      if (t.classList.contains("sv-sym")) { sym = t.value; return; }
      var k = t.dataset.p, box = panel.querySelector(".sv-props"); if (!k || !box._f) return;
      var o = box._f.obj, v = t.type === "number" ? (t.value === "" ? undefined : Number(t.value)) : t.value, ks = k.split(".");
      if (ks.length === 2) o[ks[0]][ks[1]] = v; else o[k] = v;
      if (vr === "pevnina" && k === "uroven") D.pevnina.sort(function (a, b) { return (a.uroven || 0) - (b.uroven || 0); });
      mark(); if (vr === "oblasti" && k === "typ") box._lay.setStyle({ color: OBL[v].barva });
    });
    panel.addEventListener("input", function (e) { if (e.target.classList.contains("sv-op")) kres.setOpacity(Number(e.target.value)); });
    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (t.dataset.addpop != null) { var o = panel.querySelector(".sv-props")._f.obj; o.popisek = { rot: 0, box: [o.nazev.length * 16, 30], styl: "mesto" }; mark(); load(); }
      if (t.classList.contains("sv-save")) {
        var E = window.MontelienEditor; if (!E || !E.api) { alert("Uložení funguje přes lokální editační server."); return; }
        E.api("PUT", "soubor", { cesta: "11_Mapy/svet.json", obsah: JSON.stringify(D, null, 0).replace(/\},\{/g, "},\n{") })
          .then(function () { return E.api("PUT", "soubor", { cesta: "11_Mapy/mista.json", obsah: JSON.stringify(M, null, 1) }); })
          .then(function () { dirty = false; t.classList.remove("on"); ctx.D = D; ctx.M = M; t.textContent = "Uloženo ✓"; setTimeout(function () { t.textContent = "Uložit mapu"; }, 2000); })
          .catch(function (er) { alert("Uložení selhalo: " + er.message); });
      }
      if (t.classList.contains("sv-close")) {
        if (dirty && !confirm("Neuložené změny se zahodí. Zavřít?")) return;
        grp.remove(); map.pm.removeControls(); map.off("pm:create"); kres.remove(); panel.remove(); render(ctx.svg, ctx.D, ctx.M, ctx.base); ctx.open = false;
      }
    });
    load();
  }
  window.MontelienSvet = { render: render, editor: editor };
})();
