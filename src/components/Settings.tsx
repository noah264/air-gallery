import {
  Check,
  FolderOpen,
  RefreshCw,
  X,
  Aperture,
  Monitor,
  Hand,
  ArrowUpRight,
} from "lucide-react";
import { useRef, useState } from "react";

import type { Library, ThemePreference } from "../types";
import { themes } from "../lib/themes";
import { Modal } from "./Modal";

type SettingsTab = "appearance" | "library" | "gestures";

export function Settings({
  library,
  loading,
  preference,
  preview,
  apply,
  close,
  choose,
  refresh,
  demo,
  camera,
  cameraStatus,
  toggleCamera,
}: {
  library: Library;
  loading: boolean;
  preference: ThemePreference;
  preview: (value: ThemePreference) => void;
  apply: (value: ThemePreference) => void;
  close: () => void;
  choose: () => void;
  refresh: () => void;
  demo: () => void;
  camera: boolean;
  cameraStatus: string;
  toggleCamera: () => void;
}) {
  const [draft, setDraft] = useState(preference);
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [requestedTab, setRequestedTab] = useState<SettingsTab>("appearance");
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const pendingTab = useRef<SettingsTab>("appearance");
  const content = useRef<HTMLDivElement>(null);
  const switchTab = (next: SettingsTab) => {
    if (next === pendingTab.current) return;
    pendingTab.current = next;
    setRequestedTab(next);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTab(next);
      setPhase("idle");
      if (content.current) content.current.scrollTop = 0;
      return;
    }
    // Preserve the current opacity if a new click interrupts the fade-in.
    // While fading out, only update the destination; the last click wins.
    if (phase !== "out") {
      const element = content.current;
      element?.style.setProperty(
        "--settings-fade-start",
        getComputedStyle(element).opacity,
      );
      setPhase("out");
    }
  };
  const pick = (value: ThemePreference) => {
    setDraft(value);
    preview(value);
  };
  return (
    <Modal onClose={close} label="空间设置" className="settings-scrim">
      <header className="settings-heading">
        <div className="brand-mark">
          <Aperture size={23} />
        </div>
        <div>
          <span className="eyebrow">MAKE SPACE FOR MEMORIES</span>
          <h1>你的空间，你的样子。</h1>
        </div>
        <button
          className="icon-button close-button"
          aria-label="关闭设置"
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <nav className="settings-tabs" aria-label="设置分类">
        {(
          [
            ["appearance", "外观"],
            ["library", "图片目录"],
            ["gestures", "手势与操作"],
          ] as const
        ).map(([id, title]) => (
          <button
            key={id}
            className={requestedTab === id ? "active" : ""}
            aria-pressed={requestedTab === id}
            onClick={() => switchTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      <div
        ref={content}
        className="settings-content"
        data-transition={phase}
        aria-busy={phase === "out"}
        inert={phase === "out"}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.animationName === "settings-panel-out") {
            setTab(pendingTab.current);
            event.currentTarget.scrollTop = 0;
            setPhase("in");
          } else if (event.animationName === "settings-panel-in") {
            setPhase("idle");
          }
        }}
      >
        {tab === "appearance" ? (
          <>
            <div className="section-heading">
              <div>
                <h2>光线，随心而变</h2>
                <p>六种玻璃氛围，让照片始终成为主角。</p>
              </div>
              <span className="preview-tag">实时预览</span>
            </div>
            <div className="theme-grid" role="group" aria-label="背景主题">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-card ${draft === theme.id ? "selected" : ""}`}
                  aria-pressed={draft === theme.id}
                  onClick={() => pick(theme.id)}
                >
                  <span
                    className="theme-swatch"
                    style={{ background: theme.swatch }}
                  >
                    <span className="swatch-glass" />
                    {draft === theme.id ? (
                      <span className="theme-check">
                        <Check size={12} />
                      </span>
                    ) : null}
                  </span>
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </button>
              ))}
            </div>
            <button
              className={`system-theme ${draft === "system" ? "selected" : ""}`}
              aria-pressed={draft === "system"}
              onClick={() => pick(draft === "system" ? "dawn" : "system")}
            >
              <Monitor size={18} />
              <span>
                <strong>跟随系统</strong>
                <small>在雾紫晨光和深空石墨之间自动切换</small>
              </span>
              <span className={`toggle ${draft === "system" ? "on" : ""}`} />
            </button>
          </>
        ) : null}
        {tab === "library" ? (
          <>
            <div className="section-heading">
              <div>
                <h2>打开一段回忆</h2>
                <p>直接浏览本机目录，图片留在原来的位置。</p>
              </div>
            </div>
            <div className="directory-card">
              <FolderOpen size={30} strokeWidth={1.3} />
              <div>
                <strong>{library.name}</strong>
                <p>
                  {library.albums.length} 本画册 ·{" "}
                  {library.albums.reduce(
                    (total, album) => total + album.photos.length,
                    0,
                  )}{" "}
                  张照片
                </p>
                <span className="preview-tag">
                  {library.kind === "demo" ? "示例照片" : "本机图片"}
                </span>
              </div>
            </div>
            <button
              className="primary full-width"
              disabled={loading}
              onClick={choose}
            >
              <FolderOpen size={16} />
              {loading ? "正在扫描目录…" : "选择图片文件夹"}
              <ArrowUpRight size={16} />
            </button>
            <div className="button-row">
              <button
                className="secondary"
                onClick={refresh}
                disabled={
                  library.kind === "demo" || library.kind === "fallback"
                }
              >
                <RefreshCw size={15} />
                刷新目录
              </button>
              <button className="text-button" onClick={demo}>
                查看示例空间
              </button>
            </div>
            <div className="note">
              每个含图片的文件夹对应一本画册，第一张按文件名自然排序。支持
              JPG、PNG 和 WebP。
              {library.kind === "fallback"
                ? " 当前浏览器通过文件夹选择兼容模式读取，重新打开需再次选择，更新后请重新选择目录。"
                : " Web 目录每 15 秒检查变化；再次打开时可能需要重新授权。"}
            </div>
          </>
        ) : null}
        {tab === "gestures" ? (
          <>
            <div className="section-heading">
              <div>
                <h2>让双手，带你探索</h2>
                <p>摄像头画面仅在本机识别，不会上传或录像。</p>
              </div>
            </div>
            <button
              className={`system-theme ${camera ? "selected" : ""}`}
              aria-pressed={camera}
              onClick={toggleCamera}
            >
              <Hand size={20} />
              <span>
                <strong>摄像头手势控制</strong>
                <small>{cameraStatus}</small>
              </span>
              <span className={`toggle ${camera ? "on" : ""}`} />
            </button>
            <div className="shortcut-list">
              {[
                ["双手捏合后拉开／靠近", "缩放空间或当前图片"],
                ["单手捏合拖动", "平移视野，捏合指向的画册可选中"],
                ["单手比 V，保持约 0.6 秒", "打开中心选中的画册"],
                ["单手握拳，保持约 0.6 秒", "关闭图集，返回空间"],
                ["单手持续比 👍", "持续生成随机夸奖雨，松手停止新增"],
                ["P", "预览夸奖雨，无需摄像头"],
                ["双掌分开后快速合拢拍手", "为当前照片放烟花并播放音效"],
                ["F / 查看器音量按钮", "预览烟花 / 开关烟花音效"],
                ["张开手掌左右挥动", "切换焦点或组内翻页"],
                ["滚轮 / 触控板捏合", "以指针为中心缩放"],
                ["拖动空白 / 方向键", "平移空间 / 查看上一张下一张"],
                ["双击画册 / Enter", "打开选中画册"],
                ["Esc / 0 / S / H", "返回 / 恢复总览 / 设置 / 暂停手势"],
              ].map(([action, result]) => (
                <div key={action}>
                  <span>{action}</span>
                  <small>{result}</small>
                </div>
              ))}
            </div>
            <div className="note">
              比 V
              或握拳时保持单手入镜，进度满后触发一次；持续点赞会不断落下随机夸奖，松手后已有文字落完退出。建议光线均匀，手部完整入镜。
            </div>
          </>
        ) : null}
      </div>
      <footer className="settings-footer">
        <span>
          {draft === preference ? "偏好保存在这台设备" : "正在预览，尚未保存"}
        </span>
        <button className="secondary" onClick={close}>
          取消
        </button>
        <button className="primary" onClick={() => apply(draft)}>
          应用设置
          <Check size={15} />
        </button>
      </footer>
    </Modal>
  );
}
