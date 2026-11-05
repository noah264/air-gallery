import { describe, expect, it } from "vitest";
import {
  GestureInterpreter,
  MotionFilter,
  sampleHand,
  type HandSample,
} from "./gestures";
import { handPoints } from "../../tests/hand-fixtures";

const hand = (x: number, pinch = true): HandSample => ({
  x,
  y: 0.5,
  pinch,
  open: !pinch,
});

describe("album navigation poses", () => {
  const pose = (value: "victory" | "fist"): HandSample => ({
    ...hand(0.5, false),
    open: false,
    pose: value,
  });
  const frames = (
    interpreter: GestureInterpreter,
    value: HandSample,
    start = 0,
    scope: "space" | "image" = "space",
  ) => {
    return Array.from({ length: 7 }, (_, index) =>
      interpreter.update([value], start + index * 100, scope),
    ).flat();
  };
  it("distinguishes V, fist, and palm landmarks regardless of image rotation", () => {
    for (const [name, expected] of [
      ["victory", "victory"],
      ["fist", "fist"],
      ["palm", "neutral"],
    ] as const) {
      const points = handPoints(name);
      expect(sampleHand(points)?.pose).toBe(expected);
      expect(
        sampleHand(points.map((p) => ({ x: 1 - p.y, y: p.x })))?.pose,
      ).toBe(expected);
    }
    expect(sampleHand(handPoints("fist"))?.pinch).toBe(false);
    expect(sampleHand(handPoints("victory"))?.open).toBe(false);
  });
  it("opens after a 600ms hold and never repeats while the pose remains held", () => {
    const interpreter = new GestureInterpreter();
    const events = frames(interpreter, pose("victory"));
    expect(events.filter((e) => e.type === "activate")).toEqual([
      { type: "activate", action: "open" },
    ]);
    expect(events[0]).toEqual({ type: "hold", action: "open", progress: 0 });
    expect(
      frames(interpreter, pose("victory"), 700).filter(
        (e) => e.type === "activate",
      ),
    ).toEqual([]);
  });
  it("cancels an interrupted hold and starts a fresh timer", () => {
    const interpreter = new GestureInterpreter();
    for (let t = 0; t <= 400; t += 100)
      interpreter.update([pose("victory")], t);
    interpreter.update([hand(0.5, false)], 500);
    const events = frames(interpreter, pose("victory"), 600);
    expect(events[0]).toEqual({ type: "hold", action: "open", progress: 0 });
    expect(events.at(-1)).toEqual({ type: "activate", action: "open" });
  });
  it("closes only in image mode and ignores V in image mode", () => {
    expect(frames(new GestureInterpreter(), pose("fist"))).toEqual([]);
    expect(
      frames(new GestureInterpreter(), pose("victory"), 0, "image"),
    ).toEqual([]);
    expect(
      frames(new GestureInterpreter(), pose("fist"), 0, "image").at(-1),
    ).toEqual({ type: "activate", action: "close" });
  });
  it("does not navigate when a second hand is visible", () => {
    const interpreter = new GestureInterpreter();
    for (let t = 0; t <= 1000; t += 100) {
      expect(
        interpreter
          .update([pose("victory"), hand(0.8, false)], t)
          .some((e) => e.type === "activate" || e.type === "hold"),
      ).toBe(false);
    }
  });
  it("cancels after losing the hand, a long frame gap, or moving too far", () => {
    for (const interruption of ["loss", "gap", "movement"]) {
      const interpreter = new GestureInterpreter();
      for (let t = 0; t <= 400; t += 100)
        interpreter.update([pose("victory")], t);
      if (interruption === "loss") interpreter.update([], 500);
      const time = interruption === "gap" ? 700 : 600;
      const changed = {
        ...pose("victory"),
        x: interruption === "movement" ? 0.8 : 0.5,
      };
      expect(interpreter.update([changed], time)).toEqual([
        { type: "hold", action: "open", progress: 0 },
      ]);
    }
  });
});
describe("gesture arbitration", () => {
  it("suppresses stationary jitter without delaying deliberate motion", () => {
    const filter = new MotionFilter();
    filter.update(0.5, 1 / 30);
    const output = Array.from({ length: 60 }, (_, i) =>
      filter.update(0.5 + (i % 2 ? 0.003 : -0.003), 1 / 30),
    );
    expect(Math.max(...output) - Math.min(...output)).toBeLessThan(0.002);
    for (let i = 0; i < 5; i++) filter.update(0.7, 1 / 30);
    expect(filter.update(0.7, 1 / 30)).toBeGreaterThan(0.68);
  });
  it("requires a stable pinch and uses a separate release threshold", () => {
    const interpreter = new GestureInterpreter();
    const sample = (ratio: number) => ({ ...hand(0.5), pinchRatio: ratio });
    expect(interpreter.update([sample(0.25)], 0)).toEqual([]);
    expect(interpreter.update([sample(0.25)], 33)).toEqual([]);
    expect(interpreter.update([sample(0.25)], 66)[0]?.type).toBe("start");
    expect(interpreter.update([sample(0.38)], 99)).toEqual([]);
    expect(interpreter.update([sample(0.48)], 132)).toEqual([]);
    expect(interpreter.update([sample(0.25)], 165)).toEqual([]);
    expect(interpreter.update([sample(0.25)], 198)[0]?.type).toBe("start");
  });
  it("keeps a stable drag when detector hand ordering changes", () => {
    const interpreter = new GestureInterpreter();
    interpreter.update([hand(0.2), hand(0.8, false)], 0);
    const events = interpreter.update([hand(0.8, false), hand(0.22)], 33);
    expect(events[0]?.type).toBe("pan");
    if (events[0]?.type === "pan")
      expect(Math.abs(events[0].dx)).toBeLessThan(0.025);
  });
  it("does not apply accumulated movement after a stalled recognition frame", () => {
    const interpreter = new GestureInterpreter();
    interpreter.update([hand(0.2)], 0);
    expect(interpreter.update([hand(0.5)], 400)[0]?.type).toBe("start");
  });
  it("never emits pan or swipe while two-hand zoom is locked", () => {
    const interpreter = new GestureInterpreter();
    expect(interpreter.update([hand(0.4), hand(0.6)], 0)).toEqual([]);
    const events = interpreter.update([hand(0.3), hand(0.7)], 50);
    expect(events).toEqual([{ type: "zoom", delta: 0.12, x: 0.5, y: 0.5 }]);
    expect(interpreter.update([hand(0.3)], 80)).toEqual([]);
  });
  it("resets movement baseline after hand loss", () => {
    const interpreter = new GestureInterpreter();
    interpreter.update([hand(0.2)], 0);
    expect(interpreter.update([hand(0.3)], 30)[0].type).toBe("pan");
    expect(interpreter.update([], 50)).toEqual([]);
    expect(interpreter.update([hand(0.8)], 80)).toEqual([
      { type: "start", x: 0.8, y: 0.5, time: 80 },
    ]);
  });
  it("debounces a swipe so one movement cannot flip several pages", () => {
    const interpreter = new GestureInterpreter();
    interpreter.update([hand(0.8, false)], 0);
    expect(interpreter.update([hand(0.5, false)], 100)).toEqual([
      { type: "swipe", direction: 1 },
    ]);
    expect(interpreter.update([hand(0.2, false)], 200)).toEqual([]);
  });
});

describe("thumbs-up praise", () => {
  const sample = () => sampleHand(handPoints("thumbs-up"))!;
  it("recognizes either hand across scale and moderate tilt without confusing a fist", () => {
    const points = handPoints("thumbs-up");
    for (const mirrored of [false, true]) {
      for (const scale of [0.5, 1, 1.3]) {
        const angle = Math.PI / 9;
        const transformed = points.map(({ x, y }) => {
          const dx = (x - 0.5) * scale * (mirrored ? -1 : 1),
            dy = (y - 0.6) * scale;
          return {
            x: 0.5 + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: 0.6 + dx * Math.sin(angle) + dy * Math.cos(angle),
          };
        });
        expect(sampleHand(transformed)?.pose).toBe("thumbs-up");
      }
    }
    expect(sample().pinch).toBe(false);
    expect(sample().open).toBe(false);
    expect(sampleHand(handPoints("fist"))?.pose).toBe("fist");
  });
  it("rejects sideways/downward thumbs, partial and non-finite landmarks", () => {
    for (const angle of [Math.PI / 2, Math.PI]) {
      const points = handPoints("thumbs-up").map(({ x, y }) => ({
        x: 0.5 + (x - 0.5) * Math.cos(angle) - (y - 0.6) * Math.sin(angle),
        y: 0.6 + (x - 0.5) * Math.sin(angle) + (y - 0.6) * Math.cos(angle),
      }));
      expect(sampleHand(points)?.pose).toBe("neutral");
    }
    expect(sampleHand(handPoints("thumbs-up").slice(0, 15))).toBeNull();
    const invalid = handPoints("thumbs-up");
    invalid[4].x = NaN;
    expect(sampleHand(invalid)).toBeNull();
  });
  it("reserves thumbs-up for the continuous effect in either mode without navigation events", () => {
    for (const scope of ["space", "image"] as const) {
      const interpreter = new GestureInterpreter();
      for (let t = 0; t <= 15000; t += 100)
        expect(
          interpreter.update(
            [{ ...sample(), x: 0.5 + Math.sin(t / 300) * 0.12 }],
            t,
            scope,
          ),
        ).toEqual([]);
    }
  });
  it("does not turn a second hand or a tracking restart into a swipe, zoom or close", () => {
    const interpreter = new GestureInterpreter();
    expect(
      interpreter.update([sample(), hand(0.8, false)], 0, "image"),
    ).toEqual([]);
    expect(
      interpreter.update([hand(0.2, false), sample()], 100, "image"),
    ).toEqual([]);
    interpreter.update([], 200, "image");
    expect(interpreter.update([sample()], 1000, "image")).toEqual([]);
  });
  it("still recognizes a deliberate fist after thumbs-up", () => {
    const interpreter = new GestureInterpreter();
    for (let t = 0; t <= 1000; t += 100)
      interpreter.update([sample()], t, "image");
    const fist = sampleHand(handPoints("fist"))!;
    const events = Array.from({ length: 7 }, (_, i) =>
      interpreter.update([fist], 1100 + i * 100, "image"),
    ).flat();
    expect(events.at(-1)).toEqual({ type: "activate", action: "close" });
  });
});
