import type { HandSample } from "./gestures";

export function isClapPalm(hand: HandSample) {
  return (
    hand.open &&
    !hand.pinch &&
    (hand.pinchRatio === undefined || hand.pinchRatio >= 0.6)
  );
}

export class ClapDetector {
  private armed: { time: number; span: number; distance: number } | null = null;
  private previousTime = -Infinity;
  private lastClap = -Infinity;
  reset() {
    this.armed = null;
    this.previousTime = -Infinity;
  }
  update(hands: HandSample[], time: number, enabled: boolean): boolean {
    if (time - this.previousTime > 180) this.armed = null;
    this.previousTime = time;
    if (!enabled || hands.length !== 2 || !hands.every(isClapPalm)) {
      this.armed = null;
      return false;
    }
    if (time - this.lastClap < 2200) {
      this.armed = null;
      return false;
    }
    const a = hands[0].palm,
      b = hands[1].palm;
    if (!a || !b) {
      this.armed = null;
      return false;
    }
    const size = Math.max(0.03, (a.size + b.size) / 2);
    if (Math.abs(a.y - b.y) > size * 1.4) {
      this.armed = null;
      return false;
    }
    const distance = Math.hypot(a.x - b.x, a.y - b.y),
      span = distance / size;
    if (span >= 2.5) {
      this.armed = { time, span, distance };
      return false;
    }
    const armed = this.armed;
    if (!armed) return false;
    const elapsed = time - armed.time;
    if (elapsed > 650) {
      this.armed = null;
      return false;
    }
    if (
      elapsed >= 45 &&
      span <= 1.25 &&
      armed.span - span >= 1.25 &&
      armed.distance - distance >= 0.1 &&
      (armed.span - span) / (elapsed / 1000) > 2
    ) {
      this.lastClap = time;
      this.armed = null;
      return true;
    }
    return false;
  }
}
