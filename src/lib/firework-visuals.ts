export type BloomStyle = "chrysanthemum" | "willow" | "peony" | "sapphire";
export interface BloomLayer {
  image: HTMLCanvasElement;
  delay: number;
  radius: number;
  fall: number;
}
export interface BloomArtwork {
  layers: BloomLayer[];
  stars: HTMLCanvasElement;
  color: string;
  rays: number;
}
const palettes: Record<BloomStyle, string[]> = {
  chrysanthemum: ["#ffd574", "#ff93ce", "#c4b1ff"],
  willow: ["#ffc65b", "#ffe1a2", "#fff1c7"],
  peony: ["#ff81b9", "#ffb1e3", "#a9dcff"],
  sapphire: ["#9addff", "#c0c2ff", "#ffe2a0"],
};

// Bake dense curved filaments once. Playback composites layers, not thousands of live particles.
export function createBloomArtwork(
  style: BloomStyle,
  reduced: boolean,
): BloomArtwork {
  const size = reduced ? 384 : 768,
    center = size / 2,
    r = size * 0.33;
  const palette = palettes[style],
    willow = style === "willow";
  let seed = 173 + style.length * 637;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const stars = document.createElement("canvas");
  stars.width = stars.height = size;
  const starContext = stars.getContext("2d")!;
  let rays = 0;
  const layers = palette.map((color, layer) => {
    const image = document.createElement("canvas");
    image.width = image.height = size;
    const context = image.getContext("2d")!,
      trails = new Path2D(),
      heads = new Path2D();
    const count = reduced ? 24 : [250, 190, 140][layer];
    rays += count;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (random() - 0.5) * 0.025;
      const reach = r * (0.86 + random() * 0.14),
        length = willow ? 0.7 : 0.22 + random() * 0.42;
      const curve = (random() - 0.5) * (willow ? 15 : 6);
      let x = 0,
        y = 0;
      for (let j = 0; j <= 9; j++) {
        const t = 1 - length + (length * j) / 9;
        x = center + Math.cos(angle) * reach * t + curve * t * t;
        y =
          center +
          Math.sin(angle) * reach * t +
          (willow ? r * 0.47 : r * 0.055) * t * t;
        if (!j) trails.moveTo(x, y);
        else trails.lineTo(x, y);
      }
      const dot = (willow ? 1 : 1.35) + random() * 0.8;
      heads.moveTo(x + dot, y);
      heads.arc(x, y, dot, 0, Math.PI * 2);
      if (i % 7 === 0) {
        starContext.strokeStyle = color;
        starContext.lineWidth = 1.2;
        const flare = 3 + random() * 4;
        starContext.beginPath();
        starContext.moveTo(x - flare, y);
        starContext.lineTo(x + flare, y);
        starContext.moveTo(x, y - flare);
        starContext.lineTo(x, y + flare);
        starContext.stroke();
      }
    }
    context.lineCap = "round";
    context.strokeStyle = color;
    for (const [width, alpha] of [
      [8, 0.035],
      [3.5, 0.13],
      [1.25, 0.8],
    ]) {
      context.lineWidth = width;
      context.globalAlpha = alpha;
      context.stroke(trails);
    }
    context.globalAlpha = 0.85;
    context.fillStyle = "#fff5df";
    context.fill(heads);
    return {
      image,
      delay: layer * 0.055,
      radius: [1, 0.72, 0.43][layer],
      fall: willow ? 0.08 : 0.018,
    };
  });
  return { layers, stars, color: palette[0], rays };
}
