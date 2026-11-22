import { fogState, type Fog } from "./fog";

export class FogRaster {
  private states: Uint8Array;
  private layers: HTMLCanvasElement[];
  private urls: string[] = [];
  constructor(readonly width: number, readonly height: number) {
    this.states = new Uint8Array(width * height).fill(255);
    this.layers = Array.from({ length: 4 }, () => {
      const canvas = document.createElement("canvas"); canvas.width = width * 4; canvas.height = height * 4;
      return canvas;
    });
  }
  update(fog: Fog) {
    let changed = 0;
    const contexts = this.layers.map(c => c.getContext("2d")!);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      const state = { unknown: 0, memory: 1, visible: 2 }[fogState(fog, x, y)], i = y * this.width + x;
      if (state === this.states[i]) continue;
      this.states[i] = state; changed++;
      contexts.forEach((ctx, layer) => {
        ctx.clearRect(x * 4, y * 4, 4, 4);
        if (layer === state || (layer === 3 && state !== 2)) { ctx.fillStyle = "white"; ctx.fillRect(x * 4, y * 4, 4, 4); }
      });
    }
    if (changed) this.urls = this.layers.map(c => c.toDataURL());
    return { unknown: this.urls[0], memory: this.urls[1], visible: this.urls[2], invisible: this.urls[3], changed };
  }
}
