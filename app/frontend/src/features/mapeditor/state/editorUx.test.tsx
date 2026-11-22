import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { actOnObjects, canTogglePanel, liveSelection, panUpdate, playerPreviewMap, fuzzyScore, readPreference, rememberAsset, writePreference, TOOL_GROUPS, TOOL_HINTS } from "./editorUx";
import { pickAt, pickInRect } from "../tools/ops";
import type { MapObject, MapV2 } from "../../boj/model/mapV2";
import { migrateMap } from "../../boj/model/mapV2";
import { EditorWeather, ShortcutHelp, CommandPalette } from "../components/EditorChrome";
import { ObjectInspector } from "../components/ObjectInspector";
import { AssetLibrary } from "../components/AssetLibrary";
import { PropertiesPanel } from "../components/panels";

const object: MapObject = {id:"one",asset:"tree",x:2,y:3,w:1,h:2,v:2,light:{bright:10,dim:10}};
afterEach(() => vi.unstubAllGlobals());

describe("editor productivity", () => {
  it("keeps the existing flicker checkbox effective after legacy light migration", () => {
    const map=migrateMap({id:"m",nazev:"M",mrizka:[".."],svetla:[{id:"l",x:1,y:1,bright:5,dim:5,blikani:true}]});
    const panel=PropertiesPanel({map,selObj:{kind:"svetlo",id:"l"},objects:[],assets:{},push:f=>f(map),onVariant:()=>{},onAction:()=>{},onDelete:()=>{}});
    const inputs: React.ReactElement<any>[]=[];
    function visit(node: React.ReactNode) {
      React.Children.forEach(node,child=>{
        if (!React.isValidElement<{children?:React.ReactNode;type?:string}>(child)) return;
        if (child.type === "input" && child.props.type === "checkbox") inputs.push(child);
        visit(child.props.children);
      });
    }
    visit(panel);
    expect(map.svetla![0].efekt).toBe("mihot");
    inputs[0].props.onChange({target:{checked:false}});
    expect(migrateMap(map).svetla![0]).toMatchObject({efekt:"zadny",blikani:false});
    inputs[0].props.onChange({target:{checked:true}});
    expect(migrateMap(map).svetla![0]).toMatchObject({efekt:"mihot",blikani:true});
  });
  it("snapshots pan coordinates before pointer-up clears the drag ref", () => {
    const ref: {current: {x0:number;y0:number;vx:number;vy:number} | null} = {current:{x0:500,y0:400,vx:20,vy:30}};
    const point = {clientX:530,clientY:430};
    const update = panUpdate(ref.current!,point);
    ref.current = null;
    point.clientX = 0;
    const view = {x:20,y:30,k:2};
    expect(update(view)).toEqual({x:50,y:60,k:2});
    expect(update(view)).toEqual(update(view));
    expect(view).toEqual({x:20,y:30,k:2});
  });
  it("reserves panel toggling for non-interactive targets, including control descendants", () => {
    const closest = vi.fn((_selector: string) => ({}));
    expect(canTogglePanel({closest} as unknown as EventTarget)).toBe(false);
    const selector = closest.mock.calls[0][0];
    for (const control of ["button","a[href]","summary","[tabindex]","[contenteditable]"]) expect(selector).toContain(control);
    expect(canTogglePanel({closest:() => null} as unknown as EventTarget)).toBe(true);
    expect(canTogglePanel(null)).toBe(true);
  });
  it("picks only rendered objects in player preview, including overlapping objects", () => {
    const hidden = {...object,id:"hidden",dmOnly:true};
    const map = {objekty:[object,hidden]} as MapV2;
    expect(pickAt(playerPreviewMap(map,false),2,3,true)?.id).toBe("hidden");
    const preview = playerPreviewMap(map,true);
    expect(pickAt(preview,2,3,true)?.id).toBe("one");
    expect(pickInRect(preview,[0,0],[5,5])).toEqual([{kind:"objekt",id:"one"}]);
    expect(pickAt(playerPreviewMap({objekty:[hidden]} as MapV2,true),2,3,true)).toBeNull();
    expect(pickAt(playerPreviewMap({} as MapV2,true),2,3,true)).toBeNull();
    expect(map.objekty).toEqual([object,hidden]);
    expect(playerPreviewMap(map,false)).toBe(map);
  });
  it("deletes only the objects shown in a mixed-selection inspector", () => {
    const map = {objekty:[object],steny:[{id:"wall",a:[0,0],b:[1,0],typ:"wall"}]} as MapV2;
    const deleteSelection = vi.fn();
    const panel = PropertiesPanel({map,selObj:null,objects:[object],assets:{},push:()=>{},onVariant:()=>{},onDelete:deleteSelection,
      onAction:action => { map.objekty=actOnObjects(map.objekty!,[object.id],action); }});
    panel.props.onDelete();
    expect(map.objekty).toEqual([]);
    expect(map.steny?.map(w => w.id)).toEqual(["wall"]);
    expect(deleteSelection).not.toHaveBeenCalled();
  });
  it("clears missing canvas selections after undo without mutating the document", () => {
    const map = {objekty:[object]} as MapV2;
    const selection = [{kind:"objekt",id:"one"}];
    expect(liveSelection(map,selection)).toBe(selection);
    expect(liveSelection(map,[...selection,{kind:"stena",id:"missing"}])).toEqual(selection);
    expect(liveSelection({} as MapV2,selection)).toEqual([]);
    expect(liveSelection(map,[])).toEqual([]);
    expect(map.objekty).toEqual([object]);
  });
  it("finds Czech words with accents, partial fuzzy queries, empty and missing searches", () => {
    expect(fuzzyScore("Prastará hrobka", "prastara")).toBeGreaterThan(0);
    expect(fuzzyScore("Náhled hráče", "nhhr")).toBeGreaterThan(0);
    expect(fuzzyScore("Strom", "" )).toBe(0);
    expect(fuzzyScore("Strom", "xyz")).toBe(-1);
    expect(fuzzyScore("Déšť", "dest")).toBeGreaterThan(fuzzyScore("Dřevěný stůl", "dest"));
  });
  it("describes every grouped tool exactly once", () => {
    const ids = TOOL_GROUPS.flatMap(([,ids]) => [...ids]);
    expect(new Set(ids).size).toBe(19);
    expect(ids.every(id => !!TOOL_HINTS[id])).toBe(true);
  });
  it("edits selected objects only, retains variants and has no-op-safe alignment", () => {
    const objects = [object,{...object,id:"two",x:5}];
    expect(actOnObjects(objects,[],"flip")).toBe(objects);
    expect(actOnObjects(objects,["missing"],"delete")).toBe(objects);
    expect(actOnObjects(objects,["one"],"align-x")).toBe(objects);
    expect(actOnObjects(objects,["one"],"rotate-left")[0].rot).toBe(345);
    expect(actOnObjects(objects,["one"],"rotate-right")[0].rot).toBe(15);
    expect(actOnObjects(objects,["one"],"flip")[0].flip).toBe(true);
    expect(actOnObjects(objects,["one"],"front")[0].z).toBe(1);
    expect(actOnObjects(objects,["one"],"back")[0].z).toBe(-1);
    expect(actOnObjects(objects,["one","two"],"align-x").map(o => o.x)).toEqual([2,2]);
    expect(actOnObjects(objects,["one"],"delete")).toEqual([objects[1]]);
    const copy = actOnObjects(objects,["one"],"duplicate")[2];
    expect(copy.v).toBe(2); expect(copy.id).not.toBe(object.id);
    copy.light!.bright=1; expect(object.light!.bright).toBe(10);
    const edge = {...object,x:9.5,y:9,w:1,h:2};
    const duplicate = actOnObjects([edge],[edge.id],"duplicate",10,10)[1];
    expect(duplicate.x).toBeLessThanOrEqual(9.5); expect(duplicate.y).toBeLessThanOrEqual(9);
    expect(objects[0].rot).toBeUndefined();
  });
  it("keeps twelve unique recent assets and notifies the mounted library", () => {
    const data = new Map<string,string>();
    const dispatchEvent = vi.fn();
    vi.stubGlobal("localStorage",{getItem:(k: string)=>data.get(k) ?? null,setItem:(k: string,v: string)=>data.set(k,v)});
    vi.stubGlobal("window",{dispatchEvent});
    for (let i=0;i<15;i++) rememberAsset(String(i));
    rememberAsset("13");
    expect(readPreference<string[]>("me-recent-assets",[])).toEqual(["13","14","12","11","10","9","8","7","6","5","4","3"]);
    expect(dispatchEvent).toHaveBeenCalledTimes(16);
  });
  it("renders image cards, variants and accessible empty states for all library modes", () => {
    const client = new QueryClient();
    const props = {q:"",setQ:()=>{},kat:"",setKat:()=>{},stampId:"custom-tree",onPick:()=>{},ASSETS:{"custom-tree":{id:"custom-tree",nazev:"Dub",src:"dub.webp",varianty:["dub-v1.webp"],anim:"vitr" as const,blocks:true,light:{bright:10,dim:0}}},onUpload:()=>{},variant:0,onVariant:()=>{},mode:"objects" as const,onMode:()=>{},ground:"les",tile:".",texture:"dlazba",onTile:()=>{},onTexture:()=>{}};
    const render = (p: React.ComponentProps<typeof AssetLibrary>) => renderToStaticMarkup(<QueryClientProvider client={client}><AssetLibrary {...p} /></QueryClientProvider>);
    const markup = render(props);
    for (const value of ["dub.webp","dub-v1.webp","Počet variant","Animovaný","Vydává světlo","Blokuje pohyb","draggable=\"true\"","Přidat do oblíbených: Dub"]) expect(markup).toContain(value);
    for (const mode of ["objects","terrain","textures"] as const) expect(render({...props,mode,q:"zzzzzzzz"})).toContain(mode === "objects" ? "Nic jsme nenašli" : "Žádné výsledky");
    client.clear();
  });
  it("recovers from corrupt or disabled local preferences", () => {
    vi.stubGlobal("localStorage",{getItem:() => "invalid",setItem:() => {throw Error("disabled");}});
    expect(readPreference("key",false)).toBe(false);
    expect(() => writePreference("key",true)).not.toThrow();
    vi.stubGlobal("localStorage",{getItem:() => null});
    expect(readPreference("key",[])).toEqual([]);
  });
  it("renders grouped help and a usable empty command surface", () => {
    const markup = renderToStaticMarkup(<ShortcutHelp tools={TOOL_GROUPS.flatMap(([,ids]) => ids.map(id => ({id,nazev:id,key:id,icon:<span />})))} onClose={() => {}} />);
    for (const shortcut of ["Ctrl+S","Ctrl+K","Alt+Q","Shift+A","Ctrl+D"]) expect(markup).toContain(shortcut);
    expect(renderToStaticMarkup(<CommandPalette commands={[]} onClose={() => {}} />)).toContain("Žádný příkaz nenalezen");
  });
  it("shows distinct actual FX previews instead of repeated terrain alone", () => {
    const markup = renderToStaticMarkup(<EditorWeather map={{mrizka:[".."],podklad:"les"} as MapV2} onChange={() => {}} />);
    for (const image of ["dest-svetly","blesk","snih","mraky-svetle","jiskry","snih2"]) expect(markup).toContain(`/fx/${image}.webp`);
    expect(markup).toContain("weather-jasno");
  });
  it("groups single and multi-object properties without dropping variants or mechanics", () => {
    const props = {objects:[object],assets:{tree:{id:"tree",nazev:"Strom",src:"tree.webp",varianty:["v1.webp","v2.webp"]}},push:()=>{},onVariant:()=>{},onAction:()=>{},onDelete:()=>{}};
    const single = renderToStaticMarkup(<ObjectInspector {...props} />);
    for (const name of ["Umístění","Vzhled","Mechanika","Světlo","Viditelnost","Duplikovat","Smazat","v2.webp"]) expect(single).toContain(name);
    const multi = renderToStaticMarkup(<ObjectInspector {...props} objects={[object,{...object,id:"two",x:5}]} />);
    expect(multi).toContain("2 vybraných objektů"); expect(multi).toContain("Zarovnat X"); expect(multi).toContain("Různé");
  });
});
