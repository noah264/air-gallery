import { test, expect } from "@playwright/test";
import { handPoints } from "./hand-fixtures";

test("fireworks synthesize non-silent bounded audio and clean up on mute, page change and finish", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const stats = { started: 0, stopped: 0 };
    Object.assign(window, { fireworkAudio: stats });
    const start = AudioBufferSourceNode.prototype.start,
      stop = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
      stats.started++;
      return start.call(this, when, offset, duration);
    };
    AudioBufferSourceNode.prototype.stop = function (when) {
      stats.stopped++;
      return stop.call(this, when);
    };
  });
  await page.goto("/");
  const audio = await page.evaluate(async () => {
    // Test the same synthesis graph with offline rendering, without microphone access.
    const { scheduleFireworksSound, FIREWORK_DURATION } =
      await import("/src/lib/fireworks.ts");
    const context = new OfflineAudioContext(
      1,
      Math.ceil(44100 * FIREWORK_DURATION),
      44100,
    );
    const stop = scheduleFireworksSound(context, context.destination, 0.01);
    const rendered = await context.startRendering(),
      samples = rendered.getChannelData(0);
    let peak = 0,
      energy = 0;
    for (const value of samples) {
      peak = Math.max(peak, Math.abs(value));
      energy += value * value;
    }
    stop();
    return { peak, rms: Math.sqrt(energy / samples.length) };
  });
  expect(audio.peak).toBeGreaterThan(0.02);
  expect(audio.peak).toBeLessThan(0.9);
  expect(audio.rms).toBeGreaterThan(0.005);
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  const source = await page.locator(".viewer-photo").getAttribute("src");
  await page.getByRole("button", { name: "放烟花（F）", exact: true }).click();
  await expect(page.getByTestId("photo-fireworks")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).fireworkAudio.started))
    .toBeGreaterThan(10);
  await page.waitForTimeout(2300);
  await page.screenshot({ path: "test-results/fireworks-preview.png" });
  await expect(page.locator(".viewer-photo")).toHaveAttribute("src", source!);
  await page.getByRole("button", { name: "关闭烟花音效" }).click();
  const muted = await page.evaluate(() => (window as any).fireworkAudio);
  expect(muted.stopped).toBeGreaterThanOrEqual(muted.started);
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("photo-fireworks")).toHaveCount(0);
  await page.keyboard.press("f");
  await expect(page.getByTestId("photo-fireworks")).toBeVisible();
  expect(await page.evaluate(() => (window as any).fireworkAudio.started)).toBe(
    muted.started,
  );
  await expect(page.getByTestId("photo-fireworks")).toHaveCount(0, {
    timeout: 9500,
  });
  await page.reload();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "开启烟花音效" }),
  ).toBeVisible();
  console.log("Offline fireworks audio:", audio);
});

test("camera clap triggers one celebration for the current photo without flipping the page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state: { hands: { x: number; y: number }[][] } = { hands: [] };
    Object.assign(window, { clapTest: state });
    Object.defineProperty(window, "Worker", {
      value: class {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        stopped = false;
        postMessage(data: {
          type: string;
          time?: number;
          bitmap?: ImageBitmap;
        }) {
          if (this.stopped) return;
          if (data.type === "init")
            queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } }));
          if (data.type === "frame") {
            data.bitmap?.close();
            queueMicrotask(() =>
              this.onmessage?.({
                data: {
                  type: "hands",
                  landmarks: state.hands,
                  time: data.time,
                  duration: 1,
                },
              }),
            );
          }
        }
        terminate() {
          this.stopped = true;
        }
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  const photo = await page.locator(".viewer-photo").getAttribute("src");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "手势与操作", exact: true }).click();
  await page.getByRole("button", { name: /摄像头手势控制/ }).click();
  await expect(page.locator(".system-theme")).toContainText(
    /等待手势|正在追踪/,
  );
  await page.getByRole("button", { name: "关闭设置" }).click();
  const palm = handPoints("palm");
  for (const span of [0.7, 0.54, 0.38, 0.2]) {
    const pair = [0.5 - span / 2, 0.5 + span / 2].map((center) =>
      palm.map((p) => ({ x: p.x + 0.454 - center, y: p.y })),
    );
    await page.evaluate((hands) => {
      (window as any).clapTest.hands = hands;
    }, pair);
    await page.waitForTimeout(100);
  }
  await expect(page.getByTestId("photo-fireworks")).toBeVisible();
  await expect(page.locator(".viewer-photo")).toHaveAttribute("src", photo!);
  await expect(page.locator(".viewer-top")).toContainText("1 / 5");
  await page.waitForTimeout(800);
  await expect(page.locator(".viewer-top")).toContainText("1 / 5");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("photo-fireworks")).toHaveCount(0);
});

test("dense layered blooms fill the photo and respect reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  await page.getByRole("button", { name: "放烟花（F）", exact: true }).click();
  const fireworks = page.getByTestId("photo-fireworks");
  await expect(fireworks).toBeVisible();
  // Observe real rendered frames: virtual-clock jumps can skip animation frames
  // or race React effects and ResizeObserver delivery on software-rendered CI.
  await expect
    .poll(
      () =>
        fireworks.evaluate((element) => {
          const canvas = element as HTMLCanvasElement;
          if (!canvas.width || !canvas.height) return 0;
          const pixels = canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height).data;
          let bright = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] > 100 && pixels[i + 3] > 80) bright++;
          }
          return bright / (canvas.width * canvas.height);
        }),
      { timeout: 6000, intervals: [100, 200, 400] },
    )
    .toBeGreaterThan(0.025);
  await page.screenshot({ path: "test-results/fireworks-anime-preview.png" });
  await expect(fireworks).toHaveCount(0, { timeout: 9500 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "放烟花（F）", exact: true }).click();
  await expect(fireworks).toBeVisible();
  await expect(fireworks).toHaveCount(0, { timeout: 9500 });
});
