"use client";

/**
 * Browser page translators (Chrome/Google Translate, Edge) replace text nodes with their own <font>
 * wrappers. If React later removes or inserts next to one of the original nodes, the DOM call throws
 * ("The node to be removed is not a child of this node") and the page crashes. This guard makes those
 * two DOM methods tolerant of translator changes. It runs once, when this module loads, before hydration.
 * See https://github.com/facebook/react/issues/11538
 */
if (typeof window !== "undefined" && typeof Node === "function" && Node.prototype) {
  const proto = Node.prototype as Node & { __translateGuard?: boolean };
  if (!proto.__translateGuard) {
    proto.__translateGuard = true;
    const removeChild = proto.removeChild;
    proto.removeChild = function <T extends Node>(this: Node, child: T): T {
      if (child.parentNode !== this) {
        // The translator moved the node; remove it from wherever it now lives instead of crashing.
        child.parentNode?.removeChild(child);
        return child;
      }
      return removeChild.call(this, child) as T;
    };
    const insertBefore = proto.insertBefore;
    proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
      if (reference && reference.parentNode !== this) return insertBefore.call(this, node, null) as T;
      return insertBefore.call(this, node, reference) as T;
    };
  }
}

export function TranslateGuard() {
  return null;
}
