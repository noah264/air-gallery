import { useEffect, useRef } from "react";
import { createBloomArtwork, type BloomStyle } from "../lib/firework-visuals";
import {
  FIREWORK_CUES,
  FIREWORK_DURATION,
  playFireworksSound,
} from "../lib/fireworks";

export function Fireworks({
  sound,
  done,
}: {
  sound: boolean;
  done: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    complete = useRef(done);
  complete.current = done;
  const stopSound = useRef<(() => void) | null>(null);
  // Muting stops the current sound without resetting the visual sequence.
  useEffect(() => {
    if (!sound) {
      stopSound.current?.();
      stopSound.current = null;
    }
  }, [sound]);
  const initialSound = useRef(sound).current;
  useEffect(() => {
    const element = canvas.current,
      context = element?.getContext("2d");
    if (!element || !context) {
      complete.current();
      return;
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const styles: BloomStyle[] = [
      "chrysanthemum",
      "willow",
      "peony",
      "sapphire",
    ];
    const artwork = new Map(
      styles.map((style) => [style, createBloomArtwork(style, reduced)]),
    );
    const glow = document.createElement("canvas");
    glow.width = glow.height = 128;
    const glowContext = glow.getContext("2d")!,
      gradient = glowContext.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,244,213,0.8)");
    gradient.addColorStop(0.08, "rgba(255,217,151,0.5)");
    gradient.addColorStop(0.35, "rgba(237,162,190,0.12)");
    gradient.addColorStop(1, "transparent");
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 128, 128);
    let width = 1,
      height = 1,
      frame = 0;
    const resize = () => {
      const rect = element.getBoundingClientRect(),
        dpr = Math.min(devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    if (initialSound) stopSound.current = playFireworksSound();
    const started = performance.now();
    const hide = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        stopSound.current?.();
        stopSound.current = null;
        complete.current();
      }
    };
    document.addEventListener("visibilitychange", hide);
    const tick = (now: number) => {
      const elapsed = (now - started) / 1000;
      if (elapsed >= FIREWORK_DURATION || document.hidden) {
        complete.current();
        return;
      }
      context.clearRect(0, 0, width, height);
      // A gentle night tint brings out the light while keeping the photo visible.
      context.globalCompositeOperation = "source-over";
      context.globalAlpha =
        Math.min(1, elapsed / 0.6, (FIREWORK_DURATION - elapsed) / 0.8) *
        (reduced ? 0.06 : 0.2);
      context.fillStyle = "#071025";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (const cue of FIREWORK_CUES) {
        const age = elapsed - cue.at,
          bloom = artwork.get(cue.style)!;
        const x = width * cue.x,
          y = height * cue.y;
        const base =
          Math.min(width, height) * cue.radius * (reduced ? 0.55 : 1);
        if (!reduced && age >= -0.34 && age < 0) {
          const progress = 1 + age / 0.34,
            tail = Math.max(0, progress - 0.14);
          const rocketX = (t: number) =>
            x + Math.sin(t * Math.PI) * base * 0.08;
          const rocketY = (t: number) =>
            height * 1.04 + (y - height * 1.04) * t;
          context.globalAlpha = 0.75;
          context.strokeStyle = bloom.color;
          context.lineWidth = 1.8;
          context.beginPath();
          context.moveTo(rocketX(tail), rocketY(tail));
          context.lineTo(rocketX(progress), rocketY(progress));
          context.stroke();
          context.drawImage(
            glow,
            rocketX(progress) - 13,
            rocketY(progress) - 13,
            26,
            26,
          );
        }
        const life = cue.style === "willow" ? 2.85 : 2.35;
        if (age < 0 || age >= life) continue;
        const fade = Math.pow(1 - age / life, 0.75) * Math.min(1, age / 0.075);
        context.globalAlpha = fade * (reduced ? 0.08 : 0.18);
        context.drawImage(glow, x - base, y - base, base * 2, base * 2);
        for (const layer of bloom.layers) {
          const layerAge = age - layer.delay;
          if (layerAge < 0) continue;
          const expansion = 1 - Math.exp(-layerAge * (reduced ? 2.6 : 4));
          const size = (base * layer.radius * expansion) / 0.33;
          const drop = base * layer.fall * Math.pow(layerAge, 1.7);
          context.save();
          context.translate(x, y + drop);
          context.rotate(cue.rotation);
          context.globalAlpha = fade * Math.min(1, layerAge / 0.09);
          context.drawImage(layer.image, -size / 2, -size / 2, size, size);
          context.restore();
        }
        if (!reduced && age > 0.2) {
          const size = (base * (1 - Math.exp(-age * 4))) / 0.33;
          const drop = base * bloom.layers[0].fall * Math.pow(age, 1.7);
          context.save();
          context.translate(x, y + drop);
          context.rotate(cue.rotation);
          context.globalAlpha = fade * (0.3 + 0.15 * Math.sin(age * 27));
          context.drawImage(bloom.stars, -size / 2, -size / 2, size, size);
          context.restore();
        }
        if (!reduced && age < 0.16) {
          const size = base * (0.22 + age * 2);
          context.globalAlpha = (1 - age / 0.16) * 0.65;
          context.drawImage(glow, x - size / 2, y - size / 2, size, size);
        }
      }
      context.globalAlpha = 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", hide);
      stopSound.current?.();
      stopSound.current = null;
      // Release the temporary high-density artwork when the overlay goes away.
      for (const bloom of artwork.values()) {
        for (const layer of bloom.layers)
          layer.image.width = layer.image.height = 1;
        bloom.stars.width = bloom.stars.height = 1;
      }
      glow.width = glow.height = 1;
    };
  }, [initialSound]);
  return (
    <canvas
      ref={canvas}
      className="photo-fireworks"
      aria-hidden="true"
      data-testid="photo-fireworks"
    />
  );
}
