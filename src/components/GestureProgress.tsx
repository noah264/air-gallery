import type { GestureHold } from "../lib/gestures";

export function GestureProgress({
  feedback,
}: {
  feedback: GestureHold | null;
}) {
  if (!feedback) return null;
  const opening = feedback.action === "open";
  const label = opening
    ? "保持 V 手势，正在打开图集"
    : "保持握拳，正在返回空间";
  return (
    <div
      className="gesture-progress glass-panel"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle className="gesture-ring-track" cx="20" cy="20" r="17" />
        <circle
          className="gesture-ring-fill"
          cx="20"
          cy="20"
          r="17"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - feedback.progress}
        />
      </svg>
      <span className="gesture-symbol" aria-hidden="true">
        {opening ? "✌︎" : "✊︎"}
      </span>
      <div>
        <strong>
          {opening ? "保持 V 手势 · 打开图集" : "保持握拳 · 返回空间"}
        </strong>
        <small>保持约 0.6 秒，移开可取消</small>
      </div>
    </div>
  );
}
