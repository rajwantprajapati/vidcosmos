// The automated layout check (F18 "no text box leaves its safe area"): after each frame
// renders, every text box (`data-text`) is measured. A scene's text must stay in the content
// box (the safe area above the captions), and captions (`data-area="captions"`) in their band
// at the bottom of the safe area, so the two never overlap. Text inside a card (`data-box`)
// must also stay inside that card. A box outside its area or card, or wider than itself (a
// word that can't wrap), is reported to the browser console with the `layoutProblemTag`, which
// `pnpm video:stills` collects and fails on. Off unless asked for.
import { useEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import type { Box, Stage } from "./format";

export const layoutProblemTag = "[vidcosmos-layout]";

export type LayoutProblem = { text: string; problem: string };

/** What's wrong with a measured text box, if anything (in canvas px). */
export function layoutProblem(
  box: Box,
  safe: Box,
  overflowX: number,
  tolerance = 1,
): string | null {
  const out = {
    left: safe.left - box.left,
    top: safe.top - box.top,
    right: box.left + box.width - (safe.left + safe.width),
    bottom: box.top + box.height - (safe.top + safe.height),
  };
  const worst = Object.entries(out).filter(([, by]) => by > tolerance);
  if (worst.length > 0) {
    return `leaves its area (${worst.map(([side, by]) => `${side} by ${Math.round(by)} px`).join(", ")})`;
  }
  if (overflowX > tolerance) return `overflows its box by ${Math.round(overflowX)} px`;
  return null;
}

/**
 * Rendered last inside the canvas. The frame is held (`delayRender`) until the fonts are
 * ready and the page is laid out, then every text box is measured from the canvas, the
 * marker's parent.
 */
export function LayoutCheck({ stage }: { stage: Stage }) {
  const frame = useCurrentFrame();
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const handle = delayRender("Checking the layout");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };
    void document.fonts.ready.then(() =>
      setTimeout(() => {
        const element = marker.current?.parentElement;
        if (element) report(element, stage, frame);
        finish();
      }, 0),
    );
    return finish;
  }, [frame, stage]);
  return <span ref={marker} hidden />;
}

function report(element: HTMLElement, stage: Stage, frame: number) {
  const origin = element.getBoundingClientRect();
  if (origin.width === 0) {
    console.error(
      `${layoutProblemTag} ${JSON.stringify({ frame, text: "", problem: "the canvas has no size to measure from" })}`,
    );
    return;
  }
  // Studio scales the canvas to fit; measurements are turned back into canvas px.
  const scale = origin.width / stage.width;
  const boxOf = (node: Element): Box => {
    const rect = node.getBoundingClientRect();
    return {
      left: (rect.left - origin.left) / scale,
      top: (rect.top - origin.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    };
  };
  for (const node of element.querySelectorAll<HTMLElement>("[data-text]")) {
    const box = boxOf(node);
    if (box.width === 0 && box.height === 0) continue;
    const captions = node.dataset.area === "captions";
    const area = captions ? stage.captions : stage.content;
    const card = node.parentElement?.closest("[data-box]");
    const problem =
      layoutProblem(box, area, node.scrollWidth - node.clientWidth) ??
      (card ? layoutProblem(box, boxOf(card), 0)?.replace("its area", "its card") : null);
    if (problem) {
      const where = captions ? "caption" : "scene text";
      const found: LayoutProblem = {
        text: node.dataset.text ?? "",
        problem: `${where} ${problem}`,
      };
      console.error(`${layoutProblemTag} ${JSON.stringify({ frame, ...found })}`);
    }
  }
}
