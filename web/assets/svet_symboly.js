// Knihovna kreslených symbolů mapy Montelien (jednotný tuší kreslený atlas styl).
// Každý symbol: kotva (0,0) = pata symbolu, jednotka ≈ 1 px vyrovnané mapy při m = 1.
(function () {
  var I = 'stroke="#3a2412" stroke-linejoin="round" stroke-linecap="round" fill="none"';
  function hora(w, h, snih, k) {
    var l = -w / 2, r = w / 2, p = (k || 0) * w;
    var s = '<path d="M' + l + ',0 L' + p + ',' + (-h) + ' L' + r + ',0 Z" fill="#e6d6b3"/>'
      + '<path d="M' + p + ',' + (-h) + ' L' + r + ',0 L' + (p + w * .08) + ',0 Q' + (p + w * .02) + ',' + (-h * .45) + ' ' + p + ',' + (-h) + 'Z" fill="#a8977c"/>';
    for (var i = 1; i < 5; i++) { var t = i / 5; s += '<path d="M' + (p + (r - p) * t * .9 + w * .03) + ',' + (-h * (1 - t) + h * .02) + ' l' + (-w * .06) + ',' + (h * .18) + '" ' + I + ' stroke-width=".7"/>'; }
    if (snih) s += '<path d="M' + (p - w * .16) + ',' + (-h * .68) + ' L' + p + ',' + (-h) + ' L' + (p + w * .17) + ',' + (-h * .66) + ' l-' + (w * .07) + ',' + (h * .06) + ' l-' + (w * .06) + ',-' + (h * .07) + ' l-' + (w * .07) + ',' + (h * .08) + 'Z" fill="#fbf7ee" stroke="#3a2412" stroke-width=".6"/>';
    return s + '<path d="M' + l + ',0 L' + p + ',' + (-h) + ' L' + r + ',0" ' + I + ' stroke-width="1.3"/>';
  }
  var S = {
    hora: { nazev: "Hora", kat: "terén", svg: hora(24, 20, false, .02) },
    hora2: { nazev: "Hora (štít)", kat: "terén", svg: hora(20, 24, false, -.08) },
    hora_snih: { nazev: "Zasněžená hora", kat: "terén", svg: hora(26, 26, true, .05) },
    kopec: { nazev: "Kopec", kat: "terén", svg: '<path d="M-10,0 Q-4,-9 2,-8 Q8,-7 10,0Z" fill="#d9c79c"/><path d="M-10,0 Q-4,-9 2,-8 Q8,-7 10,0" ' + I + ' stroke-width="1.1"/><path d="M3,-6 q2,2 1,5" ' + I + ' stroke-width=".6"/>' },
    jehlican: { nazev: "Jehličnan", kat: "terén", svg: '<path d="M0,-15 L4,-8 L2.5,-8 L6,-2 L-6,-2 L-2.5,-8 L-4,-8Z" fill="#4c7a3d" stroke="#2e2414" stroke-width=".8" stroke-linejoin="round"/><path d="M0,-2 V1" ' + I + ' stroke-width="1.2"/>' },
    strom: { nazev: "Listnatý strom", kat: "terén", svg: '<path d="M0,1 V-4" ' + I + ' stroke-width="1.3"/><path d="M-5,-5 a4,4 0 0,1 2,-6 a4.5,4.5 0 0,1 7,-1 a4,4 0 0,1 1,7 a3,3 0 0,1 -4,1 a3.5,3.5 0 0,1 -6,-1Z" fill="#6f9a46" stroke="#2e2414" stroke-width=".8"/><path d="M-1,-9 a2,2 0 0,1 3,-1" ' + I + ' stroke-width=".5" stroke="#cfe0a0"/>' },
    palma: { nazev: "Palma", kat: "terén", svg: '<path d="M0,1 Q1,-6 -1,-12" ' + I + ' stroke-width="1.3"/><path d="M-1,-12 q-5,-1 -8,3 M-1,-12 q5,-2 8,2 M-1,-12 q-2,-4 -6,-5 M-1,-12 q3,-4 7,-4 M-1,-12 q0,2 -3,6" stroke="#3f6b2c" stroke-width="1.6" fill="none" stroke-linecap="round"/>' },
    rakos: { nazev: "Bažina / rákos", kat: "terén", svg: '<path d="M-6,0 h12 M-3,0 q-1,-5 -3,-7 M0,0 q0,-6 1,-9 M3,0 q1,-4 4,-6 M-1,-3 q-2,-1 -3,-1" ' + I + ' stroke-width=".9"/><path d="M-8,2 h4 M2,2 h6" stroke="#5a8aa0" stroke-width=".8" fill="none"/>' },
    duna: { nazev: "Duna", kat: "terén", svg: '<path d="M-10,0 Q-3,-6 4,-4 Q8,-3 10,0" ' + I + ' stroke-width="1"/><path d="M-5,0 Q0,-3 5,-1" ' + I + ' stroke-width=".6"/>' },
    kaktus: { nazev: "Kaktus", kat: "terén", svg: '<path d="M0,0 V-10 M0,-5 h-3 v-3 M0,-6 h3 v-3" stroke="#4e7a35" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-4,0 h8" ' + I + ' stroke-width=".8"/>' },
    pole: { nazev: "Pole", kat: "terén", svg: '<path d="M-10,-2 L8,-7 L12,1 L-6,6Z" fill="#e2c97a" stroke="#3a2412" stroke-width=".8"/><path d="M-7,0 L9,-4 M-5,3 L11,-1 M-9,-3 L6,-7" stroke="#8a6a2a" stroke-width=".6"/>' },
    sidlo: { nazev: "Sídlo (kroužek)", kat: "sídla", svg: '<circle cx="0" cy="-4" r="4" fill="#efe2bf" ' + I.replace('fill="none"', '') + ' stroke-width="1.6"/>' },
    vesnice: { nazev: "Vesnice", kat: "sídla", svg: '<path d="M-9,0 v-5 l3,-3 l3,3 v5Z M-1,0 v-6 l4,-4 l4,4 v6Z" fill="#efe2bf" stroke="#3a2412" stroke-width=".9" stroke-linejoin="round"/><path d="M-9,-5 l3,-3 l3,3 M-1,-6 l4,-4 l4,4" fill="#b5523a" stroke="#3a2412" stroke-width=".9"/>' },
    mesto: { nazev: "Město", kat: "sídla", svg: '<path d="M-12,0 v-8 h4 v-4 h3 v4 h4 v-6 l3,-4 l3,4 v6 h5 v-3 h3 v11Z" fill="#efe2bf" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M-12,-8 h4 M1,-14 l3,-4 l3,4Z" fill="#b5523a" stroke="#3a2412" stroke-width=".9"/><path d="M-8,-3 v-2 M-3,-3 v-2 M4,-6 v-3 M10,-4 v-2" ' + I + ' stroke-width="1"/><path d="M-14,0 h29" ' + I + ' stroke-width="1.2"/>' },
    hrad: { nazev: "Hrad", kat: "sídla", svg: '<path d="M-11,0 v-12 h2 v2 h2 v-2 h2 v4 h10 v-4 h2 v2 h2 v-2 h2 v12Z" fill="#ddd0b0" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M-2,-8 v-9 h4 v9" fill="#ddd0b0" stroke="#3a2412" stroke-width="1"/><path d="M0,-17 v-6 l5,2 l-5,2" fill="#a83a28" stroke="#3a2412" stroke-width=".8"/><path d="M-1,0 v-4 a1,1 0 0,1 2,0 v4" fill="#3a2412"/>' },
    pevnost: { nazev: "Pevnost", kat: "sídla", svg: '<path d="M-16,0 v-10 l3,-3 l3,3 v-2 h12 v2 l3,-3 l3,3 v10Z" fill="#d8ccb0" stroke="#3a2412" stroke-width="1.1" stroke-linejoin="round"/><path d="M-4,-12 v-10 l4,-5 l4,5 v10" fill="#d8ccb0" stroke="#3a2412" stroke-width="1.1"/><path d="M-4,-22 l4,-5 l4,5Z" fill="#7a2a1c"/><path d="M-12,-6 v-2 M8,-6 v-2 M0,-17 v-2" ' + I + ' stroke-width="1.1"/><path d="M-19,0 h38" ' + I + ' stroke-width="1.3"/>' },
    pristav: { nazev: "Přístav", kat: "sídla", svg: '<path d="M-10,-2 v-6 l3,-3 l3,3 v6 M-2,-2 v-8 l4,-4 l4,4 v8" fill="#efe2bf" stroke="#3a2412" stroke-width=".9"/><path d="M-12,-2 h22 M8,-2 v5 M12,-2 v5" ' + I + ' stroke-width="1"/><path d="M14,0 v-7 M11,-5 h6 M11,-1 q3,3 6,0" ' + I + ' stroke-width="1"/>' },
    kopar: { nazev: "Kop Aram (město na ostrově)", kat: "sídla", svg: '<ellipse cx="0" cy="-2" rx="22" ry="9" fill="#e3d2a4" stroke="#3a2412" stroke-width="1.1"/><path d="M-15,-4 v-9 h4 v-3 h3 v3 h3 v-7 l3,-4 l3,4 v7 h4 v-5 h3 v5 h4 v9Z" fill="#efe2bf" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M-2,-20 l3,-4 l3,4Z" fill="#b5523a"/><path d="M-9,-8 v-2 M8,-8 v-2 M1,-13 v-3" ' + I + ' stroke-width="1"/>' },
    vez: { nazev: "Věž", kat: "stavby", svg: '<path d="M-3,0 l1,-18 h4 l1,18Z" fill="#ddd0b0" stroke="#3a2412" stroke-width="1"/><path d="M-3,-18 h6 v-3 h-6Z M-3,-21 l3,-5 l3,5" fill="#b5523a" stroke="#3a2412" stroke-width=".9"/><path d="M0,-12 v-2" ' + I + ' stroke-width="1"/>' },
    majak: { nazev: "Maják", kat: "stavby", svg: '<path d="M-3,0 l1,-16 h4 l1,16Z" fill="#f2ead6" stroke="#3a2412" stroke-width="1"/><path d="M-2.5,-6 h5 M-2.2,-11 h4.4" stroke="#a83a28" stroke-width="1.6"/><path d="M-3,-16 h6 l-1,-3 h-4Z" fill="#f0c040" stroke="#3a2412" stroke-width=".8"/><path d="M-6,-18 l-4,-2 M6,-18 l4,-2" stroke="#e0a020" stroke-width=".8"/>' },
    chram: { nazev: "Chrám", kat: "stavby", svg: '<path d="M-10,0 v-8 h20 v8Z M-12,-8 l12,-7 l12,7Z" fill="#ece0c2" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M-6,0 v-8 M-2,0 v-8 M2,0 v-8 M6,0 v-8" ' + I + ' stroke-width=".8"/>' },
    zricenina: { nazev: "Zřícenina", kat: "stavby", svg: '<path d="M-10,0 v-7 l2,1 v-4 l2,2 v8 M-2,0 v-11 l2,-1 l1,3 v9 M5,0 v-5 l2,-2 l2,3 v4" fill="#d6c9a8" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M-12,0 h23 M-6,-4 h3 M7,-2 h2" ' + I + ' stroke-width="1"/>' },
    kolonada: { nazev: "Kolonáda", kat: "stavby", svg: '<path d="M-12,-11 h24 M-12,0 h24" ' + I + ' stroke-width="1.3"/><path d="M-9,0 v-11 M-4,0 v-11 M1,0 v-11 M6,0 v-8 M10,0 v-4" ' + I + ' stroke-width="1.4"/>' },
    pyramida: { nazev: "Pyramida", kat: "stavby", svg: '<path d="M-11,0 L0,-14 L11,0Z" fill="#e8d29a"/><path d="M0,-14 L11,0 L3,0Z" fill="#b9a06a"/><path d="M-11,0 L0,-14 L11,0Z M-7,-5 h12 M-4,-9 h7" ' + I + ' stroke-width="1"/>' },
    obelisk: { nazev: "Obelisk", kat: "stavby", svg: '<path d="M-2,0 l.6,-17 l1.4,-2 l1.4,2 l.6,17Z" fill="#cfc2a3" stroke="#3a2412" stroke-width="1"/><path d="M-4,0 h8" ' + I + ' stroke-width="1.2"/>' },
    torii: { nazev: "Svatyně (torii)", kat: "stavby", svg: '<path d="M-9,-12 q9,-3 18,0 M-7,-9 h14 M-5,0 v-12 M5,0 v-12" stroke="#a83a28" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M-8,0 h16" ' + I + ' stroke-width="1"/>' },
    krystal: { nazev: "Krystalové věže", kat: "stavby", svg: '<path d="M-6,0 l-2,-10 l2,-6 l2,6 l-1,10Z M0,0 l-1,-15 l2,-7 l2,7 l-1,15Z M6,0 l-1,-8 l2,-5 l2,5 l-1,8Z" fill="#cfe6ee" stroke="#3a2412" stroke-width=".9" stroke-linejoin="round"/><path d="M1,-21 v12" stroke="#fff" stroke-width=".7"/>' },
    tvar: { nazev: "Tvář ve skále", kat: "stavby", svg: '<path d="M-12,0 q0,-14 12,-16 q12,2 12,16Z" fill="#cbbd9c" stroke="#3a2412" stroke-width="1"/><path d="M-6,-9 q2,-2 4,0 M2,-9 q2,-2 4,0 M0,-8 v4 l-1,1 M-4,-2 q4,2 8,0" ' + I + ' stroke-width="1"/>' },
    kostka: { nazev: "Krychlová stavba", kat: "stavby", svg: '<path d="M-8,0 v-10 l8,-4 l8,4 v10 l-8,4Z" fill="#d6c9a8" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M0,4 v-10 M-8,-10 l8,4 l8,-4 M-5,-4 h2 M3,-3 h2" ' + I + ' stroke-width=".8"/>' },
    kupole: { nazev: "Kupole", kat: "stavby", svg: '<path d="M-10,0 v-4 h20 v4Z M-8,-4 a8,8 0 0,1 16,0Z" fill="#e6dcc0" stroke="#3a2412" stroke-width="1"/><path d="M0,-12 v-3" ' + I + ' stroke-width="1"/>' },
    kolo: { nazev: "Velké kolo", kat: "stavby", svg: '<circle cx="0" cy="-10" r="9" fill="none" stroke="#3a2412" stroke-width="1.2"/><path d="M0,-19 v18 M-9,-10 h18 M-6,-16 l12,12 M6,-16 l-12,12 M-4,0 l4,-10 l4,10" ' + I + ' stroke-width=".8"/>' },
    most: { nazev: "Most", kat: "stavby", svg: '<path d="M-12,-2 h24 M-12,2 h24" ' + I + ' stroke-width="1.2"/><path d="M-9,-2 v4 M-5,-2 v4 M-1,-2 v4 M3,-2 v4 M7,-2 v4 M11,-2 v4" ' + I + ' stroke-width=".7"/>' },
    lod: { nazev: "Loď", kat: "moře", svg: '<path d="M-10,-3 h20 l-4,5 h-12Z" fill="#9a6a3a" stroke="#3a2412" stroke-width="1" stroke-linejoin="round"/><path d="M0,-3 v-15 M-5,-3 v-10" ' + I + ' stroke-width="1"/><path d="M0,-17 q7,5 0,12Z M-5,-12 q-5,4 0,8Z" fill="#f3ead4" stroke="#3a2412" stroke-width=".8"/><path d="M-14,4 q3,-2 6,0 M8,4 q3,-2 6,0" stroke="#2f5f6a" stroke-width=".8" fill="none"/>' },
    vrak: { nazev: "Vrak", kat: "moře", svg: '<path d="M-12,0 l3,-6 h14 l6,4 l-4,3Z" fill="#7a5530" stroke="#3a2412" stroke-width="1" stroke-linejoin="round" transform="rotate(-14)"/><path d="M-2,-6 l5,-14 M6,-4 l-6,-9 M-3,-15 l9,3" ' + I + ' stroke-width="1.1"/><path d="M-16,3 q4,-3 8,0 q4,3 8,0 q4,-3 8,0" stroke="#2f5f6a" stroke-width=".9" fill="none"/>' },
    vir: { nazev: "Vír", kat: "moře", svg: '<path d="M0,-6 m-1,0 a1.5,1.5 0 1,1 3,0 a3,3 0 1,1 -6,0 a5,5 0 1,1 10,0 a7,7 0 1,1 -14,0 a9.5,9.5 0 1,1 19,0" stroke="#24525c" stroke-width="1.2" fill="none" stroke-linecap="round"/>' },
    vlny: { nazev: "Vlny", kat: "moře", svg: '<path d="M-12,0 q3,-4 6,0 q3,4 6,0 q3,-4 6,0 q3,4 6,0" stroke="#24525c" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M-6,-5 q3,-3 6,0 q3,3 6,0" stroke="#24525c" stroke-width=".8" fill="none"/>' },
    had: { nazev: "Mořský had", kat: "moře", svg: '<path d="M-16,0 q4,-10 8,0 M-4,0 q4,-11 8,0 M8,0 q3,-9 6,-6 q3,-1 4,-4" stroke="#2e6a4e" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M-18,1 q4,-2 8,0 q4,2 8,0 q4,-2 8,0 q4,2 8,0" stroke="#24525c" stroke-width=".8" fill="none"/><circle cx="18" cy="-10.5" r=".7" fill="#3a2412"/>' },
    demon: { nazev: "Okřídlený démon", kat: "moře", svg: '<path d="M0,-4 q-12,-4 -16,-16 q5,3 8,1 q2,4 6,6 M0,-4 q12,-4 16,-16 q-5,3 -8,1 q-2,4 -6,6" fill="#6a3a2e" stroke="#3a2412" stroke-width=".9" stroke-linejoin="round"/><path d="M-2,0 q-1,-8 2,-12 q3,4 2,12Z" fill="#4a2a22" stroke="#3a2412" stroke-width=".8"/><path d="M-1,-12 l-1,-3 M1,-12 l1,-3" ' + I + ' stroke-width=".8"/>' },
    kotva: { nazev: "Kotva", kat: "moře", svg: '<path d="M0,-14 v13 M-4,-11 h8 M-7,-5 q2,6 7,4 q5,2 7,-4" ' + I + ' stroke-width="1.3"/><circle cx="0" cy="-15" r="1.6" fill="none" stroke="#3a2412" stroke-width="1"/>' }
  };
  // Výplň oblastí: které symboly a jak hustě (rozestup v px).
  var BARVY_OBLASTI = (window.SVET_PALETA || {}).areas || {};
  var OBLASTI = {
    les: { nazev: "Jehličnatý les", barva: "#567b45", spr: ["jehl_1", "jehl_2", "jehl_3", "jehl_4", "jehl_5", "jehl_6", "jehl_2", "list_6"], rozestup: 5, w: 14 },
    haj: { nazev: "Listnatý les", barva: "#789958", spr: ["list_1", "list_2", "list_3", "list_4", "list_5", "list_6", "jehl_3"], rozestup: 5.8, w: 15 },
    dzungle: { nazev: "Prales", barva: "#355d37", spr: ["palma_1", "palma_2", "palmy", "dzung_1", "dzung_2", "palma_3", "dzung_1"], rozestup: 7, w: 18 },
    hory: { nazev: "Hory", barva: "#a09e8d", spr: ["hora_a", "hora_b", "hora_c", "hora_d", "hora_e", "hora_f", "masiv_a", "skala", "masiv_c"], rozestup: 14, w: 28, shluky: true },
    velehory: { nazev: "Velehory (sníh)", barva: "#c2b8a6", spr: ["snih", "snih", "snih", "hora_e", "snih"], rozestup: 16, w: 31 },
    kopce: { nazev: "Kopce", barva: "#817c55", spr: ["kopec_1", "kopec_2", "kopec_3", "kopec_4", "kopec_5", "balvan_1"], rozestup: 24, w: 30, shluky: true },
    poust: { nazev: "Poušť", barva: "#d8c08a", spr: ["duna_1", "duna_2", "duna_3", "duna_4", "duna_5", "duna_2", "duna_3", "duna_1", "duna_4", "kaktus_1", "duna_5", "balvan_2", "kaktus_2", "balvan_1", "kopec_4", "utes_2"], rozestup: 18, w: 30 },
    bazina: { nazev: "Bažina", barva: "#8fa68a", spr: ["bazina_1", "bazina_2", "rakos_1", "rakos_2", "ker_2", "suchy_2"], rozestup: 18, w: 22 },
    pole: { nazev: "Pole a vinice", barva: "#b2ae70", spr: ["vinice", "ker_1"], rozestup: 40, w: 14 },
    mrtvy: { nazev: "Mrtvý les", barva: "#4a4238", spr: ["suchy_1", "suchy_2", "ker_2"], rozestup: 10, w: 14 },
    ledovec: { nazev: "Ledovec", barva: "#e5eef0", spr: ["ledova_pole"], rozestup: 52, w: 38, shluky: true },
    mrtva_zeme: { nazev: "Mrtvá země", barva: "#3d3633", spr: ["suchy_1", "suchy_2", "sibenice", "kamen_1", "suchy_1", "utes_2", "palisada", "suchy_2"], rozestup: 22, w: 14 },
    louky: { nazev: "Louky", barva: "#97b477", spr: ["ker_1", "list_2", "ker_2", "list_5", "kopec_3", "ker_1"], rozestup: 16, w: 10 }
  };
  Object.keys(OBLASTI).forEach(function (typ) { if (BARVY_OBLASTI[typ]) OBLASTI[typ].barva = BARVY_OBLASTI[typ]; });
  // jednotlivé symboly: typ -> sprity (malované, web/assets/svet/*.webp) a šířka v px mapy
  var SPRITY = {
    hora: { nazev: "Hora", spr: ["hora_a", "hora_d", "hora_e"], w: 46 }, hora2: { nazev: "Dvojhora", spr: ["hora_b"], w: 50 },
    hora_snih: { nazev: "Zasněžená hora", spr: ["snih"], w: 52 }, hreben: { nazev: "Horský hřeben", spr: ["hreben_b"], w: 80 },
    masiv: { nazev: "Masiv", spr: ["masiv_a", "masiv_b", "masiv_c"], w: 52 }, skala: { nazev: "Skalisko", spr: ["skala"], w: 40 },
    kopec: { nazev: "Kopec", spr: ["kopec_1", "kopec_2", "kopec_4"], w: 26 }, jehlican: { nazev: "Jehličnan", spr: ["jehl_1", "jehl_5"], w: 14 },
    strom: { nazev: "Listnatý strom", spr: ["list_1", "list_4"], w: 16 }, palma: { nazev: "Palma", spr: ["palma_1", "palma_2"], w: 15 },
    palmy: { nazev: "Palmy", spr: ["palma_1", "palma_2", "palmy", "palma_3"], w: 16 },
    dzungle: { nazev: "Pralesní strom", spr: ["dzung_1", "dzung_2"], w: 17 }, rakos: { nazev: "Rákos", spr: ["rakos_1", "rakos_2"], w: 11 },
    ker: { nazev: "Keř", spr: ["ker_1", "ker_2"], w: 11 }, suchy: { nazev: "Suchý strom", spr: ["suchy_1", "suchy_2"], w: 14 },
    duna: { nazev: "Duna", spr: ["duna_1", "duna_3"], w: 26 }, kaktus: { nazev: "Kaktus", spr: ["kaktus_1", "kaktus_2"], w: 9 },
    balvan: { nazev: "Balvany", spr: ["balvan_1", "balvan_2"], w: 15 }, oaza: { nazev: "Oáza", spr: ["oaza"], w: 26 },
    pole: { nazev: "Pole", spr: ["pole_1", "pole_2"], w: 26 }, kul: { nazev: "Kůl s lebkou", spr: ["kul_1", "kul_2", "kul_3", "palisada"], w: 13 },
    hranik: { nazev: "Hraniční kámen", spr: ["hranik"], w: 11 }, sibenice: { nazev: "Mrtvý strom s lebkou", spr: ["sibenice"], w: 18 }, vinice: { nazev: "Vinice", spr: ["vinice"], w: 24 },
    bazina: { nazev: "Bažina", spr: ["bazina_1", "bazina_2"], w: 26 },
    vesnice: { nazev: "Vesnice", spr: ["vesnice"], w: 26 }, vesnice2: { nazev: "Městečko", spr: ["vesnice2"], w: 30 },
    mesto: { nazev: "Opevněné město", spr: ["mesto"], w: 36 }, velkomesto: { nazev: "Velkoměsto", spr: ["velkomesto"], w: 46 },
    hrad: { nazev: "Hrad", spr: ["hrad"], w: 36 }, pevnost: { nazev: "Pevnost", spr: ["pevnost"], w: 40 },
    pristav: { nazev: "Přístav", spr: ["pristav"], w: 40 }, kopar: { nazev: "Město na ostrově", spr: ["kopar"], w: 50 },
    kop_aram: { nazev: "Kop Aram – věže na ostrově", spr: ["kop_aram"], w: 96 },
    vez: { nazev: "Věž mága", spr: ["vez"], w: 20 }, strazni_vez: { nazev: "Strážní věž", spr: ["strazni_vez"], w: 20 },
    majak: { nazev: "Maják", spr: ["majak"], w: 22 }, chram: { nazev: "Chrám", spr: ["chram"], w: 34 },
    zricenina: { nazev: "Zřícenina", spr: ["zricenina"], w: 32 }, kolonada: { nazev: "Kolonáda", spr: ["kolonada"], w: 34 },
    most: { nazev: "Most", spr: ["most"], w: 40 }, pyramida: { nazev: "Pyramida", spr: ["pyramida"], w: 40 },
    obelisk: { nazev: "Obelisk", spr: ["obelisk"], w: 14 }, torii: { nazev: "Torii", spr: ["torii"], w: 26 },
    palisada: { nazev: "Palisáda", spr: ["palisada"], w: 16 },
    krystal: { nazev: "Krystalové věže", spr: ["krystal"], w: 36 }, tvar: { nazev: "Tvář ve skále", spr: ["tvar"], w: 40 },
    kostka: { nazev: "Kostka", spr: ["kostka"], w: 26 }, kupole: { nazev: "Kupole / observatoř", spr: ["kupole"], w: 30 },
    kolo: { nazev: "Kamenné kolo", spr: ["kolo"], w: 30 }, lod: { nazev: "Loď", spr: ["lod"], w: 38 },
    vrak: { nazev: "Vrak", spr: ["vrak"], w: 38 }, vir: { nazev: "Vír", spr: ["vir"], w: 50 }, had: { nazev: "Mořský had", spr: ["had"], w: 42 },
    demon: { nazev: "Démon", spr: ["demon"], w: 50 }, vlny: { nazev: "Vlny", spr: ["vlny"], w: 34 }, clun: { nazev: "Člun", spr: ["clun"], w: 22 },
    utes_velky: { nazev: "Útes", spr: ["utes_a", "utes_b", "utes_c"], w: 26 },
    ledovcovy_jazyk: { nazev: "Ledovcový jazyk", spr: ["ledovcovy_jazyk"], w: 76 },
    ledovy_utes: { nazev: "Ledovcový útes", spr: ["ledovy_utes"], w: 44 },
    ledova_kra: { nazev: "Ledová kra", spr: ["ledova_kra", "ledova_kra2"], w: 22 },
    hradba: { nazev: "Hradba", spr: ["hradba_a", "hradba_a", "hradba_b"], w: 24 },
    vytah: { nazev: "Pevnost na útesu s výtahem", spr: ["vytah"], w: 46 }
  };
  window.SVET_SYMBOLY = S;
  window.SVET_OBLASTI = OBLASTI;
  window.SVET_SPRITY = SPRITY;
})();
