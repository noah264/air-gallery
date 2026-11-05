import { test, expect } from "@playwright/test";
import { handPoints } from "./hand-fixtures";

test("held V opens the selected album and held fist returns to the same spatial view", async ({
  page,
}) => {
  // Exercise the real camera scheduler, pose interpreter, feedback and app commands
  // using synthetic worker landmarks. The separate camera test uses the real model.
  await page.addInitScript(
    ({ victory, fist }) => {
      const state = { pose: "victory", victory, fist };
      Object.assign(window, { gestureTest: state });
      Object.defineProperty(window, "Worker", {
        value: class {
          onmessage: ((event: { data: unknown }) => void) | null = null;
          stopped = false;
          postMessage(data: {
            type: string;
            bitmap?: ImageBitmap;
            time?: number;
          }) {
            if (this.stopped) return;
            if (data.type === "init")
              queueMicrotask(() =>
                this.onmessage?.({ data: { type: "ready" } }),
              );
            if (data.type === "frame") {
              data.bitmap?.close();
              const points =
                state.pose === "victory"
                  ? state.victory
                  : state.pose === "fist"
                    ? state.fist
                    : null;
              queueMicrotask(() =>
                this.onmessage?.({
                  data: {
                    type: "hands",
                    landmarks: points ? [points] : [],
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
    },
    { victory: handPoints("victory"), fist: handPoints("fist") },
  );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("+");
  const zoom = await page
    .locator(".spatial-stage")
    .getAttribute("data-log-zoom");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "手势与操作", exact: true }).click();
  await page.getByRole("button", { name: /摄像头手势控制/ }).click();
  await expect(page.locator(".system-theme")).toContainText("正在追踪");
  await page.waitForTimeout(700);
  await expect(page.locator(".image-viewer")).toHaveCount(0);
  await expect(page.locator(".gesture-progress")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(page.locator(".gesture-progress")).toContainText("保持 V 手势");
  await expect(
    page.getByRole("dialog", { name: /阿尔卑斯之旅/ }),
  ).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator(".image-viewer")).toBeVisible();
  await page.evaluate(() => {
    (
      window as typeof window & { gestureTest: { pose: string } }
    ).gestureTest.pose = "fist";
  });
  await expect(page.locator(".gesture-progress")).toContainText("保持握拳");
  await expect(page.locator(".image-viewer")).toHaveCount(0);
  await expect(page.locator(".spatial-stage")).toHaveAttribute(
    "data-log-zoom",
    zoom!,
  );
  await page.waitForTimeout(800);
  await expect(page.locator(".image-viewer")).toHaveCount(0);
  await page.keyboard.press("h");
  await expect(page.locator(".gesture-progress")).toHaveCount(0);
});
