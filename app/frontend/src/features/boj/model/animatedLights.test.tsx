import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MapAnimatedScene } from "../components/MapAnimatedScene";
import { AnimatedLightMask,lightBounds, lightTint, visibleLight, rasterizeLight } from "../components/MapAnimatedLights";
import { MapAtmosphereArtwork, visualLights } from "../components/MapAtmoLayers";
import type { MapV2 } from "./mapV2";
import {finiteLightShadows} from "./objectShadows";

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
  it("masks animated light by the actual object alpha, even for flat non-occluding sprites",()=>{
    const html=renderToStaticMarkup(<AnimatedLightMask light={visualLights({...base,svetla:[light]})[0]} polygon={[]} shadows={[]} objects={[{id:"o",asset:"img:crate.webp",x:5,y:5,w:1,h:1,vyska:0}]} assets={{}} width={30} height={20}/>);
    expect(html).toContain('data-glow-exclusion="o"');expect(html).toContain('href="/repo/11_Mapy/bojove/crate.webp"');
    expect(html).toContain('mask="url(#artwork)"');expect(html).toContain('mask="url(#shadow)"');
  });
  it("caps simultaneous effects while retaining the remaining static lights",()=>{
    const html=renderToStaticMarkup(<MapAnimatedScene map={{...base,svetla:Array.from({length:16},(_,i)=>({...light,id:"l"+i}))}} view={view}>{null}</MapAnimatedScene>);
    expect((html.match(/data-animated-light=/g)||[])).toHaveLength(12);
    expect((html.match(/map-light-effect /g)||[])).toHaveLength(12);
    expect(visualLights({...base,svetla:Array.from({length:16},(_,i)=>({...light,id:"l"+i}))})).toHaveLength(16);
  });
  it("does not change light clips when a distant blocker moves, but includes nearby and strip-end blockers",()=>{
    const clip=(x:number,y:number,shape={})=>renderToStaticMarkup(<MapAnimatedScene map={{...base,svetla:[{...light,...shape}],objekty:[{id:"crate",asset:"bedna",x,y,w:1,h:1,rot:0,blocks:true}]}} view={view}>{null}</MapAnimatedScene>).match(/<div class="map-light-clip"[^>]+>/)?.[0];
    expect(clip(20,15)).toBe(clip(21,15));
    expect(clip(6.5,5)).toContain("opacity:0");
    const shadow=(x:number,shape={})=>finiteLightShadows({...light,...shape},[{id:"crate",asset:"bedna",x,y:5,w:1,h:1,blocks:true}]);
    expect(shadow(6.5)).toHaveLength(1);
    expect(shadow(6.5,{stiny:false})).toHaveLength(0);
    expect(shadow(10)).toHaveLength(0);
    expect(shadow(10,{tvar:"pruh",delka:8})).toHaveLength(1);
    const baked=(x:number)=>renderToStaticMarkup(<MapAtmosphereArtwork layer="darkness" map={{...base,svetla:[light],objekty:[{id:"crate",asset:"bedna",x,y:15,w:1,h:1,rot:0,blocks:true}]}} />);
    expect(baked(20)).toBe(baked(21));
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
