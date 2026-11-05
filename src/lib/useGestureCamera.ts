import { useCallback, useEffect, useRef, useState } from "react";
import {
  GestureInterpreter,
  sampleHand,
  type GestureEvent,
  type Point,
  type GestureHold,
  type GestureScope,
} from "./gestures";

export function useGestureCamera(
  onEvent: (event: GestureEvent) => void,
  enabledInput: boolean,
  scope: GestureScope,
) {
  const [enabled, setEnabled] = useState(false);
  const [praising, setPraising] = useState(false);
  const [status, setStatus] = useState("未开启 · 画面仅在本机处理");
  const [feedback, setFeedback] = useState<GestureHold | null>(null);
  const controls = useRef<{ stop: () => void } | null>(null);
  const generation = useRef(0),
    eventHandler = useRef(onEvent),
    canInteract = useRef(enabledInput),
    currentScope = useRef(scope);
  eventHandler.current = onEvent;
  canInteract.current = enabledInput;
  currentScope.current = scope;
  useEffect(() => {
    setFeedback(null);
    if (!enabledInput) setPraising(false);
  }, [scope, enabledInput]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPraising(false);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  const stop = useCallback(() => {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    setEnabled(false);
    setPraising(false);
    setFeedback(null);
    setStatus("已暂停 · 摄像头已关闭");
  }, []);
  const start = useCallback(async () => {
    const token = ++generation.current;
    controls.current?.stop();
    setEnabled(true);
    setStatus("正在请求摄像头权限…");
    let stream: MediaStream | null = null,
      worker: Worker | null = null,
      timer = 0,
      videoTimer = 0,
      praiseTimer = 0;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      clearTimeout(praiseTimer);
      setPraising(false);
      setFeedback(null);
      cancelAnimationFrame(timer);
      if (videoTimer) video.cancelVideoFrameCallback(videoTimer);
      stream?.getTracks().forEach((track) => track.stop());
      worker?.terminate();
      video.pause();
      video.srcObject = null;
    };
    controls.current = { stop: cleanup };
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      if (generation.current !== token) {
        cleanup();
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (generation.current !== token) {
        cleanup();
        return;
      }
      worker = new Worker(
        new URL(`${import.meta.env.BASE_URL}hand-worker.js`, document.baseURI),
      );
      let ready = false,
        pending = false,
        capturing = false,
        lastTime = 0,
        lastVideoTime = -1,
        interval = 33;
      const interpreter = new GestureInterpreter();
      worker.onmessage = (event) => {
        if (token !== generation.current) return;
        if (event.data.type === "ready") {
          ready = true;
          setStatus("已就绪 · 将双手放入摄像头视野");
        }
        if (event.data.type === "error") {
          if (import.meta.env.DEV)
            console.error("Hand worker:", event.data.message);
          cleanup();
          controls.current = null;
          setEnabled(false);
          setStatus("识别模型加载或运行失败，请重试");
        }
        if (event.data.type === "hands") {
          pending = false;
          interval = Math.max(33, Math.min(100, event.data.duration * 1.1));
          clearTimeout(praiseTimer);
          if (performance.now() - event.data.time > 180) {
            setPraising(false);
            interpreter.reset();
            setFeedback(null);
            return;
          }
          const hands = (event.data.landmarks as Point[][])
            .map(sampleHand)
            .filter((sample) => sample !== null);
          setStatus(
            hands.length
              ? `正在追踪 ${hands.length} 只手 · 松手可停止操作`
              : "等待手势 · 请保持光线均匀",
          );
          if (!canInteract.current || document.hidden) {
            setPraising(false);
            interpreter.reset();
            setFeedback(null);
            return;
          }
          const thumbsUp = hands.length === 1 && hands[0].pose === "thumbs-up";
          setPraising(thumbsUp);
          // If the camera/worker stalls, never leave a continuous effect stuck on.
          if (thumbsUp)
            praiseTimer = window.setTimeout(() => setPraising(false), 350);
          const events = interpreter.update(
            hands,
            event.data.time,
            currentScope.current,
          );
          const held = events.find((event) => event.type === "hold");
          setFeedback(
            held?.type === "hold"
              ? { action: held.action, progress: held.progress }
              : null,
          );
          for (const gesture of events) eventHandler.current(gesture);
        }
      };
      worker.onerror = () => {
        if (token === generation.current) {
          cleanup();
          setEnabled(false);
          setStatus("手势线程不可用，请重试");
        }
      };
      worker.postMessage({
        type: "init",
        assets: new URL(
          `${import.meta.env.BASE_URL}mediapipe`,
          document.baseURI,
        ).href,
      });
      const tick = async (time: number) => {
        if (token !== generation.current) return;
        if ("requestVideoFrameCallback" in video)
          videoTimer = video.requestVideoFrameCallback(tick);
        else timer = requestAnimationFrame(tick);
        if (
          !ready ||
          pending ||
          capturing ||
          video.readyState < 2 ||
          time - lastTime < interval ||
          video.currentTime === lastVideoTime ||
          document.hidden
        )
          return;
        capturing = true;
        lastTime = time;
        lastVideoTime = video.currentTime;
        try {
          const width = Math.min(480, video.videoWidth);
          const bitmap = await createImageBitmap(video, {
            resizeWidth: width,
            resizeHeight: Math.round(
              (width * video.videoHeight) / video.videoWidth,
            ),
            resizeQuality: "low",
          });
          if (token !== generation.current) {
            bitmap.close();
            return;
          }
          pending = true;
          worker!.postMessage({ type: "frame", bitmap, time }, [bitmap]);
        } catch {
          pending = false;
        } finally {
          capturing = false;
        }
      };
      if ("requestVideoFrameCallback" in video)
        videoTimer = video.requestVideoFrameCallback(tick);
      else timer = requestAnimationFrame(tick);
    } catch (error) {
      cleanup();
      if (token === generation.current) {
        setEnabled(false);
        setStatus(
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "摄像头权限被拒绝，可在浏览器设置中重新授权"
            : "摄像头不可用，请检查连接或其他应用占用",
        );
      }
    }
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
    },
    [],
  );
  return {
    enabled,
    praising: enabled && enabledInput && praising,
    status,
    feedback,
    toggle: () => {
      if (enabled) stop();
      else void start();
    },
    stop,
  };
}
