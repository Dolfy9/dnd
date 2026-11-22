import { describe, expect, it } from "vitest";
import { lightBlockers, visibilityPolygon, conePath, type Point } from "./lightGeometry";
import { normalizeLight, migrateMap, type MapLightV2, type MapWall } from "./mapV2";

const light: MapLightV2 = {id:"l",x:2,y:3,bright:10,dim:15};
const wall: MapWall = {id:"w",a:[5,0],b:[5,10],typ:"wall"};
function contains(poly: Point[], [x,y]: Point) {
  let inside = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const [ax,ay]=poly[i], [bx,by]=poly[j];
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside;
  }
  return inside;
}

describe("light projection", () => {
  it("blocks a point behind a wall but not one in front", () => {
    const poly=visibilityPolygon([2,3],lightBlockers([wall]),10,10);
    expect(contains(poly,[4,3])).toBe(true);
    expect(contains(poly,[6,3])).toBe(false);
  });
  it("lets open doors and windows transmit, respecting live door overrides", () => {
    for (const w of [{...wall,typ:"window" as const},{...wall,typ:"door" as const,open:true}])
      expect(contains(visibilityPolygon([2,3],lightBlockers([w]),10,10),[6,3])).toBe(true);
    const door={...wall,typ:"door" as const};
    expect(lightBlockers([door],{w:true})).toEqual([]);
    expect(lightBlockers([{...door,open:true}],{w:false})).toHaveLength(1);
  });
  it("handles angled walls, endpoints, no walls, and invalid bounds", () => {
    const diagonal={...wall,a:[4,0] as Point,b:[8,8] as Point};
    const poly=visibilityPolygon([2,3],lightBlockers([diagonal]),10,10);
    expect(contains(poly,[3,3])).toBe(true); expect(contains(poly,[8,3])).toBe(false);
    expect(contains(visibilityPolygon([2,3],[],10,10),[9,9])).toBe(true);
    expect(visibilityPolygon([5,3],[wall],10,10).flat().every(Number.isFinite)).toBe(true);
    expect(visibilityPolygon([NaN,0],[],10,10)).toEqual([]);
    expect(visibilityPolygon([0,0],[],0,10)).toEqual([]);
    expect(lightBlockers([{...wall,b:wall.a}])).toEqual([]);
    expect(conePath(5,60)).toContain("A5,5");
  });
});

describe("light migration", () => {
  it("preserves legacy point lights and maps flicker only when the effect is absent", () => {
    expect(normalizeLight(light)).toMatchObject({tvar:"bod",smer:0,sirka:60,delka:3,efekt:"zadny",rychlost:1,stiny:true});
    expect(normalizeLight({...light,blikani:true}).efekt).toBe("mihot");
    expect(normalizeLight({...light,blikani:true,efekt:"zadny"}).efekt).toBe("zadny");
    const m={id:"m",nazev:"M",podklad:"les",mrizka:[".."],svetla:[{...light,tvar:"kuzel" as const,efekt:"plamen" as const,smer:90,stiny:false}]};
    const migrated=migrateMap(m);
    expect(migrateMap(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    expect(migrated.svetla![0]).toMatchObject(m.svetla[0]);
  });
  it("validates enums, finite values and ranges", () => {
    expect(normalizeLight({...light,tvar:"bad",efekt:"bad",smer:NaN,sirka:999,delka:-2,rychlost:99} as unknown as MapLightV2))
      .toMatchObject({tvar:"bod",efekt:"zadny",smer:0,sirka:180,delka:.1,rychlost:3});
    expect(normalizeLight({...light,smer:-90,sirka:0,delka:Infinity,rychlost:NaN})).toMatchObject({smer:270,sirka:10,delka:3,rychlost:1});
  });
});
