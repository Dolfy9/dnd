import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { get, post, put, del } from "../api";
import { useApp, isEditor } from "../store";
import { toast, confirmDialog } from "../components/ui";
import { Layers, Map as MapIcon, MapPinPlus, PencilLine, Plus, Ruler, Search } from "lucide-react";
import EntityPicker from "../components/EntityPicker";

declare global { interface Window { L?: any; MontelienSvet?: any; MontelienMapa?: any; MontelienEditor?: any; SVET_PALETA?: any; MONTELIEN_HERALDIKA?: any; } }

// svet.js i leaflet-geoman.js používají globální L (v bundlu neexistuje)
window.L = L;

const REPO = "/repo/";
const WEB = "/repo/web/";
const KM_PX = 1.7;
const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const HER_IDS: Record<string, string> = {
  "Nölien": "nolien", "Briria": "briria", "Nöet": "noet", "Khearaz": "khearaz",
  "Khärghe Zhia": "kharghe", "Knärghe Zhia": "knarghe", "Mönohen": "monohen",
  "Orden": "orden", "Laertmund": "laertmund", "Tali": "tali", "Zairam": "zairam",
  "Svobodné Jižní ostrovy": "ostrovy", "Dräar": "draar", "Divoký Sever": "divoky_sever",
  "Banerbo": "banerbo", "Imatoma": "imatoma",
};

function herPath(item: any, kind: string) {
  if (!item?.soubor) return "";
  const dir = item.soubor.substring(0, item.soubor.lastIndexOf("/") + 1) + "obrazky/";
  return REPO + dir + (kind === "vlajka" ? "Vlajka_" : "Znak_") + item.id + ".webp";
}

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error(src));
    document.head.appendChild(s);
  });
}

export default function Mapa() {
  const [params, setParams] = useSearchParams();
  const { user } = useApp();
  const editor = isEditor(user);
  const crop = params.get("vyrez") === "1";
  const cropState = crop && params.get("typ") === "zeme";
  const mapId = params.get("mapa") || "montelien";
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [merOn, setMerOn] = useState(false);
  const [stitky, setStitky] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [addMode, setAddMode] = useState(false);
  const addModeRef = useRef(false);
  addModeRef.current = addMode;
  const [placeForm, setPlaceForm] = useState<any>(null);
  const [mapList, setMapList] = useState<any[]>([]);
  const [newMap, setNewMap] = useState(false);
  const [editOn, setEditOn] = useState(false);
  const [baseNames, setBaseNames] = useState<string[]>([]);
  const [baseName, setBaseName] = useState("Atlas (z dat)");
  const [prekryv, setPrekryv] = useState(0);
  const [prekryvOK, setPrekryvOK] = useState(false);
  const [vis, setVis] = useState<Record<string, boolean>>({ uzemi: true, hranice: true, mista: true, popisky: true, boje: true });
  const [stavy, setStavy] = useState<{ nazev: string; color: string; navrh: boolean }[]>([]);
  const [vrstvyOn, setVrstvyOn] = useState(false);
  const [stavyOn, setStavyOn] = useState(false);
  const byName = useRef<Record<string, { m: any; c: L.CircleMarker }>>({});
  const mapData = useRef<any>(null);
  const mer = useRef<any>({ start: null as any, stop: null as any, pts: [], line: null, lab: null }).current as any;
  const stitkyRef = useRef(false);
  stitkyRef.current = stitky;

  const openPlace = useCallback((m: any) => setSel(m), []);

  useEffect(() => {
    let dead = false;
    const el = ref.current;
    if (!el || mapRef.current) return;

    (async () => {
      const [M, pal, her, list] = await Promise.all([
        get<any>(`/api/map/data?mapa=${encodeURIComponent(mapId)}`),
        fetch(WEB + "assets/svet/paleta.json").then((r) => r.json()).catch(() => ({})),
        fetch(REPO + "web/docs/heraldika_index.json").then((r) => r.json()).catch(() => ({})),
        get<{ mapy: any[] }>("/api/map/list").catch(() => ({ mapy: [] })),
      ]);
      if (!dead) setMapList(list.mapy || []);
      const assetV = "?t=" + Math.floor(Date.now() / 60000);
      await loadScript(WEB + "assets/svet_symboly.js" + assetV);
      await loadScript(WEB + "assets/svet/sprity.js" + assetV);
      window.SVET_PALETA = pal;
      window.MONTELIEN_HERALDIKA = her;
      await loadScript(WEB + "assets/svet.js" + assetV);
      // leaflet-geoman musí být načtený PŘED vznikem mapy (initHook přidá map.pm)
      if (editor) await loadScript(WEB + "assets/leaflet/leaflet-geoman.min.js").catch(() => {});
      if (dead) return;

      mapData.current = M;
      const D = { sirka: M.sirka, vyska: M.vyska, ...M.svet };
      const W = D.sirka, H = D.vyska, bounds: L.LatLngBoundsExpression = [[0, 0], [H, W]];
      const map = L.map(el, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 2.5, zoomSnap: 0.05, attributionControl: false });
      mapRef.current = map;
      window.MontelienMapa = map;

      // --- vrstvy podkladu (z registru mapy) ---
      const baseDir = mapId === "montelien" ? REPO + "11_Mapy/" : REPO + `11_Mapy/mapy/${mapId}/`;
      const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const atlas = L.svgOverlay(svgEl, bounds, { interactive: false });
      const vrstvy: Record<string, L.Layer> = { "Atlas (z dat)": atlas };
      const PODK_TITUL: [RegExp, string][] = [
        [/ilustrovan/i, "Ilustrovaná mapa"], [/vyrovnana|kresba/i, "Původní kresba (DM)"],
        [/foto|satelit/i, "Fotomapa"], [/^(?!.*ilustrovan)mapa/i, "Barevná mapa"],
      ];
      const imgV = `?t=${Math.floor(Date.now() / 60000)}`; // cache-bust po překreslení
      (M.podklady || []).forEach((p: any) => {
        const t = PODK_TITUL.find(([re]) => re.test(p.soubor));
        vrstvy[t ? t[1] : p.nazev] = L.imageOverlay(baseDir + p.soubor + imgV, bounds);
      });
      const pam = localStorage.getItem("mapa-vrstva") || "";
      const baseNames = Object.keys(vrstvy);
      const initialBase = crop ? "Atlas (z dat)" : (vrstvy[pam] ? pam : "Atlas (z dat)");
      (crop ? atlas : vrstvy[initialBase]).addTo(map);
      setBaseNames(baseNames);
      setBaseName(initialBase);
      const setBase = (name: string) => {
        baseNames.forEach((n) => map.removeLayer(vrstvy[n]));
        vrstvy[name].addTo(map);
        localStorage.setItem("mapa-vrstva", name);
        setBaseName(name);
      };
      (el as any)._setBase = setBase;

      // překryv původní kresby DM nad podkladem (jen hlavní mapa)
      const prekryvLayer = mapId === "montelien"
        ? L.imageOverlay(REPO + "11_Mapy/Montelien_mapa_vyrovnana.jpg" + imgV, bounds,
            { opacity: 0, interactive: false }).addTo(map)
        : null;
      const savedPrekryv = Math.max(0, Math.min(1, Number(localStorage.getItem("mapa-prekryv") || 0)));
      if (prekryvLayer) prekryvLayer.setOpacity(savedPrekryv);
      setPrekryv(savedPrekryv);
      setPrekryvOK(!!prekryvLayer);
      (el as any)._setPrekryv = (v: number) => prekryvLayer?.setOpacity(v);

      const LABELS = window.SVET_PALETA?.labels || {};
      const HER = window.MONTELIEN_HERALDIKA || {};

      function refreshLabels() {
        const scale = map.getZoomScale(map.getZoom(), 0), fitZoom = map.getBoundsZoom(bounds as any, false);
        const showDashed = map.getZoom() >= fitZoom + .5;
        const statePx = Math.min(LABELS.state_size_max || 18,
          (LABELS.state_size_fit || 13) + Math.max(0, map.getZoom() - fitZoom) * (LABELS.state_zoom_gain || 1.5));
        const tracking = (LABELS.state_tracking || 1) / scale;
        svgEl.querySelectorAll('[data-map-label="state"]').forEach((l) => {
          l.setAttribute("font-size", String(statePx / scale));
          l.setAttribute("letter-spacing", String(tracking));
        });
        const showCities = map.getZoom() >= (LABELS.city_min_zoom ?? .25);
        const cityFont = Math.min((LABELS.city_size_max || 20) / scale,
          Math.max(LABELS.city_size_base || 20, (LABELS.city_size_min || 13) / scale));
        const cityHalo = Math.max(LABELS.city_halo_min || .5, (LABELS.city_halo_min_screen || 2) / scale);
        svgEl.querySelectorAll("[data-city-label]").forEach((l: any) => {
          l.style.display = showCities ? "" : "none";
          l.setAttribute("font-size", String(cityFont));
          l.setAttribute("stroke-width", cityHalo + "px");
        });
        svgEl.querySelectorAll("[data-map-dashed-border]").forEach((l: any) => {
          l.style.display = showDashed ? "" : "none";
        });
        (el as any)._applyVis?.(); // přebití podle přepínačů viditelnosti
      }

      // --- hover nad státy + heraldika ---
      const stateHighlight = L.layerGroup().addTo(map);
      let stateTip: L.Tooltip | null = null, activeState: any = null, activeLabel: Element | null = null;
      let pinnedState: any = null; // kliknutý stát drží highlight + kartu do kliku na prázdné místo
      let stateData: any[] = [];
      // „body" = hit-test území státu (generované, nekreslí se – _auto_body);
      // „pas" = pásové kruhy hranic → záložní hit-test z vnějších kruhů
      const pasAreas = (z: any): number[][][] => {
        if (Array.isArray(z.body) && z.body.length) return z.body;
        const out: number[][][] = [];
        for (const g of z.pas || []) {
          if (!Array.isArray(g)) continue;
          const ring = typeof g[0]?.[0] === "number" ? g : g[0];
          if (Array.isArray(ring) && ring.length >= 3) out.push(ring as number[][]);
        }
        return out;
      };
      const ringArea = (r: number[][]) => {
        let a = 0;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
        return Math.abs(a / 2);
      };
      const inRing = (x: number, y: number, ring: number[][]) => {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
          if ((ring[i][1] > y) !== (ring[j][1] > y) && x < (ring[j][0] - ring[i][0]) * (y - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
        return inside;
      };
      // plocha území: vnější prsteny − díry (even-odd)
      const stateArea = (z: any) => {
        const rings = pasAreas(z);
        return rings.reduce((s, r, i) => {
          const p = r[0];
          const depth = rings.reduce((d, o, j) => d + (j !== i && inRing(p[0], p[1], o) ? 1 : 0), 0);
          return s + ringArea(r) * (depth % 2 === 0 ? 1 : -1);
        }, 0);
      };
      // barva státu: explicitní barva z dat → paleta podle jména → výchozí odstín
      const ZPAL0 = window.SVET_PALETA?.state_tints || [];
      const ZCOL0 = window.SVET_PALETA?.state_colors || {};
      const stateColor = (z: any) =>
        z.barva || (z.stat === null ? "#838b8f" : (ZCOL0[z.nazev] || ZPAL0[(D.zeme || []).indexOf(z) % ZPAL0.length] || "#777"));
      const shade = (hex: string, f: number) => {
        const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return "#" + n.map((v) => Math.round(v * f).toString(16).padStart(2, "0")).join("");
      };
      const herState = (name: string) => {
        const zeme = HER.zeme || [];
        const id = HER_IDS[name];
        const low = (name || "").toLowerCase();
        const item = zeme.find((r: any) => r.id === id || r.nazev === name)
          || zeme.find((r: any) => r.nazev?.toLowerCase() === low)
          || zeme.find((r: any) => low && (r.nazev?.toLowerCase().includes(low) || low.includes(r.nazev?.toLowerCase() || "")));
        if (!item) return esc(name);
        const hIm = (k: string) => { const p = herPath(item, k); return p ? `<img src="${p}" class="her-${k}" alt="" onerror="this.remove()">` : ""; };
        return `<span class="mapa-heraldika"><span>${hIm("znak")}${hIm("vlajka")}</span><b>${esc(name)}</b></span>`;
      };
      const clearState = () => {
        activeState = null;
        if (activeLabel) (activeLabel as HTMLElement).style.visibility = "";
        activeLabel = null; stateHighlight.clearLayers();
        if (stateTip) { map.removeLayer(stateTip); stateTip = null; }
      };
      const showState = (z: any, latlng: L.LatLng | null, pin = false) => {
        if (activeState === z && !pin) return;
        if (activeLabel) (activeLabel as HTMLElement).style.visibility = "";
        activeLabel = null; activeState = z; stateHighlight.clearLayers();
        // zvýraznění = celé území (body – stejná data jako hit-test,
        // takže svítí přesně stát pod kurzorem; jen výplň, bez obrysu)
        const rings = pasAreas(z);
        const col = stateColor(z);
        if (rings.length) stateHighlight.addLayer(L.polygon(
          rings.map((r) => r.map((p) => [H - p[1], p[0]] as L.LatLngTuple)), {
            interactive: false, fillRule: "evenodd",
            color: shade(col, .55), weight: 2.5, opacity: .95,
            fillColor: col, fillOpacity: pin ? .4 : .28,
          }));
        if (stateTip) { map.removeLayer(stateTip); stateTip = null; }
        const place = M.mista.find((m: any) => m.typ === "zeme" && m.nazev === z.nazev);
        if (place) {
          const labels = Array.from(svgEl.querySelectorAll('[data-map-label="state"]'));
          activeLabel = labels.map((l) => l.parentElement?.tagName.toLowerCase() === "g" ? l.parentElement : l)
            .find((l: any) => {
              const parts = l.matches?.('[data-map-label="state"]') ? [l.textContent.trim()]
                : Array.from(l.querySelectorAll?.('[data-map-label="state"]') || []).map((p: any) => p.textContent.trim());
              return parts.join(" ").toLowerCase() === z.nazev.toLowerCase();
            }) || null;
          if (activeLabel) (activeLabel as HTMLElement).style.visibility = "hidden";
        }
        if (!pin && latlng) {
          stateTip = L.tooltip({ permanent: true, interactive: false, direction: "top", offset: [0, 0], className: "mapa-stav-stitek" })
            .setLatLng(latlng).setContent(herState(z.nazev)).addTo(map);
        }
      };
      // hit-test: even-odd parita přes všechny prsteny státu (díry nesvítí)
      const pickState = (x: number, y: number) =>
        stateData.find((z) => pasAreas(z).reduce((inside, ring) => inside !== inRing(x, y, ring), false));
      map.on("mousemove", (e) => {
        if (crop || !stateData.length || pinnedState) return;
        const found = pickState(e.latlng.lng, H - e.latlng.lat);
        if (found) showState(found, e.latlng); else if (activeState) clearState();
      });
      el.addEventListener("mouseleave", () => { if (!pinnedState) clearState(); });

      // --- atlas render ---
      // menší území (ostrovy, enklávy) mají u hit-testu přednost
      stateData = (D.zeme || []).slice().sort((a: any, b: any) => stateArea(a) - stateArea(b));
      window.MontelienSvet.render(svgEl, D, { sirka: W, vyska: H, mista: M.mista }, WEB);
      refreshLabels();

      // kontext pro editor atlasu (MontelienSvet.editor)
      ["pevnina", "oblasti", "reky", "cesty", "hranice", "hradby", "utesy", "symboly", "zeme"]
        .forEach((k) => { if (!Array.isArray(D[k])) D[k] = []; });
      (el as any)._svetCtx = {
        map, D, M: { _popis: M.popis_mista || "", sirka: W, vyska: H, mista: M.mista_raw || M.mista },
        el, svg: svgEl, base: REPO,
      };

      // --- místa ---
      const MP = window.SVET_PALETA?.markers || {};
      const barvy: Record<string, string> = { mapa: MP.mapa || "#8e4f45", kanon: MP.kanon || "#4f7657", odhad: MP.odhad || "#9a8050" };
      const jistotaText: Record<string, string> = { mapa: "popsáno na mapě DM", kanon: "potvrzeno DM", odhad: "odhad – čeká na potvrzení" };
      const bojMapy = (M.bojove_mapy || []).map((b: any) => b.data || b);
      const bojeU = (m: any) => bojMapy.filter((b: any) => b.misto && b.misto === m.odkaz);
      const body = L.layerGroup(), sidla = L.layerGroup(), bojL = L.layerGroup();
      const mkTooltip = (m: any, c: L.CircleMarker) => c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -8], permanent: stitkyRef.current });
      (M.mista || []).forEach((m: any) => {
        const atlasSprite = m.typ === "mesto" || m.typ === "sidlo" || m.typ === "zeme";
        const c = L.circleMarker([H - m.y, m.x], {
          radius: atlasSprite ? 9 : (MP.radius || 5),
          color: MP.stroke || "#241c10", weight: MP.stroke_width || 1.6,
          opacity: atlasSprite ? 0 : 1,
          fillColor: barvy[m.jistota] || "#777", fillOpacity: atlasSprite ? 0 : .95,
          className: "mapa-marker",
        });
        mkTooltip(m, c);
        c.on("mouseover", () => atlasSprite
          ? c.setStyle({ opacity: .95, fillOpacity: .18, fillColor: "#fff1a0", radius: 10 })
          : c.setStyle({ radius: 7 }));
        c.on("mouseout", () => atlasSprite
          ? c.setStyle({ opacity: 0, fillOpacity: 0, radius: 9 })
          : c.setStyle({ radius: 5 }));
        c.on("click", () => openPlace(m));
        if (m.typ === "sidlo") sidla.addLayer(c); else body.addLayer(c);
        byName.current[m.nazev.toLowerCase()] = { m, c };
        if (bojeU(m).length) {
          bojL.addLayer(L.marker([H - m.y, m.x], { icon: L.divIcon({ className: "mapa-boj", html: "⚔", iconSize: [18, 18], iconAnchor: [-12, 6] }), interactive: false }));
        }
      });
      if (!crop) { map.addLayer(body); bojL.addTo(map); }

      // --- viditelnost vrstev atlasu (území / hranice / místa / popisky / boje) ---
      const applyVis = (v: Record<string, boolean>) => {
        svgEl.querySelectorAll('[data-sv-layer="zeme"]').forEach((g: any) => { g.style.display = v.uzemi ? "" : "none"; });
        svgEl.querySelectorAll('[data-sv-layer="hranice"]').forEach((g: any) => { g.style.display = v.hranice ? "" : "none"; });
        svgEl.querySelectorAll('[data-map-label], [data-city-label]').forEach((l: any) => { l.style.display = v.popisky ? "" : "none"; });
        if (v.mista) { map.addLayer(body); map.addLayer(sidla); } else { map.removeLayer(body); map.removeLayer(sidla); }
        if (v.boje) map.addLayer(bojL); else map.removeLayer(bojL);
      };
      const vis0 = { uzemi: true, hranice: true, mista: true, popisky: true, boje: true,
        ...JSON.parse(localStorage.getItem("mapa-viditelnost") || "{}") };
      let visCur = vis0;
      setVis(vis0);
      applyVis(vis0);
      (el as any)._applyVis = () => applyVis(visCur);
      (el as any)._setVis = (key: string, on: boolean) => {
        visCur = { ...visCur, [key]: on };
        localStorage.setItem("mapa-viditelnost", JSON.stringify(visCur));
        applyVis(visCur);
        setVis(visCur);
      };
      // --- seznam států pro legendu + interakce ---
      setStavy(stateData.map((z) => ({
        nazev: z.nazev, navrh: z._uzemi === "navrh", color: stateColor(z),
      })).sort((a, b) => a.nazev.localeCompare(b.nazev, "cs")));
      (el as any)._ukazStat = (nazev: string, pin: boolean) => {
        const z = stateData.find((s) => s.nazev === nazev);
        if (!z) return;
        if (pin) pinnedState = z;
        showState(z, null, pin);
      };
      (el as any)._skryjStat = () => { if (!pinnedState) clearState(); };
      (el as any)._zamerStat = (nazev: string) => {
        const z = stateData.find((s) => s.nazev === nazev);
        if (!z) return;
        const pts: L.LatLngTuple[] = [];
        pasAreas(z).forEach((ring) => ring.forEach((p) => pts.push([H - p[1], p[0]])));
        if (pts.length) map.fitBounds(L.latLngBounds(pts).pad(.12));
        pinnedState = z;
        showState(z, null, true);
        const place = M.mista.find((m: any) => m.typ === "zeme" && m.nazev === nazev);
        if (place) openPlace(place);
      };

      // --- souřadnice + měření ---
      const coord = document.createElement("div");
      coord.className = "mapa-souradnice"; el.appendChild(coord);
      map.on("click", (e) => {
        const cx = Math.round(e.latlng.lng), cy = Math.round(H - e.latlng.lat);
        coord.textContent = `x ${cx}, y ${cy}`;
        if (addModeRef.current) {
          setPlaceForm({ mode: "new", nazev: "", x: cx, y: cy, typ: "misto", jistota: "odhad", odkaz: "", pozn: "", popisek: {} });
          return;
        }
        if (!mer.line) {
          // klik na stát → přišpendlený highlight + karta vlevo; klik na prázdné → zrušit
          const found = !crop && pickState(cx, cy);
          if (found) {
            pinnedState = found;
            showState(found, null, true);
            const place = M.mista.find((m: any) => m.typ === "zeme" && m.nazev === found.nazev);
            if (place) openPlace(place);
          } else {
            pinnedState = null;
            clearState();
            setSel(null);
          }
          return;
        }
        mer.pts.push(e.latlng);
        mer.line.setLatLngs(mer.pts);
        if (mer.pts.length > 1) {
          const km = mer.pts.reduce((s: number, p: any, i: number) =>
            i ? s + Math.hypot(p.lng - mer.pts[i - 1].lng, p.lat - mer.pts[i - 1].lat) * KM_PX : 0, 0);
          const mi = km / 1.609, d = (x: number) => (mi / x).toFixed(1);
          if (mer.lab) map.removeLayer(mer.lab);
          mer.lab = L.marker(e.latlng, { opacity: 0 }).addTo(map)
            .bindTooltip(`<b>${Math.round(km)} km</b> (${Math.round(mi)} mil) · pěšky: Normal ${d(24)} dne, Fast ${d(30)}, Slow ${d(18)}<br><small>klik = další bod · tlačítko = konec</small>`,
              { permanent: true, className: "mapa-stitek", direction: "right" });
        }
      });
      mer.start = () => {
        mer.pts = [];
        mer.line = L.polyline([], { color: "#7a1f12", weight: 3, dashArray: "6 6" }).addTo(map);
        mer.lab = null;
        el.style.cursor = "crosshair";
      };
      mer.stop = () => {
        if (mer.line) map.removeLayer(mer.line);
        if (mer.lab) map.removeLayer(mer.lab);
        mer.pts = []; mer.line = null; mer.lab = null;
        el.style.cursor = "";
      };

      // --- fit + zoom handlers ---
      const fitAtlas = () => {
        map.invalidateSize({ pan: false });
        const fitZoom = Math.log2(Math.min(el.clientWidth / W, el.clientHeight / H));
        map.setMinZoom(Math.min(-1.5, fitZoom - .1));
        // na portrait displejích přizpůsobíme šířce a lehce přiblížíme —
        // mapa je čitelnější a panuje se (fit-bounds by ji na vysokém displeji zmenšil)
        if (el.clientHeight > el.clientWidth) {
          map.setView([H / 2, W / 2], Math.log2(el.clientWidth / W) + 0.35, { animate: false });
        } else {
          map.fitBounds(bounds, { padding: [0, 0], animate: false });
        }
        refreshLabels();
      };
      map.on("zoomend", refreshLabels);
      const onResize = () => fitAtlas();
      window.addEventListener("resize", onResize);
      requestAnimationFrame(fitAtlas);
      map.setMaxBounds([[-200, -200], [H + 200, W + 200]]);

      // --- hledání / deep link ---
      const najdi = (q: string) => {
        const key = q.toLowerCase();
        let x = byName.current[key] || byName.current[Object.keys(byName.current).find((n) => n.includes(key)) || ""];
        if (!x) return;
        if (crop && x.m.typ === "zeme") {
          const state = stateData.find((z) => z.nazev === x.m.nazev);
          if (state) {
            const pts: L.LatLngTuple[] = [];
            pasAreas(state).forEach((ring) => ring.forEach((p) => pts.push([H - p[1], p[0]])));
            if (pts.length) {
              map.fitBounds(L.latLngBounds(pts).pad(.16), { padding: [18, 18], animate: false });
              // výřez: zeslabit okolí (maska mimo území) a zvýraznit hranici státu
              const rect: L.LatLngTuple[] = [[0, 0], [0, W], [H, W], [H, 0]];
              const rings = pasAreas(state).map((r) => r.map((p) => [H - p[1], p[0]] as L.LatLngTuple));
              stateHighlight.clearLayers();
              stateHighlight.addLayer(L.polygon([rect, ...rings], {
                interactive: false, fillRule: "evenodd", stroke: false,
                fillColor: "#17120c", fillOpacity: .45,
              }));
              const col = stateColor(state);
              stateHighlight.addLayer(L.polygon(rings, {
                interactive: false, fillRule: "evenodd",
                color: shade(col, .55), weight: 2.5, opacity: .95,
                fillColor: col, fillOpacity: .22,
              }));
            }
            return;
          }
        }
        if (x.m.typ === "sidlo") map.addLayer(sidla); else map.addLayer(body);
        map.flyTo([H - x.m.y, x.m.x], crop ? .35 : 1, { duration: .5 });
        openPlace(x.m);
      };
      (el as any)._najdi = najdi;
      const q0 = params.get("misto");
      if (q0) setTimeout(() => najdi(q0), 400);
      setReady(true);
    })().catch((e) => setErr(String(e)));

    return () => {
      dead = true; mapRef.current?.remove(); mapRef.current = null;
      el.parentElement?.querySelectorAll(".sv-ed").forEach((p) => p.remove());
      setEditOn(false);
    };
  }, [mapId]); // eslint-disable-line

  const doSearch = (v: string) => { setSearchQ(v); setSuggOn(false); const el = ref.current as any; el?._najdi?.(v); };
  const [suggOn, setSuggOn] = useState(false);
  const suggestions = searchQ.trim()
    ? Object.keys(byName.current).filter((n) => n.includes(searchQ.trim().toLowerCase())).slice(0, 8)
    : [];

  const startEditor = async () => {
    const el = ref.current as any;
    const ctx = el?._svetCtx;
    const map = mapRef.current;
    if (!ctx || !map) return;
    if (!(map as any).pm) {
      setErr("Editor se nenačetl – zkontroluj, že se načetl leaflet-geoman (obnov stránku).");
      return;
    }
    if (!document.getElementById("geoman-css")) {
      const l = document.createElement("link");
      l.id = "geoman-css"; l.rel = "stylesheet";
      l.href = WEB + "assets/leaflet/leaflet-geoman.css";
      document.head.appendChild(l);
    }
    window.MontelienEditor = {
      api: (_m: string, _action: string, body: any) =>
        put("/api/map/soubor", { mapa: mapId, soubor: body.cesta, obsah: body.obsah }),
    };
    setEditOn(true);
    window.MontelienSvet.editor(ctx);
  };

  return (
    <div className="h-full flex flex-col relative">
      {!crop && (
        <div className="mapa-toolbar flex items-center gap-2 px-3 py-1.5 border-b border-[var(--line)] font-ui flex-wrap text-xs relative">
          <b className="mapa-title text-sm mr-1 flex items-center gap-1.5"><MapIcon size={15} />{mapList.find((m) => m.id === mapId)?.nazev || "Atlas Montelienu"}</b>
          {mapList.length > 1 && (
            <select className="mapa-sel inp !w-40 !py-0.5 text-xs" value={mapId}
              onChange={(e) => setParams({ mapa: e.target.value })}>
              {mapList.map((m) => <option key={m.id} value={m.id}>{m.nazev}</option>)}
            </select>
          )}
          <span className="mapa-sep w-px h-5 bg-[var(--line)]" />
          <div className="mapa-hledat relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
            <input className="inp !w-48 !py-1 !pl-6 text-xs" placeholder="Hledat místo…" autoComplete="off"
              value={searchQ}
              onChange={(e) => { setSearchQ(e.target.value); setSuggOn(true); }}
              onFocus={() => setSuggOn(true)}
              onBlur={() => setTimeout(() => setSuggOn(false), 150)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(suggestions[0] || searchQ); if (e.key === "Escape") setSuggOn(false); }} />
            {suggOn && suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 card !p-1 w-56 z-[700]">
                {suggestions.map((n) => (
                  <button key={n} className="block w-full text-left px-2 py-1 rounded hover:bg-[var(--bg-3)] capitalize"
                    onMouseDown={(e) => { e.preventDefault(); doSearch(n); }}>{n}</button>
                ))}
              </div>
            )}
          </div>
          <button className="btn sm mapa-najit" onClick={() => doSearch(searchQ)}>Najít</button>
          {/* na mobilu se akce sbalí pod ⋯; na desktopu se box zobrazí inline */}
          <input type="checkbox" id="mapa-acts-cb" className="mapa-acts-cb" hidden />
          <label htmlFor="mapa-acts-cb" className="btn sm mapa-acts-btn" title="Akce mapy">⋯</label>
          <div className="mapa-acts-box">
            {editor && mapList.length > 0 && (
              <button className="btn sm mapa-novamapa" onClick={() => setNewMap(true)} title="Nová mapa">
                <Plus size={13} className="inline -mt-0.5" /> <span className="mapa-act-txt">Nová mapa</span>
              </button>
            )}
            <button className={"btn sm" + (merOn ? " chip-accent" : "")} onClick={() => {
              const next = !merOn; setMerOn(next);
              if (next) mer.start(); else mer.stop();
            }}><Ruler size={13} className="inline -mt-0.5" /> <span className="mapa-act-txt">Měřit</span></button>
            {editor && (
              <button className={"btn sm" + (addMode ? " chip-accent" : "")} onClick={() => {
                const n = !addMode; setAddMode(n);
                const el = ref.current; if (el) el.style.cursor = n ? "copy" : "";
              }}><MapPinPlus size={13} className="inline -mt-0.5" /> <span className="mapa-act-txt">Přidat místo</span></button>
            )}
            {editor && !editOn && (
              <button className="btn sm chip-accent" onClick={startEditor}
                title="Kreslení oblastí, řek, cest, hranic, terénu, symbolů a popisků"><PencilLine size={13} className="inline -mt-0.5" /> <span className="mapa-act-txt">Editor</span></button>
            )}
          </div>
        </div>
      )}
      <div className="flex-1 relative isolate overflow-hidden">
        <div ref={ref} className={"absolute inset-0" + (crop ? " mapa-vyrez" : "")} />
        {err && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#a33] font-ui p-8">Mapu se nepodařilo načíst: {err}</div>}
        {!ready && !err && <div className="absolute inset-0 flex items-center justify-center text-[var(--ink-3)] font-ui">Načítám atlas…</div>}
        {ready && !crop && (
          <>
            <div className="mapa-staty absolute left-3 top-28 z-[600] card !p-2 w-56 font-ui text-xs">
              <button className="w-full flex items-center justify-between font-bold text-[var(--ink-2)]"
                onClick={() => setStavyOn((v) => !v)}>
                Státy <span className="text-[var(--ink-3)]">{stavyOn ? "▾" : "▸"}</span>
              </button>
              {stavyOn && (
                <div className="mt-1 max-h-[50dvh] overflow-y-auto">
                  {stavy.map((s) => (
                    <button key={s.nazev} className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-[var(--bg-3)] text-left"
                      onMouseEnter={() => (ref.current as any)?._ukazStat?.(s.nazev, false)}
                      onMouseLeave={() => (ref.current as any)?._skryjStat?.()}
                      onClick={() => (ref.current as any)?._zamerStat?.(s.nazev)}>
                      <i className="w-3 h-3 rounded-sm inline-block flex-none border border-black/20" style={{ background: s.color }} />
                      <span className="truncate">{s.nazev}</span>
                      {s.navrh && <span className="ml-auto text-[9px] px-1 rounded bg-[var(--bg-3)] text-[var(--ink-3)]">návrh</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mapa-vrstvy absolute left-3 bottom-8 z-[600] card !p-2 w-60 font-ui text-xs">
              <button className="w-full flex items-center justify-between font-bold text-[var(--ink-2)]"
                onClick={() => setVrstvyOn((v) => !v)}>
                <span className="flex items-center gap-1"><Layers size={12} /> Vrstvy</span>
                <span className="text-[var(--ink-3)]">{vrstvyOn ? "▾" : "▸"}</span>
              </button>
              {vrstvyOn && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <div className="flex flex-wrap gap-0.5">
                    {baseNames.map((n) => (
                      <button key={n}
                        className={"btn sm !px-1.5 !py-0.5 !text-[10px]" + (baseName === n ? " chip-accent" : "")}
                        onClick={() => (ref.current as any)?._setBase?.(n)}>{n}</button>
                    ))}
                  </div>
                  {prekryvOK && (
                    <label className="flex items-center gap-2">
                      <span className="w-28 flex-none">Překryv kresby</span>
                      <input type="range" min={0} max={1} step={0.05} value={prekryv} className="flex-1"
                        onChange={(e) => {
                          const v = Number(e.target.value); setPrekryv(v);
                          localStorage.setItem("mapa-prekryv", String(v));
                          (ref.current as any)?._setPrekryv?.(v);
                        }} />
                    </label>
                  )}
                  {[["uzemi", "Území států"], ["hranice", "Hranice"], ["mista", "Místa"], ["popisky", "Popisky"], ["boje", "Boje"]].map(([k, t]) => (
                    <label key={k} className="flex items-center gap-1.5">
                      <input type="checkbox" checked={!!vis[k]}
                        onChange={(e) => (ref.current as any)?._setVis?.(k, e.target.checked)} /> {t}
                    </label>
                  ))}
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={stitky} onChange={(e) => {
                    setStitky(e.target.checked);
                    Object.values(byName.current).forEach(({ m, c }) => {
                      if (m.typ !== "mesto" && m.typ !== "misto") return;
                      c.unbindTooltip(); c.bindTooltip(m.nazev, { className: "mapa-stitek", direction: "top", offset: [0, -6], permanent: e.target.checked });
                      if (e.target.checked) c.openTooltip();
                    });
                  }} /> jména měst</label>
                  <div className="flex items-center gap-3 pt-1 border-t border-[var(--line)] text-[10px] text-[var(--ink-3)]">
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#8e4f45" }} /> mapa DM</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#4f7657" }} /> kánon</span>
                    <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full inline-block" style={{ background: "#9a8050" }} /> odhad</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {sel && (
          <aside className="mapa-sel absolute right-3 top-3 z-[600] card p-4 w-72 font-ui max-h-[80%] overflow-y-auto">
            <button className="float-right text-[var(--ink-3)]" onClick={() => setSel(null)}>✕</button>
            <div className="text-lg font-bold">{sel.nazev}</div>
            <div className="flex items-center gap-1.5 mb-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-[var(--bg-3)] text-[var(--ink-2)]">{sel.typ}</span>
              <span className="px-1.5 py-0.5 rounded text-white" style={{
                background: { mapa: "#8e4f45", kanon: "#4f7657", odhad: "#9a8050" }[sel.jistota as string] || "#777",
              }}>{sel.jistota === "kanon" ? "potvrzeno DM" : sel.jistota === "mapa" ? "mapa DM" : "odhad"}</span>
            </div>
            {(() => {
              const her = (window.MONTELIEN_HERALDIKA?.mesta || []).find((e: any) => e.soubor === sel.odkaz);
              const img = her ? herPath(her, "znak") : "";
              return img ? <img src={img} className="w-16 h-auto mb-2" alt="" onError={(e) => ((e.target as HTMLElement).style.display = "none")} /> : null;
            })()}
            {sel.pozn && <p className="text-sm mb-3">{sel.pozn}</p>}
            <div className="flex flex-col gap-1.5">
              {sel.url && <Link to={sel.url} className="btn sm text-center" onClick={() => setSel(null)}>Otevřít stránku →</Link>}
              {editor && (
                <button className="btn sm" onClick={() => { setPlaceForm({ mode: "edit", ...sel, popisek: sel.popisek || {} }); setSel(null); }}>
                  ✎ Upravit místo
                </button>
              )}
              {(mapData.current?.bojove_mapy || [])
                .map((b: any) => b.data || b)
                .filter((b: any) => b.misto === sel.odkaz)
                .map((b: any) => (
                  <Link key={b.id} to={`/boje`} className="btn sm text-center">⚔ {b.nazev}</Link>
                ))}
            </div>
          </aside>
        )}
      {placeForm && (
        <PlaceForm form={placeForm} setForm={setPlaceForm} mapa={mapId}
          onDone={() => { setPlaceForm(null); setAddMode(false); location.reload(); }} />
      )}
      {newMap && <NewMapForm onDone={(id: string) => { setNewMap(false); if (id) setParams({ mapa: id }); }} />}
    </div>
  );
}

/* --- nová mapa --- */
function NewMapForm({ onDone }: { onDone: (id: string) => void }) {
  const [f, setF] = useState({ id: "", nazev: "", sirka: 2048, vyska: 1440 });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await post("/api/map/create", { id: f.id.trim(), nazev: f.nazev.trim() || f.id.trim(), sirka: f.sirka, vyska: f.vyska });
      onDone(f.id.trim());
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[700] bg-black/50 flex items-center justify-center" onClick={() => onDone("")}>
      <div className="card p-4 w-[340px] font-ui" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-3">Nová mapa</h3>
        <label className="block text-xs mb-1">ID (adresář v 11_Mapy/mapy/)</label>
        <input className="inp mb-2" value={f.id} placeholder="napr. podsviti"
          onChange={(e) => setF({ ...f, id: e.target.value.replace(/[^\w-]/g, "_") })} autoFocus />
        <label className="block text-xs mb-1">Název</label>
        <input className="inp mb-2" value={f.nazev} onChange={(e) => setF({ ...f, nazev: e.target.value })} />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <label className="text-xs">Šířka (px)<input type="number" className="inp" value={f.sirka} onChange={(e) => setF({ ...f, sirka: Number(e.target.value) })} /></label>
          <label className="text-xs">Výška (px)<input type="number" className="inp" value={f.vyska} onChange={(e) => setF({ ...f, vyska: Number(e.target.value) })} /></label>
        </div>
        <p className="text-xs text-[var(--ink-3)] mb-3">Po vytvoření přepni do Editoru mapy — nakreslíš pevninu, vody, hranice i místa. Podklad nahrát přes odkaz „Nahrát obrázek“ (11_Mapy/mapy/&lt;id&gt;).</p>
        <div className="flex gap-2 justify-end">
          <button className="btn sm" onClick={() => onDone("")}>Zrušit</button>
          <button className="btn sm chip-accent" onClick={save} disabled={busy || !f.id.trim()}>Vytvořit</button>
        </div>
      </div>
    </div>
  );
}

/* --- formulář místa (editor) --- */
const TYPY = ["mesto", "misto", "zeme", "sidlo", "more"];
const JISTOTY = [["kanon", "kánon (potvrzeno DM)"], ["mapa", "mapa DM"], ["odhad", "odhad / návrh"]];
const STYLY = ["", "zeme", "misto", "more"];

function PlaceForm({ form, setForm, onDone, mapa }: any) {
  const [busy, setBusy] = useState(false);
  const f = form;
  const qs = `?mapa=${encodeURIComponent(mapa)}`;
  const set = (k: string, v: any) => setForm({ ...f, [k]: v });
  const save = async () => {
    setBusy(true);
    try {
      const body = { nazev: f.nazev, x: f.x, y: f.y, typ: f.typ, jistota: f.jistota,
        odkaz: f.odkaz || "", pozn: f.pozn || "", popisek: f.popisek || {} };
      if (f.hlavni_mesto) (body as any).hlavni_mesto = true;
      if (f.mode === "new") await post("/api/map/places" + qs, body);
      else await put(`/api/map/places/${f.id}` + qs, body);
      onDone();
    } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!await confirmDialog({ title: "Smazat místo", text: `Smazat místo „${f.nazev}“ z mapy?`, okLabel: "Smazat", danger: true })) return;
    setBusy(true);
    try { await del(`/api/map/places/${f.id}` + qs); onDone(); }
    catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[700] bg-black/50 flex items-center justify-center" onClick={() => setForm(null)}>
      <div className="card p-4 w-[380px] font-ui max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-3">{f.mode === "new" ? `Nové místo (x ${f.x}, y ${f.y})` : `Upravit „${f.nazev}“`}</h3>
        <label className="block text-xs mb-1">Název</label>
        <input className="inp mb-2" value={f.nazev} onChange={(e) => set("nazev", e.target.value)} autoFocus />
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="text-xs">Typ
            <select className="inp" value={f.typ} onChange={(e) => set("typ", e.target.value)}>
              {TYPY.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></label>
          <label className="text-xs">Jistota
            <select className="inp" value={f.jistota} onChange={(e) => set("jistota", e.target.value)}>
              {JISTOTY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <label className="text-xs">X<input type="number" className="inp" value={f.x} onChange={(e) => set("x", Number(e.target.value))} /></label>
          <label className="text-xs">Y<input type="number" className="inp" value={f.y} onChange={(e) => set("y", Number(e.target.value))} /></label>
        </div>
        <label className="block text-xs mb-1">Odkaz na stránku</label>
        <div className="mb-2"><EntityPicker value={f.odkaz || ""} onChange={(p) => set("odkaz", p)} placeholder="Stránka v repu…" /></div>
        <label className="block text-xs mb-1">Poznámka</label>
        <textarea className="inp mb-2" rows={3} value={f.pozn || ""} onChange={(e) => set("pozn", e.target.value)} />
        <label className="flex items-center gap-2 text-xs mb-3">
          <input type="checkbox" checked={!!f.hlavni_mesto} onChange={(e) => set("hlavni_mesto", e.target.checked)} />
          hlavní město (velký symbol + štít)</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <label className="text-xs">Styl popisku
            <select className="inp" value={f.popisek?.styl || ""} onChange={(e) => set("popisek", { ...(f.popisek || {}), styl: e.target.value || undefined })}>
              {STYLY.map((s) => <option key={s} value={s}>{s || "—"}</option>)}
            </select></label>
          <label className="text-xs">Rotace °<input type="number" className="inp" value={f.popisek?.rot || 0}
            onChange={(e) => set("popisek", { ...(f.popisek || {}), rot: Number(e.target.value) })} /></label>
          <label className="text-xs">Velikost<input type="number" className="inp" value={f.popisek?.velikost || ""} placeholder="—"
            onChange={(e) => set("popisek", { ...(f.popisek || {}), velikost: e.target.value ? Number(e.target.value) : undefined })} /></label>
        </div>
        <div className="flex gap-2 justify-between">
          {f.mode === "edit" ? <button className="btn sm !text-[#a33]" onClick={remove} disabled={busy}>Smazat</button> : <span />}
          <div className="flex gap-2">
            <button className="btn sm" onClick={() => setForm(null)}>Zrušit</button>
            <button className="btn sm chip-accent" onClick={save} disabled={busy || !f.nazev.trim()}>Uložit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
