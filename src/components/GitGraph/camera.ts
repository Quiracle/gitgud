/** Pure 2D camera math for the pannable, zoomable commit canvas. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MIN_ZOOM = 0.35;
export const MAX_ZOOM = 2.5;

export function clampScale(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Zooms so the content point under `focus` (viewport pixels) stays under it. */
export function zoomAt(camera: Camera, focus: { x: number; y: number }, nextScale: number): Camera {
  const scale = clampScale(nextScale);
  const contentX = (focus.x - camera.x) / camera.scale;
  const contentY = (focus.y - camera.y) / camera.scale;
  return { x: focus.x - contentX * scale, y: focus.y - contentY * scale, scale };
}

/** Places a content point at the centre of the viewport. */
export function centerOn(point: { x: number; y: number }, view: Size, scale: number): Camera {
  return { x: view.width / 2 - point.x * scale, y: view.height / 2 - point.y * scale, scale };
}

/** Keeps at least `margin` pixels of the drawing on screen so it can't be lost. */
export function clampPan(camera: Camera, view: Size, content: Size, margin = 80): Camera {
  const w = content.width * camera.scale;
  const h = content.height * camera.scale;
  const keepX = Math.min(margin, w);
  const keepY = Math.min(margin, h);
  return {
    ...camera,
    x: Math.min(view.width - keepX, Math.max(keepX - w, camera.x)),
    y: Math.min(view.height - keepY, Math.max(keepY - h, camera.y)),
  };
}
