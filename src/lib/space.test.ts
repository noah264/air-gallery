import { describe, expect, it } from "vitest";
import { createLayout, groupPhotos, zoomAt, zoomImageAt } from "./space";
import { resolveTheme, isTheme } from "./themes";
import type { Album } from "../types";

describe("spatial navigation", () => {
  it("keeps the world point under an off-center zoom anchor stationary", () => {
    const view = { x: 74, y: -28, logZoom: 1.2 },
      anchor = { x: 300, y: -120 };
    const before = {
      x: view.x + anchor.x / Math.exp(view.logZoom),
      y: view.y + anchor.y / Math.exp(view.logZoom),
    };
    const next = zoomAt(view, 0.6, anchor);
    expect(next.x + anchor.x / Math.exp(next.logZoom)).toBeCloseTo(before.x, 9);
    expect(next.y + anchor.y / Math.exp(next.logZoom)).toBeCloseTo(before.y, 9);
  });
  it("continues repeated zoom rather than resetting to a gesture baseline", () => {
    let view = { x: 0, y: 0, logZoom: 0 };
    for (let i = 0; i < 200; i++) view = zoomAt(view, 0.05, { x: 0, y: 0 });
    expect(view.logZoom).toBeCloseTo(10);
    for (let i = 0; i < 200; i++) view = zoomAt(view, -0.05, { x: 0, y: 0 });
    expect(view.logZoom).toBeCloseTo(0);
  });
  it("preserves an image-space anchor independently of camera transforms", () => {
    const view = { x: 50, y: -20, logZoom: 0.8 },
      anchor = { x: 200, y: 150 };
    const point = {
      x: (anchor.x - view.x) / Math.exp(view.logZoom),
      y: (anchor.y - view.y) / Math.exp(view.logZoom),
    };
    const next = zoomImageAt(view, -0.4, anchor);
    expect(point.x * Math.exp(next.logZoom) + next.x).toBeCloseTo(anchor.x);
    expect(point.y * Math.exp(next.logZoom) + next.y).toBeCloseTo(anchor.y);
  });
  it("gives the selected album and its label a clear exclusion area", () => {
    const albums: Album[] = Array.from({ length: 80 }, (_, i) => ({
      id: `album-${i}`,
      name: String(i),
      path: String(i),
      photos: [],
    }));
    const layout = createLayout(albums, albums[0].id);
    expect(layout[0].x).toBe(0);
    expect(layout[0].width).toBe(350);
    for (const position of layout.slice(1)) {
      const separatedX =
        Math.abs(position.x) >= 235 + position.width / 2 - 0.01;
      const separatedY =
        Math.abs(position.y) >= 185 + position.height / 2 - 0.01;
      expect(separatedX || separatedY).toBe(true);
    }
  });
  it("groups root and nested folders with natural filename order", () => {
    const result = groupPhotos(
      ["Trip/10.jpg", "Trip/2.jpg", "Trip/nested/1.png", "root.jpg"].map(
        (path) => ({ path, photo: { id: path, name: path.split("/").pop()! } }),
      ),
      "Pictures",
    );
    expect(
      result
        .find((album) => album.id === "Trip")
        ?.photos.map((photo) => photo.name),
    ).toEqual(["2.jpg", "10.jpg"]);
    expect(result.find((album) => album.id === "@root")?.name).toBe("Pictures");
    expect(result.find((album) => album.id === "Trip/nested")?.name).toBe(
      "nested",
    );
  });
});
describe("theme modes", () => {
  it("only follows system brightness when explicitly selected", () => {
    expect(resolveTheme("forest", true)).toBe("forest");
    expect(resolveTheme("system", true)).toBe("graphite");
    expect(resolveTheme("system", false)).toBe("dawn");
    expect(isTheme("unknown")).toBe(false);
  });
});
