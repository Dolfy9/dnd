/* Nastavení boje: výchozí hodnoty, merge, perzistence výchozích pro nové boje. */
import type { BattleSettings, StavBoje } from "../types";

const LS_KEY = "boj-defaults:v1";

/** Tvrdé výchozí hodnoty (2024 pravidla, DM-friendly defaulty). */
export function defaultSettings(): BattleSettings {
  return {
    pohyb: {
      limit: "zeptat",
      uhlopricky: "5",
      pruchodNepratel: "blokovat",
      oa: "zeptat",
      zonyPriPresunuDM: true,
      mimoTah: "volne",
      priprava: "volne",
      sledujTah: true,
    },
    automatizace: {
      hodUtoku: "auto",
      zraneni: "potvrdit",
      concentration: "auto",
      zony: "auto",
      expirace: "auto",
      recharge: "auto",
      deathSaves: "auto",
      ekonomika: "hlidat",
      sloty: "hlidat",
      dosah: "hlidat",
    },
  };
}

/** Hluboký merge: načte výchozí + překryje hodnotami z `o`. */
export function mergeSettings(o?: Partial<BattleSettings> | null): BattleSettings {
  const d = defaultSettings();
  if (!o) return d;
  return {
    pohyb: { ...d.pohyb, ...(o.pohyb || {}) },
    automatizace: { ...d.automatizace, ...(o.automatizace || {}) },
  };
}

/** Uložené výchozí pro nové boje (localStorage), jinak null. */
export function loadDefaultSettings(): BattleSettings | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? mergeSettings(JSON.parse(raw)) : null;
  } catch { return null; }
}

export function saveDefaultSettings(s: BattleSettings) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* */ }
}

/** Efektivní nastavení stavu boje: nastaveni v boji → LS výchozí → tvrdé defaulty. */
export function settingsOf(S: StavBoje): BattleSettings {
  return S.nastaveni ? mergeSettings(S.nastaveni) : (loadDefaultSettings() || defaultSettings());
}

/** Popisky pro UI (jednovětné české vysvětlivky). */
export const SETTING_LABELS: Record<string, { n: string; hint: string; opts: Record<string, string> | null }> = {
  "pohyb.limit": { n: "Limit pohybu", hint: "Co se stane při přesunu za hranici pohybu", opts: { prisne: "Přísné — jen Dash", zeptat: "Zeptat se DM", volne: "Volné — provést a zaznamenat" } },
  "pohyb.uhlopricky": { n: "Úhlopříčky", hint: "Cena diagonálního kroku", opts: { "5": "5 ft (2024)", "5-10": "5/10 ft (DMG varianta)" } },
  "pohyb.pruchodNepratel": { n: "Průchod nepřáteli", hint: "Zda lze projít buňkou nepřítele", opts: { blokovat: "Blokovat (2024)", povolit: "Povolit" } },
  "pohyb.oa": { n: "Opportunity Attack", hint: "Reakce při odchodu z dosahu", opts: { zeptat: "Zeptat se (quick-resolve)", jenZaznam: "Jen zaznamenat do logu", vypnuto: "Vypnuto" } },
  "pohyb.zonyPriPresunuDM": { n: "Zóny při nuceném přesunu", hint: "Triggerovat vstup do zóny i při DM/nuceném přesunu", opts: null },
  "pohyb.mimoTah": { n: "Přesun mimo tah", hint: "Žeton, který není na tahu, během boje", opts: { volne: "Volné (nucený přesun)", zeptat: "Zeptat se DM" } },
  "pohyb.sledujTah": { n: "Sledovat aktivního", hint: "Při novém tahu přesunout mapu na aktivního, je-li mimo obraz", opts: null },
  "automatizace.hodUtoku": { n: "Hod útoku", hint: "Zda se kostky hází automaticky", opts: { auto: "Automaticky", rucne: "Ručně — resolve otevře pole pro hod" } },
  "automatizace.zraneni": { n: "Zranění", hint: "Před aplikací zobrazit výsledné damage za cíl", opts: { auto: "Aplikovat rovnou", potvrdit: "Potvrdit/editovat předem" } },
  "automatizace.concentration": { n: "Concentration", hint: "Hlídat koncentraci u efektů/zón", opts: { auto: "Automaticky", zeptat: "Zeptat se", vypnuto: "Vypnuto" } },
  "automatizace.zony": { n: "Zóny", hint: "Triggerovat vstup/výstup a start-of-turn zóny", opts: { auto: "Automaticky", zeptat: "Zeptat se", vypnuto: "Vypnuto" } },
  "automatizace.expirace": { n: "Expirace efektů", hint: "Automaticky ukončovat efekty na konci trvání", opts: { auto: "Automaticky", zeptat: "Zeptat se" } },
  "automatizace.recharge": { n: "Recharge", hint: "Automaticky házet dobíjení schopností", opts: { auto: "Automaticky", rucne: "Ručně (DM rozhodne)" } },
  "automatizace.deathSaves": { n: "Death saves", hint: "Hody na záchranu před smrtí", opts: { auto: "Automaticky", rucne: "Ručně" } },
  "automatizace.ekonomika": { n: "Action economy", hint: "Action/Bonus/Reaction už použité", opts: { hlidat: "Hlídat — zeptat se DM", varovat: "Provést + varování v logu", vypnuto: "Vypnuto" } },
  "automatizace.sloty": { n: "Sloty a zdroje", hint: "Spell sloty a spotřební zdroje", opts: { hlidat: "Hlídat — zeptat se DM", varovat: "Provést + varování v logu", vypnuto: "Vypnuto" } },
  "automatizace.dosah": { n: "Dostřel a kryt", hint: "Útok mimo dostřel / plný kryt / recharge", opts: { hlidat: "Hlídat — zeptat se DM", varovat: "Provést + varování v logu" } },
};
