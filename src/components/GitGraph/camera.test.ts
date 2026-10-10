import { describe, expect, it } from "vitest";
import { centerOn, clampPan, MAX_ZOOM, zoomAt } from "./camera";

describe("canvas camera", () => {
  it("keeps the point under the cursor fixed while zooming", () => {
    const camera = { x: 10, y: 20, scale: 1 };
    const next = zoomAt(camera, { x: 110, y: 120 }, 2);
    // Content point (100, 100) was under the cursor and still is.
    expect(next.x + 100 * next.scale).toBe(110);
    expect(next.y + 100 * next.scale).toBe(120);
  });

  it("limits zoom", () => {
    expect(zoomAt({ x: 0, y: 0, scale: 1 }, { x: 0, y: 0 }, 99).scale).toBe(MAX_ZOOM);
  });

  it("centres a content point in the view", () => {
    expect(centerOn({ x: 50, y: 40 }, { width: 300, height: 200 }, 1)).toEqual({ x: 100, y: 60, scale: 1 });
  });

  it("stops the drawing from being dragged out of sight", () => {
    const clamped = clampPan({ x: -5000, y: 5000, scale: 1 }, { width: 300, height: 200 }, { width: 200, height: 200 });
    expect(clamped.x).toBe(80 - 200);
    expect(clamped.y).toBe(200 - 80);
  });
});
