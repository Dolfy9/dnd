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
  var OBLASTI = {
    les: { nazev: "Les", barva: "#7fa25a", sym: ["jehlican", "strom", "jehlican"], rozestup: 9, m: [.8, 1.1] },
    dzungle: { nazev: "Prales", barva: "#5e8f45", sym: ["palma", "strom"], rozestup: 9, m: [.8, 1.1] },
    hory: { nazev: "Hory", barva: "#b8a88a", sym: ["hora", "hora2", "hora"], rozestup: 19, m: [.85, 1.3] },
    velehory: { nazev: "Velehory (sníh)", barva: "#c2b8a6", sym: ["hora_snih", "hora2", "hora_snih"], rozestup: 21, m: [1, 1.45] },
    kopce: { nazev: "Kopce", barva: "#cdb98a", sym: ["kopec"], rozestup: 16, m: [.8, 1.2] },
    poust: { nazev: "Poušť", barva: "#e6c886", sym: ["duna", "duna", "kaktus"], rozestup: 20, m: [.8, 1.2] },
    bazina: { nazev: "Bažina", barva: "#8fa68a", sym: ["rakos"], rozestup: 13, m: [.8, 1.1] },
    pole: { nazev: "Pole", barva: "#dcc57a", sym: ["pole"], rozestup: 20, m: [.8, 1.1] },
    louky: { nazev: "Louky (jen barva)", barva: "#b8c47a", sym: [], rozestup: 0, m: [1, 1] }
  };
  window.SVET_SYMBOLY = S;
  window.SVET_OBLASTI = OBLASTI;
})();
