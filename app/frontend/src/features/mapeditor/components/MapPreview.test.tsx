import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MapPreview } from "./MapPreview";
import type { MapV2 } from "../../boj/model/mapV2";

const map:MapV2={id:"lit",nazev:"Osvětlená mapa",podklad:"dungeon",mrizka:["....","...."],atmosfera:{amb:.2,barva:"#101522"},svetla:[{id:"l",x:1,y:1,bright:5,dim:10,tvar:"kuzel",color:"#ff9944"}]};
describe("map preview export",()=>{
  it("includes light artwork and darkness holes in a synchronous static export",()=>{
    const svg=renderToStaticMarkup(<MapPreview map={map} staticLighting/>);
    expect(svg).toContain('data-light-shape="kuzel"');
    expect(svg).toContain("#ff9944");
    expect(svg).toContain("<mask");
    expect(svg).toContain("<use");
    expect(svg).not.toContain("blob:");
  });
  it("keeps live thumbnails baked and handles an empty, fully lit export",()=>{
    expect(renderToStaticMarkup(<MapPreview map={map}/>)).toContain('data-atmosphere-baked="false"');
    const svg=renderToStaticMarkup(<MapPreview map={{...map,svetla:[],atmosfera:undefined}} staticLighting/>);
    expect(svg).not.toContain("<mask");
    expect(svg).not.toContain("<use");
  });
});
