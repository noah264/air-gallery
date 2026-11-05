import { test, expect } from "@playwright/test";

test("keeps the demo draw budget bounded and pauses the scene behind the image viewer", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const stats = { calls: 0, frame: 0, max: 0 };
    Object.assign(window, { renderStats: stats });
    const prototype = WebGL2RenderingContext.prototype;
    const clear = prototype.clear,
      draw = prototype.drawElements;
    prototype.clear = function (mask) {
      stats.frame = 0;
      return clear.call(this, mask);
    };
    prototype.drawElements = function (mode, count, type, offset) {
      stats.calls++;
      stats.frame++;
      stats.max = Math.max(stats.max, stats.frame);
      return draw.call(this, mode, count, type, offset);
    };
  });
  const stats = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            renderStats: { calls: number; max: number };
          }
        ).renderStats,
    );
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(async () => (await stats()).max).toBeGreaterThan(25);
  await page.keyboard.press("+");
  await page.waitForTimeout(700);
  expect((await stats()).max).toBeLessThanOrEqual(140);
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  await page.waitForTimeout(300);
  const paused = (await stats()).calls;
  await page.waitForTimeout(500);
  expect((await stats()).calls).toBe(paused);
  await page.keyboard.press("Escape");
  await page.keyboard.press("+");
  await expect.poll(async () => (await stats()).calls).toBeGreaterThan(paused);
  console.log("WebGL draw budget:", (await stats()).max);
});
