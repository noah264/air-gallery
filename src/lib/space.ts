import type { Album, AlbumPosition, View } from "../types";

export const initialView: View = { x: 0, y: 0, logZoom: 0 };
export function zoomAt(
  view: View,
  delta: number,
  anchor: { x: number; y: number },
): View {
  const nextLog = view.logZoom + delta;
  const oldZoom = Math.exp(view.logZoom),
    nextZoom = Math.exp(nextLog);
  // Numerical safety only; there is no product-level fixed set of zoom stops.
  if (!Number.isFinite(nextZoom) || nextZoom < 1e-12 || nextZoom > 1e12)
    return view;
  return {
    logZoom: nextLog,
    x: view.x + anchor.x / oldZoom - anchor.x / nextZoom,
    y: view.y + anchor.y / oldZoom - anchor.y / nextZoom,
  };
}
export function zoomImageAt(
  view: View,
  delta: number,
  anchor: { x: number; y: number },
): View {
  const nextLog = view.logZoom + delta,
    scale = Math.exp(delta),
    zoom = Math.exp(nextLog);
  if (!Number.isFinite(zoom) || zoom < 1e-12 || zoom > 1e12) return view;
  return {
    logZoom: nextLog,
    x: anchor.x - (anchor.x - view.x) * scale,
    y: anchor.y - (anchor.y - view.y) * scale,
  };
}
export function hash(value: string): number {
  let state = 2166136261;
  for (const character of value)
    state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  state ^= state >>> 16;
  state = Math.imul(state, 0x85ebca6b);
  state ^= state >>> 13;
  state = Math.imul(state, 0xc2b2ae35);
  state ^= state >>> 16;
  return state >>> 0;
}
export function createLayout(
  albums: Album[],
  selected: string | null,
): AlbumPosition[] {
  // Deterministic seeds with relaxation keep groups legible without a regular grid.
  const extent = Math.max(1, Math.sqrt(albums.length / 25));
  const result: AlbumPosition[] = albums.map((album) => {
    const seed = hash(album.id),
      focused = album.id === selected;
    const angle = (hash(album.id + ":angle") / 4294967296) * Math.PI * 2;
    const radius = Math.pow(hash(album.id + ":radius") / 4294967296, 0.8);
    return {
      id: album.id,
      x: focused ? 0 : Math.cos(angle) * radius * 760 * extent,
      y: focused ? 0 : Math.sin(angle) * radius * 340 * extent,
      z: focused ? 90 : seed % 30,
      width: focused ? 350 : 108 + (seed % 35),
      height: focused ? 238 : 80 + (seed % 24),
      rotation: focused ? 0 : ((seed % 100) / 100 - 0.5) * 0.26,
    };
  });
  const excludeFocus = (item: AlbumPosition) => {
    if (!selected || item.id === selected) return;
    const dx = 235 + item.width / 2,
      dy = (item.y > 0 ? 225 : 185) + item.height / 2;
    const distance = Math.max(Math.abs(item.x) / dx, Math.abs(item.y) / dy);
    if (distance < 0.00001) {
      item.x = dx;
      item.y = 0;
    } else if (distance < 1) {
      const ratio = 1 / Math.max(distance, 0.001);
      item.x *= ratio;
      item.y *= ratio;
    }
  };
  for (let iteration = 0; iteration < 28; iteration++) {
    for (const item of result) excludeFocus(item);
    // Only nearby cells can overlap. This avoids quadratic work on large directories.
    const cells = new Map<string, AlbumPosition[]>();
    const cellSize = 200;
    for (const left of result) {
      if (left.id === selected) continue;
      const cx = Math.floor(left.x / cellSize),
        cy = Math.floor(left.y / cellSize);
      for (let x = cx - 1; x <= cx + 1; x++) {
        for (let y = cy - 1; y <= cy + 1; y++) {
          for (const right of cells.get(`${x},${y}`) || []) {
            const dx = right.x - left.x,
              dy = right.y - left.y;
            const overlapX = (left.width + right.width) / 2 + 12 - Math.abs(dx);
            const overlapY =
              (left.height + right.height) / 2 + 22 - Math.abs(dy);
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (overlapX < overlapY) {
              const push = Math.sign(dx || 1) * overlapX * 0.52;
              left.x -= push;
              right.x += push;
            } else {
              const push = Math.sign(dy || 1) * overlapY * 0.52;
              left.y -= push;
              right.y += push;
            }
          }
        }
      }
      const key = `${Math.floor(left.x / cellSize)},${Math.floor(left.y / cellSize)}`;
      const cell = cells.get(key) || [];
      cell.push(left);
      cells.set(key, cell);
    }
  }
  result.forEach(excludeFocus);
  return result;
}

export const naturalOrder = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
export function groupPhotos(
  items: { path: string; photo: import("../types").Photo }[],
  rootName: string,
): Album[] {
  const groups = new Map<string, import("../types").Photo[]>();
  for (const { path, photo } of items) {
    const folder = path.includes("/")
      ? path.slice(0, path.lastIndexOf("/"))
      : "";
    const photos = groups.get(folder) || [];
    photos.push(photo);
    groups.set(folder, photos);
  }
  return [...groups]
    .sort(([a], [b]) => naturalOrder.compare(a, b))
    .map(([path, photos]) => ({
      id: path || "@root",
      name: path.split("/").pop() || rootName,
      path,
      photos: photos.sort((a, b) => naturalOrder.compare(a.name, b.name)),
    }));
}
