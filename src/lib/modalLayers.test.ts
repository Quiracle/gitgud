import { describe, expect, it } from "vitest";
import { createModalLayers, type LayerElement } from "./modalLayers";

class FakeElement implements LayerElement {
  attributes = new Map<string, string>();
  constructor(readonly name: string) {}
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  get inert() {
    return this.attributes.has("inert");
  }
}

function setup() {
  const root = new FakeElement("root");
  const first = new FakeElement("first dialog");
  const second = new FakeElement("second dialog");
  const children: FakeElement[] = [root, first, second];
  return { root, first, second, children, layers: createModalLayers({ children }) };
}

describe("modal layers", () => {
  it("makes everything but the open dialog inert, and restores it on close", () => {
    const { root, first, second, layers } = setup();
    layers.open(first);
    expect([root.inert, first.inert, second.inert]).toEqual([true, false, true]);
    layers.close(first);
    expect([root.inert, first.inert, second.inert]).toEqual([false, false, false]);
  });

  it("keeps only the top dialog interactive when one opens another", () => {
    const { root, first, second, layers } = setup();
    layers.open(first);
    layers.open(second);
    expect([root.inert, first.inert, second.inert]).toEqual([true, true, false]);
    expect(layers.isTop(second)).toBe(true);
    expect(layers.isTop(first)).toBe(false);

    layers.close(second);
    expect([root.inert, first.inert, second.inert]).toEqual([true, false, true]);
    expect(layers.isTop(first)).toBe(true);
  });

  it("handles closing a lower dialog first", () => {
    const { root, first, second, layers } = setup();
    layers.open(first);
    layers.open(second);
    layers.close(first);
    expect([root.inert, first.inert, second.inert]).toEqual([true, true, false]);
    layers.close(second);
    expect([root.inert, first.inert, second.inert]).toEqual([false, false, false]);
  });

  it("never removes inert that something else set", () => {
    const { root, first, children, layers } = setup();
    const foreign = new FakeElement("already inert");
    foreign.setAttribute("inert", "");
    children.push(foreign);
    layers.open(first);
    layers.close(first);
    expect(foreign.inert).toBe(true);
    expect(root.inert).toBe(false);
  });

  it("ignores closing a dialog that was never opened, and reopening moves it to the top", () => {
    const { root, first, second, layers } = setup();
    layers.close(first);
    expect(root.inert).toBe(false);
    layers.open(first);
    layers.open(second);
    layers.open(first);
    expect(layers.isTop(first)).toBe(true);
    expect([root.inert, first.inert, second.inert]).toEqual([true, false, true]);
  });
});
