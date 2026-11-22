import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MapAnimatedScene } from "../components/MapAnimatedScene";
import { lightBounds, lightTint, visibleLight, rasterizeLight } from "../components/MapAnimatedLights";
import { visualLights } from "../components/MapAtmoLayers";
import type { MapV2 } from "./mapV2";

const base:MapV2={id:"m",nazev:"M",podklad:"dungeon",mrizka:Array(20).fill(".".repeat(30))};
const light={id:"f",x:5,y:5,bright:5,dim:5,efekt:"plamen" as const};
const view={x:0,y:0,k:1};
afterEach(()=>vi.unstubAllGlobals());

describe("bounded light compositor",()=>{
  it("keeps the atmosphere static and moves effects onto bounded HTML layers",()=>{
    const map={...base,svetla:[light]};
    const html=renderToStaticMarkup(<MapAnimatedScene map={map} view={view}>{null}</MapAnimatedScene>);
    expect(html).toContain('data-animated-light="f"');
    expect(html).toContain('map-light-effect map-light-plamen');
    expect(html).toContain('map-light-crossfade');
    expect(html).toContain('animation-duration:2.9s');
    expect((html.match(/data-light-raster-ready="false"/g)||[])).toHaveLength(2);
    expect(html).not.toContain('<filter');
    expect(renderToStaticMarkup(<MapAnimatedScene map={map} view={view} lights={false}>{null}</MapAnimatedScene>)).not.toContain('data-animated-light');
  });
  it("handles empty, static, invalid and offscreen lights without animation layers",()=>{
    for(const svetla of [[],[{...light,efekt:"zadny" as const}],[{...light,x:NaN}],[{...light,x:1000}]])
      expect(renderToStaticMarkup(<MapAnimatedScene map={{...base,svetla}} view={view}>{null}</MapAnimatedScene>)).not.toContain('data-animated-light');
    const l=visualLights({...base,svetla:[light]})[0];
    expect(visibleLight(l,view,24,800,600)).toBe(true);
    expect(visibleLight(l,{...view,x:-1000},24,800,600)).toBe(false);
    expect(lightTint("#ffac52",0)).toBe("#ffac52");
    expect(lightTint("#ffac52",-7)).not.toBe("#ffac52");
    expect(lightBounds({...l,tvar:"pruh",delka:8,smer:0}).width).toBeGreaterThan(lightBounds({...l,tvar:"pruh",delka:8,smer:90}).width);
  });
  it("caps simultaneous effects while retaining the remaining static lights",()=>{
    const html=renderToStaticMarkup(<MapAnimatedScene map={{...base,svetla:Array.from({length:16},(_,i)=>({...light,id:"l"+i}))}} view={view}>{null}</MapAnimatedScene>);
    expect((html.match(/data-animated-light=/g)||[])).toHaveLength(2);
    expect((html.match(/map-light-effect /g)||[])).toHaveLength(2);
    expect(visualLights({...base,svetla:Array.from({length:16},(_,i)=>({...light,id:"l"+i}))})).toHaveLength(16);
  });
  it("rasterizes once, reuses cached PNGs and evicts failed results",async()=>{
    const drawImage=vi.fn(),toDataURL=vi.fn(()=>"data:image/png;base64,png");
    vi.stubGlobal("fetch",vi.fn(async()=>({ok:true,blob:async()=>new Blob(["image"])})));
    vi.stubGlobal("FileReader",class {result="data:image/webp;base64,glow";onload=()=>{};readAsDataURL(){queueMicrotask(()=>this.onload());}});
    let fail=false;
    vi.stubGlobal("Image",class {onload=()=>{};onerror=()=>{};set src(_:string){queueMicrotask(()=>fail ? this.onerror() : this.onload());}});
    vi.stubGlobal("document",{createElement:()=>({getContext:()=>({drawImage}),toDataURL})});
    const [a,b]=await Promise.all([rasterizeLight("test-svg",100,100),rasterizeLight("test-svg",100,100)]);
    expect(a).toBe("data:image/png;base64,png");expect(b).toBe(a);expect(drawImage).toHaveBeenCalledTimes(1);
    fail=true;await expect(rasterizeLight("broken-svg",100,100)).rejects.toThrow("Light raster unavailable");
    fail=false;await expect(rasterizeLight("broken-svg",100,100)).resolves.toBe(a);
  });
});
