import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { assetSrc, normalizeVariant, placementVariant, nextVariant, variantEdits } from "./assetVariants";
import { migrateMap, type MapV2 } from "./mapV2";
import { MapObjectLayer, setManifests } from "../components/MapV2Layers";
import { MapAnimatedScene } from "../components/MapAnimatedScene";
import { MapPreview } from "../../mapeditor/components/MapPreview";
import { VariantStrip } from "../../mapeditor/components/VariantStrip";
import { duplicateObjects } from "../../mapeditor/tools/ops";

const tree = {id:"tree",nazev:"Strom",src:"tree.webp",varianty:["tree-v1.webp","tree-v2.webp"],anim:"vitr" as const};
const base = (): MapV2 => ({id:"t",nazev:"Test",podklad:"les",mrizka:["....","...."]});
const object = {id:"o",asset:"tree",v:2,x:1,y:1,w:2,h:3,rot:37,flip:true,blocks:true,cover:3 as const,difficult:true,light:{bright:10,dim:20}};
afterEach(() => setManifests({},{}));

describe("asset variant resolution and migration", () => {
  it("resolves base and indexed variants without changing metadata", () => {
    expect(assetSrc(tree)).toBe("tree.webp");
    expect(assetSrc(tree,0)).toBe("tree.webp");
    expect(assetSrc(tree,1)).toBe("tree-v1.webp");
    expect(assetSrc(tree,2)).toBe("tree-v2.webp");
    expect(tree.varianty).toEqual(["tree-v1.webp","tree-v2.webp"]);
    expect(assetSrc({src:"custom.webp"},1)).toBe("custom.webp");
  });
  it("normalizes malformed and unavailable indexes to base", () => {
    for (const value of [-1,.5,NaN,Infinity,3,"1",null,undefined,Number.MAX_SAFE_INTEGER+1]) {
      expect(normalizeVariant(value,2)).toBe(0);
      expect(assetSrc(tree,value as number)).toBe("tree.webp");
    }
    expect(assetSrc({...tree,varianty:[""]},1)).toBe("tree.webp");
    expect(nextVariant(tree,undefined)).toBe(1);
    expect(nextVariant(tree,2)).toBe(0);
    expect(nextVariant(undefined,7)).toBe(0);
  });
  it("keeps old maps and valid variants, sanitizes on load with the manifest", () => {
    expect(migrateMap(base(),{tree}).objekty).toBeUndefined();
    const old = {...object}; delete (old as {v?:number}).v;
    expect(migrateMap({...base(),objekty:[old]},{tree}).objekty![0]).not.toHaveProperty("v");
    expect(migrateMap({...base(),objekty:[object]},{tree}).objekty![0]).toEqual(object);
    for (const value of [4,-1,"2",NaN,.2]) {
      const input = {...base(),objekty:[{...object,v:value}]};
      expect(migrateMap(input,{tree}).objekty![0].v).toBe(0);
    }
    expect(migrateMap({...base(),objekty:[object]},{}).objekty![0].v).toBe(0);
    expect(object.v).toBe(2);
  });
});

describe("placement and selection variants", () => {
  it("uses injectable uniform RNG over base and variants", () => {
    expect([0,.34,.99,1].map(roll => placementVariant(tree,true,0,() => roll))).toEqual([0,1,2,2]);
    expect(placementVariant(tree,false,2,() => {throw Error("must not roll");})).toBe(2);
    expect(placementVariant(undefined,true)).toBe(0);
    expect(placementVariant({src:"empty"},true)).toBe(0);
    expect(placementVariant(tree,false,10)).toBe(0);
    for (const roll of [NaN,Infinity,-Infinity,-1]) expect(placementVariant(tree,true,0,() => roll)).toBe(0);
  });
  it("returns only actual edits, including heterogeneous selections and empty/no-op cases", () => {
    const objects = [object,{...object,id:"base",v:0},{...object,id:"custom",asset:"custom",v:undefined}];
    expect(variantEdits(objects,{tree},"next")).toEqual({o:0,base:1});
    expect(variantEdits(objects,{tree},"random",() => .9)).toEqual({base:2});
    expect(variantEdits([object],{tree},2)).toEqual({});
    expect(variantEdits([],{tree},"random")).toEqual({});
    expect(variantEdits([{...object,v:99}],{tree},0)).toEqual({});
    expect(objects[0]).toEqual(object);
  });
  it("duplicates and copies variants and gameplay metadata without sharing nested state", () => {
    const copies = duplicateObjects([object]);
    expect(copies[0]).toEqual({...object,id:copies[0].id,x:2,y:2});
    expect(copies[0].id).not.toBe(object.id);
    copies[0].light!.bright = 1;
    expect(object.light.bright).toBe(10);
    expect(duplicateObjects([])).toEqual([]);
  });
});

describe("variant imagery across render surfaces", () => {
  it("shares variants across static export, preview and animated battle/editor layers", () => {
    setManifests({tree},{});
    const map = {...base(),objekty:[object]};
    const svg = renderToStaticMarkup(<svg><MapObjectLayer map={map} /></svg>);
    expect(svg).toContain('href="/repo/11_Mapy/tree-v2.webp"');
    expect(svg).toContain("rotate(37)");
    expect(svg).toContain('width="48"');
    const scene = renderToStaticMarkup(<MapAnimatedScene map={map} view={{x:0,y:0,k:1}}><rect /></MapAnimatedScene>);
    expect(scene).toContain('src="/repo/11_Mapy/tree-v2.webp"');
    expect(scene).toContain("rotate(37deg) scaleX(-1)");
    expect(renderToStaticMarkup(<MapPreview map={map} />)).toContain("tree-v2.webp");
    expect(map.objekty[0]).toEqual(object);
  });
  it("provides a base card plus selectable variant image cards, including assets without variants", () => {
    const strip = renderToStaticMarkup(<VariantStrip entry={tree} value={2} onChange={() => {}} />);
    expect(strip.match(/<button /g)).toHaveLength(3);
    expect(strip).toContain("tree-v2.webp");
    expect(strip.match(/aria-pressed="true"/g)).toHaveLength(1);
    const empty = renderToStaticMarkup(<VariantStrip entry={{id:"custom",nazev:"Vlastní",src:"custom.webp"}} onChange={() => {}} />);
    expect(empty.match(/<button /g)).toHaveLength(1);
    expect(empty).toContain('src="/repo/11_Mapy/custom.webp"');
  });
});
