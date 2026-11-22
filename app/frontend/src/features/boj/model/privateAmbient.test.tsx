import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BakedAtmosphere, MapAtmosphereArtwork, MapAtmosphereLayer, PublicIlluminationMask } from "../components/MapAtmoLayers";
import type { MapV2 } from "./mapV2";

it("cuts ambient darkness out of anonymous bright cells even before baking completes", () => {
  const map: MapV2 = { id: "m", nazev: "M", podklad: "jine", mrizka: [".."], atmosfera: { amb: 0, barva: "#000000" } };
  const html = renderToStaticMarkup(<svg><MapAtmosphereLayer map={map} illumination={{ "0,0": "bright", "1,0": "dark" }} /></svg>);
  expect(html).toContain('data-public-illumination');
  expect(html).toMatch(/<rect[^>]*x="0"[^>]*fill="#000"/);
  expect(html).toMatch(/<rect[^>]*mask="url\(#[^)]+\)"/);
});

it("preserves public glow while masking both baked and fallback darkness", () => {
  const baked = renderToStaticMarkup(<BakedAtmosphere dark="dark.png" glow="glow.png" width={48} height={24} darknessMask="url(#public)"/>);
  const images = baked.match(/<image[^>]*>/g)!;
  expect(images[0]).toContain('mask="url(#public)"');
  expect(images[1]).not.toContain("mask=");
  const fallback = renderToStaticMarkup(<MapAtmosphereArtwork map={{ id:"m",nazev:"M",podklad:"jine",mrizka:[".."],atmosfera:{amb:0,barva:"#000000"} }} darknessMask="url(#public)"/>);
  expect(fallback).toContain('<g mask="url(#public)"><rect');
});

it("keeps unknown/dark cells opaque and ignores malformed, out-of-bounds or invalid levels", () => {
  const render = (illumination:Record<string,string>) => renderToStaticMarkup(<PublicIlluminationMask id="public" illumination={illumination} width={48} height={24}/>);
  expect(render({}).match(/<rect/g)).toHaveLength(1);
  expect(render({"0,0":"dark","1,0":"invalid","999,0":"bright","-1,0":"bright","bad":"bright"}).match(/<rect/g)).toHaveLength(1);
  expect(render({"1,0":"dim"})).toContain('fill="#000" opacity="0.55"');
});
