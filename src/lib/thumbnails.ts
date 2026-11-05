import { useEffect, useState } from "react";
import type { Photo } from "../types";
import { photoSource } from "./library";

interface Thumbnail {
  url: string;
  aspect: number;
}
interface Entry {
  references: number;
  promise: Promise<Thumbnail>;
  value?: Thumbnail;
}
const cache = new Map<string, Entry>();
let active = 0;
const queue: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= 4) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try {
    return await work();
  } finally {
    active--;
    queue.shift()?.();
  }
}
function trim() {
  for (const [key, entry] of cache) {
    if (cache.size <= 64) break;
    if (!entry.references && entry.value) {
      URL.revokeObjectURL(entry.value.url);
      cache.delete(key);
    }
  }
}
async function make(photo: Photo): Promise<Thumbnail> {
  return slot(async () => {
    const source = await photoSource(photo);
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error("图片读取失败");
      const bitmap = await createImageBitmap(await response.blob());
      try {
        const aspect = bitmap.width / bitmap.height;
        const factor = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * factor));
        canvas.height = Math.max(1, Math.round(bitmap.height * factor));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("缩略图不可用");
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) =>
              value ? resolve(value) : reject(new Error("缩略图失败")),
            "image/webp",
            0.85,
          ),
        );
        return { url: URL.createObjectURL(blob), aspect };
      } finally {
        bitmap.close();
      }
    } finally {
      source.release();
    }
  });
}
export function useThumbnail(photo: Photo | undefined): Thumbnail | null {
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const key = photo
    ? `${photo.id}:${photo.revision || 0}:${photo.url || ""}`
    : "";
  useEffect(() => {
    if (!photo) return;
    let mounted = true;
    setThumbnail(null);
    let entry = cache.get(key);
    if (!entry) {
      const created: Entry = {
        references: 0,
        promise: Promise.resolve(null as unknown as Thumbnail),
      };
      created.promise = make(photo)
        .then((value) => {
          created.value = value;
          trim();
          return value;
        })
        .catch((error) => {
          cache.delete(key);
          throw error;
        });
      cache.set(key, created);
      entry = created;
    }
    entry.references++;
    void entry.promise
      .then((value) => {
        if (mounted) setThumbnail(value);
      })
      .catch(() => {
        if (mounted) setThumbnail(null);
      });
    return () => {
      mounted = false;
      entry.references--;
      trim();
    };
    // File/handle objects can change on a rescan; the revision key determines invalidation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return thumbnail;
}
