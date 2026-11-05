import { ClapDetector, isClapPalm } from "./clap";

export interface Point {
  x: number;
  y: number;
  z?: number;
}
export interface HandSample {
  x: number;
  y: number;
  pinch: boolean;
  open: boolean;
  pinchRatio?: number;
  clapPalm?: boolean;
  pose?: "victory" | "fist" | "thumbs-up" | "neutral";
  palm?: { x: number; y: number; size: number };
}
export type GestureScope = "space" | "image";
export type HoldAction = "open" | "close";
export interface GestureHold {
  action: HoldAction;
  progress: number;
}
export type GestureEvent =
  | { type: "start"; x: number; y: number; time: number }
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; delta: number; x: number; y: number }
  | { type: "swipe"; direction: -1 | 1 }
  | { type: "hold"; action: HoldAction; progress: number }
  | { type: "activate"; action: HoldAction }
  | { type: "clap" };
function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function spatialDistance(a: Point, b: Point) {
  const depth = (p: Point) => (Number.isFinite(p.z) ? p.z! : 0);
  return Math.hypot(a.x - b.x, a.y - b.y, depth(a) - depth(b));
}
export function sampleHand(points: Point[]): HandSample | null {
  if (
    points.length < 21 ||
    points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null;
  const palm = Math.max(distance(points[0], points[9]), 0.005);
  // Side-facing palms collapse in the image plane during a real clap. Use
  // depth for this pose only, preserving the navigation and pinch calibration.
  const clapSize = Math.max(spatialDistance(points[0], points[9]), 0.005);
  const clapPalm =
    [8, 12, 16, 20].filter(
      (tip) =>
        spatialDistance(points[tip], points[0]) >
        spatialDistance(points[tip - 2], points[0]) * 1.1,
    ).length >= 3 && spatialDistance(points[4], points[8]) / clapSize >= 0.5;
  const extended = [8, 12, 16, 20].map(
    (tip) =>
      distance(points[tip], points[0]) >
      distance(points[tip - 2], points[0]) * 1.13,
  );
  const folded = [8, 12, 16, 20].every(
    (tip) =>
      distance(points[tip], points[0]) <
      distance(points[tip - 2], points[0]) * 1.02,
  );
  const victory =
    extended[0] &&
    extended[1] &&
    !extended[2] &&
    !extended[3] &&
    distance(points[8], points[12]) / palm > 0.35;
  // A raised, straight thumb with four curled fingers. Use palm-relative lengths
  // and an upward direction, so mirrored hands work but sideways/downward thumbs do not.
  const thumbA = { x: points[3].x - points[2].x, y: points[3].y - points[2].y };
  const thumbB = { x: points[4].x - points[3].x, y: points[4].y - points[3].y };
  const thumbLength = distance(points[2], points[4]);
  const straightThumb =
    (thumbA.x * thumbB.x + thumbA.y * thumbB.y) /
      Math.max(
        0.00001,
        Math.hypot(thumbA.x, thumbA.y) * Math.hypot(thumbB.x, thumbB.y),
      ) >
    0.55;
  const extendedThumb =
    straightThumb &&
    thumbLength > palm * 0.65 &&
    distance(points[4], points[5]) > palm * 0.6;
  const thumbsUp =
    folded &&
    extendedThumb &&
    points[4].y < points[3].y - palm * 0.12 &&
    points[4].y < points[5].y - palm * 0.15 &&
    points[4].y - points[2].y < -thumbLength * 0.65;
  // An extended thumb is never a fist, even when tilted out of the thumbs-up range.
  const pose = thumbsUp
    ? "thumbs-up"
    : victory
      ? "victory"
      : folded && !extendedThumb
        ? "fist"
        : "neutral";
  return {
    x: 1 - (points[8].x + points[4].x) / 2,
    y: (points[8].y + points[4].y) / 2,
    pinchRatio: distance(points[4], points[8]) / palm,
    pinch: pose === "neutral" && distance(points[4], points[8]) / palm < 0.35,
    open: extended.filter(Boolean).length >= 3,
    clapPalm,
    pose,
    palm: {
      x:
        1 -
        [0, 5, 9, 13, 17].reduce((sum, index) => sum + points[index].x, 0) / 5,
      y: [0, 5, 9, 13, 17].reduce((sum, index) => sum + points[index].y, 0) / 5,
      size: clapSize,
    },
  };
}
// Speed-adaptive low-pass: steady hands are stable; deliberate motion catches up quickly.
export class MotionFilter {
  private value: number | null = null;
  private raw = 0;
  private speed = 0;
  update(value: number, dt: number) {
    if (this.value === null) {
      this.value = this.raw = value;
      return value;
    }
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.speed += alpha(1) * ((value - this.raw) / dt - this.speed);
    this.raw = value;
    this.value += alpha(1.8 + 12 * Math.abs(this.speed)) * (value - this.value);
    return this.value;
  }
}
type Track = {
  x: MotionFilter;
  y: MotionFilter;
  sample: HandSample;
  pinching: boolean;
  since: number;
};
export class GestureInterpreter {
  private clap = new ClapDetector();
  private tracks: Track[] = [];
  private lastTime = -Infinity;
  private previous: HandSample | null = null;
  private span: number | null = null;
  private swipe: { x: number; y: number; time: number } | null = null;
  private lastSwipe = -Infinity;
  private hold: {
    action: HoldAction;
    since: number;
    x: number;
    y: number;
  } | null = null;
  private latchedPose: HandSample["pose"] = undefined;
  private releaseSince: number | null = null;
  private scope: GestureScope = "space";
  reset() {
    this.clap.reset();
    this.resetNavigation();
  }
  private resetNavigation() {
    this.tracks = [];
    this.lastTime = -Infinity;
    this.previous = null;
    this.span = null;
    this.swipe = null;
    this.hold = null;
    this.latchedPose = undefined;
    this.releaseSince = null;
  }
  update(
    hands: HandSample[],
    time: number,
    scope: GestureScope = "space",
  ): GestureEvent[] {
    if (scope !== this.scope) {
      this.clap.reset();
      this.hold = null;
      this.previous = null;
      this.swipe = null;
      this.span = null;
      this.scope = scope;
    }
    const clapped = this.clap.update(hands, time, true);
    if (!hands.length) {
      // Reset navigation immediately, but preserve a short contact occlusion.
      this.resetNavigation();
      return [];
    }
    // Reserve two palms and brief contact occlusion in both views. A clap
    // cannot also swipe, zoom, or start a fist-to-close hold.
    if (
      clapped ||
      this.clap.pending ||
      (hands.length === 2 && hands.every(isClapPalm))
    ) {
      this.previous = null;
      this.span = null;
      this.swipe = null;
      this.hold = null;
      return clapped ? [{ type: "clap" }] : [];
    }
    // Match by position rather than detector order, which may flip between frames.
    const dt = Math.min(0.1, Math.max(0.008, (time - this.lastTime) / 1000));
    const remaining = [...hands];
    const ordered: HandSample[] = [];
    for (const track of this.tracks) {
      if (!remaining.length) break;
      const distances = remaining.map((hand) =>
        Math.hypot(hand.x - track.sample.x, hand.y - track.sample.y),
      );
      const index = distances.indexOf(Math.min(...distances));
      ordered.push(remaining.splice(index, 1)[0]);
    }
    ordered.push(...remaining);
    const stale = time - this.lastTime > 180;
    let discontinuity = stale;
    this.tracks = ordered.map((hand, index) => {
      let track = this.tracks[index];
      if (
        !track ||
        stale ||
        Math.hypot(hand.x - track.sample.x, hand.y - track.sample.y) > 0.4
      ) {
        discontinuity = true;
        track = {
          x: new MotionFilter(),
          y: new MotionFilter(),
          sample: hand,
          pinching: false,
          since: time,
        };
      }
      let pinch = hand.pinch;
      if (hand.pinchRatio !== undefined) {
        if (hand.pinchRatio > 0.46) {
          track.pinching = false;
          track.since = time;
        } else if (!track.pinching) {
          if (hand.pinchRatio >= 0.32) track.since = time;
          else if (time - track.since >= 45) track.pinching = true;
        }
        pinch = track.pinching;
      }
      if (
        hand.pose === "victory" ||
        hand.pose === "fist" ||
        hand.pose === "thumbs-up"
      ) {
        pinch = false;
        track.pinching = false;
        track.since = time;
      }
      track.sample = {
        ...hand,
        pinch,
        x: track.x.update(hand.x, dt),
        y: track.y.update(hand.y, dt),
      };
      return track;
    });
    this.lastTime = time;
    hands = this.tracks.map((track) => track.sample);
    if (discontinuity) {
      this.previous = null;
      this.span = null;
      this.swipe = null;
      this.hold = null;
    }
    const pose = hands.length === 1 ? hands[0].pose : undefined;
    if (this.latchedPose && pose !== this.latchedPose) {
      this.releaseSince ??= time;
      if (time - this.releaseSince >= 120) {
        this.latchedPose = undefined;
        this.releaseSince = null;
      }
    } else this.releaseSince = null;
    const action: HoldAction | null =
      pose === "victory" && scope === "space"
        ? "open"
        : pose === "fist" && scope === "image"
          ? "close"
          : null;
    if (action && !this.latchedPose) {
      const hand = hands[0];
      this.previous = null;
      this.span = null;
      this.swipe = null;
      if (
        !this.hold ||
        this.hold.action !== action ||
        Math.hypot(hand.x - this.hold.x, hand.y - this.hold.y) > 0.08
      ) {
        this.hold = { action, since: time, x: hand.x, y: hand.y };
      }
      const progress = Math.min(1, (time - this.hold.since) / 600);
      if (progress >= 1) {
        this.latchedPose = pose;
        this.hold = null;
        return [{ type: "activate", action }];
      }
      return [{ type: "hold", action, progress }];
    }
    this.hold = null;
    // Navigation poses never fall through to pinch/drag or swipe, including in the other mode.
    if (
      (hands.length === 1 && (pose === "victory" || pose === "fist")) ||
      hands.some((hand) => hand.pose === "thumbs-up")
    ) {
      this.previous = null;
      this.span = null;
      this.swipe = null;
      return [];
    }
    if (hands.length >= 2 && hands[0].pinch && hands[1].pinch) {
      const current = Math.max(
        Math.hypot(hands[0].x - hands[1].x, hands[0].y - hands[1].y),
        0.015,
      );
      const event: GestureEvent[] = this.span
        ? [
            {
              type: "zoom",
              delta: Math.max(
                -0.12,
                Math.min(0.12, Math.log(current / this.span)),
              ),
              x: (hands[0].x + hands[1].x) / 2,
              y: (hands[0].y + hands[1].y) / 2,
            },
          ]
        : [];
      this.span = current;
      this.previous = null;
      this.swipe = null;
      return event;
    }
    if (this.span !== null) {
      this.reset();
      return [];
    } // Release before transitioning from two-hand zoom.
    const hand = hands[0];
    if (hand.pinch) {
      this.swipe = null;
      if (
        this.previous?.pinch &&
        Math.hypot(hand.x - this.previous.x, hand.y - this.previous.y) < 0.0015
      )
        return [];
      const events: GestureEvent[] = this.previous?.pinch
        ? [
            {
              type: "pan",
              dx: hand.x - this.previous.x,
              dy: hand.y - this.previous.y,
            },
          ]
        : [{ type: "start", x: hand.x, y: hand.y, time }];
      this.previous = hand;
      return events;
    }
    this.previous = null;
    if (hand.open && time - this.lastSwipe > 800) {
      if (!this.swipe || time - this.swipe.time > 650)
        this.swipe = { x: hand.x, y: hand.y, time };
      const dx = hand.x - this.swipe.x,
        dy = hand.y - this.swipe.y;
      if (Math.abs(dx) > 0.17 && Math.abs(dx) > Math.abs(dy) * 2) {
        this.lastSwipe = time;
        this.swipe = null;
        return [{ type: "swipe", direction: dx < 0 ? 1 : -1 }];
      }
    } else this.swipe = null;
    return [];
  }
}
