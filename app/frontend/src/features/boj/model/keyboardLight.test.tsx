import { expect, it, vi } from "vitest";
import { migrate } from "../rules/migrate";
import { updateLightState } from "./lightState";

const context = vi.hoisted(() => ({ S: null as any, map: null as any, effects: [] as (() => any)[], states: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: any) => [context.states++ === 0 ? "hero" : typeof initial === "function" ? initial() : initial, vi.fn()],
  useMemo: (fn: () => any) => fn(),
  useRef: (current: any) => ({ current }),
  useEffect: (fn: () => any) => { context.effects.push(fn); },
}));
vi.mock("../state/useBattle", () => ({ useBattle: () => ({ S: context.S, dispatch: (fn: (s: any) => void) => fn(context.S) }) }));
vi.mock("../../../store", () => ({ useApp: (selector: any) => selector ? vi.fn() : { user: {}, previewPlayer: false }, isEditor: () => true }));
vi.mock("react-router-dom", async original => ({ ...await original<typeof import("react-router-dom")>(), useSearchParams: () => [new URLSearchParams("boj=test")], useNavigate: () => vi.fn() }));
vi.mock("@tanstack/react-query", async original => ({ ...await original<typeof import("@tanstack/react-query")>(), useQuery: () => ({ data: { bojove_mapy: [context.map] } }) }));
import BattlePage from "../components/BattlePage";

it.each([true, false])("refreshes anonymous illumination after keyboard movement (teleport=%s)", altKey => {
  context.states = 0; context.effects = [];
  context.map = { id: "m", nazev: "M", podklad: "jine", mrizka: ["..."], svetla: [{ id: "secret", x: 2.5, y: .5, bright: 0, dim: 0, dmOnly: true, zap: false }] };
  context.S = migrate({ map: "m", lightLevel: "dark", ord: ["hero"], tok: [{ id: "hero", nazev: "Hero", kind: "custom", side: "druzina", x: 0, y: 0, s: 1, hp: 10, max: 10, speed: 30 }], lights: [{ id: "carried", tokenId: "hero", bright: 0, dim: 0 }] });
  updateLightState(context.S, context.map);
  expect(context.S.lightCells["0,0"]).toBe("bright");
  let handler: ((e: any) => void) | undefined;
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("window", { innerHeight: 1000, innerWidth: 1600, addEventListener: (_: string, h: any) => { handler = h; }, removeEventListener: vi.fn() });
  try {
    BattlePage();
    context.effects.find(fn => fn.toString().includes('"keydown"'))!();
    handler!({ key: "ArrowRight", altKey, target: null, preventDefault: vi.fn() });
    expect(context.S.tok[0].x).toBe(1);
    expect(context.S.lightCells["0,0"]).toBe("dark");
    expect(context.S.lightCells["1,0"]).toBe("bright");
  } finally { vi.unstubAllGlobals(); }
});
