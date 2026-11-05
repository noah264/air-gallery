import { useEffect, useRef, useState, type CSSProperties } from "react";

const compliments = [
  "你真的很棒！",
  "这眼光，绝了 ✨",
  "今天也闪闪发光",
  "优秀的人出现了",
  "你的审美满分",
  "这张值得珍藏",
  "生活因你更精彩",
  "给你一万个赞 👍",
  "你就是主角",
  "每一份热爱都很酷",
  "把美好都留住",
  "有你在，真好",
  "灵感值拉满",
  "这份快乐属于你",
  "可爱值超标了",
  "你值得所有美好",
  "好状态，继续保持",
  "氛围感拿捏了",
  "你的快乐很有感染力",
  "这一刻，满分！",
  "美好正在发生",
  "今天的你超赞",
  "全场最佳就是你",
  "为你疯狂打 call",
];
const colors = ["rose", "violet", "blue", "mint", "gold"];
type Drop = {
  id: number;
  text: string;
  color: string;
  until: number;
  style: CSSProperties;
};

// Replenish a bounded stream in batches. CSS handles motion between batches.
export function PraiseRain({
  emitting,
  preview,
  done,
}: {
  emitting: boolean;
  preview: boolean;
  done: () => void;
}) {
  const complete = useRef(done),
    live = useRef(emitting);
  complete.current = done;
  live.current = emitting;
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [drops, setDrops] = useState<Drop[]>([]);
  const previewUntil = useRef(performance.now() + (preview ? 3500 : 0));
  const sequence = useRef(0);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    const hide = () => {
      if (document.hidden) complete.current();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      preference.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    let active: Drop[] = [],
      nextBatch = 0;
    const tick = () => {
      const now = performance.now();
      active = active.filter((drop) => drop.until > now);
      const feeding = live.current || now < previewUntil.current;
      if (feeding && (!reduced || now >= nextBatch)) {
        const lanes = Math.max(2, Math.min(10, Math.floor(innerWidth / 190)));
        const count = reduced ? 12 : lanes;
        if (reduced) active = [];
        for (let lane = 0; lane < count; lane++) {
          const jitter = Math.random(),
            duration = 3.8 + Math.random() * 0.7,
            delay = Math.random() * 0.16;
          active.push({
            id: ++sequence.current,
            text: compliments[Math.floor(Math.random() * compliments.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            until: now + (reduced ? 3200 : (duration + delay) * 1000),
            style: {
              left: `${((lane + 0.5) / lanes) * 100}%`,
              fontSize: `${16 + Math.floor(Math.random() * 4) * 2}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              "--praise-sway": `${(jitter - 0.5) * 70}px`,
              "--praise-tilt": `${(jitter - 0.5) * 12}deg`,
            } as CSSProperties,
          });
        }
        nextBatch = now + (reduced ? 2000 : 320);
        // Never accumulate unbounded text nodes, even after hours of holding 👍.
        active = active.slice(-(reduced ? 12 : 160));
      }
      setDrops([...active]);
      if (!feeding && !active.length) complete.current();
    };
    tick();
    const timer = window.setInterval(tick, 320);
    return () => clearInterval(timer);
  }, [reduced]);
  return (
    <div
      className={`praise-rain ${reduced ? "praise-still" : ""}`}
      data-testid="praise-rain"
      data-emitting={emitting}
    >
      <span className="sr-only" role="status">
        收到你的点赞！你真的很棒，值得所有美好。
      </span>
      <div className="praise-drops" aria-hidden="true">
        {drops.map((drop) => (
          <span
            key={drop.id}
            data-drop-id={drop.id}
            className={`praise-drop praise-${drop.color}`}
            style={reduced ? undefined : drop.style}
          >
            <i>✦</i>
            {drop.text}
          </span>
        ))}
      </div>
    </div>
  );
}
