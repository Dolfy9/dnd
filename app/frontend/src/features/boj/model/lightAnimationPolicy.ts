export const LIGHT_CAPS = [12, 8, 4, 2] as const;
export type LightAnimationCap = typeof LIGHT_CAPS[number];

export function nextLightAnimationCap(current: LightAnimationCap, meanMs: number): LightAnimationCap {
  return Number.isFinite(meanMs) && meanMs > 40
    ? LIGHT_CAPS[Math.min(LIGHT_CAPS.length - 1, LIGHT_CAPS.indexOf(current) + 1)]
    : current;
}

export function nearestLights<T extends { x: number; y: number }>(lights: T[], center: [number, number], cap: number): T[] {
  const distance = (light: T) => (light.x - center[0]) ** 2 + (light.y - center[1]) ** 2;
  return [...lights].sort((a, b) => distance(a) - distance(b)).slice(0, Math.max(0, cap));
}

export function coneFeatherLayers(count = 48) {
  const smoothstep = (t: number) => t * t * (3 - 2 * t);
  return Array.from({ length: count }, (_, i) => {
    const previous = smoothstep(i / count), next = smoothstep((i + 1) / count);
    return { scale: 1 - .6 * i / count, opacity: (next - previous) / (1 - previous) };
  });
}
