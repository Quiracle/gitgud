/**
 * Hand-off for the Home → puzzle shared-element transition: Home records where its
 * preview canvas was, and the puzzle screen grows its canvas out of that spot.
 */
export interface CanvasOrigin {
  rect: { top: number; left: number; width: number; height: number };
  /** Scale the tree was drawn at inside the preview. */
  treeScale: number;
}

let pending: CanvasOrigin | null = null;

export function setCanvasOrigin(origin: CanvasOrigin) {
  pending = origin;
}

export function peekCanvasOrigin(): CanvasOrigin | null {
  return pending;
}

/** Called once the puzzle screen has used the hand-off, so later visits start fresh. */
export function clearCanvasOrigin() {
  pending = null;
}
