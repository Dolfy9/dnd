const embeddedImages = new Map<string, Promise<string>>();

export function atmosphereBitmapSize(width: number, height: number, dpr: number, cap: number) {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const limit = Number.isFinite(cap) ? Math.max(1, cap) : 4096;
  const scale = Math.min(Number.isFinite(dpr) ? Math.max(1, dpr) : 1, limit / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

function embeddedImage(url:string) {
  const cached=embeddedImages.get(url);
  if(cached)return cached;
  const result=fetch(url).then(response => {
    if (!response.ok) throw new Error("Light image unavailable");
    return response.blob();
  }).then(blob => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  })).catch(error => { embeddedImages.delete(url); throw error; });
  embeddedImages.set(url,result);
  if(embeddedImages.size>128)embeddedImages.delete(embeddedImages.keys().next().value!);
  return result;
}

export async function embedSvgImages(svg:string) {
  const urls=[...new Set([...svg.matchAll(/href="(\/repo\/[^\"]+)"/g)].map(match=>match[1]))];
  const data=await Promise.all(urls.map(async url=>[url,await embeddedImage(url.replace(/&amp;/g,"&"))]));
  for(const [url,image] of data)svg=svg.split(url).join(image);
  return svg;
}

export async function rasterizeAtmosphere(svg: string, width: number, height: number, dpr: number, cap: number) {
  const size = atmosphereBitmapSize(width, height, dpr, cap);
  const source = await embedSvgImages(svg);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Atmosphere image unavailable"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Atmosphere canvas unavailable");
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Atmosphere bitmap unavailable")), "image/png"));
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function bakeAtmosphere(dark: string, glow: string, width: number, height: number, dpr: number, preview = false) {
  const results = await Promise.allSettled([
    rasterizeAtmosphere(dark, width, height, dpr, preview ? 1024 : 4096),
    rasterizeAtmosphere(glow, width, height, dpr, preview ? 512 : 2048),
  ]);
  if (results[0].status === "fulfilled" && results[1].status === "fulfilled")
    return { dark: results[0].value, glow: results[1].value };
  for (const result of results) if (result.status === "fulfilled") URL.revokeObjectURL(result.value);
  throw new Error("Atmosphere bake failed");
}
