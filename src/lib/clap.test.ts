import { describe, it, expect } from "vitest";
import { GestureInterpreter, sampleHand, type HandSample } from "./gestures";
import { handPoints } from "../../tests/hand-fixtures";

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
  it("does not fire for a stationary contact or a slow approach", () => {
    const idle = new GestureInterpreter();
    for (let t = 0; t < 1000; t += 80)
      expect(idle.update(hands(0.16), t, "image")).toEqual([]);
    const slow = new GestureInterpreter();
    const events = Array.from({ length: 17 }, (_, i) =>
      slow.update(hands(0.6 - i * 0.0275), i * 100, "image"),
    ).flat();
    expect(events).not.toContainEqual({ type: "clap" });
  });
  it("also fires in the spatial overview without switching albums", () => {
    expect(clap(new GestureInterpreter(), 0, "space")).toEqual([
      { type: "clap" },
    ]);
  });
  it("recognizes tilted palms using depth without changing navigation poses", () => {
    const points = handPoints("palm").map((point) => ({
      x: point.x,
      y: 0.9 + (point.y - 0.9) * Math.cos(1.4),
      z: (point.y - 0.9) * Math.sin(1.4),
    }));
    const sample = sampleHand(points)!;
    expect(sample.open).toBe(false);
    expect(sample.clapPalm).toBe(true);
    const interpreter = new GestureInterpreter();
    const events = [0.7, 0.52, 0.36, 0.23].flatMap((span, i) =>
      interpreter.update(
        hands(span).map((hand) => ({
          ...hand,
          open: false,
          clapPalm: sample.clapPalm,
        })),
        i * 80,
        "image",
      ),
    );
    expect(events).toEqual([{ type: "clap" }]);
  });
  it("confirms contact when one palm occludes the other after a fast near approach", () => {
    const interpreter = new GestureInterpreter();
    for (const [i, span] of [0.66, 0.5, 0.36].entries())
      expect(interpreter.update(hands(span), i * 80, "image")).toEqual([]);
    expect(interpreter.update([hands(0)[0]], 260, "image")).toEqual([
      { type: "clap" },
    ]);
    expect(interpreter.update(hands(0.12), 320, "image")).toEqual([]);
  });
  it("tolerates a brief overlap and reacquires both palms before confirming", () => {
    const interpreter = new GestureInterpreter();
    interpreter.update(hands(0.66), 0, "image");
    interpreter.update(hands(0.45), 80, "image");
    expect(interpreter.update([], 140, "image")).toEqual([]);
    expect(interpreter.update(hands(0.23), 200, "image")).toEqual([
      { type: "clap" },
    ]);
  });
  it("never infers a clap from ordinary distant hand loss or a hand leaving sideways", () => {
    for (const lost of [[], [hands(0.8)[0]]]) {
      const interpreter = new GestureInterpreter();
      interpreter.update(hands(0.66), 0, "image");
      interpreter.update(hands(0.5), 80, "image");
      expect(interpreter.update(lost, 180, "image")).toEqual([]);
      expect(interpreter.update(lost, 500, "image")).not.toContainEqual({
        type: "clap",
      });
    }
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
