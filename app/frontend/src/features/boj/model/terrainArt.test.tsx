import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { terrainTexture, terrainProp, interiorWall } from "./terrainArt";
import { TerenLayer } from "../components/MapLayers";
import { MapTextureLayer, MapObjectLayer, setManifests } from "../components/MapV2Layers";
import type { MapV2 } from "./mapV2";

describe("image-backed terrain", () => {
  it("maps every legacy tile and preserves natural/built wall distinctions", () => {
    for (const c of ".gr#oT%^~,=+_xS") expect(terrainTexture(c, "les")).toMatch(/^teren-/);
    expect(terrainTexture("#", "les")).toBe("teren-skala");
    expect(terrainTexture("#", "krypta")).toBe("teren-wall");
    expect(terrainTexture("#", "krypta", true)).toBe("teren-bedrock");
    expect(terrainTexture(".", "unknown")).toBe("teren-mesto");
    expect(terrainTexture(",", "les")).toBe("teren-melcina");
    expect(terrainProp("%", "krypta", 0, 0)).toBe("sarkofag");
    expect(terrainProp("T", "les", 1, 2)).toBe(terrainProp("T", "les", 1, 2));
    expect(terrainProp(".", "les", 0, 0)).toBeNull();
  });
  it("identifies enclosed wall mass including map boundaries", () => {
    expect(interiorWall(0, 0, (x, y) => x < 0 || y < 0 ? undefined : "#")).toBe(true);
    expect(interiorWall(1, 1, (x, y) => x === 0 && y === 0 ? "." : "#")).toBe(false);
  });
  it("renders images in shared terrain, texture and object layers, including manifest updates", () => {
    const map = { id: "test", nazev: "Test", podklad: "les", mrizka: ["T~"],
      textury: { "0,0": "dlazba" }, objekty: [{ id: "o", asset: "stul", x: 1, y: 1, w: 1, h: 1 }] } as MapV2;
    const textures = Object.fromEntries(["teren-les", "teren-voda", "dlazba"].map(id => [id, { id, nazev: id, src: id + ".webp", cells: 4 }]));
    const prop = terrainProp("T", "les", 0, 0)!;
    setManifests({ ["gen2-" + prop]: { id: prop, nazev: prop, src: prop + ".webp" },
      stul: { id: "stul", nazev: "Stůl", src: "table.webp" } }, textures);
    const terrain = renderToStaticMarkup(<svg><TerenLayer map={map} px={24} /></svg>);
    expect(terrain).toContain("teren-voda.webp");
    expect(terrain).toContain(prop + ".webp");
    expect(renderToStaticMarkup(<svg><MapTextureLayer map={map} /><MapObjectLayer map={map} /></svg>)).toContain("table.webp");
    expect(renderToStaticMarkup(<svg><TerenLayer map={map} px={24} illustration /></svg>)).not.toContain("<image");
    expect(renderToStaticMarkup(<svg><TerenLayer map={map} px={24} illustration S={{ teren: { "0,0": "~" } }} /></svg>)).toContain("teren-voda.webp");
    setManifests({}, {});
    expect(renderToStaticMarkup(<svg><TerenLayer map={{ ...map, mrizka: [] }} px={24} /></svg>)).not.toContain("<path");
    expect(renderToStaticMarkup(<svg><TerenLayer map={map} px={24} /></svg>)).toContain("#57524d");
  });
});
