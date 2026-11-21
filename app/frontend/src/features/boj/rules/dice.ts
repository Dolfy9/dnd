/* Kostkové výrazy: "2d6+5", "1d6+2+0", "8d6", "3d8-2". Čisté, testovatelné. */

export type Rng = () => number; // 0..1
export const defaultRng: Rng = () => Math.random();
export const die = (f: number, rng: Rng = defaultRng): number => 1 + Math.floor(rng() * f);

export interface DiceTerm { sign: number; n: number; f: number } // f=0 → konstanta

const TERM = /([+\-−])?(\d*)d(\d+)|([+\-−])?(\d+)/g;

export function parseDice(expr: string): DiceTerm[] {
  const out: DiceTerm[] = [];
  String(expr || "").replace(/\s/g, "").replace(TERM, (_m, s1, n, f, s2, k) => {
    if (f !== undefined) out.push({ sign: s1 === "-" || s1 === "−" ? -1 : 1, n: Number(n) || 1, f: Number(f) });
    else out.push({ sign: s2 === "-" || s2 === "−" ? -1 : 1, n: Number(k), f: 0 });
    return _m;
  });
  return out;
}

export function diceAvg(expr: string): number {
  return parseDice(expr).reduce((s, t) => s + (t.f ? t.sign * t.n * (t.f + 1) / 2 : t.sign * t.n), 0);
}

/** Průměr jen kostkových členů (pro crit bonus damage). */
export function diceOnlyAvg(expr: string): number {
  return parseDice(expr).reduce((s, t) => s + (t.f ? t.sign * t.n * (t.f + 1) / 2 : 0), 0);
}

export interface RollResult { total: number; parts: number[] }

/** Hod kostkami; crit zdvojnásobí počet kostek. */
export function rollDice(expr: string, opts: { crit?: boolean; rng?: Rng } = {}): RollResult {
  const rng = opts.rng || defaultRng;
  let total = 0;
  const parts: number[] = [];
  for (const t of parseDice(expr)) {
    if (t.f) {
      const count = t.n * (opts.crit ? 2 : 1);
      for (let i = 0; i < count; i++) {
        const r = die(t.f, rng);
        total += t.sign * r;
        parts.push(r);
      }
    } else total += t.sign * t.n;
  }
  return { total: Math.max(0, total), parts };
}

export interface D20Result { r: number; rolls: number[] }

/** d20 s výhodou (adv>0) / nevýhodou (adv<0). */
export function d20(adv: number = 0, rng: Rng = defaultRng): D20Result {
  const a = die(20, rng);
  if (!adv) return { r: a, rolls: [a] };
  const b = die(20, rng);
  return { r: adv > 0 ? Math.max(a, b) : Math.min(a, b), rolls: [a, b] };
}
