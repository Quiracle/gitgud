import { useEffect, useState } from "react";

/**
 * The part of the screen not covered by the on-screen keyboard. iOS Safari keeps the
 * layout viewport full height when the keyboard opens, so full-screen layouts size
 * themselves from the visual viewport to keep the command input visible.
 */
export function useVisualViewport() {
  const read = () => {
    const viewport = window.visualViewport;
    return { height: viewport?.height ?? window.innerHeight, offsetTop: viewport?.offsetTop ?? 0 };
  };
  const [size, setSize] = useState(read);

  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setSize(read());
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return size;
}
