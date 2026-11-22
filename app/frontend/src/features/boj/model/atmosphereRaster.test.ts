import { afterEach, describe, expect, it, vi } from "vitest";
import { atmosphereBitmapSize, bakeAtmosphere, embedSvgImages, rasterizeAtmosphere } from "./atmosphereRaster";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("atmosphere bitmap baking", () => {
  it("embeds overlapping image URLs independently without rewriting unrelated SVG text",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>({ok:true,blob:async()=>new Blob([url])})));
    vi.stubGlobal("FileReader",class {result="";onload=()=>{};readAsDataURL(blob:Blob){blob.text().then(t=>{this.result="data:"+t;this.onload();});}});
    const svg='<svg data-source="/repo/prefix.webp"><image href="/repo/prefix.webp"/><image href="/repo/prefix.webp?v=2"/><image href="/repo/prefix.webp"/></svg>';
    expect(await embedSvgImages(svg)).toBe('<svg data-source="/repo/prefix.webp"><image href="data:/repo/prefix.webp"/><image href="data:/repo/prefix.webp?v=2"/><image href="data:/repo/prefix.webp"/></svg>');
  });
  it("uses device pixels, caps the long side and tolerates empty/non-finite dimensions", () => {
    expect(atmosphereBitmapSize(100, 200, 2, 4096)).toEqual({width:200,height:400});
    expect(atmosphereBitmapSize(8000, 4000, 2, 4096)).toEqual({width:4096,height:2048});
    expect(atmosphereBitmapSize(4000, 8000, 2, 2048)).toEqual({width:1024,height:2048});
    expect(atmosphereBitmapSize(0, NaN, Infinity, -1)).toEqual({width:1,height:1});
  });

  function setup() {
    let number = 0;
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:test-" + ++number);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    let fail = false;
    vi.stubGlobal("Image", class {
      onload = () => {}; onerror = () => {};
      set src(_: string) { queueMicrotask(() => fail ? this.onerror() : this.onload()); }
    });
    const draw = vi.fn();
    const canvas = {width:0,height:0,getContext:() => ({drawImage:draw}),toBlob:(callback:(blob:Blob|null)=>void) => callback(new Blob(["png"]))};
    vi.stubGlobal("document", {createElement:() => canvas});
    return {create,revoke,draw,canvas,fail:() => { fail = true; }};
  }

  it("bakes two alpha PNGs at independently capped resolutions and releases SVG URLs", async () => {
    const {create,revoke,draw} = setup();
    const result = await bakeAtmosphere("<svg>dark</svg>", "<svg>glow</svg>", 8000, 4000, 2);
    expect(result).toEqual({dark:"blob:test-3",glow:"blob:test-4"});
    expect(create).toHaveBeenCalledTimes(4);
    expect(draw.mock.calls.map(call=>call.slice(1))).toEqual([[0,0,4096,2048],[0,0,2048,1024]]);
    expect(revoke.mock.calls.flat()).toEqual(["blob:test-1","blob:test-2"]);
  });

  it("releases SVG URLs on image and canvas errors", async () => {
    const {fail,revoke,canvas} = setup();
    canvas.getContext = () => null!;
    await expect(rasterizeAtmosphere("empty", 10, 10, 1, 100)).rejects.toThrow("canvas unavailable");
    fail();
    await expect(rasterizeAtmosphere("bad", 10, 10, 1, 100)).rejects.toThrow("image unavailable");
    expect(revoke.mock.calls.flat()).toEqual(["blob:test-1","blob:test-2"]);
  });

  it("releases a successful sibling when either bitmap fails", async () => {
    const {revoke,canvas} = setup();
    let count=0;
    canvas.toBlob = callback => callback(++count === 1 ? new Blob(["png"]) : null);
    await expect(bakeAtmosphere("dark", "glow", 10, 10, 1)).rejects.toThrow("bake failed");
    expect(revoke.mock.calls.flat()).toContain("blob:test-3");
  });

  it("retries unavailable glow images and embeds them before rasterizing", async () => {
    const {create} = setup();
    const fetch = vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true,blob:async()=>new Blob(["glow"])});
    vi.stubGlobal("fetch",fetch);
    vi.stubGlobal("FileReader",class {
      result="data:image/webp;base64,glow"; onload=()=>{};
      readAsDataURL(){queueMicrotask(()=>this.onload());}
    });
    const svg='<svg><image href="/repo/11_Mapy/bojove/ovl/zar.webp"/></svg>';
    await expect(rasterizeAtmosphere(svg,10,10,1,100)).rejects.toThrow("Light image unavailable");
    await rasterizeAtmosphere(svg,10,10,1,100);
    expect(await (create.mock.calls[0][0] as Blob).text()).toContain('href="data:image/webp;base64,glow"');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("embeds sprite-alpha masks once per asset, and retries failed sprite requests",async()=>{
    const {create}=setup();
    const fetch=vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true,blob:async()=>new Blob(["sprite"])});
    vi.stubGlobal("fetch",fetch);
    vi.stubGlobal("FileReader",class {result="data:image/webp;base64,sprite";onload=()=>{};readAsDataURL(){queueMicrotask(()=>this.onload());}});
    const svg='<svg><image href="/repo/crate.webp"/><image href="/repo/crate.webp"/></svg>';
    await expect(rasterizeAtmosphere(svg,10,10,1,100)).rejects.toThrow("image unavailable");
    await rasterizeAtmosphere(svg,10,10,1,100);
    await rasterizeAtmosphere(svg,10,10,1,100);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await (create.mock.calls[0][0] as Blob).text()).not.toContain('/repo/crate.webp');
  });
});
