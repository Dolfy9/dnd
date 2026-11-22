import { describe, expect, it } from "vitest";
import { coneFeatherLayers, nearestLights, nextLightAnimationCap } from "./lightAnimationPolicy";

describe("light animation budget", () => {
  it("steps down once per slow sample and never increases", () => {
    expect(nextLightAnimationCap(12, 41)).toBe(8);
    expect(nextLightAnimationCap(8, 60)).toBe(4);
    expect(nextLightAnimationCap(4, 120)).toBe(2);
    expect(nextLightAnimationCap(2, 200)).toBe(2);
    for (const cap of [12,8,4,2] as const) for (const mean of [16,40,NaN,Infinity])
      expect(nextLightAnimationCap(cap, mean)).toBe(cap);
  });
  it("prefers the viewport center without mutating input and handles empty candidates", () => {
    const lights=[{x:0,y:0},{x:7,y:9},{x:10,y:10}];
    expect(nearestLights(lights,[8,8],2)).toEqual([lights[1],lights[2]]);
    expect(nearestLights(lights,[8,8],0)).toEqual([]);
    expect(nearestLights([],[0,0],12)).toEqual([]);
    expect(lights[0]).toEqual({x:0,y:0});
  });
  it("builds a smoothstep angular fade over 30% of each side", () => {
    const layers=coneFeatherLayers();
    let alpha=0;
    layers.forEach((layer,i)=>{
      alpha+=layer.opacity*(1-alpha);
      const t=(i+1)/layers.length;
      expect(alpha).toBeCloseTo(t*t*(3-2*t),10);
    });
    expect(layers[0].scale).toBe(1);
    expect(layers[layers.length-1].scale).toBeCloseTo(.4,1);
    expect(coneFeatherLayers(0)).toEqual([]);
  });
});
