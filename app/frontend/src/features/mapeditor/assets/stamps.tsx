/* Vestavěná knihovna top-down SVG stampů (≥80), kategorie + výchozí mechanika. */
import React from "react";

export interface StampDef {
  id: string; nazev: string; kat: string;
  w: number; h: number;            // výchozí velikost v buňkách
  blocks?: boolean; cover?: 2 | 3; difficult?: boolean;
  light?: { bright: number; dim: number };
  svg: () => React.ReactElement;   // kresba v jednotkách 1 buňka = 24 px, centrum 0,0
}

const e = React.createElement;
// pomocné tvary (viewBox -w/2..w/2, -h/2..h/2 v 24px buňkách → kreslíme v 24px souřadnicích ×rozměr)
const r = (x: number, y: number, w: number, h: number, f: string, s = "#3a332c", sw = 1.4, rx = 2) =>
  e("rect", { x, y, width: w, height: h, fill: f, stroke: s, strokeWidth: sw, rx });
const c = (cx: number, cy: number, rr: number, f: string, s = "#3a332c", sw = 1.4) =>
  e("circle", { cx, cy, r: rr, fill: f, stroke: s, strokeWidth: sw });
const p = (d: string, f: string, s = "#3a332c", sw = 1.4) => e("path", { d, fill: f, stroke: s, strokeWidth: sw, strokeLinejoin: "round" });
const l = (x1: number, y1: number, x2: number, y2: number, s = "#3a332c", sw = 1.4) =>
  e("line", { x1, y1, x2, y2, stroke: s, strokeWidth: sw, strokeLinecap: "round" });
const g = (children: React.ReactNode, extra: any = {}) =>
  e("g", extra, React.Children.map(children, (ch, i) => React.isValidElement(ch) ? React.cloneElement(ch, { key: i }) : ch));

const W = "#8a6a44", Wd = "#6b4f30", St = "#7d7466", Mt = "#a09a90", R_ = "#7d3b3b", Gn = "#5d7345", Br = "#8a4030";

export const KATEGORIE = ["Nábytek", "Dungeon", "Příroda", "Město", "Loď", "Magie", "Pasti a nebezpečí", "Světla", "Tábor/bitva"] as const;

export const STAMPS: StampDef[] = [
  /* --- Nábytek --- */
  { id: "stul-ctverec", nazev: "Stůl čtvercový", kat: "Nábytek", w: 1, h: 1, cover: 2, svg: () => g([r(-10, -10, 20, 20, W), r(-7, -7, 14, 14, "none", Wd, 1)]) },
  { id: "stul-obdelnik", nazev: "Stůl dlouhý", kat: "Nábytek", w: 2, h: 1, cover: 2, svg: () => g([r(-22, -10, 44, 20, W), l(-12, -10, -12, 10, Wd), l(12, -10, 12, 10, Wd)]) },
  { id: "stul-kulaty", nazev: "Stůl kulatý", kat: "Nábytek", w: 1, h: 1, cover: 2, svg: () => g([c(0, 0, 10, W), c(0, 0, 7, "none", Wd, 1)]) },
  { id: "zidle", nazev: "Židle", kat: "Nábytek", w: .5, h: .5, svg: () => g([r(-5, -5, 10, 10, W), r(-5, -5, 10, 3, Wd)]) },
  { id: "lavice", nazev: "Lavice", kat: "Nábytek", w: 1, h: .5, svg: () => r(-11, -4, 22, 8, W) },
  { id: "postel", nazev: "Postel", kat: "Nábytek", w: 1, h: 2, cover: 2, svg: () => g([r(-10, -22, 20, 44, "#9a8a74"), r(-10, -22, 20, 10, "#d8d0c0"), r(-10, -8, 20, 28, R_)]) },
  { id: "postel-dvou", nazev: "Dvoulůžko", kat: "Nábytek", w: 2, h: 2, cover: 2, svg: () => g([r(-22, -22, 44, 44, "#9a8a74"), r(-22, -22, 20, 10, "#d8d0c0"), r(2, -22, 20, 10, "#d8d0c0"), r(-22, -8, 44, 28, "#5d4a7d")]) },
  { id: "skrin", nazev: "Skříň", kat: "Nábytek", w: 1, h: .5, blocks: true, svg: () => g([r(-11, -5, 22, 10, Wd), l(0, -5, 0, 5)]) },
  { id: "truhel", nazev: "Truhla", kat: "Nábytek", w: 1, h: .5, cover: 2, svg: () => g([r(-10, -5, 20, 10, W, "#3a332c", 1.4, 3), l(-10, 0, 10, 0, Wd), r(-2, -2, 4, 4, Mt)]) },
  { id: "knihovna", nazev: "Knihovna", kat: "Nábytek", w: 1, h: .5, blocks: true, svg: () => g([r(-11, -5, 22, 10, Wd), l(-7, -5, -7, 5, "#3a332c", .8), l(-2, -5, -2, 5, "#3a332c", .8), l(3, -5, 3, 5, "#3a332c", .8), l(8, -5, 8, 5, "#3a332c", .8)]) },
  { id: "krzeslo", nazev: "Křeslo / trůn", kat: "Nábytek", w: 1, h: 1, cover: 2, svg: () => g([r(-8, -8, 16, 16, W, "#3a332c", 1.4, 4), r(-10, -10, 20, 6, Wd)]) },
  { id: "stolni-deska", nazev: "Psací stůl", kat: "Nábytek", w: 1, h: .5, cover: 2, svg: () => g([r(-11, -5, 22, 10, W), r(-9, -3, 8, 6, "#d8d0c0", "#3a332c", .8)]) },
  { id: "krb", nazev: "Krb", kat: "Nábytek", w: 1, h: .5, blocks: true, light: { bright: 10, dim: 10 }, svg: () => g([r(-11, -5, 22, 10, St), p("M-6 4 Q-4 -4 0 -2 Q4 -4 6 4 Z", "#e05a16")]) },
  { id: "pult", nazev: "Pult / bar", kat: "Nábytek", w: 2, h: .5, cover: 2, svg: () => r(-22, -5, 44, 10, Wd) },
  { id: "koberec-velky", nazev: "Koberec", kat: "Nábytek", w: 2, h: 3, svg: () => g([r(-22, -33, 44, 66, R_, "#3a332c", 1.4, 3), r(-18, -29, 36, 58, "none", "#a06a4a", 1)]) },
  { id: "sud", nazev: "Sud", kat: "Nábytek", w: .5, h: .5, cover: 2, svg: () => g([c(0, 0, 6, W), l(-6, -1, 6, -1, Wd, 1), l(-6, 1, 6, 1, Wd, 1)]) },
  { id: "bedna", nazev: "Bedna", kat: "Nábytek", w: .5, h: .5, cover: 2, difficult: true, svg: () => g([r(-6, -6, 12, 12, W), l(-6, -6, 6, 6, Wd, 1), l(-6, 6, 6, -6, Wd, 1)]) },
  { id: "bedny-sesup", nazev: "Hromada beden", kat: "Nábytek", w: 1, h: 1, cover: 2, difficult: true, svg: () => g([r(-11, -11, 12, 12, W), r(-1, -5, 12, 12, "#96774e"), r(-8, 2, 10, 9, Wd)]) },
  { id: "pydel", nazev: "Pytel", kat: "Nábytek", w: .5, h: .5, svg: () => p("M-5 6 Q-7 -2 -3 -5 L3 -5 Q7 -2 5 6 Z", "#a8946a") },
  /* --- Dungeon --- */
  { id: "sloup", nazev: "Sloup", kat: "Dungeon", w: .5, h: .5, blocks: true, cover: 3, svg: () => g([c(0, 0, 6, St), c(0, 0, 4, "#8f857a", "#3a332c", 1)]) },
  { id: "sloup-velky", nazev: "Masivní sloup", kat: "Dungeon", w: 1, h: 1, blocks: true, cover: 3, svg: () => g([c(0, 0, 11, St), c(0, 0, 8, "#8f857a", "#3a332c", 1)]) },
  { id: "socha", nazev: "Socha", kat: "Dungeon", w: .5, h: .5, blocks: true, cover: 3, svg: () => g([r(-6, 3, 12, 4, St), p("M-3 3 L-4 -4 Q0 -8 4 -4 L3 3 Z", "#8f857a")]) },
  { id: "sarkofag", nazev: "Sarkofág", kat: "Dungeon", w: 1, h: 2, cover: 2, svg: () => g([r(-9, -20, 18, 40, St, "#3a332c", 1.4, 6), p("M0 -14 l3 5 -3 5 -3 -5 z", "#6e6558")]) },
  { id: "hrobka-kryt", nazev: "Hrob", kat: "Dungeon", w: 1, h: 2, svg: () => g([r(-9, -20, 18, 40, "#6e6558", "#3a332c", 1.4, 3), l(-4, -14, 4, -14), l(0, -17, 0, -11)]) },
  { id: "oltar", nazev: "Oltář", kat: "Dungeon", w: 1, h: .5, cover: 2, svg: () => g([r(-11, -5, 22, 10, St), c(0, -1, 3, "#c9b489", "#3a332c", 1)]) },
  { id: "kazatelna", nazev: "Kazatelna", kat: "Dungeon", w: .5, h: .5, cover: 2, svg: () => g([r(-5, -5, 10, 10, W), r(-3, -7, 6, 4, Wd)]) },
  { id: "mriz", nazev: "Mříž / cela", kat: "Dungeon", w: 1, h: .25, blocks: true, svg: () => g([l(-11, 0, 11, 0, Mt, 2), l(-8, -2, -8, 2, Mt, 1.6), l(-4, -2, -4, 2, Mt, 1.6), l(0, -2, 0, 2, Mt, 1.6), l(4, -2, 4, 2, Mt, 1.6), l(8, -2, 8, 2, Mt, 1.6)]) },
  { id: "studna", nazev: "Studna", kat: "Dungeon", w: 1, h: 1, blocks: true, svg: () => g([c(0, 0, 10, St), c(0, 0, 6, "#22303c", "#3a332c", 1)]) },
  { id: "tajna-mistnost", nazev: "Pokladnice", kat: "Dungeon", w: 1, h: 1, cover: 2, svg: () => g([r(-10, -8, 20, 16, Wd), r(-2, -3, 4, 6, Mt)]) },
  { id: "pavouk-web", nazev: "Pavučiny", kat: "Dungeon", w: 1, h: 1, difficult: true, svg: () => g([l(-10, -10, 10, 10, "#cfd4da", .8), l(-10, 10, 10, -10, "#cfd4da", .8), l(0, -10, 0, 10, "#cfd4da", .8), l(-10, 0, 10, 0, "#cfd4da", .8), c(0, 0, 4, "none", "#cfd4da", .7)]) },
  { id: "kostlivec", nazev: "Kostlivec", kat: "Dungeon", w: .5, h: .5, svg: () => g([c(-2, -2, 3, "#d8d0c0"), l(-4, 2, 4, 5, "#d8d0c0", 1.4), l(-1, 4, 5, 1, "#d8d0c0", 1.2)]) },
  { id: "kosti-hromada", nazev: "Hromada kostí", kat: "Dungeon", w: 1, h: 1, difficult: true, svg: () => g([c(-4, -3, 3, "#cfc5b0"), c(3, 0, 2.4, "#d8d0c0"), l(-6, 4, 6, 6, "#d8d0c0", 1.4), l(-2, 6, 5, 3, "#cfc5b0", 1.2)]) },
  { id: "prulom", nazev: "Prolomená zeď", kat: "Dungeon", w: 1, h: .5, difficult: true, svg: () => p("M-11 -4 L-6 -6 L-2 -3 L3 -6 L8 -3 L11 -5 L11 5 L-11 5 Z", St) },
  { id: "schod-dolu", nazev: "Schody dolů", kat: "Dungeon", w: 1, h: 1, difficult: true, svg: () => g([r(-10, -10, 20, 20, "#57534e"), l(-8, -6, 8, -6, "#3a332c", 1), l(-8, -2, 8, -2, "#3a332c", 1), l(-8, 2, 8, 2, "#3a332c", 1), l(-8, 6, 8, 6, "#3a332c", 1)]) },
  { id: "balvan", nazev: "Balvan", kat: "Dungeon", w: 1, h: 1, blocks: true, cover: 3, svg: () => p("M-9 4 Q-11 -4 -4 -8 Q4 -11 9 -4 Q11 4 5 8 Q-4 10 -9 4 Z", St) },
  { id: "stalaktit", nazev: "Stalaktit", kat: "Dungeon", w: .5, h: .5, difficult: true, svg: () => p("M-5 5 L0 -7 L5 5 Z", "#6e6558") },
  { id: "trhlina", nazev: "Trhlina", kat: "Dungeon", w: .5, h: .5, svg: () => p("M-6 -6 L-1 0 L-5 4 L0 8", "none", "#3a332c", 1.4) },
  /* --- Příroda --- */
  { id: "strom", nazev: "Strom", kat: "Příroda", w: 1, h: 1, blocks: true, cover: 3, svg: () => g([c(0, 0, 10, Gn), c(0, 0, 6, "#4a6038", "#3a332c", 1), c(0, 0, 2, "#5d4229", "#3a332c", 1)]) },
  { id: "strom-velky", nazev: "Strom velký", kat: "Příroda", w: 2, h: 2, blocks: true, cover: 3, svg: () => g([c(0, 0, 21, Gn), c(0, 0, 14, "#4a6038", "#3a332c", 1), c(0, 0, 3.5, "#5d4229", "#3a332c", 1)]) },
  { id: "smrk", nazev: "Smrk", kat: "Příroda", w: 1, h: 1, blocks: true, cover: 3, svg: () => g([p("M0 -11 L8 2 L4 2 L9 9 L-9 9 L-4 2 L-8 2 Z", "#3e5c3a"), c(0, 9, 1.6, "#5d4229")]) },
  { id: "keř", nazev: "Keř", kat: "Příroda", w: .5, h: .5, cover: 2, difficult: true, svg: () => g([c(-3, 1, 4, Gn), c(3, -1, 4, "#4a6038"), c(0, -3, 3.4, "#55704a")]) },
  { id: "kamen", nazev: "Kámen", kat: "Příroda", w: .5, h: .5, cover: 2, svg: () => p("M-6 3 Q-7 -3 -2 -5 Q4 -6 6 -1 Q7 4 2 5 Q-3 6 -6 3 Z", St) },
  { id: "skala", nazev: "Skalní útvar", kat: "Příroda", w: 2, h: 1, blocks: true, cover: 3, svg: () => p("M-20 8 Q-22 -4 -10 -8 Q0 -10 10 -7 Q21 -5 20 6 Q12 9 -20 8 Z", "#6e6558") },
  { id: "pazdrovi", nazev: "Pařez", kat: "Příroda", w: .5, h: .5, cover: 2, difficult: true, svg: () => g([c(0, 0, 5, "#8a6a44"), c(0, 0, 3, "none", "#6b4f30", 1), c(0, 0, 1.4, "none", "#6b4f30", .8)]) },
  { id: "padly-strom", nazev: "Padlý strom", kat: "Příroda", w: 2, h: .5, cover: 2, difficult: true, svg: () => g([r(-20, -3, 40, 6, "#6b4f30", "#3a332c", 1.4, 3), c(-20, 0, 3, "#8a6a44")]) },
  { id: "houby", nazev: "Houby", kat: "Příroda", w: .5, h: .5, svg: () => g([p("M-5 2 Q-5 -4 0 -4 Q5 -4 5 2 Z", "#b04a3a"), l(0, 2, 0, 5, "#d8d0c0", 1.6), p("M3 5 Q3 1 6 1 Q9 1 9 5 Z", "#a06a4a")]) },
  { id: "houby-svitici", nazev: "Svítící houby", kat: "Příroda", w: .5, h: .5, light: { bright: 5, dim: 10 }, svg: () => g([p("M-5 2 Q-5 -4 0 -4 Q5 -4 5 2 Z", "#4a8a8a"), l(0, 2, 0, 5, "#bcd8e8", 1.6)]) },
  { id: "vinorost", nazev: "Vřes / porost", kat: "Příroda", w: 1, h: 1, difficult: true, svg: () => g([c(-5, -3, 3.5, "#55704a"), c(4, -4, 3, "#5d7345"), c(1, 4, 4, "#4a6038"), c(6, 3, 2.6, "#55704a")]) },
  { id: "reka-prechod", nazev: "Brod", kat: "Příroda", w: 1, h: 1, difficult: true, svg: () => g([c(-4, -2, 2.4, "#8f857a"), c(3, 1, 2, "#8f857a"), c(-1, 4, 1.8, "#7d7466")]) },
  { id: "koreny", nazev: "Kořeny", kat: "Příroda", w: 1, h: 1, difficult: true, svg: () => g([p("M-9 -8 Q-4 -2 -8 4 M-3 -9 Q0 -3 -4 8 M4 -8 Q6 -1 2 7 M9 -5 Q6 2 9 6", "none", "#5d4229", 1.6)]) },
  { id: "kvety", nazev: "Květiny", kat: "Příroda", w: .5, h: .5, svg: () => g([c(-3, -1, 1.6, "#a05a8a", "#3a332c", .8), c(2, 2, 1.6, "#c9b489", "#3a332c", .8), c(4, -3, 1.4, "#8a6a9a", "#3a332c", .8)]) },
  /* --- Město --- */
  { id: "studna-mesto", nazev: "Městská studna", kat: "Město", w: 1, h: 1, blocks: true, svg: () => g([c(0, 0, 10, St), c(0, 0, 6, "#22303c", "#3a332c", 1), r(-11, -11, 22, 3, Wd)]) },
  { id: "stodola-vuz", nazev: "Vůz", kat: "Město", w: 1, h: 2, cover: 2, svg: () => g([r(-8, -18, 16, 32, W), c(0, -16, 4, "none", Wd, 1.6), c(0, 16, 4, "none", Wd, 1.6)]) },
  { id: "stojan-stand", nazev: "Tržní stánek", kat: "Město", w: 1, h: 1, cover: 2, svg: () => g([r(-10, -7, 20, 14, W), p("M-11 -7 L0 -12 L11 -7 Z", R_)]) },
  { id: "lavoir-kasna", nazev: "Kašna", kat: "Město", w: 1, h: 1, blocks: true, svg: () => g([c(0, 0, 10, St), c(0, 0, 7, "#5f8a9e", "#3a332c", 1), c(0, 0, 2, St)]) },
  { id: "latarnik", nazev: "Lampa", kat: "Město", w: .25, h: .25, blocks: true, light: { bright: 15, dim: 15 }, svg: () => g([l(0, 5, 0, -4, "#3a332c", 1.6), c(0, -5, 2.4, "#f0b024")]) },
  { id: "plot", nazev: "Plot", kat: "Město", w: 1, h: .25, blocks: true, cover: 2, svg: () => g([l(-11, 0, 11, 0, Wd, 2), l(-8, -3, -8, 3, W, 1.6), l(-2, -3, -2, 3, W, 1.6), l(4, -3, 4, 3, W, 1.6), l(10, -3, 10, 3, W, 1.6)]) },
  { id: "zabradi", nazev: "Zábradlí", kat: "Město", w: 1, h: .25, cover: 2, svg: () => g([l(-11, 0, 11, 0, Mt, 2), l(-8, -2, -8, 0, Mt, 1.4), l(0, -2, 0, 0, Mt, 1.4), l(8, -2, 8, 0, Mt, 1.4)]) },
  { id: "kvetinac", nazev: "Květináč", kat: "Město", w: .5, h: .5, svg: () => g([p("M-4 5 L-5 -1 L5 -1 L4 5 Z", "#a06a4a"), c(-2, -3, 2, Gn, "#3a332c", .8), c(2, -3, 2, "#55704a", "#3a332c", .8)]) },
  { id: "kolo-voza", nazev: "Rozbitý vůz", kat: "Město", w: 1, h: 1, cover: 2, difficult: true, svg: () => g([r(-10, -6, 20, 12, Wd, "#3a332c", 1.4, 2), c(8, 7, 4, "none", Wd, 1.6)]) },
  { id: "markyza", nazev: "Markýza", kat: "Město", w: 1, h: 1, svg: () => g([r(-10, -10, 20, 20, R_, "#3a332c", 1.2, 2), l(-6, -10, -6, 10, "#a06a4a", 1), l(0, -10, 0, 10, "#a06a4a", 1), l(6, -10, 6, 10, "#a06a4a", 1)]) },
  { id: "smiti", nazev: "Hromada odpadu", kat: "Město", w: .5, h: .5, difficult: true, svg: () => g([p("M-6 5 Q-7 -2 -2 -4 Q4 -6 6 0 Q7 4 4 5 Z", "#6e6558"), c(-2, -2, 1, "#3e5c3a")]) },
  { id: "dvere-ikona", nazev: "Vrata", kat: "Město", w: 1, h: .25, svg: () => g([r(-11, -3, 22, 6, W), l(0, -3, 0, 3)]) },
  /* --- Loď --- */
  { id: "clun", nazev: "Člun", kat: "Loď", w: 1, h: 2, cover: 2, svg: () => g([p("M-8 -18 Q-10 0 -8 18 L8 18 Q10 0 8 -18 Q0 -22 -8 -18 Z", W), l(-6, -6, 6, -6, Wd), l(-6, 4, 6, 4, Wd)]) },
  { id: "stożar", nazev: "Stěžeň", kat: "Loď", w: .5, h: .5, blocks: true, svg: () => g([c(0, 0, 5, Wd), c(0, 0, 2, "#3a332c")]) },
  { id: "kotva", nazev: "Kotva", kat: "Loď", w: .5, h: .5, svg: () => g([c(0, -4, 2, "none", Mt, 1.4), l(0, -2, 0, 5, Mt, 1.8), p("M-4 2 Q-4 6 0 5 Q4 6 4 2", "none", Mt, 1.6)]) },
  { id: "vrv-kotel", nazev: "Kladka / lano", kat: "Loď", w: .5, h: .5, svg: () => g([c(0, 0, 5, "none", "#a8946a", 2), c(0, 0, 2.4, "none", "#a8946a", 1.6)]) },
  { id: "truhla-lod", nazev: "Náklad", kat: "Loď", w: 1, h: .5, cover: 2, svg: () => g([r(-10, -5, 20, 10, W), r(-9, -4, 6, 8, "#a8946a")]) },
  /* --- Magie --- */
  { id: "mag-kruh", nazev: "Magický kruh", kat: "Magie", w: 1, h: 1, svg: () => g([c(0, 0, 10, "none", "#7d5aa0", 1.2), c(0, 0, 7, "none", "#7d5aa0", .8), p("M0 -7 L6 4 L-6 4 Z", "none", "#7d5aa0", .9)]) },
  { id: "portal", nazev: "Portál", kat: "Magie", w: 1, h: 1, svg: () => g([c(0, 0, 9, "none", "#4a8a9a", 2), c(0, 0, 6, "#2e4f63", "#4a8a9a", 1)]) },
  { id: "rune-kamen", nazev: "Runový kámen", kat: "Magie", w: .5, h: .5, blocks: true, svg: () => g([p("M-4 5 L-5 -4 L0 -6 L5 -4 L4 5 Z", "#57534e"), p("M-2 -2 L0 1 L2 -2", "none", "#7d5aa0", 1)]) },
  { id: "krystal", nazev: "Krystal", kat: "Magie", w: .5, h: .5, light: { bright: 5, dim: 10 }, svg: () => p("M0 -6 L4 -1 L2 6 L-2 6 L-4 -1 Z", "#6ab8c9") },
  { id: "kotel", nazev: "Kotel", kat: "Magie", w: .5, h: .5, light: { bright: 5, dim: 5 }, svg: () => g([c(0, 1, 5, "#3a3a3a"), c(0, 0, 3.4, "#4a8a3a", "#3a332c", 1)]) },
  { id: "magicky-oltar", nazev: "Rituální oltář", kat: "Magie", w: 1, h: 1, cover: 2, light: { bright: 5, dim: 10 }, svg: () => g([c(0, 0, 9, St), p("M0 -5 L4 3 L-4 3 Z", "none", "#7d5aa0", 1.2)]) },
  { id: "svitek-police", nazev: "Police svitků", kat: "Magie", w: 1, h: .5, blocks: true, svg: () => g([r(-11, -5, 22, 10, Wd), c(-7, 0, 2, "#c9b489", "#3a332c", .8), c(0, 0, 2, "#d8d0c0", "#3a332c", .8), c(7, 0, 2, "#c9b489", "#3a332c", .8)]) },
  /* --- Pasti a nebezpečí --- */
  { id: "spiky", nazev: "Hřeby / spiky", kat: "Pasti a nebezpečí", w: 1, h: 1, difficult: true, svg: () => g([p("M-8 8 L-5 -4 L-2 8 Z M-1 8 L2 -6 L5 8 Z M6 8 L8 -2 L10 8 Z", Mt)]) },
  { id: "jama-spiky", nazev: "Jáma s hřeby", kat: "Pasti a nebezpečí", w: 1, h: 1, svg: () => g([r(-10, -10, 20, 20, "#1c1917", "#3a332c", 1.4, 2), p("M-6 6 L-3 -4 L0 6 Z M2 6 L5 -4 L8 6 Z", Mt)]) },
  { id: "past-klapka", nazev: "Padací klapka", kat: "Pasti a nebezpečí", w: 1, h: .5, svg: () => g([r(-10, -4, 20, 8, "#1c1917"), l(-8, 0, 8, 0, "#3a332c", 1)]) },
  { id: "ohen-past", nazev: "Ohnivá past", kat: "Pasti a nebezpečí", w: .5, h: .5, svg: () => g([c(0, 0, 5, "none", "#e05a16", 1.2), p("M0 -4 L3 2 L-3 2 Z", "none", "#e05a16", 1)]) },
  { id: "lano-past", nazev: "Lanková past", kat: "Pasti a nebezpečí", w: .5, h: .5, svg: () => c(0, 0, 5, "none", "#a8946a", 1.4) },
  { id: "trn", nazev: "Trnitý porost", kat: "Pasti a nebezpečí", w: 1, h: 1, difficult: true, svg: () => g([p("M-8 8 L-6 -6 L-4 8 Z M-2 8 L0 -8 L2 8 Z M4 8 L7 -5 L9 8 Z", "#4a6038")]) },
  { id: "kyselina", nazev: "Kyselá louže", kat: "Pasti a nebezpečí", w: 1, h: 1, difficult: true, svg: () => g([p("M-8 2 Q-9 -4 -3 -6 Q4 -8 8 -3 Q10 2 5 6 Q-3 8 -8 2 Z", "#5c8a3a", "#3a5c2a", 1)]) },
  { id: "netopyri", nazev: "Hnízdo netopýrů", kat: "Pasti a nebezpečí", w: .5, h: .5, svg: () => g([p("M-5 0 Q-2 -4 0 0 Q2 -4 5 0 Q2 4 0 1 Q-2 4 -5 0 Z", "#3a3a3a")]) },
  /* --- Světla --- */
  { id: "pochodeň", nazev: "Pochodeň", kat: "Světla", w: .25, h: .25, light: { bright: 20, dim: 20 }, svg: () => g([l(0, 4, 0, -2, "#6b4f30", 1.6), p("M-2 -3 Q0 -7 2 -3 Q2 -1 0 -1 Q-2 -1 -2 -3 Z", "#f08a24")]) },
  { id: "ohriste", nazev: "Ohniště", kat: "Světla", w: 1, h: 1, light: { bright: 15, dim: 15 }, difficult: true, svg: () => g([c(0, 0, 8, "none", St, 2), c(0, 0, 4, "#e05a16", "#8a3010", 1)]) },
  { id: "brasier", nazev: "Žhavina / brazier", kat: "Světla", w: .5, h: .5, light: { bright: 10, dim: 10 }, svg: () => g([p("M-5 5 L-4 0 L4 0 L5 5 Z", Mt), c(0, -1, 3, "#f08a24", "#8a3010", 1)]) },
  { id: "svicka", nazev: "Svíčka", kat: "Světla", w: .25, h: .25, light: { bright: 5, dim: 5 }, svg: () => g([r(-1, -2, 2, 6, "#d8d0c0", "#3a332c", .8), c(0, -3.4, 1.2, "#f0b024")]) },
  { id: "lucerna", nazev: "Lucerna", kat: "Světla", w: .25, h: .25, light: { bright: 10, dim: 10 }, svg: () => g([r(-2.4, -4, 4.8, 8, "#3a3a3a", "#3a332c", 1, 1), c(0, 0, 1.4, "#f0b024")]) },
  { id: "kandelabr", nazev: "Svícen", kat: "Světla", w: .5, h: .5, light: { bright: 10, dim: 10 }, svg: () => g([l(0, 5, 0, -4, "#8a8070", 1.6), l(-3, -2, 3, -2, "#8a8070", 1.4), c(-3, -3, 1, "#f0b024"), c(0, -5, 1, "#f0b024"), c(3, -3, 1, "#f0b024")]) },
  { id: "svitici-runa", nazev: "Svítící runa", kat: "Světla", w: .5, h: .5, light: { bright: 10, dim: 10 }, svg: () => p("M-3 4 L0 -5 L3 4 M-1.5 0 L1.5 0", "none", "#6ab8c9", 1.4) },
  { id: "krb-vapka", nazev: "Magický plamen", kat: "Světla", w: .5, h: .5, light: { bright: 15, dim: 15 }, svg: () => p("M-3 5 Q-5 0 -1 -2 Q-3 -6 1 -7 Q5 -3 3 1 Q5 4 2 5 Z", "#4a8a9a") },
  /* --- Tábor / bitva --- */
  { id: "stan", nazev: "Stan", kat: "Tábor/bitva", w: 1, h: 1, cover: 2, svg: () => p("M-10 8 L0 -10 L10 8 Z", "#a8946a") },
  { id: "stan-velky", nazev: "Stan velký", kat: "Tábor/bitva", w: 2, h: 2, cover: 2, svg: () => g([p("M-20 18 L0 -20 L20 18 Z", "#a8946a"), p("M-4 18 L0 6 L4 18 Z", "#6b5a3a")]) },
  { id: "ohne-tabor", nazev: "Táborák", kat: "Tábor/bitva", w: .5, h: .5, light: { bright: 15, dim: 15 }, svg: () => g([l(-4, 4, 4, -2, "#5d4229", 2), l(-4, -2, 4, 4, "#5d4229", 2), c(0, 1, 2.6, "#e05a16", "#8a3010", 1)]) },
  { id: "barikada", nazev: "Barikáda", kat: "Tábor/bitva", w: 2, h: .5, cover: 2, difficult: true, svg: () => g([l(-20, -4, 20, 4, "#5d4229", 3), l(-14, -5, -14, 5, Wd, 2), l(0, -5, 0, 5, Wd, 2), l(14, -5, 14, 5, Wd, 2)]) },
  { id: "jezek", nazev: "Protijezdecký ježek", kat: "Tábor/bitva", w: .5, h: .5, difficult: true, svg: () => g([l(-6, -6, 6, 6, Wd, 2.4), l(-6, 6, 6, -6, Wd, 2.4)]) },
  { id: "vlajka", nazev: "Vlajka", kat: "Tábor/bitva", w: .25, h: .25, svg: () => g([l(0, 6, 0, -6, "#3a332c", 1.4), p("M0 -6 L7 -4 L0 -1 Z", R_)]) },
  { id: "zbroj-stojan", nazev: "Stojan na zbraně", kat: "Tábor/bitva", w: .5, h: .5, cover: 2, svg: () => g([r(-6, 2, 12, 3, W), l(-4, -5, -4, 2, Mt, 1.4), l(0, -6, 0, 2, Mt, 1.4), l(4, -4, 4, 2, Mt, 1.4)]) },
  { id: "zavazi", nazev: "Válec / pytle", kat: "Tábor/bitva", w: 1, h: .5, cover: 2, difficult: true, svg: () => g([p("M-10 4 Q-11 -2 -6 -4 L6 -4 Q11 -2 10 4 Z", "#a8946a"), l(-4, -4, -4, 4, "#8a7a55", 1), l(2, -4, 2, 4, "#8a7a55", 1)]) },
  { id: "valek-buben", nazev: "Válečný buben", kat: "Tábor/bitva", w: .5, h: .5, svg: () => g([c(0, 0, 5, W), c(0, 0, 4, "#a8946a", Wd, 1)]) },
];

export const stampById = (id: string) => STAMPS.find((s) => s.id === id);

/** Vykreslí stamp (kresba je autorsky v buňkových jednotkách ×24 px, centrum 0,0). */
export function StampSvg({ def, tint }: { def: StampDef; tint?: string }) {
  return (
    <g>
      {def.svg()}
      {tint && <rect x={-def.w * 12} y={-def.h * 12} width={def.w * 24} height={def.h * 24} fill={tint} opacity={0.25} style={{ pointerEvents: "none" }} />}
    </g>
  );
}
