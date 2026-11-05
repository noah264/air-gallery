import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Scan,
  LoaderCircle,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Fireworks } from "./Fireworks";
import type { Album, View } from "../types";
import { photoSource } from "../lib/library";

export function ImageViewer({
  album,
  page,
  view,
  close,
  step,
  reset,
  celebration,
  celebrate,
  sound,
  toggleSound,
}: {
  album: Album;
  page: number;
  view: View;
  close: () => void;
  step: (delta: number) => void;
  reset: () => void;
  celebration: number;
  celebrate: () => void;
  sound: boolean;
  toggleSound: () => void;
}) {
  const [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    setCelebrating(celebration > 0);
  }, [celebration]);
  const photo = album.photos[page];
  const [source, setSource] = useState<string | null>(null),
    [error, setError] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  const target = useRef(view),
    current = useRef(view);
  target.current = view;
  useLayoutEffect(() => {
    current.current = target.current;
  }, [source]);
  useLayoutEffect(() => {
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const alpha = 1 - Math.exp(-30 * Math.min((now - previous) / 1000, 0.05));
      previous = now;
      const value = current.current,
        destination = target.current;
      const error =
        Math.abs(destination.x - value.x) +
        Math.abs(destination.y - value.y) +
        Math.abs(destination.logZoom - value.logZoom) * 100;
      current.current =
        error < 0.05
          ? destination
          : {
              x: value.x + (destination.x - value.x) * alpha,
              y: value.y + (destination.y - value.y) * alpha,
              logZoom:
                value.logZoom + (destination.logZoom - value.logZoom) * alpha,
            };
      const next = current.current;
      if (image.current)
        image.current.style.transform = `translate(${next.x}px, ${next.y}px) scale(${Math.exp(next.logZoom)})`;
      if (error >= 0.05) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [view, source]);
  useEffect(() => {
    let active = true,
      release = () => {};
    setSource(null);
    setError(false);
    if (!photo) {
      setError(true);
      return;
    }
    void photoSource(photo)
      .then((result) => {
        if (active) {
          release = result.release;
          setSource(result.url);
        } else result.release();
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      release();
    };
  }, [photo]);
  return (
    <section
      className="image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${album.name}，第 ${page + 1} 张`}
    >
      <div
        className="viewer-top glass-panel"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div>
          <strong>{album.name}</strong>
          <small>
            {photo?.name} · {page + 1} / {album.photos.length}
          </small>
        </div>
        <button
          className="icon-button"
          onClick={celebrate}
          aria-label="放烟花（F）"
          title="拍手或按 F 放烟花"
          disabled={!source || error}
        >
          <Sparkles size={19} />
        </button>
        <button
          className="icon-button"
          onClick={toggleSound}
          aria-label={sound ? "关闭烟花音效" : "开启烟花音效"}
          aria-pressed={sound}
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="icon-button"
          onClick={reset}
          aria-label="图片适配窗口"
        >
          <Scan size={19} />
        </button>
        <button className="icon-button" onClick={close} aria-label="返回空间">
          <X size={20} />
        </button>
      </div>
      {celebrating && source && !error ? (
        <Fireworks
          key={celebration}
          sound={sound}
          done={() => setCelebrating(false)}
        />
      ) : null}
      <div className="viewer-image-area">
        {source && !error ? (
          <img
            ref={image}
            className="viewer-photo"
            src={source}
            alt={photo?.name || album.name}
            draggable={false}
            onError={() => setError(true)}
          />
        ) : error ? (
          <div className="viewer-message">
            这张图片暂时无法读取，请尝试下一张。
          </div>
        ) : (
          <LoaderCircle className="spinner" size={24} />
        )}
      </div>
      <button
        className="viewer-arrow previous"
        disabled={page === 0}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => step(-1)}
        aria-label="上一张"
      >
        <ChevronLeft size={26} />
      </button>
      <button
        className="viewer-arrow next"
        disabled={page >= album.photos.length - 1}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => step(1)}
        aria-label="下一张"
      >
        <ChevronRight size={26} />
      </button>
      <div className="viewer-bottom">拍手 / F 放烟花 · ← → 翻页 · Esc 返回</div>
    </section>
  );
}
