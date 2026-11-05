import { openDB } from "idb";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Album, Library, Photo } from "../types";
import { groupPhotos } from "./space";

const imagePattern = /\.(jpe?g|png|webp)$/i;
export const demoLibrary: Library = {
  name: "示例画册",
  kind: "demo",
  albums: [
    "阿尔卑斯之旅",
    "海岸来信",
    "沙漠的形状",
    "森林漫步",
    "远山与湖",
    "城市片段",
    "午后光影",
    "慢行日记",
    "夏日海风",
    "秋日拾光",
    "山间清晨",
    "旅途之外",
    "蓝色时刻",
    "周末散步",
    "静谧原野",
    "海的另一面",
    "山野来信",
    "光的记忆",
    "出走计划",
    "暮色山川",
    "自然切片",
    "沿途风景",
    "停留一刻",
    "温柔日常",
    "向远方",
  ].map((name, index) => ({
    id: `demo-${index}`,
    name,
    path: name,
    photos: Array.from({ length: 5 }, (_, page) => ({
      id: `demo-${index}-${page}`,
      name: `${String(page + 1).padStart(2, "0")}.jpg`,
      url: `${import.meta.env.BASE_URL}demo/photo-${((index + page) % 12) + 1}.jpg`,
    })),
  })),
};
type Directory = FileSystemDirectoryHandle & {
  values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
};
async function database() {
  return openDB("airgallery.directory.v1", 1, {
    upgrade(db) {
      db.createObjectStore("preferences");
    },
  });
}
export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
): Promise<Album[]> {
  const items: { path: string; photo: Photo }[] = [];
  async function walk(directory: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of (directory as Directory).values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory")
        await walk(entry as FileSystemDirectoryHandle, path);
      else if (imagePattern.test(entry.name)) {
        const file = await (entry as FileSystemFileHandle).getFile();
        items.push({
          path,
          photo: {
            id: path,
            name: entry.name,
            handle: entry as FileSystemFileHandle,
            revision: file.lastModified + file.size,
          },
        });
      }
    }
  }
  await walk(handle, "");
  return groupPhotos(items, handle.name);
}
export function libraryFromFiles(files: FileList): Library {
  const first = files[0]?.webkitRelativePath || "";
  const name = first.split("/")[0] || "图片目录";
  const items = Array.from(files)
    .filter((file) => imagePattern.test(file.name))
    .map((file) => ({
      path: (file.webkitRelativePath || file.name).replace(/^[^/]+\//, ""),
      photo: {
        id: file.webkitRelativePath || file.name,
        name: file.name,
        file,
        revision: file.lastModified + file.size,
      },
    }));
  return { name, albums: groupPhotos(items, name), kind: "fallback" };
}
export function useLibrary(onMessage: (message: string) => void) {
  const [library, setLibrary] = useState<Library>(demoLibrary);
  const [loading, setLoading] = useState(false);
  const directory = useRef<Directory | null>(null);
  const operation = useRef(0),
    scanning = useRef(false);
  const message = useRef(onMessage);
  message.current = onMessage;
  const currentKind = useRef(library.kind);
  currentKind.current = library.kind;

  useEffect(() => {
    const token = ++operation.current;
    void (async () => {
      try {
        if (window.airgallery) {
          const restored = await window.airgallery.restoreDirectory();
          if (restored && token === operation.current)
            setLibrary({ ...restored, kind: "desktop" });
        } else {
          const db = await database();
          const saved = (await db.get("preferences", "directory")) as
            Directory | undefined;
          db.close();
          if (!saved || token !== operation.current) return;
          directory.current = saved;
          if ((await saved.queryPermission({ mode: "read" })) !== "granted") {
            message.current("上次的目录需要重新授权，请打开设置继续。");
            return;
          }
          const albums = await scanDirectory(saved);
          if (token === operation.current)
            setLibrary({ name: saved.name, albums, kind: "browser" });
        }
      } catch {
        if (token === operation.current)
          message.current("上次的目录暂不可用，可以在设置中重新选择。");
      }
    })();
    return () => {
      operation.current++;
    };
  }, []);

  const choose = useCallback(async () => {
    const token = ++operation.current;
    setLoading(true);
    try {
      if (window.airgallery) {
        const result = await window.airgallery.chooseDirectory();
        if (result && token === operation.current) {
          directory.current = null;
          setLibrary({ ...result, kind: "desktop" });
        }
      } else if (window.showDirectoryPicker) {
        // The picker must be called before any asynchronous persistence work.
        const handle = (await window.showDirectoryPicker({
          mode: "read",
        })) as Directory;
        const albums = await scanDirectory(handle);
        if (token !== operation.current) return;
        directory.current = handle;
        setLibrary({ name: handle.name, albums, kind: "browser" });
        try {
          const db = await database();
          await db.put("preferences", handle, "directory");
          db.close();
        } catch {
          message.current("目录已加载，但浏览器未能保存目录授权。");
        }
      } else {
        return false;
      }
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        message.current("目录读取失败，请检查访问权限后重试。");
      return true;
    } finally {
      if (token === operation.current) setLoading(false);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (scanning.current) return;
    scanning.current = true;
    const token = operation.current;
    try {
      if (window.airgallery) {
        const result = await window.airgallery.refreshDirectory();
        if (result && token === operation.current)
          setLibrary({ ...result, kind: "desktop" });
      } else if (directory.current) {
        const handle = directory.current;
        if ((await handle.queryPermission({ mode: "read" })) !== "granted")
          throw new Error("Permission expired");
        const albums = await scanDirectory(handle);
        if (token === operation.current)
          setLibrary({ name: handle.name, albums, kind: "browser" });
      }
    } catch {
      message.current("目录刷新失败，请在设置中重新选择或授权。");
    } finally {
      scanning.current = false;
    }
  }, []);
  useEffect(() => {
    if (library.kind !== "browser") return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [library.kind, refresh]);
  useEffect(
    () =>
      window.airgallery?.onLibraryChanged((data) => {
        if (currentKind.current !== "desktop") return;
        if ("error" in data) message.current(data.error);
        else setLibrary({ ...data, kind: "desktop" });
      }),
    [],
  );
  return {
    library,
    loading,
    choose,
    refresh,
    useFiles: (files: FileList) => {
      operation.current++;
      directory.current = null;
      setLibrary(libraryFromFiles(files));
    },
    useDemo: () => {
      operation.current++;
      directory.current = null;
      setLibrary(demoLibrary);
    },
  };
}

export async function photoSource(
  photo: Photo,
): Promise<{ url: string; release: () => void }> {
  if (photo.url) return { url: photo.url, release: () => {} };
  const file = photo.file || (await photo.handle?.getFile());
  if (!file) throw new Error("图片不可用");
  const url = URL.createObjectURL(file);
  return { url, release: () => URL.revokeObjectURL(url) };
}
