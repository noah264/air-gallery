import type { HandSample } from "./gestures";

export function isClapPalm(hand: HandSample) {
  return (
    hand.clapPalm ??
    (hand.open &&
      !hand.pinch &&
      (hand.pinchRatio === undefined || hand.pinchRatio >= 0.6))
  );
}
type Approach = { time: number; distance: number; size: number };
type Pair = Approach & { x: number; y: number; speed: number };

export class ClapDetector {
  private armed: Approach | null = null;
  private pair: Pair | null = null;
  private previousTime = -Infinity;
  private lastClap = -Infinity;
  get pending() {
    return this.armed !== null;
  }
  reset() {
    this.armed = null;
    this.pair = null;
    this.previousTime = -Infinity;
  }
  private fire(time: number) {
    this.lastClap = time;
    this.reset();
    return true;
  }
  update(hands: HandSample[], time: number, enabled: boolean): boolean {
    if (!Number.isFinite(time) || time <= this.previousTime) {
      this.reset();
      return false;
    }
    if (time - this.previousTime > 260) this.reset();
    this.previousTime = time;
    if (!enabled || time - this.lastClap < 2200) {
      this.reset();
      return false;
    }
    if (this.armed && time - this.armed.time > 850) this.armed = null;
    if (hands.length < 2) {
      const pair = this.pair;
      if (!pair || time - pair.time > 220) {
        this.reset();
        return false;
      }
      const armed = this.armed;
      const palm = hands[0]?.palm;
      // Confirm a single visible palm only after a substantial, fast approach
      // predicts contact at this instant. Ordinary hand loss never fires.
      if (
        armed &&
        hands.length === 1 &&
        isClapPalm(hands[0]) &&
        palm &&
        pair.distance / pair.size <= 2.4 &&
        armed.distance - pair.distance >= 0.1 &&
        pair.distance <= armed.distance * 0.7 &&
        pair.speed >= 0.65 &&
        pair.distance - (pair.speed * (time - pair.time)) / 1000 <=
          pair.size * 1.4 &&
        Math.hypot(palm.x - pair.x, palm.y - pair.y) <= pair.size * 0.75
      )
        return this.fire(time);
      if (hands.length && !isClapPalm(hands[0])) this.reset();
      return false;
    }
    if (hands.length !== 2 || !hands.every(isClapPalm)) {
      this.reset();
      return false;
    }
    const a = hands[0].palm,
      b = hands[1].palm;
    if (!a || !b) {
      this.reset();
      return false;
    }
    const size = Math.max(0.03, (a.size + b.size) / 2);
    if (Math.abs(a.y - b.y) > size * 1.8) {
      this.reset();
      return false;
    }
    const distance = Math.hypot(a.x - b.x, a.y - b.y),
      span = distance / size;
    const previous = this.pair;
    this.pair = {
      time,
      distance,
      size,
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      // Camera frames may repeat the same hand positions between inference
      // updates. Retain recent approach velocity briefly, but cancel on retreat.
      speed:
        previous && distance <= previous.distance + 0.01
          ? Math.max(
              0,
              ((previous.distance - distance) * 1000) / (time - previous.time),
              previous.speed * Math.exp(-(time - previous.time) / 120),
            )
          : 0,
    };
    if (span >= 2.2 && (!this.armed || distance >= this.armed.distance)) {
      this.armed = { time, distance, size };
      return false;
    }
    const armed = this.armed;
    if (!armed) return false;
    const elapsed = time - armed.time,
      contraction = armed.distance - distance;
    if (
      elapsed >= 35 &&
      distance / ((armed.size + size) / 2) <= 1.8 &&
      distance <= armed.distance * 0.62 &&
      contraction >= Math.max(0.07, armed.size * 0.9) &&
      (contraction * 1000) / elapsed >= 0.35
    )
      return this.fire(time);
    return false;
  }
}
