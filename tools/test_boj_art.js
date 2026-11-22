const fs = require("fs");
const vm = require("vm");
const assert = require("assert/strict");
const code = fs.readFileSync("web/assets/boj.js", "utf8").replace(
  "window.MontelienBoj = {",
  "window.artTest = { validateMapArt, strokeDistance, ambient, animationClass }; window.MontelienBoj = {"
);
const context = { window: {}, document: { addEventListener() {} } };
vm.runInNewContext(code, context);
const { validateMapArt, strokeDistance, ambient, animationClass } = context.window.artTest;
for (const map of [{}, { pocasi: "", rekvizity: [], malba: [], svetla: [] }, {
  pocasi: "bourka",
  rekvizity: [{ k: "portal", x: 1.25, y: 2.75, r: 45, s: 1.5, a: false }],
  malba: [{ t: "voda", b: 2, o: .5, h: .3, p: [[.1, 1], [3, 4]] }],
  svetlo: { amb: .2, barva: "#080c18" },
  svetla: [{ x: 1, y: 2, r: 5, barva: "#ffbb66", i: .8, f: true }]
}]) assert.equal(validateMapArt(map), map);
for (const map of [
  { pocasi: "invalid" }, { rekvizity: {} }, { rekvizity: [null] },
  { rekvizity: [{ k: "portal", x: NaN, y: 0, r: 0, s: 1 }] },
  { rekvizity: [{ k: "portal", x: 1, y: 0, r: 0, s: -1 }] },
  { malba: [{ t: "voda", b: 1, o: 1, p: [] }] },
  { malba: [{ t: "bad", b: 1, o: 1, p: [[0, 0]] }] },
  { svetlo: { amb: 2, barva: "#ffffff" } },
  { svetla: [{ x: 0, y: 0, r: -1, barva: "#ffffff", i: 1, f: true }] },
  { svetla: [{ x: 0, y: 0, r: 1, barva: '"><script>', i: 1, f: true }] }
]) assert.throws(() => validateMapArt(map), /Neplatné pole mapy/);
assert.equal(strokeDistance([5, 2], { p: [[0, 0], [10, 0]] }), 2);
assert.equal(strokeDistance([3, 4], { p: [[0, 0]] }), 5);
assert.equal(ambient({}), 1);
assert.equal(ambient({ osvetleni: "Darkness" }), .68);
assert.equal(ambient({ svetlo: { amb: 0 } }), 0);
assert.equal(animationClass("portal2"), "bj-portal");
assert.equal(animationClass("rakos"), "bj-sway");
assert.equal(animationClass("stul"), "");
console.log("OK: visual map fields — legacy/empty/valid/error cases; stroke erasing geometry; ambient fallback; image animation classes.");
