import type { Point } from "../src/lib/gestures";

// Synthetic geometry for deterministic control tests; not an accuracy dataset.
export function handPoints(
  pose: "victory" | "fist" | "palm" | "thumbs-up",
): Point[] {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  points[0] = { x: 0.5, y: 0.9 };
  [0.35, 0.5, 0.63, 0.75].forEach((x, finger) => {
    const base = 5 + finger * 4;
    points[base] = { x, y: 0.7 };
    points[base + 1] = { x, y: 0.56 };
    points[base + 2] = { x, y: 0.45 };
    points[base + 3] = {
      x,
      y: pose === "palm" || (pose === "victory" && finger < 2) ? 0.3 : 0.76,
    };
  });
  points[4] = { x: 0.35, y: 0.76 };
  if (pose === "thumbs-up") {
    points[1] = { x: 0.4, y: 0.84 };
    points[2] = { x: 0.32, y: 0.7 };
    points[3] = { x: 0.3, y: 0.5 };
    points[4] = { x: 0.29, y: 0.32 };
  }
  return points;
}
