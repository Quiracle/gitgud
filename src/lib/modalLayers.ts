/**
 * Keeps only the top-most open dialog interactive. Every other child of the host (the app
 * root, lower dialogs, anything else on <body>) is marked `inert`, so Tab can't reach it and
 * screen readers skip it. Only elements this module made inert are ever restored.
 */

export interface LayerElement {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  hasAttribute(name: string): boolean;
}

export interface LayerHost {
  readonly children: ArrayLike<LayerElement>;
}

/** Marks elements we made inert, so inert set by anything else is left alone. */
const MARK = "data-modal-inert";

export function createModalLayers(host: LayerHost) {
  const stack: LayerElement[] = [];

  function sync() {
    const top = stack[stack.length - 1];
    for (const element of Array.from(host.children)) {
      if (top && element !== top) {
        if (!element.hasAttribute("inert")) {
          element.setAttribute("inert", "");
          element.setAttribute(MARK, "");
        }
      } else if (element.hasAttribute(MARK)) {
        element.removeAttribute("inert");
        element.removeAttribute(MARK);
      }
    }
  }

  return {
    /** Puts `layer` on top and makes everything else inert. */
    open(layer: LayerElement) {
      const index = stack.indexOf(layer);
      if (index >= 0) stack.splice(index, 1);
      stack.push(layer);
      sync();
    },
    /** Removes `layer`; the next dialog down (or the whole page) becomes interactive again. */
    close(layer: LayerElement) {
      const index = stack.indexOf(layer);
      if (index >= 0) stack.splice(index, 1);
      sync();
    },
    isTop(layer: LayerElement): boolean {
      return stack[stack.length - 1] === layer;
    },
  };
}

let shared: ReturnType<typeof createModalLayers> | undefined;

/** The layers for this document's <body>. */
export function modalLayers() {
  shared ??= createModalLayers(document.body);
  return shared;
}
