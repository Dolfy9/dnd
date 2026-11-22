import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlayerIntents, { PlayerIntentConfirm } from "./PlayerIntents";
import IntentRequests from "./IntentRequests";
import { useIntents, type Intent } from "../state/useIntents";
import { migrate } from "../rules/migrate";
import { custom } from "../rules/combatants";
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn(), toast: vi.fn() }));
vi.mock("../../../api", () => api);
vi.mock("../../../components/ui", () => ({ toast: api.toast }));
class Socket {
  static current: Socket;
  onmessage?: (e: { data: string }) => void;
  constructor() { Socket.current = this; }
  close() {}
  emit() { this.onmessage?.({ data: JSON.stringify({ channel: "battle:test", event: "intent" }) }); }
}
const S = migrate({ round: 1, ord: ["hero"], turn: 0, tok: [{ ...custom("Hero", "druzina", 30, 14), id: "hero", src: { owner: "7" }, x: 2, y: 2 }] });
let root: ReactTestRenderer;
let transport: ReturnType<typeof useIntents>;
const row: Intent = { id: "i", user_id: 7, token_id: "hero", kind: "move", payload: { path: [[2, 2], [3, 2]] }, status: "pending", note: "" };
const button = (name: string) => root.root.findAllByType("button").find(b => b.children.join("") === name)!;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { setTimeout, clearTimeout }); vi.stubGlobal("location", { protocol: "http:", host: "localhost" }); vi.stubGlobal("WebSocket", Socket);
  api.get.mockResolvedValue({ intents: [] }); api.post.mockResolvedValue({}); api.del.mockResolvedValue({});
});
afterEach(() => { act(() => root?.unmount()); vi.unstubAllGlobals(); });
function Confirm() {
  transport = useIntents("test", true, false);
  return <PlayerIntentConfirm S={S} proposed={{ tokenId: "hero", kind: "action", payload: { action_id: "attack:Bow", target_ids: ["enemy"] }, label: "Bow" }} submit={transport.submit} onClose={() => {}} />;
}
it("submits physical dice through the player confirmation UI, never a battle-state PUT", async () => {
  await act(async () => { root = create(<Confirm />); });
  act(() => { root.root.findByProps({ "aria-label": "Ruční d20" }).props.onChange({ target: { value: "18" } }); root.root.findByProps({ "aria-label": "Ruční damage" }).props.onChange({ target: { value: "9" } }); });
  await act(async () => { await button("Odeslat PJ").props.onClick(); });
  expect(api.post).toHaveBeenCalledWith("/api/battles/test/intents", { token_id: "hero", kind: "action", payload: { action_id: "attack:Bow", target_ids: ["enemy"], manual_dice: { attack: 18, damage: 9 } } });
});
it("refetches WS intent events and shows GM rejection notes", async () => {
  api.get.mockResolvedValue({ intents: [row] });
  await act(async () => { root = create(<Confirm />); });
  api.get.mockResolvedValue({ intents: [{ ...row, status: "rejected", note: "Zeď blokuje kouzlo" }] });
  await act(async () => { Socket.current.emit(); });
  expect(api.toast).toHaveBeenCalledWith("Zamítnuto: Zeď blokuje kouzlo", "err");
  expect(transport.intents[0].status).toBe("rejected");
});
it("does not refetch intents while idle or on parent rerenders without an intent event", async () => {
  vi.useFakeTimers();
  try {
    await act(async () => { root = create(<Confirm />); });
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(async () => { root.update(<Confirm />); await vi.advanceTimersByTimeAsync(5000); });
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(async () => { Socket.current.emit(); });
    expect(api.get).toHaveBeenCalledTimes(2);
  } finally { vi.useRealTimers(); }
});
it("shows pending cancellation, only owned reaction prompts and free rolls", async () => {
  const submit = vi.fn().mockResolvedValue(true), cancel = vi.fn().mockResolvedValue(undefined);
  const state = structuredClone(S);
  state.pendingResolutions = [{ id: "owned", kind: "reaction", tokenId: "hero", actorId: "hero", label: "Shield" }, { id: "other", kind: "reaction", tokenId: "stranger", label: "Secret" }];
  await act(async () => { root = create(<PlayerIntents S={state} userId={7} intents={[row]} submit={submit} cancel={cancel} onPreview={() => {}} />); });
  expect(root.root.findAllByType("article")).toHaveLength(2);
  await act(async () => { button("Přijmout reakci").props.onClick(); button("Zrušit žádost").props.onClick(); button("Požádat o hod").props.onClick(); });
  expect(submit).toHaveBeenCalledWith("hero", "reaction", { pending_id: "owned", accept: true });
  expect(submit).toHaveBeenCalledWith("hero", "roll", { type: "check", name: "STR" }); expect(cancel).toHaveBeenCalledWith("i");
});
it("does not advertise editing for standard actions that apply unchanged", async () => {
  const approve = vi.fn().mockResolvedValue(undefined);
  const request: Intent = { ...row, kind: "action", payload: { action_id: "std:dodge" } };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(["battle-players"], { players: [] });
  await act(async () => { root = create(<QueryClientProvider client={client}><IntentRequests S={S} map={{ id: "m", nazev: "Map", podklad: "mesto", mrizka: ["....."] }} rows={[request]} onApprove={approve} onReject={vi.fn()} onPreview={vi.fn()} busy={false} /></QueryClientProvider>); });
  expect(button("Upravit")).toBeUndefined();
  expect(JSON.stringify(root.toJSON())).toContain("Schválit provede akci beze změn");
  await act(async () => { await button("Schválit").props.onClick(); });
  expect(approve).toHaveBeenCalledWith(request, false, false);
});
it("GM queue routes preview, approval, editing and rejection with a required note", async () => {
  const state = structuredClone(S);
  state.tok[0].atk = [{ nazev: "Bow", kind: "weapon", bonus: 5, range: 80 }];
  const request: Intent = { ...row, kind: "action", payload: { action_id: "attack:Bow" } };
  const approve = vi.fn().mockResolvedValue(undefined), reject = vi.fn().mockResolvedValue(undefined), preview = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  client.setQueryData(["battle-players"], { players: [{ id: 7, name: "Player One", login: "one" }] });
  await act(async () => { root = create(<QueryClientProvider client={client}><IntentRequests S={state} map={{ id: "map", nazev: "Map", podklad: "mesto", mrizka: Array(10).fill("..........") }} rows={[request]} onApprove={approve} onReject={reject} onPreview={preview} busy={false} /></QueryClientProvider>); });
  await act(async () => { button("Náhled").props.onClick(); await button("Schválit").props.onClick(); await button("Upravit").props.onClick(); button("Zamítnout").props.onClick(); });
  expect(preview).toHaveBeenCalledWith(request); expect(approve).toHaveBeenCalledWith(request, false, false); expect(approve).toHaveBeenCalledWith(request, true, false);
  expect(button("Potvrdit zamítnutí").props.disabled).toBe(true);
  act(() => root.root.findByProps({ "aria-label": "Důvod zamítnutí" }).props.onChange({ target: { value: "Neplatná cesta" } }));
  await act(async () => { await button("Potvrdit zamítnutí").props.onClick(); }); expect(reject).toHaveBeenCalledWith(request, "Neplatná cesta");
});
