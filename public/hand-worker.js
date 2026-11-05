/* MediaPipe's WASM loader uses importScripts. Keep this as a classic worker. */
let detector = null;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      importScripts(`${data.assets}/vision_bundle.js`);
      const files = await Vision.FilesetResolver.forVisionTasks(
        `${data.assets}/wasm`,
      );
      detector = await Vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${data.assets}/hand_landmarker.task`,
          delegate: "CPU",
        },
        numHands: 2,
        runningMode: "VIDEO",
        minHandDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "frame") {
      try {
        const started = performance.now();
        const result = detector?.detectForVideo(data.bitmap, data.time);
        self.postMessage({
          type: "hands",
          landmarks: result?.landmarks || [],
          time: data.time,
          duration: performance.now() - started,
        });
      } finally {
        data.bitmap.close();
      }
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "手势识别失败",
    });
  }
};
