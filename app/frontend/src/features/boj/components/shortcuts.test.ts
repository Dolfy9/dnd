import { expect, it, vi } from "vitest";
import { isInteractiveTarget } from "./shortcuts";

it("keeps shortcut keys available to focused controls and their children", () => {
  for (const control of ["button", "input", "select", "textarea", "summary", "[role=button]", "[role=switch]", "[role=slider]", "[role=checkbox]"]) {
    const closest = vi.fn((selector: string) => selector.split(", ").includes(control) ? {} : null);
    expect(isInteractiveTarget({ closest } as unknown as EventTarget)).toBe(true);
  }
  expect(isInteractiveTarget({ closest: () => null } as unknown as EventTarget)).toBe(false);
  expect(isInteractiveTarget(null)).toBe(false);
});
