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
  function boundaryDistance(x, y, b) {
    var d = Infinity;
    for (var i = 0, j = b.length - 1; i < b.length; j = i++) {
      var ax = b[j][0], ay = b[j][1], dx = b[i][0] - ax, dy = b[i][1] - ay;
      var t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
    return d;
  }
  function nearestShore(x, y, rings) {
    var best = { x: x, y: y, d: Infinity };
    (rings || []).forEach(function (ring) {
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var ax = ring[j][0], ay = ring[j][1], dx = ring[i][0] - ax, dy = ring[i][1] - ay;
        var t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        var px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
        if (d < best.d) best = { x: px, y: py, d: d };
      }
    });
    return best;
  }
  function polygonCenter(body) {
    var crossSum = 0, xSum = 0, ySum = 0;
    for (var i = 0, j = body.length - 1; i < body.length; j = i++) {
      var cross = body[j][0] * body[i][1] - body[i][0] * body[j][1];
      crossSum += cross;
      xSum += (body[j][0] + body[i][0]) * cross;
      ySum += (body[j][1] + body[i][1]) * cross;
    }
    if (Math.abs(crossSum) > 1e-6) {
      var x = xSum / (3 * crossSum), y = ySum / (3 * crossSum);
      if (inPoly(x, y, body)) return { x: x, y: y };
    }
    var box = bbox(body), step = Math.max(1, Math.min(box[2] - box[0], box[3] - box[1]) / 16);
    var best = { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, d: -1 };
    for (var py = box[1]; py <= box[3]; py += step) for (var px = box[0]; px <= box[2]; px += step) {
      if (!inPoly(px, py, body)) continue;
      var distance = boundaryDistance(px, py, body);
      if (distance > best.d) best = { x: px, y: py, d: distance };
    }
    return best;
  }

  function render(svg, D, M, base) {
    svg._svAreas = D.oblasti || [];
    var SYM = window.SVET_SYMBOLY || {}, OBL = window.SVET_OBLASTI || {}, SPR = window.SVET_SPRITY || {}, META = window.SVET_SPRITY_META || {},
      PAL = window.SVET_PALETA || {}, SEA = PAL.sea || {}, LAND = PAL.land || {}, AP = PAL.areas || {}, FIELD = PAL.fields || {}, W = D.sirka, H = D.vyska, o = [];
    var A = base + "assets/svet/";
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");
    var LABEL = PAL.labels || {};
    o.push('<defs><style>@font-face{font-family:MCinzel;src:url(' + base + 'assets/fonts/Cinzel.ttf)}@font-face{font-family:MFell;src:url(' + base + 'assets/fonts/IMFePIit28P.ttf)}'
      + '.sv-l{font-family:MCinzel,serif;fill:' + (LABEL.state_ink || "#332418") + ';paint-order:stroke;stroke:' + (LABEL.state_halo || "#f1e3c4") + ';stroke-width:' + (LABEL.state_halo_width || 4) + 'px;stroke-linejoin:round;text-transform:uppercase}.sv-m{font-family:MFell,serif;font-style:italic;fill:#1f4a52;paint-order:stroke;stroke:#cfe3df;stroke-width:3px}.sv-c{font-family:MFell,serif;fill:#332418;paint-order:stroke;stroke:#f1e3c4;stroke-width:2.5px}</style>'
      + '<filter id="sv-papir" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .016" numOctaves="4" seed="3"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .18  0 0 0 .16 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>'
      + '<filter id="sv-mekce" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>'
      + '<radialGradient id="sv-vin" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="' + PAL.grade.vignette + '" stop-opacity="' + PAL.grade.vignette_opacity + '"/></radialGradient>');
    Object.keys(SYM).forEach(function (k) { o.push('<g id="sv-' + k + '">' + SYM[k].svg + "</g>"); });
    o.push('<pattern id="sv-pp" patternUnits="userSpaceOnUse" width="512" height="512"><rect width="512" height="512" fill="#efdfb4"/><image href="' + A + 'papir.jpg" width="512" height="512" opacity=".75"/></pattern>');
    o.push('<pattern id="sv-mp" patternUnits="userSpaceOnUse" width="420" height="420"><image href="' + A + 'more.jpg" width="420" height="420"/></pattern>');
    o.push('<pattern id="sv-jp" patternUnits="userSpaceOnUse" width="420" height="420"><rect width="420" height="420" fill="' + SEA.lake + '"/><image href="' + A + 'more.jpg" width="420" height="420" opacity="' + SEA.lake_wave_opacity + '"/></pattern>');
    (FIELD.patterns || []).forEach(function (f, i) { o.push('<pattern id="sv-f' + i + '" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(' + [25, -35, 70][i] + ')"><rect width="9" height="9" fill="' + f[0] + '"/><rect width="9" height="4" fill="' + f[1] + '"/><path d="M0,4.5 h9" stroke="' + FIELD.line + '" stroke-width=".45" opacity="' + FIELD.stroke_opacity + '"/></pattern>'); });
    var lakes = (D.pevnina || []).filter(function (s) { return s.typ === "jezero"; });
    var landD = (D.pevnina || []).filter(function (s) { return s.typ === "pevnina" || s.typ === "ostrov"; }).map(function (s) { return pathD(s.body, true); }).join(" ");
    svg._svShore = (D.pevnina || []).filter(function (s) { return s.typ === "pevnina" || s.typ === "ostrov"; }).map(function (s) { return s.body; });
    o.push('<clipPath id="sv-souse"><path d="' + landD + '"/></clipPath></defs>');
    o.push('<image href="' + A + 'hloubka.jpg" width="' + W + '" height="' + H + '" preserveAspectRatio="none"/>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="url(#sv-mp)" opacity="' + SEA.wave_opacity + '" style="mix-blend-mode:multiply"/>');
    o.push('<path d="' + landD + '" fill="none" stroke="' + SEA.edge + '" stroke-opacity=".12" stroke-width="28" stroke-linejoin="round" filter="url(#sv-mekce)"/>');
    o.push('<path d="' + landD + '" fill="none" stroke="' + SEA.edge + '" stroke-opacity=".24" stroke-width="8" stroke-linejoin="round"/><path d="' + landD + '" fill="none" stroke="' + SEA.light_edge + '" stroke-opacity=".22" stroke-width="4" stroke-linejoin="round"/>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="#fff" filter="url(#sv-papir)" opacity=".6"/>');
    var lid = 0;
    (D.pevnina || []).forEach(function (s) {
      var d = pathD(s.body, true);
      if (s.typ === "jezero") { lid++; o.push('<clipPath id="sv-j' + lid + '"><path d="' + d + '"/></clipPath><path d="' + d + '" fill="url(#sv-jp)"/><g clip-path="url(#sv-j' + lid + ')" fill="none" stroke-linejoin="round"><path d="' + d + '" stroke="' + SEA.edge + '" stroke-opacity=".22" stroke-width="8"/><path d="' + d + '" stroke="' + SEA.light_edge + '" stroke-opacity=".24" stroke-width="3"/></g><path d="' + d + '" fill="none" stroke="#3a2412" stroke-opacity=".65" stroke-width=".8"/>'); }
      else o.push('<path d="' + d + '" fill="url(#sv-pp)" stroke="#3a2412" stroke-width="1.3" stroke-linejoin="round"/>');
    });
    o.push('<g clip-path="url(#sv-souse)"><rect width="' + W + '" height="' + H + '" fill="#fff" filter="url(#sv-papir)" opacity=".45"/>');
    o.push('<image href="' + A + 'barvy.jpg" width="' + W + '" height="' + H + '" preserveAspectRatio="none" opacity="' + (LAND.base_opacity == null ? 1 : LAND.base_opacity) + '"/>');
    o.push('<path d="' + landD + '" fill="none" stroke="' + SEA.beach + '" stroke-opacity="' + SEA.beach_opacity + '" stroke-width="4" stroke-linejoin="round"/>');
    o.push('<path d="' + landD + '" fill="none" stroke="#7a5a37" stroke-opacity=".18" stroke-width="2" stroke-linejoin="round"/>');
    (D.oblasti || []).forEach(function (a) { if (!a.tmavy) return; o.push('<path d="' + pathD(a.body, true) + '" fill="' + AP.tmavy + '" opacity="' + PAL.area_opacity.tmavy + '" filter="url(#sv-mekce)"/>'); });
    var ZPAL = PAL.state_tints || [];
    (D.zeme || []).forEach(function (z, i) { var c = ZPAL[i % ZPAL.length] || "#777"; (z.pas || []).forEach(function (b) { o.push('<path d="' + (typeof b[0][0] === "number" ? pathD(b, true) : b.map(function (r) { return pathD(r, true); }).join(" ")) + '" fill="' + c + '" fill-rule="evenodd" opacity="' + (PAL.state_tint_opacity == null ? .12 : PAL.state_tint_opacity) + '"/>'); }); });
    (D.oblasti || []).forEach(function (a, i) {
      if (a.typ !== "pole") return;
      var Rf = rng(977 + i * 31), xs = a.body.map(function (p) { return p[0]; }), ys = a.body.map(function (p) { return p[1]; }),
        x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), ang = (Rf() - .5) * 50;
      for (var fy = y0 + 4; fy < y1; fy += 10) for (var fx = x0 + 4; fx < x1; fx += 13) {
        var qx = fx + (Rf() - .5) * 4, qy = fy + (Rf() - .5) * 3;
        if (Rf() < .18 || !inPoly(qx, qy, a.body)) continue;
        o.push('<rect x="' + (qx - 5.5).toFixed(1) + '" y="' + (qy - 4).toFixed(1) + '" width="' + (9 + Rf() * 3).toFixed(1) + '" height="' + (6.5 + Rf() * 2).toFixed(1) + '" transform="rotate(' + (ang + (Rf() - .5) * 12).toFixed(1) + " " + qx.toFixed(1) + " " + qy.toFixed(1) + ')" fill="url(#sv-f' + Math.floor(Rf() * 3) + ')" stroke="' + FIELD.line + '" stroke-width=".4" stroke-opacity="' + FIELD.stroke_opacity + '" opacity="' + FIELD.opacity + '"/>');
      }
    });
    lakes.forEach(function (s) { o.push('<path d="' + pathD(s.body, true) + '" fill="url(#sv-jp)"/>'); });
    o.push("</g>");
    o.push('<g clip-path="url(#sv-souse)">');
    (D.reky || []).forEach(function (r) {
      var b = r.body, n = b.length, parts = n > 8 ? [[0, Math.floor(n / 3) + 1, 1.1], [Math.floor(n / 3), Math.floor(2 * n / 3) + 1, 1.7], [Math.floor(2 * n / 3), n, 2.4]] : [[0, n, 1.6]];
      parts.forEach(function (q) { var d = pathD(b.slice(q[0], q[1]), false); o.push('<path d="' + d + '" fill="none" stroke="#3a2412" stroke-width="' + (q[2] + 1.3) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><path d="' + d + '" fill="none" stroke="#7fb3b8" stroke-width="' + q[2] + '" stroke-linecap="round" stroke-linejoin="round"/>'); });
    });
    o.push("</g>");
    (D.cesty || []).forEach(function (r) {
      var d = pathD(r.body, false);
      if (r.typ === "most") o.push('<path d="' + d + '" fill="none" stroke="#4a2e16" stroke-width="5" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#c9a676" stroke-width="2.6" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="#4a2e16" stroke-width="2.6" stroke-dasharray="1 4"/>');
      else if (r.typ === "stezka") o.push('<path d="' + d + '" fill="none" stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><path d="' + d + '" fill="none" stroke="#e3cfa0" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>');
      else o.push('<path d="' + d + '" fill="none" stroke="#5a3f24" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><path d="' + d + '" fill="none" stroke="#d8bf8a" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><path d="' + d + '" fill="none" stroke="#a88a5a" stroke-width=".6" stroke-dasharray="3 2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>');
    });
    (D.hradby || []).forEach(function (r) { o.push('<path d="' + pathD(r.body, false) + '" fill="none" stroke="#2e241a" stroke-width="2.2" opacity=".5"/>'); });
    (D.utesy || []).forEach(function (r) { o.push('<path d="' + pathD(r.body, false) + '" fill="none" stroke="#3a2e22" stroke-width="3" opacity=".3"/>'); });
    (D.hranice || []).forEach(function (r) { var d = pathD(r.body, false); o.push('<path d="' + d + '" fill="none" stroke="#f3e6c4" stroke-width="4" opacity=".5"/><path d="' + d + '" fill="none" stroke="#7a2416" stroke-width="1.6" stroke-dasharray="9 3 2 3" opacity=".85"/>'); });
    // symboly v oblastech (seřazené podle y, aby se překrývaly správně)
    var items = [], landPolys = (D.pevnina || []).filter(function (p) { return p.typ === "pevnina" || p.typ === "ostrov"; }),
      ridgeAreas = (D.oblasti || []).filter(function (a) { return a.typ === "hory" || a.typ === "velehory"; });
    var REL = { kaktus: .3, balvan: .45, rakos: .55, ker: .5, suchy: .8, kopec: .65, utes: .55 };
    function spr(name, x, y, w, flip, rot, tmavy) {
      if (!META[name]) return "";
      var res = PAL.viewport_sprites || {}, maxScale = Math.pow(2, res.max_zoom || 2.5);
      w = Math.min(w, META[name].w / (maxScale * (res.min_resolution_ratio || 2)));
      return { n: name, x: x, y: y, w: w, f: flip, r: rot || 0, tmavy: !!tmavy };
    }
    (D.oblasti || []).forEach(function (a, ai) {
      var t = OBL[a.typ]; if (!t || !t.spr || !t.spr.length) return;
      var bb = bbox(a.body), R = rng(ai * 7919 + 13 + Math.round(bb[0] + bb[1])), forest = a.typ === "les" || a.typ === "haj" || a.typ === "dzungle",
        deadArea = a.typ === "mrtva_zeme" || a.typ === "mrtvy",
        forestStyle = LAND.forest || {}, density = forest ? Math.max(1, a.hustota || 1) * (forestStyle.density || 1) : (a.hustota || 1),
        st = t.rozestup / density, row = 0, sh = t.shluky === true || a.shluky === true,
        f1 = sh ? R() * Math.PI * 2 : 0, f2 = sh ? R() * Math.PI * 2 : 0, f3 = sh ? R() * Math.PI * 2 : 0;
      for (var y = bb[1] + st * .5; y < bb[3] + st * .3; y += st * .62, row++) for (var x = bb[0] + (row % 2 ? st / 2 : 0); x < bb[2]; x += st) {
        var px = x + (R() - .5) * st * (sh ? 1.1 : .8), py = y + (R() - .5) * st * (sh ? .9 : .5);
        if (!inPoly(px, py, a.body) || lakes.some(function (l) { return inPoly(px, py, l.body); })) continue;
        if ((a.typ === "poust" || a.typ === "ledovec") && !landPolys.some(function (p) { return inPoly(px, py, p.body); })) continue;
        var edge = 1;
        if (forest) {
          edge = Math.max(0, Math.min(1, boundaryDistance(px, py, a.body) / (forestStyle.edge_depth || 15)));
          if (R() > (forestStyle.edge_density || .42) + (1 - (forestStyle.edge_density || .42)) * edge) continue;
        }
        if (sh) {
          var n = .5 + .5 * Math.sin(px * .031 + f1) * Math.sin(py * .027 + f2) + .25 * Math.sin((px + py) * .07 + f3);
          if (R() > .2 + .9 * n) continue;
        }
        var pool = a.tmavy && a.typ === "dzungle" ? ["dzung_1", "dzung_2"] : t.spr;
        var nm = pool[Math.floor(R() * pool.length)];
        if (a.typ === "ledovec" && nm === "ledova_pole") continue;
        var size = t.w * (REL[nm.split("_")[0]] || 1) * (sh ? .65 + R() * .7 : .8 + R() * .4);
        if (forest) size *= (forestStyle.edge_scale || .58) + (1 - (forestStyle.edge_scale || .58)) * edge;
        var rotation = a.typ === "poust" ? Math.sin((px + py * .62) * .012) * ((LAND.variation || {}).sand_row_rotation || 8) + (R() - .5) * 3 : 0;
        items.push([py, spr(nm, px, py, size, R() < .5, rotation, a.tmavy || (deadArea && /^such/.test(nm)))]);
      }
      if (a.typ === "ledovec") {
        var seracRng = rng(619 + ai * 997), step = 58;
        for (var sy = bb[1] + step * .5; sy < bb[3]; sy += step) for (var sx = bb[0] + step * .5; sx < bb[2]; sx += step) {
          var rx = sx + (seracRng() - .5) * step * .65, ry = sy + (seracRng() - .5) * step * .55;
          if (!inPoly(rx, ry, a.body) || !ridgeAreas.some(function (ridge) { return inPoly(rx, ry, ridge.body); }) || seracRng() > .32) continue;
          items.push([ry, spr("seraky", rx, ry, 18 + seracRng() * 7, seracRng() < .5, (seracRng() - .5) * 8)]);
        }
      }
    });
    // řídká drobná vegetace na volné pevnině (mimo oblasti a jezera)
    if (D.rozptyl !== false) {
      var R2 = rng(4242), land = (D.pevnina || []).filter(function (p) { return p.typ === "pevnina"; });
      var ZEL = ["zel_1", "zel_2", "zel_3", "zel_5", "zel_1", "vres", "krik_1", "krik_2", "list_2", "list_5", "kopec_3"],
        SEV = ["zel_4", "zel_6", "zel_2", "kamen_1", "kamen_3", "vres", "utes_1", "jehl_4", "krik_1", "zel_4"],
        JIH = ["kamen_2", "zel_3", "kopec_5", "utes_2"],
        PSK = ["sucha_2", "sucha_5", "kamen_2", "kamen_1", "kaktus_2", "sucha_4"];
      var VEL = { zel: 7, sucha: 7, kamen: 8, vres: 7, maky: 7, kvety: 7, krik: 9, podzim: 9, utes: 13, list: 11, jehl: 11, kopec: 20, kaktus: 6 };
      var DEC = PAL.scatter || {};
      for (var gy = 14; gy < H; gy += 20) for (var gx = 10; gx < W; gx += 22) {
        if (R2() > .62) continue;
        var qx = gx + (R2() - .5) * 20, qy = gy + (R2() - .5) * 16;
        if (!land.some(function (p) { return inPoly(qx, qy, p.body); }) || lakes.some(function (l) { return inPoly(qx, qy, l.body); })) continue;
        var vO = null; (D.oblasti || []).some(function (o2) { if (o2.typ !== "pole" && inPoly(qx, qy, o2.body)) { vO = o2.typ; return true; } return false; });
        if (vO && vO !== "louky" && vO !== "poust") continue;
        if (qy < 400 && R2() < .6) { items.push([qy, spr(["kamen_3", "zel_4", "utes_1", "kamen_1", "zel_6"][Math.floor(R2() * 5)], qx, qy, 8 * (.8 + R2() * .4), R2() < .5)]); continue; }
        var pool = vO === "poust" ? PSK : vO === "louky" ? ZEL : qy < 520 ? (R2() < .6 ? SEV : ZEL) : qy > 950 ? (R2() < .65 ? JIH : ZEL) : (R2() < .5 ? ZEL : JIH);
        var nm2 = pool[Math.floor(R2() * pool.length)];
        if (pool === JIH && R2() < (DEC.dry_grass_chance || 0)) nm2 = R2() < DEC.dry_grass_share ? "sucha_2" : "sucha_5";
        else if (pool === ZEL && R2() < (DEC.flower_chance || 0)) nm2 = R2() < (DEC.poppy_share || 0) ? "maky" : "kvety";
        else if (qy > 950 && vO !== "poust" && R2() < (DEC.autumn_chance || 0)) nm2 = R2() < DEC.autumn_share ? "podzim_1" : "podzim_2";
        var size = (VEL[nm2.split("_")[0]] || 8) * (.8 + R2() * .45);
        if (nm2 === "maky" || nm2 === "kvety") size *= DEC.flower_scale || 1;
        if (/^sucha/.test(nm2)) size *= DEC.dry_grass_scale || 1;
        if (/^podzim/.test(nm2)) size *= DEC.autumn_scale || 1;
        items.push([qy, spr(nm2, qx, qy, size, R2() < .5)]);
      }
    }
    (D.symboly || []).forEach(function (s, si) {
      var sp = SPR[s.typ];
      if (sp) items.push([s.y, spr(sp.spr[(Math.abs(s.x * 7 + s.y * 13)) % sp.spr.length], s.x, s.y, sp.w * (s.m || 1), !!s.zrcadlo, s.rot || 0)]);
      else if (SYM[s.typ]) items.push([s.y, '<use href="#sv-' + s.typ + '" transform="translate(' + s.x + "," + s.y + ") rotate(" + (s.rot || 0) + ") scale(" + (s.m || 1) + ')"/>']);
    });
    (M.mista || []).forEach(function (m) { if ((m.typ === "sidlo" || m.typ === "mesto") && !(D.symboly || []).some(function (q) { return SPR[q.typ] && Math.abs(q.x - m.x) < 45 && Math.abs(q.y - m.y) < 90; })) items.push([m.y + 6, spr(m.typ === "mesto" ? "mesto" : (Math.round(m.x + m.y) % 2 ? "vesnice" : "vesnice2"), m.x, m.y + 6, m.typ === "mesto" ? 28 : 16, Math.round(m.x) % 2 === 0)]); });
    var sprites = [];
    o.push('<foreignObject id="sv-spr" x="0" y="0" width="1" height="1"><canvas xmlns="http://www.w3.org/1999/xhtml" style="display:block;width:100%;height:100%"></canvas></foreignObject>');
    items.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (i) { if (typeof i[1] === "string") o.push(i[1]); else sprites.push(i[1]); });
    // popisky z mista.json
    (M.mista || []).forEach(function (m) {
      var p = m.popisek; if (!p) return;
      var x = m.x + (p.dx || 0), y = m.y + (p.dy || 0), rot = -(p.rot || 0), styl = p.styl || "zeme", w = m.nazev.split(" ");
      if (styl === "more") { var sz = p.velikost || 22, half = Math.ceil(w.length / 2); [w.slice(0, half).join(" "), w.slice(half).join(" ")].forEach(function (ln, i) { if (ln) o.push('<text class="sv-m" text-anchor="middle" dominant-baseline="middle" font-size="' + sz + '" letter-spacing="' + sz * .2 + '" transform="translate(' + x + "," + y + ") rotate(" + rot + ') translate(0,' + ((i - .5) * sz * 1.1).toFixed(1) + ')">' + esc(ln.toUpperCase()) + "</text>"); }); }
      else if (styl === "zeme" && w.length === 2) o.push('<g transform="translate(' + x + "," + y + ") rotate(" + rot + ')"><text class="sv-l" data-map-label="state" text-anchor="middle" font-size="24" letter-spacing="1" y="-2">' + esc(w[0]) + '</text><text class="sv-l" data-map-label="state" text-anchor="middle" font-size="17" letter-spacing="1" y="17">' + esc(w[1]) + "</text></g>");
      else o.push('<text class="' + (styl === "zeme" ? "sv-l" : "sv-c") + '"' + (styl === "zeme" ? ' data-map-label="state"' : "") + ' text-anchor="middle" dominant-baseline="middle" font-size="' + (p.velikost || (styl === "zeme" ? 27 : 24)) + '" letter-spacing="1" transform="translate(' + x + "," + y + ") rotate(" + rot + ')">' + esc(styl === "zeme" ? m.nazev : m.nazev) + "</text>");
    });
    (M.mista || []).forEach(function (m) {
      if (m.typ !== "mesto" || m.popisek || !m.nazev || /^(Hrad na|Opevněné|Sídlo|Nové místo)/.test(m.nazev)) return;
      o.push('<text class="sv-c" data-city-label="1" text-anchor="middle" font-size="15" letter-spacing="1" x="' + m.x + '" y="' + (m.y + 20) + '">' + esc(m.nazev) + "</text>");
    });
    var KM = D.km_px || 1.75, sx = 1560, sy = 1405, dil = 150 / KM;
    o.push('<g font-family="MFell,serif" font-size="13" fill="#3a2412">');
    for (var di = 0; di < 4; di++) o.push('<rect x="' + (sx + di * dil).toFixed(1) + '" y="' + sy + '" width="' + dil.toFixed(1) + '" height="6" fill="' + (di % 2 ? "#f3e6c4" : "#3a2412") + '" stroke="#3a2412" stroke-width=".8"/><text x="' + (sx + (di + 1) * dil).toFixed(1) + '" y="' + (sy - 5) + '" text-anchor="middle">' + (150 * (di + 1)) + '</text>');
    o.push('<text x="' + sx + '" y="' + (sy - 5) + '" text-anchor="middle">0</text><text x="' + (sx + 2 * dil) + '" y="' + (sy + 22) + '" text-anchor="middle" font-style="italic">km</text></g>');
    var cx = 1935, cy = 1300, rr = 58, rose = "";
    for (var ri = 0; ri < 8; ri++) { var ang = ri * Math.PI / 4, L2 = ri % 2 ? rr * .55 : rr, w2 = ri % 2 ? 6 : 10, ax = Math.sin(ang), ay = -Math.cos(ang), px = Math.cos(ang), py = Math.sin(ang);
      rose += '<path d="M' + cx + "," + cy + " L" + (cx + px * w2).toFixed(1) + "," + (cy + py * w2).toFixed(1) + " L" + (cx + ax * L2).toFixed(1) + "," + (cy + ay * L2).toFixed(1) + 'Z" fill="#3a2412"/><path d="M' + cx + "," + cy + " L" + (cx - px * w2).toFixed(1) + "," + (cy - py * w2).toFixed(1) + " L" + (cx + ax * L2).toFixed(1) + "," + (cy + ay * L2).toFixed(1) + 'Z" fill="#f3e6c4" stroke="#3a2412" stroke-width=".8"/>'; }
    o.push('<g opacity=".9"><circle cx="' + cx + '" cy="' + cy + '" r="' + (rr * .72) + '" fill="none" stroke="#3a2412" stroke-width="1"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (rr * .78) + '" fill="none" stroke="#3a2412" stroke-width=".6"/>' + rose + '<text class="sv-l" x="' + cx + '" y="' + (cy - rr - 6) + '" text-anchor="middle" font-size="18">S</text></g>');
    o.push('<text class="sv-l" text-anchor="middle" font-size="48" letter-spacing="6" x="1810" y="130">Montelien</text>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="' + PAL.grade.parchment + '" opacity="' + PAL.grade.multiply_opacity + '" style="mix-blend-mode:multiply" pointer-events="none"/>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="url(#sv-vin)" pointer-events="none"/>');
    svg.innerHTML = o.join("");
    kresliSprity(svg, sprites, A, W, H, META);
  }

  var IMG = {}, GRADED = {};
  function nacti(src) { if (!IMG[src]) IMG[src] = new Promise(function (ok) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { ok(null); }; i.src = src; }); return IMG[src]; }
  function upravObraz(img, saturation, brightness, grade) {
    saturation = saturation == null ? 1 : saturation; brightness = brightness == null ? 1 : brightness;
    if (saturation === 1 && brightness === 1 && !grade) return img;
    var c = document.createElement("canvas"); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    var g = c.getContext("2d"); g.drawImage(img, 0, 0);
    var px = g.getImageData(0, 0, c.width, c.height), d = px.data;
    var tint = grade && grade.tint ? [1, 3, 5].map(function (i) { return parseInt(grade.tint.slice(i, i + 2), 16); }) : null;
    for (var j = 0; j < d.length; j += 4) {
      var l = .3 * d[j] + .59 * d[j + 1] + .11 * d[j + 2], r = (l + (d[j] - l) * saturation) * brightness, gg = (l + (d[j + 1] - l) * saturation) * brightness, b = (l + (d[j + 2] - l) * saturation) * brightness;
      if (tint) {
        var opacity = grade.tint_opacity || 0;
        if (grade.preserve_highlights) { var hi = Math.max(0, Math.min(1, (l - grade.highlight_luminance) / (255 - grade.highlight_luminance))); opacity *= 1 - hi * hi * (3 - 2 * hi); }
        r = r * (1 - opacity) + tint[0] * opacity; gg = gg * (1 - opacity) + tint[1] * opacity; b = b * (1 - opacity) + tint[2] * opacity;
      }
      d[j] = r; d[j + 1] = gg; d[j + 2] = b;
    }
    g.putImageData(px, 0, 0); return c;
  }
  function pripravenySprite(name, A, tmavy) {
    var key = A + name;
    if (!GRADED[key]) GRADED[key] = nacti(key + ".webp").then(function (img) {
      if (!img) return null;
      var filters = (window.SVET_PALETA || {}).sprite_filters || {}, f = null, grade = null;
      if (/^(hora|masiv|skala|hreben|utes)/.test(name)) { f = [filters.mountain_saturation, filters.mountain_brightness]; grade = { tint: filters.mountain_tint, tint_opacity: filters.mountain_tint_opacity, preserve_highlights: true, highlight_luminance: filters.snow_highlight_luminance }; }
      else if (/^kopec/.test(name)) { f = [filters.hill_saturation, filters.hill_brightness]; grade = { tint: filters.hill_tint, tint_opacity: filters.hill_tint_opacity }; }
      else if (/^duna/.test(name)) { f = [filters.dune_saturation, filters.dune_brightness]; grade = { tint: filters.dune_tint, tint_opacity: filters.dune_tint_opacity }; }
      else if (/^kaktus/.test(name)) f = [filters.cactus_saturation, filters.cactus_brightness];
      else if (/^sucha/.test(name)) f = [filters.dry_grass_saturation, filters.dry_grass_brightness];
      else if (/^podzim/.test(name)) f = [filters.autumn_saturation, filters.autumn_brightness];
      else if (/^(kvety|maky)/.test(name)) f = [filters.flower_saturation, filters.flower_brightness];
      else if (name === "kostka") { f = [filters.artifact_saturation, filters.artifact_brightness]; grade = { tint: filters.artifact_tint, tint_opacity: filters.artifact_tint_opacity }; }
      if (f) img = upravObraz(img, f[0], f[1], grade);
      return upravObraz(img, ((window.SVET_PALETA || {}).grade || {}).sprite_saturation, 1);
    });
    if (!tmavy) return GRADED[key];
    if (!GRADED[key + "#tmavy"]) GRADED[key + "#tmavy"] = GRADED[key].then(function (img) { return img && upravObraz(img, .65, .58); });
    return GRADED[key + "#tmavy"];
  }
  function indexSprity(state) {
    var cell = state.gridSize, grid = Object.create(null);
    state.sprites.forEach(function (s, i) {
      var m = state.meta[s.n]; if (!m) return;
      var k = s.w / m.w, rw = Math.abs(s.w), rh = m.h * k, r = Math.hypot(rw, rh) / 2 + 3;
      var x0 = Math.floor((s.x - r) / cell), x1 = Math.floor((s.x + r) / cell);
      var y0 = Math.floor((s.y - rh / 2 - r) / cell), y1 = Math.floor((s.y - rh / 2 + r) / cell);
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
        var key = x + "," + y; (grid[key] || (grid[key] = [])).push(i);
      }
    });
    state.grid = grid;
  }
  function prekresli(state) {
    var map = state.map, bounds = map && map.getBounds ? map.getBounds() : null;
    var left = bounds ? bounds.getWest() : 0, right = bounds ? bounds.getEast() : state.W;
    var top = bounds ? state.H - bounds.getNorth() : 0, bottom = bounds ? state.H - bounds.getSouth() : state.H;
    var margin = (window.SVET_PALETA.viewport_sprites || {}).margin_ratio || .22;
    var mx = (right - left) * margin, my = (bottom - top) * margin;
    left = Math.max(0, left - mx); right = Math.min(state.W, right + mx);
    top = Math.max(0, top - my); bottom = Math.min(state.H, bottom + my);
    var fo = state.svg.querySelector("#sv-spr"), canvas = fo && fo.querySelector("canvas");
    if (!canvas || right <= left || bottom <= top) return;
    fo.setAttribute("x", left); fo.setAttribute("y", top);
    fo.setAttribute("width", right - left); fo.setAttribute("height", bottom - top);
    var scale = map && map.getZoomScale ? map.getZoomScale(map.getZoom(), 0) : 1, dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.ceil((right - left) * scale * dpr));
    canvas.height = Math.max(1, Math.ceil((bottom - top) * scale * dpr));
    var ctx = canvas.getContext("2d"), pixelScale = scale * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(pixelScale, 0, 0, pixelScale, -left * pixelScale, -top * pixelScale);
    ctx.imageSmoothingQuality = "high";
    var cell = state.gridSize, seen = Object.create(null), visible = [];
    for (var cy = Math.floor(top / cell); cy <= Math.floor(bottom / cell); cy++) for (var cx = Math.floor(left / cell); cx <= Math.floor(right / cell); cx++) {
      (state.grid[cx + "," + cy] || []).forEach(function (i) { if (!seen[i]) { seen[i] = true; visible.push(i); } });
    }
    var scaleNow = Math.max(.25, scale), line = 1 / scaleNow;
    var vectors = (window.SVET_PALETA || {}).terrain_vectors || {};
    (state.areas || []).forEach(function (area, index) {
      if (area.typ !== "ledovec" && area.typ !== "poust") return;
      var pts = area.body || [];
      if (pts.length < 3) return;
      var minX = Math.min.apply(null, pts.map(function (p) { return p[0]; })), maxX = Math.max.apply(null, pts.map(function (p) { return p[0]; }));
      var minY = Math.min.apply(null, pts.map(function (p) { return p[1]; })), maxY = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
      if (maxX < left || minX > right || maxY < top || minY > bottom) return;
      var drawMinX = Math.max(minX, left), drawMaxX = Math.min(maxX, right);
      var drawMinY = Math.max(minY, top), drawMaxY = Math.min(maxY, bottom);
      ctx.save(); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      pts.slice(1).forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.closePath();
      if (area.typ === "ledovec") {
        ctx.lineWidth = 2 / scaleNow; ctx.strokeStyle = vectors.glacier_outline_shadow || "rgba(54,81,94,.55)"; ctx.stroke();
        ctx.lineWidth = .75 / scaleNow; ctx.strokeStyle = vectors.glacier_outline || "rgba(135,164,178,.9)"; ctx.stroke();
      }
      ctx.clip();
      ctx.lineWidth = line;
      if (area.typ === "ledovec") {
        var flowCenter = polygonCenter(pts), centerX = flowCenter.x, centerY = flowCenter.y;
        var coastward = nearestShore(centerX, centerY, state.shore), vx = coastward.x - centerX, vy = coastward.y - centerY;
        var directionLength = Math.hypot(vx, vy) || 1; vx /= directionLength; vy /= directionLength;
        var clusterCount = Math.max(1, Math.min(3, Math.ceil((maxX - minX) / 60)));
        var bandCount = Math.max(2, Math.min(5, vectors.glacier_flow_count || 3));
        var spread = Math.min(32, Math.max(12, (maxX - minX) * .18));
        var flowRng = rng(617 + index * 9973), crackRng = rng(7919 + index * 104729);
        var hollow = vectors.glacier_hollow || "rgba(57,90,106,.1)";
        var crackLength = (vectors.glacier_crevasse_length || 13) / scaleNow;
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (var cluster = 0; cluster < clusterCount; cluster++) {
          var position = clusterCount === 1 ? 0 : cluster / (clusterCount - 1) * 2 - 1;
          var anchorX = centerX - vx * spread * position, anchorY = centerY - vy * spread * position;
          if (!inPoly(anchorX, anchorY, pts)) continue;
          var shore = nearestShore(anchorX, anchorY, state.shore), fx = shore.x - anchorX, fy = shore.y - anchorY;
          var flowNorm = Math.hypot(fx, fy) || 1; fx /= flowNorm; fy /= flowNorm;
          var fpx = -fy, fpy = fx;
          var flowLength = Math.min(vectors.glacier_flow_length || 48, Math.max(22, shore.d * scaleNow * .42)) / scaleNow;
          var phase = flowRng() * Math.PI * 2;
          for (var band = 0; band < bandCount; band++) {
            var offset = (band - (bandCount - 1) / 2) * 14 / scaleNow, points = [];
            for (var step = 0; step <= 8; step++) {
              var t = step / 8, wave = Math.sin(t * Math.PI * 2 + band * 1.31 + cluster * .73 + phase) * 3.5 / scaleNow * (1 - t);
              points.push([
                anchorX - fx * flowLength * .38 + fx * flowLength * t + fpx * (offset * (1 - .84 * t) + wave),
                anchorY - fy * flowLength * .38 + fy * flowLength * t + fpy * (offset * (1 - .84 * t) + wave)
              ]);
            }
            for (var seg = 0; seg < points.length - 1; seg++) {
              ctx.globalAlpha = Math.sin(Math.PI * (seg + .5) / (points.length - 1)) * .95;
              ctx.beginPath(); ctx.moveTo(points[seg][0], points[seg][1]); ctx.lineTo(points[seg + 1][0], points[seg + 1][1]);
              ctx.strokeStyle = hollow; ctx.lineWidth = 6 / scaleNow; ctx.stroke();
              ctx.strokeStyle = vectors.glacier_flow || "rgba(84,117,133,.25)"; ctx.lineWidth = 2 / scaleNow; ctx.stroke();
            }
          }
          ctx.globalAlpha = .85;
          ctx.strokeStyle = vectors.glacier_crevasse || "rgba(57,90,106,.48)"; ctx.lineWidth = 1.2 / scaleNow;
          var crackX = anchorX + fx * flowLength * .76, crackY = anchorY + fy * flowLength * .76;
          for (var ci = 0; ci < 3; ci++) {
            var cx = crackX + fpx * (crackRng() - .5) * 14 / scaleNow, cy = crackY + fpy * (crackRng() - .5) * 14 / scaleNow;
            var angle = Math.atan2(fy, fx) + Math.PI / 2 + (crackRng() - .5) * .55;
            var dx = Math.cos(angle) * crackLength, dy = Math.sin(angle) * crackLength;
            var ex = cx + dx, ey = cy + dy;
            if (!inPoly(cx, cy, pts) || !inPoly(ex, ey, pts)) continue;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * .55 + fpx * crackLength * .12, cy + dy * .55 + fpy * crackLength * .12); ctx.lineTo(ex, ey); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.strokeStyle = vectors.sand_ripple || "rgba(126,96,52,.5)";
        ctx.beginPath();
        for (var sy = drawMinY; sy <= drawMaxY; sy += Math.max(8, (vectors.sand_band_spacing || 34) / scaleNow)) {
          ctx.moveTo(drawMinX, sy + Math.sin(sy * .035 + index) * 4);
          for (var sx = drawMinX + 8; sx <= drawMaxX; sx += 8) ctx.lineTo(sx, sy + Math.sin(sx * .025 + sy * .04 + index) * 4);
        }
        ctx.stroke();
        ctx.strokeStyle = vectors.sand_highlight || "rgba(244,224,182,.4)";
        ctx.lineWidth = .6 / scaleNow; ctx.beginPath();
        for (var hy = drawMinY + 12 / scaleNow; hy <= drawMaxY; hy += Math.max(8, (vectors.sand_band_spacing || 34) / scaleNow) * 2) {
          ctx.moveTo(drawMinX, hy + Math.sin(hy * .035 + index + .8) * 3);
          for (var hx = drawMinX + 10; hx <= drawMaxX; hx += 10) ctx.lineTo(hx, hy + Math.sin(hx * .023 + hy * .032 + index + .8) * 3);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
    visible.sort(function (a, b) { return a - b; });
    visible.forEach(function (i) {
      var s = state.sprites[i], img = state.images[s.n + (s.tmavy ? "#tmavy" : "")], m = state.meta[s.n];
      if (!img || !m || s.x < left - s.w || s.x > right + s.w || s.y < top - m.h * s.w / m.w || s.y > bottom + m.h * s.w / m.w) return;
      var k = s.w / m.w;
      ctx.save(); ctx.translate(s.x, s.y); if (s.r) ctx.rotate(s.r * Math.PI / 180); ctx.scale(s.f ? -k : k, k);
      ctx.drawImage(img, -m.w / 2, -m.h + 2, m.w, m.h); ctx.restore();
    });
  }
  function kresliSprity(svg, sprites, A, W, H, META) {
    var state = svg._svSpriteState;
    if (!state) {
      state = svg._svSpriteState = { svg: svg, map: window.MontelienMapa, gridSize: 128, images: {}, grid: {} };
      state.schedule = function () {
        if (state.frame) return;
        state.frame = requestAnimationFrame(function () { state.frame = 0; prekresli(state); });
      };
      if (state.map && state.map.on) state.map.on("moveend zoomend resize", state.schedule);
    }
    state.token = (state.token || 0) + 1;
    var token = state.token, config = (window.SVET_PALETA || {}).viewport_sprites || {};
    state.sprites = sprites; state.meta = META; state.W = W; state.H = H;
    state.areas = svg._svAreas || []; state.shore = svg._svShore || [];
    state.gridSize = config.grid_px || 128; state.map = window.MontelienMapa || state.map;
    state.svg = svg; indexSprity(state);
    var needed = Object.create(null);
    sprites.forEach(function (s) { needed[s.n] = 1; if (s.tmavy) needed[s.n + "#tmavy"] = 1; });
    var keys = Object.keys(needed);
    Promise.all(keys.map(function (key) {
      var dark = key.slice(-6) === "#tmavy", name = dark ? key.slice(0, -6) : key;
      return pripravenySprite(name, A, dark).then(function (img) { return [key, img]; });
    })).then(function (images) {
      if (state.token !== token) return;
      state.images = {};
      images.forEach(function (entry) { state.images[entry[0]] = entry[1]; });
      state.schedule();
    });
  }

  // ---------------- editor ----------------
  var VRSTVY = { pevnina: "Pobřeží a jezera", oblasti: "Oblasti (les, hory…)", reky: "Řeky", cesty: "Cesty", hranice: "Hranice", hradby: "Hradby", utesy: "Útesy", symboly: "Symboly", popisky: "Popisky a místa" };
  function editor(ctx) {
    var map = ctx.map, H = ctx.D.vyska, D = JSON.parse(JSON.stringify(ctx.D)), M = JSON.parse(JSON.stringify(ctx.M)), grp = L.featureGroup().addTo(map), vr = "oblasti", dirty = false, typ = "les", sym = "hora";
    var ll = function (p) { return [H - p[1], p[0]]; }, pt = function (l) { return [Math.round(l.lng), Math.round(H - l.lat)]; };
    var OBL = window.SVET_OBLASTI, SYM = {};
    Object.keys(window.SVET_SPRITY || {}).forEach(function (k) { SYM[k] = window.SVET_SPRITY[k]; });
    Object.keys(window.SVET_SYMBOLY || {}).forEach(function (k) { if (!SYM[k]) SYM[k] = { nazev: window.SVET_SYMBOLY[k].nazev + " (kresba)" }; });
    var panel = document.createElement("div"); panel.className = "sv-ed";
    ctx.el.parentNode.insertBefore(panel, ctx.el);
    var rt; function rerender() { clearTimeout(rt); rt = setTimeout(function () { render(ctx.svg, D, M, ctx.base); }, 250); }
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
      else if (vr === "reky" || vr === "cesty" || vr === "hranice" || vr === "hradby" || vr === "utesy") arr.forEach(function (o) { var lay = L.polyline(o.body.map(ll), { color: "#c0392b", weight: 4 }); lay._sv = { kind: "line", obj: o, arr: arr }; hook(lay); });
      else if (vr === "symboly") arr.forEach(function (o) { var lay = L.marker(ll([o.x, o.y]), { draggable: true, icon: L.divIcon({ className: "sv-h", html: "✥", iconSize: [18, 18] }) }); lay.bindTooltip((SYM[o.typ] || {}).nazev || o.typ); lay._sv = { kind: "sym", obj: o, arr: arr }; hook(lay); });
      else if (vr === "popisky") M.mista.forEach(function (o) {
        var m = L.marker(ll([o.x, o.y]), { draggable: true, icon: L.divIcon({ className: "sv-h sv-hm", html: "●", iconSize: [12, 12] }) }); m.bindTooltip(o.nazev); m._sv = { kind: "misto", obj: o, arr: M.mista }; hook(m);
        if (o.popisek) { var p = L.marker(ll([o.x + (o.popisek.dx || 0), o.y + (o.popisek.dy || 0)]), { draggable: true, icon: L.divIcon({ className: "sv-h sv-hp", html: "T", iconSize: [18, 18] }) }); p.bindTooltip("popisek: " + o.nazev); p._sv = { kind: "pop", obj: o, arr: M.mista }; hook(p); }
      });
      var line = vr === "reky" || vr === "cesty" || vr === "hranice" || vr === "hradby" || vr === "utesy", poly = vr === "pevnina" || vr === "oblasti";
      map.pm.addControls({ position: "topleft", drawMarker: vr === "symboly" || vr === "popisky", drawPolygon: poly, drawPolyline: line, drawCircle: false, drawCircleMarker: false, drawRectangle: false, drawText: false, cutPolygon: false, rotateMode: false, editMode: false, dragMode: true, removalMode: vr !== "popisky" });
      panel.querySelector(".sv-props").innerHTML = '<span class="sv-tip">' + (poly ? "Klikni na tvar = upravit body (táhni body, klik na střed hrany přidá bod, pravý klik bod smaže). Nový tvar: ⬠ vlevo." : line ? "Klikni na čáru = upravit body. Nová čára: ╱ vlevo, dvojklik ukončí." : "Táhni značky. Nový: 📍 vlevo, pak vyber typ.") + "</span>";
    }
    map.on("pm:create", function (e) {
      var lay = e.layer, o; map.removeLayer(lay);
      if (vr === "pevnina") o = { typ: "pevnina", uroven: 0, body: lay.getLatLngs()[0].map(pt) };
      else if (vr === "oblasti") o = { typ: typ, body: lay.getLatLngs()[0].map(pt) };
      else if (vr === "symboly") { var q = pt(lay.getLatLng()); o = { typ: sym, x: q[0], y: q[1], m: 1 }; }
      else if (vr === "popisky") { var q2 = pt(lay.getLatLng()), n = prompt("Název nového místa"); if (!n) return; M.mista.push({ nazev: n, x: q2[0], y: q2[1], typ: "misto", jistota: "odhad", odkaz: "11_Mapy/Analyza_mapy.md", pozn: "" }); mark(); load(); return; }
      else o = { typ: vr === "reky" ? "reka" : vr === "cesty" ? "cesta" : vr === "hradby" ? "hradba" : vr === "utesy" ? "utes" : "hranice", body: lay.getLatLngs().map(pt) };
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
