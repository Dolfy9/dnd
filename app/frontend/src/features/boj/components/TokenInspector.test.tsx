import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { custom } from "../rules/combatants";
import { defaultSettings } from "../rules/settings";
import type { StavBoje } from "../types";
import TokenInspector from "./TokenInspector";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../../api", () => api);
vi.mock("../../../components/EntityPicker", () => ({ default: () => null }));
let root: ReactTestRenderer | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; vi.resetAllMocks(); });

async function mount(dm = true, players: { id: number; login: string; name: string }[] | null = [{ id: 7, login: "player", name: "Hráč" }]) {
  const token = custom("Hero", "druzina", 20, 14);
  token.src = { cesta: "hero.md", id: "source", owner: "7" };
  const S: StavBoje = { tok: [token], ord: [token.id], turn: 0, round: 1, eco: {}, log: [], zones: [], fx: [], nastaveni: defaultSettings() };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  if (players !== null) client.setQueryData(["battle-players"], { players });
  const cmd = vi.fn((fn: (s: StavBoje) => void) => fn(S));
  await act(async () => { root = create(<QueryClientProvider client={client}><TokenInspector S={S} t={token} cmd={cmd} dm={dm} onClose={() => {}} /></QueryClientProvider>); });
  return { token, cmd, client };
}

describe("GM token ownership dropdown", () => {
  it("assigns string user IDs and clears ownership through the command without replacing source metadata", async () => {
    const { token, cmd } = await mount();
    const select = root!.root.findByProps({ "aria-label": "Vlastník žetonu" });
    expect(select.props.value).toBe("7");
    expect(select.findAllByType("option").map(o => o.children.join(""))).toContain("Hráč (player)");
    act(() => select.props.onChange({ target: { value: "" } }));
    expect(token.src).toEqual({ cesta: "hero.md", id: "source", owner: undefined });
    act(() => select.props.onChange({ target: { value: "7" } }));
    expect(token.src?.owner).toBe("7"); expect(cmd).toHaveBeenCalledTimes(2);
  });
  it("does not render or fetch the account list for players", async () => {
    await mount(false, null);
    expect(root!.root.findAllByProps({ "aria-label": "Vlastník žetonu" })).toHaveLength(0);
    expect(api.get).not.toHaveBeenCalled();
  });
  it("handles an empty player list while preserving an unavailable existing owner", async () => {
    await mount(true, []);
    const select = root!.root.findByProps({ "aria-label": "Vlastník žetonu" });
    expect(select.props.disabled).toBe(false);
    expect(select.findAllByType("option").map(o => o.props.value)).toEqual(["", "7"]);
  });
  it("fetches the editor-only directory and disables edits on errors", async () => {
    api.get.mockRejectedValue(new Error("offline"));
    await mount(true, null);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    expect(api.get).toHaveBeenCalledWith("/api/battles/players");
    expect(root!.root.findByProps({ "aria-label": "Vlastník žetonu" }).props.disabled).toBe(true);
    expect(root!.root.findByProps({ role: "alert" }).children.join("")).toBe("Hráče se nepodařilo načíst.");
  });
});
