import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Aperture, FolderOpen, LoaderCircle, Settings2, X } from "lucide-react";
import { Settings } from "./components/Settings";
import { ImageViewer } from "./components/ImageViewer";
import { PraiseRain } from "./components/PraiseRain";
import { GestureProgress } from "./components/GestureProgress";
import { unlockFireworksAudio } from "./lib/fireworks";
import { useLibrary } from "./lib/library";
import { initialView, createLayout, zoomAt, zoomImageAt } from "./lib/space";
import { readTheme, resolveTheme } from "./lib/themes";
import { useGestureCamera } from "./lib/useGestureCamera";
import type { GestureEvent } from "./lib/gestures";
import type { ThemePreference, View } from "./types";

const SpatialGallery = lazy(() => import("./components/SpatialGallery"));

export default function App() {
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [preference, setPreference] = useState<ThemePreference>(readTheme);
  const [preview, setPreview] = useState<ThemePreference | null>(null);
  const [dark, setDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const theme = resolveTheme(preview || preference, dark);
  const { library, loading, choose, refresh, useFiles, useDemo } =
    useLibrary(setMessage);
  const [selected, setSelected] = useState<string | null>("demo-0");
  const [view, setView] = useState<View>(initialView);
  const [viewer, setViewer] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [praise, setPraise] = useState<{ id: number; preview: boolean } | null>(
    null,
  );
  const praiseSequence = useRef(0);
  const [celebration, setCelebration] = useState<{
    photo: string;
    sequence: number;
  } | null>(null);
  const [fireworksSound, setFireworksSound] = useState(() => {
    try {
      return localStorage.getItem("airgallery.fireworks.sound.v1") !== "off";
    } catch {
      return true;
    }
  });
  const lastCelebration = useRef(-Infinity);
  const [imageView, setImageView] = useState<View>(initialView);
  const [restoredSpace, setRestoredSpace] = useState("");
  const spaceKey = `airgallery.space.v1:${library.kind}:${library.name}`;
  const [size, setSize] = useState({ width: innerWidth, height: innerHeight });
  const label = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const gestureCallback = useRef<(event: GestureEvent) => void>(() => {});
  const camera = useGestureCamera(
    (event) => gestureCallback.current(event),
    !settings,
    viewer ? "image" : "space",
  );
  const positions = useMemo(
    () => createLayout(library.albums, selected),
    [library.albums, selected],
  );
  const bounds = useMemo(
    () =>
      positions.reduce(
        (value, item) => ({
          x: Math.max(value.x, Math.abs(item.x) + item.width / 2 + 35),
          y: Math.max(value.y, Math.abs(item.y) + item.height / 2 + 35),
        }),
        { x: 780, y: 440 },
      ),
    [positions],
  );
  const fit = Math.min(
    size.width / (bounds.x * 2),
    size.height / (bounds.y * 2),
    1,
  );
  const effectiveZoom = fit * Math.exp(view.logZoom);
  const currentAlbum = library.albums.find((album) => album.id === selected);
  const openedAlbum = library.albums.find((album) => album.id === viewer);
  const celebrate = () => {
    const photo = openedAlbum?.photos[page],
      now = performance.now();
    if (!photo || settings || now - lastCelebration.current < 800) return;
    lastCelebration.current = now;
    setCelebration({ photo: photo.id, sequence: now });
  };
  const praiseShower = () => {
    if (settings || document.hidden) return;
    const sequence = ++praiseSequence.current;
    // Ignore another trigger while the bounded shower is already playing.
    setPraise((active) => active ?? { id: sequence, preview: true });
  };
  useEffect(() => {
    if (settings) setPraise(null);
    else if (camera.praising) {
      const id = ++praiseSequence.current;
      setPraise((active) => active ?? { id, preview: false });
    }
  }, [camera.praising, settings]);
  const toggleFireworksSound = () => {
    const next = !fireworksSound;
    if (next) unlockFireworksAudio();
    setFireworksSound(next);
    try {
      localStorage.setItem(
        "airgallery.fireworks.sound.v1",
        next ? "on" : "off",
      );
    } catch {}
  };
  useEffect(() => {
    if (!fireworksSound) return;
    const unlock = () => unlockFireworksAudio();
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    };
  }, [fireworksSound]);
  const pointer = useRef<{
    x: number;
    y: number;
    previousX: number;
    previousY: number;
    dragging: boolean;
  } | null>(null);

  useEffect(() => {
    let restored = initialView,
      focus: string | null = library.albums[0]?.id || null;
    try {
      const data = JSON.parse(localStorage.getItem(spaceKey) || "{}");
      if (
        [data.view?.x, data.view?.y, data.view?.logZoom].every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ) &&
        Math.abs(data.view.logZoom) < 27
      )
        restored = data.view;
      if (library.albums.some((album) => album.id === data.selected))
        focus = data.selected;
    } catch {
      /* Ignore malformed preferences. */
    }
    setView(restored);
    setSelected(focus);
    setViewer(null);
    setRestoredSpace(spaceKey);
    // Directory rescans retain the current view; only switching the source restores it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceKey]);
  useEffect(() => {
    if (restoredSpace !== spaceKey) return;
    const save = () => {
      try {
        localStorage.setItem(spaceKey, JSON.stringify({ view, selected }));
      } catch {}
    };
    const timer = window.setTimeout(save, 180);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [view, selected, restoredSpace, spaceKey]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const change = () => setDark(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle(
      "native-glass",
      !!window.airgallery?.nativeGlass,
    );
    void window.airgallery?.setTheme(theme === "graphite");
  }, [theme]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6500);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!library.albums.some((album) => album.id === selected))
      setSelected(library.albums[0]?.id || null);
    if (viewer && !openedAlbum) setViewer(null);
    if (openedAlbum && page >= openedAlbum.photos.length)
      setPage(Math.max(0, openedAlbum.photos.length - 1));
  }, [library.albums, selected, viewer, openedAlbum, page]);
  const select = useCallback((id: string) => {
    setSelected(id);
    setView((value) => ({ ...value, x: 0, y: 0 }));
  }, []);
  const open = useCallback((id: string) => {
    setCelebration(null);
    setSelected(id);
    setViewer(id);
    setPage(0);
    setImageView(initialView);
  }, []);
  const step = useCallback(
    (delta: number) => {
      if (openedAlbum) {
        setCelebration(null);
        setPage((value) =>
          Math.max(0, Math.min(openedAlbum.photos.length - 1, value + delta)),
        );
        setImageView(initialView);
      } else if (library.albums.length) {
        const index = library.albums.findIndex(
          (album) => album.id === selected,
        );
        select(
          library.albums[
            (index + delta + library.albums.length) % library.albums.length
          ].id,
        );
      }
    },
    [openedAlbum, library.albums, selected, select],
  );
  const reset = useCallback(() => {
    if (viewer) setImageView(initialView);
    else setView(initialView);
  }, [viewer]);
  const closeSettings = () => {
    setPreview(null);
    setSettings(false);
  };
  const chooseDirectory = async () => {
    const supported = await choose();
    if (supported === false) fileInput.current?.click();
  };
  const wheel = useRef<(event: WheelEvent) => void>(() => {});
  wheel.current = (event) => {
    if (settings) return;
    event.preventDefault();
    const delta = -event.deltaY * (event.ctrlKey ? 0.008 : 0.0015);
    if (viewer)
      setImageView((value) =>
        zoomImageAt(value, delta, {
          x: event.clientX - size.width / 2,
          y: event.clientY - size.height / 2,
        }),
      );
    else
      setView((value) =>
        zoomAt(value, delta, {
          x: (event.clientX - size.width / 2) / fit,
          y: -(event.clientY - size.height / 2) / fit,
        }),
      );
  };
  useEffect(() => {
    const element = stage.current;
    const handler = (event: WheelEvent) => wheel.current(event);
    element?.addEventListener("wheel", handler, { passive: false });
    return () => element?.removeEventListener("wheel", handler);
  }, []);
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandler.current = (event) => {
    if (settings || event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      (event.target as HTMLElement).matches(
        'input, textarea, select, [contenteditable="true"]',
      )
    )
      return;
    if (
      event.key === "Enter" &&
      (event.target as HTMLElement).closest("button")
    )
      return;
    if (event.key.toLowerCase() === "s" || event.key === "?") {
      event.preventDefault();
      setSettings(true);
    }
    if (event.key.toLowerCase() === "h") camera.toggle();
    if (event.key.toLowerCase() === "f" && !event.repeat && viewer) {
      event.preventDefault();
      celebrate();
    }
    if (event.key.toLowerCase() === "p" && !event.repeat) {
      event.preventDefault();
      praiseShower();
    }
    if (event.key === "Escape") {
      if (!camera.praising) setPraise(null);
      if (viewer) setViewer(null);
    }
    if (event.key === "0") reset();
    if (event.key === "Enter" && selected && !viewer) open(selected);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
    if (event.key === "+" || event.key === "=") {
      if (viewer)
        setImageView((value) => zoomImageAt(value, 0.15, { x: 0, y: 0 }));
      else setView((value) => zoomAt(value, 0.15, { x: 0, y: 0 }));
    }
    if (event.key === "-") {
      if (viewer)
        setImageView((value) => zoomImageAt(value, -0.15, { x: 0, y: 0 }));
      else setView((value) => zoomAt(value, -0.15, { x: 0, y: 0 }));
    }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pan = (dx: number, dy: number) => {
    if (viewer)
      setImageView((value) => ({ ...value, x: value.x + dx, y: value.y + dy }));
    else
      setView((value) => ({
        ...value,
        x: value.x - dx / (fit * Math.exp(value.logZoom)),
        y: value.y + dy / (fit * Math.exp(value.logZoom)),
      }));
  };
  gestureCallback.current = (event) => {
    if (event.type === "clap" && viewer) celebrate();
    if (event.type === "activate") {
      if (event.action === "open" && !viewer && currentAlbum)
        open(currentAlbum.id);
      if (event.action === "close" && viewer) setViewer(null);
    }
    if (event.type === "zoom") {
      if (viewer)
        setImageView((value) =>
          zoomImageAt(value, event.delta, {
            x: (event.x - 0.5) * size.width,
            y: (event.y - 0.5) * size.height,
          }),
        );
      else
        setView((value) =>
          zoomAt(value, event.delta, {
            x: ((event.x - 0.5) * size.width) / fit,
            y: ((0.5 - event.y) * size.height) / fit,
          }),
        );
    }
    if (event.type === "pan")
      pan(event.dx * size.width, event.dy * size.height);
    if (event.type === "swipe") step(event.direction);
    if (event.type === "start" && !viewer) {
      const x = ((event.x - 0.5) * size.width) / effectiveZoom + view.x;
      const y = ((0.5 - event.y) * size.height) / effectiveZoom + view.y;
      const match = [...positions]
        .reverse()
        .find(
          (item) =>
            Math.abs(x - item.x) < item.width / 2 + 12 &&
            Math.abs(y - item.y) < item.height / 2 + 12,
        );
      if (match) {
        select(match.id);
      }
    }
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = pointer.current;
    if (!current || settings) return;
    if (
      !current.dragging &&
      Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5
    ) {
      current.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (current.dragging)
      pan(event.clientX - current.previousX, event.clientY - current.previousY);
    current.previousX = event.clientX;
    current.previousY = event.clientY;
  };
  const nameX = size.width / 2 - view.x * effectiveZoom;
  const nameY = size.height / 2 + (view.y - 165) * effectiveZoom - 14;
  const labelVisible =
    nameX > -100 &&
    nameX < size.width + 100 &&
    nameY > 0 &&
    nameY < size.height;

  return (
    <main className="app-shell" data-source={library.kind} data-theme={theme}>
      <div className="wallpaper" aria-hidden="true">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="ambient ambient-three" />
      </div>
      <div className="glass-backdrop" aria-hidden="true" />
      <div
        ref={stage}
        className={`spatial-stage ${pointer.current?.dragging ? "dragging" : ""}`}
        aria-label="空间画册，拖动平移、滚轮缩放；按 S 打开设置"
        data-log-zoom={view.logZoom.toFixed(4)}
        onPointerDown={(event) => {
          if (settings || event.button !== 0) return;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            previousX: event.clientX,
            previousY: event.clientY,
            dragging: false,
          };
        }}
        onPointerMove={pointerMove}
        onPointerUp={(event) => {
          pointer.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        {library.albums.length ? (
          <Suspense
            fallback={
              <div className="canvas-loading">
                <LoaderCircle className="spinner" size={24} />
              </div>
            }
          >
            <SpatialGallery
              label={label}
              paused={!!openedAlbum}
              albums={library.albums}
              positions={positions}
              selected={selected}
              view={view}
              fit={fit}
              select={select}
              open={open}
            />
          </Suspense>
        ) : (
          <div className="empty-space glass-panel">
            <Aperture size={32} strokeWidth={1.2} />
            <h1>给回忆，留一片空间。</h1>
            <p>
              这个目录还没有可显示的图片。
              <br />
              选择含有 JPG、PNG 或 WebP 的文件夹。
            </p>
            <button className="primary" onClick={() => void chooseDirectory()}>
              <FolderOpen size={16} />
              选择图片目录
            </button>
          </div>
        )}
        {currentAlbum && !viewer && labelVisible ? (
          <button
            ref={label}
            className="album-name"
            style={{ left: nameX, top: nameY }}
            title={`${currentAlbum.name} · ${currentAlbum.photos.length} 张 · 双击图片或按 Enter 打开`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => open(currentAlbum.id)}
          >
            {currentAlbum.name}
          </button>
        ) : null}
        {openedAlbum ? (
          <ImageViewer
            key={openedAlbum.photos[page]?.id}
            album={openedAlbum}
            page={page}
            view={imageView}
            close={() => setViewer(null)}
            step={step}
            reset={reset}
            celebration={
              celebration?.photo === openedAlbum.photos[page]?.id
                ? celebration?.sequence || 0
                : 0
            }
            celebrate={celebrate}
            sound={fireworksSound}
            toggleSound={toggleFireworksSound}
          />
        ) : null}
      </div>
      {praise !== null && !settings ? (
        <PraiseRain
          key={praise.id}
          emitting={camera.praising}
          preview={praise.preview}
          done={() => setPraise(null)}
        />
      ) : null}
      <div className="edge-reveal">
        <button
          className="edge-settings glass-panel"
          title="设置（S）"
          aria-label="打开空间设置"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={19} />
        </button>
      </div>
      {!settings && camera.enabled && (viewer || currentAlbum) ? (
        <GestureProgress feedback={camera.feedback} />
      ) : null}
      {settings ? (
        <Settings
          library={library}
          loading={loading}
          preference={preference}
          preview={setPreview}
          close={closeSettings}
          apply={(value) => {
            setPreference(value);
            setPreview(null);
            setSettings(false);
            try {
              localStorage.setItem(
                "airgallery.preferences.v1",
                JSON.stringify({ theme: value }),
              );
            } catch {
              setMessage("主题已应用，但当前环境无法保存偏好。");
            }
          }}
          choose={() => void chooseDirectory()}
          refresh={() => void refresh()}
          demo={useDemo}
          camera={camera.enabled}
          cameraStatus={camera.status}
          toggleCamera={camera.toggle}
        />
      ) : null}
      <input
        type="file"
        ref={fileInput}
        className="visually-hidden"
        multiple
        accept="image/jpeg,image/png,image/webp"
        {...{ webkitdirectory: "", directory: "" }}
        onChange={(event) => {
          if (event.target.files?.length) useFiles(event.target.files);
          event.target.value = "";
        }}
        aria-label="兼容模式选择图片文件夹"
        tabIndex={-1}
      />
      {message ? (
        <div className="toast glass-panel" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setMessage(null)}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      <div className="sr-only" aria-live="polite">
        {currentAlbum
          ? `已选中 ${currentAlbum.name}，${currentAlbum.photos.length} 张。按 Enter 打开，左右方向键切换画册。`
          : "没有画册"}
      </div>
      {!settings && !viewer ? (
        <div className="first-hint" aria-hidden="true">
          <span>拖动探索</span>
          <i /> <span>滚轮缩放</span>
          <i />
          <span>按 S 设置</span>
        </div>
      ) : null}
    </main>
  );
}
