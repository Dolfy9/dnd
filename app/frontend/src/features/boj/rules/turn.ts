import { alertInit } from "./actions/features";
/* Kolo/tah: iniciativa, posun tahu, zpracování začátku/konce tahu, action economy,
   recharge, legendary actions, death-save prompt. Stav = StavBoje (legacy-kompatibilní). */
import type { StavBoje, Token, LogEntry, EcoState } from "../types";
import { uid } from "../types";
import { hasCond, isIncap, speedOf, flySpeedOf } from "./conditions";
import { sumMods, tickEffects, dropConcentration } from "./effects";
import { d20, die, type Rng, defaultRng } from "./dice";
import { settingsOf } from "./settings";
import { deathSave } from "./damage";

export const byId = (S: StavBoje, id?: string | null) => S.tok.find((t) => t.id === id);
export const cur = (S: StavBoje) => byId(S, S.ord?.[S.turn ?? -1]);
export const alive = (S: StavBoje) => S.tok.filter((t) => !t.dead);

export function log(S: StavBoje, typ: LogEntry["typ"], t: string, kdo?: string, detail?: string, pj = false) {
  S.log.unshift({
    k: S.round, c: new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }),
    kdo: kdo || "", typ, t, detail, pj: pj || undefined,
  });
  if (S.log.length > 400) S.log.length = 400;
}

/** Hod iniciativy za všechny žetony; Surprise (2024) = Disadvantage. */
export function rollInitiative(S: StavBoje, rng: Rng = defaultRng, surpriseIds: string[] = []): void {
  delete S.legendaryWindow;
  for (const t of S.tok) {
    const r = d20(surpriseIds.includes(t.id) ? -1 : 0, rng);
    t.init = r.r + (t.initB || 0) + alertInit(t);
    t.initRoll = r.rolls;
  }
  S.ord = [...S.tok].sort((x, y) => (y.init ?? 0) - (x.init ?? 0) || (y.initB ?? 0) - (x.initB ?? 0)).map((t) => t.id);
  S.turn = 0;
  if (S.round < 1) S.round = 1;
  log(S, "turn", `Kolo ${S.round}: iniciativa svržena`, "PJ");
}

export const ecoOf = (S: StavBoje, t: Token): EcoState => {
  if (!S.eco[t.id]) resetEconomy(S, t);
  return S.eco[t.id];
};

export function resetEconomy(S: StavBoje, t: Token): void {
  S.eco[t.id] = { a: 0, b: 0, r: 0, moved: 0, objInt: 0, spell: 0, baSpell: 0, dash: 0, disengage: 0, extraA: 0 };
  if (t.x != null) t.startPos = [t.x, t.y!];
  t.react = true;
}

/** Zbývající pohyb ve ft (speed − moved + Dash + efekty, speed0 stavy = 0). */
export const moveLeft = (S: StavBoje, t: Token): number => {
  const e = ecoOf(S, t);
  const sp = Math.max(speedOf(t), flySpeedOf(t));
  return Math.max(0, sp + e.dash * sp - e.moved);
};

/** Je akce/bonus/reakce volná? */
export const ecoFree = (S: StavBoje, t: Token, k: "a" | "b" | "r"): boolean => !ecoOf(S, t)[k];

export function useEco(S: StavBoje, t: Token, k: "a" | "b" | "r" | "objInt"): boolean {
  if (settingsOf(S).rezim === "volny") return true;   // Volný režim: ekonomika se nesleduje
  const e = ecoOf(S, t);
  if (e[k]) return false;
  e[k] = 1;
  if (k === "r") t.react = false;
  return true;
}

export function legendaryActionError(S: StavBoje, t: Token, cost: number): string | undefined {
  if (t.dead || t.hp <= 0 || isIncap(t)) return "Legendární akce: tvor nemůže jednat";
  const window = S.legendaryWindow;
  if (!window || window.actorId !== cur(S)?.id || window.actorId === t.id)
    return "Legendární akce: jen na konci tahu jiného tvora";
  if (window.usedBy.includes(t.id)) return "Jen jedna legendární akce na konci tahu";
  if (!Number.isInteger(cost) || cost < 1 || !t.legendary || t.legendary.max - t.legendary.used < cost)
    return "Nedostatek legendárních akcí";
}

export function useLegendaryAction(S: StavBoje, t: Token, cost: number): boolean {
  if (legendaryActionError(S, t, cost)) return false;
  t.legendary!.used += cost;
  S.legendaryWindow!.usedBy.push(t.id);
  log(S, "effect", `${t.nazev}: legendární akce −${cost} (${t.legendary!.max - t.legendary!.used}/${t.legendary!.max})`, t.nazev);
  return true;
}

/** Záchrany "save na konci tahu" + tick efektů; vrací hlášky. */
export function endOfTurnProcess(S: StavBoje, t: Token, rng: Rng = defaultRng): string[] {
  const out: string[] = [];
  for (const e of [...(t.effects || [])]) {
    if (e.saveEnd && e.saveEnd.dc) {
      const bonus = t.saves?.[e.saveEnd.ab] ?? t.mods?.[e.saveEnd.ab] ?? 0;
      const r = d20(0, rng);
      const ok = r.r + bonus >= e.saveEnd.dc;
      if (ok) {
        out.push(`${t.nazev}: ${e.saveEnd.ab} save ${r.r}${bonus >= 0 ? "+" : ""}${bonus} ≥ ${e.saveEnd.dc} — ${e.nazev} končí`);
        if (e.mods?.grantsCond || e.conc) void 0;
        if (e.mods?.grantsCond) t.cond = t.cond.filter((c) => c.n !== e.mods!.grantsCond);
        if (e.conc) {
          const res = dropConcentration(S.tok, S.zones, e.src || "", e.conc);
          S.zones = res.zones; out.push(...res.messages);
          const src = byId(S, e.src); if (src && src.conc === e.conc) src.conc = false;
        }
        t.effects = t.effects.filter((x) => x !== e);
      } else out.push(`${t.nazev}: ${e.saveEnd.ab} save ${r.r}${bonus >= 0 ? "+" : ""}${bonus} < ${e.saveEnd.dc} — ${e.nazev} trvá`);
    }
  }
  for (const n of tickEffects(t, "end", t.id)) out.push(`${t.nazev}: efekt ${n} skončil`);
  return out;
}

export function startOfTurnProcess(S: StavBoje, t: Token, rng: Rng = defaultRng): string[] {
  const out: string[] = [];
  resetEconomy(S, t);
  if (t.legendary) t.legendary.used = 0;
  for (const n of tickEffects(t, "start", t.id)) out.push(`${t.nazev}: efekt ${n} skončil`);
  for (const u of t.atk || []) {
    if (u.rc && t.spent?.[u.nazev] && settingsOf(S).automatizace.recharge === "auto") {
      if (die(6, rng) >= u.rc) { delete t.spent[u.nazev]; out.push(`${t.nazev}: ${u.nazev} recharged`); }
    }
  }
  if (t.hp <= 0 && t.dying && !t.dead) {
    if (settingsOf(S).automatizace.deathSaves === "auto") out.push(deathSave(t, d20(0, rng).r).text);
    else out.push(`${t.nazev} umírá — hoď death save`);
  }
  if (isIncap(t)) out.push(`${t.nazev} je Incapacitated — žádné akce`);
  return out;
}

/** Posun o tah / kolo dopředu. */
export function advanceTurn(S: StavBoje, rng: Rng = defaultRng): { newRound: boolean; msg: string[] } {
  const msg: string[] = [];
  const t = cur(S);
  const free = settingsOf(S).rezim === "volny";
  if (free) {
    delete S.legendaryWindow;
    S.ord = (S.ord || []).filter((id) => { const x = byId(S, id); return x && !x.dead; });
    let ni = (S.turn ?? -1) + 1;
    let newRound = false;
    if (S.ord.length && ni >= S.ord.length) { ni = 0; S.round += 1; newRound = true; }
    S.turn = ni;
    const nx = cur(S);
    if (nx) log(S, "turn", `${nx.nazev} je na tahu${newRound ? ` (kolo ${S.round})` : ""}`, "PJ");
    S.turnMsgs = [];
    return { newRound, msg };
  }
  if (t && !S.legendaryWindow) {
    msg.push(...endOfTurnProcess(S, t, rng));
    S.legendaryWindow = { actorId: t.id, usedBy: [] };
    if (S.tok.some(owner => owner.atk.some(atk => atk.legendaryCost != null && !legendaryActionError(S, owner, atk.legendaryCost)))) {
      msg.unshift(`Konec tahu ${t.nazev} — okno pro legendární akce; Další pokračuje`);
      for (const m of msg) log(S, "system", m, "PJ");
      S.turnMsgs = msg;
      return { newRound: false, msg };
    }
  }
  delete S.legendaryWindow;
  const order = S.ord || [];
  const living = (id: string) => { const actor = byId(S, id); return actor && !actor.dead; };
  const nextId = order.slice(S.turn + 1).find(living) ?? order.find(living);
  const newRound = nextId != null && S.turn >= 0 && order.indexOf(nextId) <= S.turn;
  S.ord = (S.ord || []).filter((id) => { const x = byId(S, id); return x && !x.dead; });
  if (newRound) { S.round += 1; msg.push(`— kolo ${S.round} —`); }
  S.turn = nextId == null ? -1 : S.ord.indexOf(nextId);
  const nx = cur(S);
  if (nx) msg.push(...startOfTurnProcess(S, nx, rng));
  if (nx) log(S, "turn", `${nx.nazev} je na tahu${newRound ? ` (kolo ${S.round})` : ""}`, "PJ");
  for (const m of msg) if (!/na tahu|kolo/.test(m)) log(S, "system", m, "PJ");
  S.turnMsgs = msg;
  return { newRound, msg };
}

/** Standardní akce 2024. */
export const STD_ACTIONS = [
  { id: "attack", nazev: "Attack", desc: "Jeden nebo více útoků (podle Extra Attack)." },
  { id: "dash", nazev: "Dash", desc: "+movement rovné speed." },
  { id: "disengage", nazev: "Disengage", desc: "Pohyb nevyvolává OA tento tah." },
  { id: "dodge", nazev: "Dodge", desc: "Dis útokům proti tobě + adv DEX saves." },
  { id: "help", nazev: "Help", desc: "Spojenci adv na příští útok / check." },
  { id: "hide", nazev: "Hide", desc: "Stealth check; Invisible dokud tě nenajdou." },
  { id: "influence", nazev: "Influence", desc: "Ovlivni postoj tvora." },
  { id: "magic", nazev: "Magic", desc: "Sesílání kouzla / magického předmětu." },
  { id: "ready", nazev: "Ready", desc: "Připrav akci na trigger (reaction)." },
  { id: "search", nazev: "Search", desc: "Perception/Investigation hledání." },
  { id: "study", nazev: "Study", desc: "Prozkoumej věc (Arcana/History/…)." },
  { id: "utilize", nazev: "Utilize", desc: "Použij předmět (ne magický)." },
  { id: "grapple", nazev: "Grapple (Unarmed)", desc: "Zápas: cíl STR/DEX save vs DC 8+STR+PB." },
  { id: "shove", nazev: "Shove (Unarmed)", desc: "Strčení: Prone nebo odtlačení 5 ft." },
  { id: "escape", nazev: "Escape", desc: "Uvolnění z Grappled (Athletics/Acrobatics)." },
  { id: "standup", nazev: "Stand Up", desc: "Vstát z Prone (½ speed)." },
  { id: "dropprone", nazev: "Drop Prone", desc: "Lehnout si (zdarma)." },
  { id: "crawl", nazev: "Crawl", desc: "Plazení — pohyb ×2 (přepínač)." },
  { id: "jumplong", nazev: "Long Jump", desc: "Skok do dálky: STR ft (rozběh 10 ft)." },
  { id: "jumphigh", nazev: "High Jump", desc: "Skok do výšky: 3+STR mod." },
  { id: "flyup", nazev: "Fly ↑", desc: "Vzletět +5 ft elevace (−5 ft pohybu)." },
  { id: "flydown", nazev: "Fly ↓", desc: "Klesnout −5 ft elevace (−5 ft pohybu)." },
] as const;

export type StdActionId = (typeof STD_ACTIONS)[number]["id"];
