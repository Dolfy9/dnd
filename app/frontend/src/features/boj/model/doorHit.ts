import type { MapWall } from "./mapV2";

export const DOOR_OPEN_ANGLE = -85;
export function doorLeafEnd(w: MapWall, doors?: Record<string, boolean>): [number, number] {
  const angle = (doors?.[w.id] ?? w.open) ? DOOR_OPEN_ANGLE * Math.PI / 180 : 0;
  const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
  return [w.a[0] + dx * Math.cos(angle) - dy * Math.sin(angle), w.a[1] + dx * Math.sin(angle) + dy * Math.cos(angle)];
}
export function doorAt(walls: MapWall[], x: number, y: number, doors?: Record<string, boolean>) {
  const near = (w: MapWall, b: [number, number]) => {
    const dx = b[0] - w.a[0], dy = b[1] - w.a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - w.a[0]) * dx + (y - w.a[1]) * dy) / l2));
    return Math.hypot(x - (w.a[0] + t * dx), y - (w.a[1] + t * dy)) < .5;
  };
  return walls.find(w => w.typ === "door" && (near(w, w.b) || near(w, doorLeafEnd(w, doors))));
}
