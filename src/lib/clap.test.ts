import { describe, it, expect } from "vitest";
import { GestureInterpreter, type HandSample } from "./gestures";

const hands = (span: number, pinch = false): HandSample[] =>
  [0.5 - span / 2, 0.5 + span / 2].map((x) => ({
    x,
    y: 0.5,
    pinch,
    open: !pinch,
    palm: { x, y: 0.5, size: 0.16 },
  }));
const clap = (
  interpreter: GestureInterpreter,
  start = 0,
  scope: "space" | "image" = "image",
  pinch = false,
) =>
  [0.6, 0.45, 0.3, 0.16].flatMap((span, i) =>
    interpreter.update(hands(span, pinch), start + i * 80, scope),
  );

describe("camera clap celebration", () => {
  it("fires once on a fast two-palm approach without also swiping or zooming", () => {
    expect(clap(new GestureInterpreter())).toEqual([{ type: "clap" }]);
  });
  it("does not fire for a stationary contact, a slow approach, or in the spatial overview", () => {
    const idle = new GestureInterpreter();
    for (let t = 0; t < 1000; t += 80)
      expect(idle.update(hands(0.16), t, "image")).toEqual([]);
    const slow = new GestureInterpreter();
    const events = Array.from({ length: 17 }, (_, i) =>
      slow.update(hands(0.6 - i * 0.0275), i * 100, "image"),
    ).flat();
    expect(events).not.toContainEqual({ type: "clap" });
    expect(clap(new GestureInterpreter(), 0, "space")).not.toContainEqual({
      type: "clap",
    });
  });
  it("does not confuse pinched zooming with clapping", () => {
    const events = clap(new GestureInterpreter(), 0, "image", true);
    expect(events.some((event) => event.type === "zoom")).toBe(true);
    expect(events).not.toContainEqual({ type: "clap" });
    const loosening = new GestureInterpreter();
    const partial = [0.6, 0.45, 0.3, 0.16].flatMap((span, i) =>
      loosening.update(
        hands(span).map((hand) => ({ ...hand, pinchRatio: 0.4 })),
        i * 80,
        "image",
      ),
    );
    expect(partial).not.toContainEqual({ type: "clap" });
  });
  it("keeps cooldown across hand loss and rearms only on a fresh separated pair", () => {
    const interpreter = new GestureInterpreter();
    expect(clap(interpreter)).toEqual([{ type: "clap" }]);
    interpreter.update([], 400, "image");
    expect(clap(interpreter, 600)).not.toContainEqual({ type: "clap" });
    expect(clap(interpreter, 2600)).toEqual([{ type: "clap" }]);
  });
  it("rejects lost tracking, a long frame gap, and vertically separated palms", () => {
    for (const loss of [false, true]) {
      const interpreter = new GestureInterpreter();
      interpreter.update(hands(0.6), 0, "image");
      if (loss) interpreter.update([], 100, "image");
      expect(interpreter.update(hands(0.16), 400, "image")).not.toContainEqual({
        type: "clap",
      });
    }
    const interpreter = new GestureInterpreter();
    const raised = (span: number) =>
      hands(span).map((hand, i) => ({
        ...hand,
        palm: { ...hand.palm!, y: i ? 0.9 : 0.2 },
      }));
    interpreter.update(raised(0.6), 0, "image");
    expect(interpreter.update(raised(0.16), 100, "image")).not.toContainEqual({
      type: "clap",
    });
  });
});
