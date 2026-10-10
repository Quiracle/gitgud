import { useEffect, useRef } from "react";

/**
 * Lets mouse users scroll a horizontal strip: drag it, or use the vertical wheel,
 * which hands back to the page once the strip reaches either end. Touch and
 * trackpads keep their native behaviour. A drag never triggers the card's link.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let start: { x: number; left: number } | null = null;
    let dragged = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      start = { x: event.clientX, left: element.scrollLeft };
      dragged = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      if (!dragged && Math.abs(dx) > 5) {
        dragged = true;
        // Snapping fights a manual drag; restore it on release so the strip settles.
        element.style.scrollSnapType = "none";
        element.style.cursor = "grabbing";
        element.setPointerCapture(event.pointerId);
      }
      if (dragged) element.scrollLeft = start.left - dx;
    };
    const onPointerUp = () => {
      start = null;
      element.style.scrollSnapType = "";
      element.style.cursor = "";
    };
    const onClick = (event: MouseEvent) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };
    // Links would otherwise start a native "drag this URL" gesture.
    const onDragStart = (event: DragEvent) => event.preventDefault();
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const max = element.scrollWidth - element.clientWidth;
      const atStart = element.scrollLeft <= 0 && event.deltaY < 0;
      const atEnd = element.scrollLeft >= max - 1 && event.deltaY > 0;
      if (max <= 0 || atStart || atEnd) return;
      event.preventDefault();
      element.scrollBy({ left: event.deltaY });
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", onPointerUp);
    element.addEventListener("pointercancel", onPointerUp);
    element.addEventListener("click", onClick, true);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("dragstart", onDragStart);
    return () => {
      element.removeEventListener("dragstart", onDragStart);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointercancel", onPointerUp);
      element.removeEventListener("click", onClick, true);
      element.removeEventListener("wheel", onWheel);
    };
  }, []);

  return ref;
}
