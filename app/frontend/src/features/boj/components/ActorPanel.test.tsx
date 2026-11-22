import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import ActorPanel from "./ActorPanel";
import { custom } from "../rules/combatants";
import { migrate } from "../rules/migrate";

it("preserves attack button identity on parent updates and lets an owned player pick a spell slot", () => {
  const t = { ...custom("Hero", "druzina", 30, 14), id: "hero", atk: [{ nazev: "Bow", bonus: 5, range: 80 }], kouzla: [{ nazev: "Spell", kind: "spell" as const, lvl: 1, range: 60 }], slots: [{ max: 2, used: 0 }] };
  const S = migrate({ tok: [t], ord: [t.id], turn: 0, round: 1 });
  const attack = vi.fn();
  const props = { S, t: S.tok[0], targeting: null, dm: false, playerControl: true, onAttack: attack, onStdAction: vi.fn(), onResource: vi.fn() };
  let root!: ReturnType<typeof create>;
  act(() => { root = create(<ActorPanel {...props} />); });
  const buttons = () => root.root.findAllByType("button");
  const bow = buttons().find(b => b.props.title === "Bow")!;
  act(() => root.update(<ActorPanel {...props} onAttack={(a, opts) => attack(a, opts)} />));
  expect(buttons().find(b => b.props.title === "Bow")).toBe(bow);
  act(() => buttons().find(b => b.props.title === "Spell")!.props.onClick());
  act(() => buttons().find(b => b.props.title === "1. slot")!.props.onClick());
  expect(attack).toHaveBeenCalledWith(S.tok[0].kouzla![0], { slot: 1, meta: undefined });
  act(() => root.unmount());
});
