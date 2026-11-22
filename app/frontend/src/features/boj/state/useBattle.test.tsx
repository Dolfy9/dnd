import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBattle } from "./useBattle";
import { applyResolution, previewResolution } from "./resolution";
import { custom } from "../rules/combatants";
import type { BattleMapData } from "../types";

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), toast: vi.fn() }));
vi.mock("../../../api", () => api);
vi.mock("../../../components/ui", () => ({ toast: api.toast }));
class Socket {
  static current: Socket;
  onmessage?: (event: { data: string }) => void;
  constructor() { Socket.current = this; }
  close() {}
  emit(version: number) { this.onmessage?.({ data: JSON.stringify({ channel: "battle:test", event: "state", data: { version } }) }); }
}
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
};
const map: BattleMapData = { id: "map", nazev: "Map", podklad: "mesto", mrizka: Array(20).fill("..............................") };
const fixture = () => ({ version: 1, state: { stav_boje: {
  map: "map", round: 3, turn: 0, ord: ["hero", "one", "two", "three"], log: [], eco: {}, zones: [], fx: [],
  tok: ["hero", "one", "two", "three"].map((id, i) => ({ ...custom(id, i ? "nepratele" : "druzina", 100, 14), id, x: i ? 10 + i : 2, y: 5 })),
} } });
let battle: ReturnType<typeof useBattle>;
let root: ReactTestRenderer;
function Harness({ bid = "test" }: { bid?: string }) { battle = useBattle(bid); return null; }
const flush = async (fn: () => void | Promise<unknown>) => { await act(async () => { await fn(); }); };
async function mount() {
  await flush(() => { root = create(<Harness />); });
  await flush(() => battle.load());
}
function fireball() {
  return previewResolution(battle.S!, map, { kind: "area", srcId: "hero", tgtIds: ["one", "two", "three"],
    atk: { nazev: "Fireball", kind: "spell", range: 150, dmg: "8d6", typ: "Fire", save: "DEX", dc: 15, half: true },
    spec: { shape: "sphere", size: 20, anchor: [12, 5] } }, { manualDmg: 32, manualSaves: { one: 1, two: 1, three: 1 } });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout });
  vi.stubGlobal("location", { protocol: "http:", host: "localhost" });
  vi.stubGlobal("WebSocket", Socket);
  api.get.mockImplementation(async () => structuredClone(fixture()));
  api.put.mockResolvedValue({ version: 2 });
});
afterEach(async () => { await flush(() => root?.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("battle command and state-hook persistence integration", () => {
  it("preserves Fireball when an earlier save broadcasts before its HTTP acknowledgement", async () => {
    await mount();
    const first = deferred<{ version: number }>(); api.put.mockReturnValueOnce(first.promise).mockResolvedValue({ version: 3 });
    await flush(() => battle.dispatch(() => {}));
    await flush(() => vi.advanceTimersByTimeAsync(600));
    const draft = fireball();
    await flush(() => battle.dispatch(s => { expect(applyResolution(s, draft)).toBe(true); }));
    await flush(() => Socket.current.emit(2));
    await flush(() => first.resolve({ version: 2 }));
    expect(battle.S!.tok.map(t => t.hp)).toEqual([100, 68, 68, 68]);
    expect(api.get).toHaveBeenCalledTimes(1);
    await flush(() => vi.advanceTimersByTimeAsync(600));
    expect(api.put.mock.calls[1][1]).toMatchObject({ version: 2, state: { stav_boje: { tok: [{ hp: 100 }, { hp: 68 }, { hp: 68 }, { hp: 68 }] } } });
    expect(battle.S!.log.some(l => l.t.includes("Fireball"))).toBe(true);
    await flush(() => battle.undo()); expect(battle.S!.tok[1].hp).toBe(100);
    await flush(() => battle.redo()); expect(battle.S!.tok[1].hp).toBe(68);
  });
  it("does not apply a refetch that began before a local command", async () => {
    await mount(); const response = deferred<ReturnType<typeof fixture>>(); api.get.mockReturnValueOnce(response.promise);
    await flush(() => Socket.current.emit(2));
    const draft = fireball(); await flush(() => battle.dispatch(s => { applyResolution(s, draft); }));
    await flush(() => response.resolve({ ...fixture(), version: 2 }));
    expect(battle.S!.tok[1].hp).toBe(68);
    await flush(() => vi.advanceTimersByTimeAsync(600));
    expect(api.put.mock.calls[0][1].state.stav_boje.tok[1].hp).toBe(68);
  });
  it("still loads remote changes when idle and explicitly recovers a version conflict", async () => {
    await mount(); const remote = fixture(); remote.version = 2; remote.state.stav_boje.tok[1].hp = 77;
    api.get.mockResolvedValue(remote);
    await flush(() => Socket.current.emit(2)); expect(battle.S!.tok[1].hp).toBe(77);
    api.put.mockRejectedValueOnce({ status: 409 });
    await flush(() => battle.dispatch(s => { s.tok[1].hp = 60; }));
    await flush(() => vi.advanceTimersByTimeAsync(600));
    expect(battle.S!.tok[1].hp).toBe(77); expect(api.toast).toHaveBeenCalled();
  });
  it("does not loop failed saves, and allows another command to retry", async () => {
    await mount(); api.put.mockRejectedValueOnce(new Error("Offline"));
    await flush(() => battle.dispatch(s => { s.tok[1].hp = 80; }));
    await flush(() => vi.advanceTimersByTimeAsync(6000));
    expect(api.put).toHaveBeenCalledTimes(1); expect(battle.S!.tok[1].hp).toBe(80);
    await flush(() => battle.dispatch(s => { s.tok[1].hp = 70; }));
    await flush(() => vi.advanceTimersByTimeAsync(600));
    expect(api.put).toHaveBeenCalledTimes(2); expect(api.put.mock.calls[1][1].state.stav_boje.tok[1].hp).toBe(70);
  });
  it("isolates pending saves when navigating to another battle", async () => {
    await mount(); const first = deferred<{ version: number }>(); api.put.mockReturnValueOnce(first.promise);
    await flush(() => battle.dispatch(s => { s.tok[1].hp = 80; }));
    await flush(() => vi.advanceTimersByTimeAsync(600));
    await flush(() => { root.update(<Harness bid="other" />); });
    await flush(() => battle.load());
    expect(battle.S!.tok[1].hp).toBe(100);
    await flush(() => first.resolve({ version: 99 })); expect(battle.version).toBe(1);
    await flush(() => battle.dispatch(s => { s.tok[1].hp = 70; }));
    await flush(() => vi.advanceTimersByTimeAsync(600));
    expect(api.put.mock.calls[1][0]).toBe("/api/battles/other/state");
    expect(api.put.mock.calls[1][1].version).toBe(1);
  });
});
