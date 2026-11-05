import { test, expect } from "@playwright/test";
import { handPoints } from "./hand-fixtures";

test("camera thumbs-up continuously replenishes random praise, drains on release and stops on stalled results", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript((points) => {
    const state = { hands: [points], activations: 0, paused: false };
    Object.assign(window, { praiseTest: state });
    new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (
            node instanceof HTMLElement &&
            node.matches('[data-testid="praise-rain"]')
          )
            state.activations++;
        }
    }).observe(document, { childList: true, subtree: true });
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
            if (state.paused) return;
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
  }, handPoints("thumbs-up"));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "手势与操作", exact: true }).click();
  await expect(page.locator(".shortcut-list")).toContainText(
    "持续生成随机夸奖",
  );
  await page.getByRole("button", { name: /摄像头手势控制/ }).click();
  await expect(page.locator(".system-theme")).toContainText("正在追踪");
  await page.waitForTimeout(800);
  await expect(page.getByTestId("praise-rain")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭设置" }).click();
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "true",
  );
  await expect
    .poll(() => page.locator(".praise-drop").count())
    .toBeGreaterThan(0);
  const initial = await page.locator(".praise-drop").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-drop-id"),
      text: node.textContent,
    })),
  );
  await page.waitForTimeout(9400); // Longer than the old fixed 8.2-second celebration.
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "true",
  );
  const current = await page.locator(".praise-drop").evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute("data-drop-id"),
      text: node.textContent,
    })),
  );
  console.log("Continuous praise:", {
    initial: initial.length,
    count: current.length,
    first: current[0]?.id,
    last: current.at(-1)?.id,
    activations: await page.evaluate(
      () => (window as any).praiseTest.activations,
    ),
  });
  expect(current.length).toBeGreaterThan(0);
  expect(current.length).toBeLessThanOrEqual(160);
  expect(
    current.some((item) => initial.some((old) => old.id === item.id)),
  ).toBe(false);
  expect(current.map((item) => item.text).join()).not.toBe(
    initial.map((item) => item.text).join(),
  );
  expect(
    await page.evaluate(() => (window as any).praiseTest.activations),
  ).toBe(1);
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "true",
  );
  const source = await page.locator(".viewer-photo").getAttribute("src");
  await page.evaluate(() => {
    (window as any).praiseTest.hands = [];
  });
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "false",
  );
  // Already falling text remains, but its newest ID must stop advancing.
  const lastId = await page
    .locator(".praise-drop")
    .last()
    .getAttribute("data-drop-id");
  await page.waitForTimeout(1000);
  expect(
    await page.locator(".praise-drop").last().getAttribute("data-drop-id"),
  ).toBe(lastId);
  await expect(page.getByTestId("praise-rain")).toHaveCount(0, {
    timeout: 6000,
  });
  await expect(page.locator(".viewer-photo")).toHaveAttribute("src", source!);
  await page.evaluate((points) => {
    (window as any).praiseTest.hands = [points];
  }, handPoints("thumbs-up"));
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "true",
  );
  await page.evaluate(() => {
    (window as any).praiseTest.paused = true;
  });
  await expect(page.getByTestId("praise-rain")).toHaveAttribute(
    "data-emitting",
    "false",
    { timeout: 1500 },
  );
  await expect(page.getByTestId("praise-rain")).toHaveCount(0, {
    timeout: 6000,
  });
  await page.keyboard.press("h");
  await expect(page.locator(".gesture-progress")).toHaveCount(0);
});

test("praise falls across the screen, keeps controls usable and supports reduced motion", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 100));
  await page.keyboard.press("p");
  await expect(page.getByTestId("praise-rain")).toBeVisible();
  // CSS animations use the browser animation timeline, independent of the JS clock.
  // Pause them at known times to inspect real keyframe interpolation and capture the rain.
  const seek = async (time: number) =>
    page.locator(".praise-drop").evaluateAll((nodes, time) => {
      for (const node of nodes)
        for (const animation of node.getAnimations()) {
          animation.pause();
          animation.currentTime = time;
        }
    }, time);
  await page.clock.runFor(2500);
  await seek(2500);
  const before = await page
    .locator(".praise-drop")
    .first()
    .evaluate((node) => node.getBoundingClientRect().y);
  await page.clock.fastForward(400);
  await seek(2900);
  const after = await page
    .locator(".praise-drop")
    .first()
    .evaluate((node) => node.getBoundingClientRect().y);
  expect(after).toBeGreaterThan(before + 40);
  const positions = await page.locator(".praise-drop").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    }),
  );
  expect(positions.some(({ x }) => x < 150)).toBe(true);
  expect(positions.some(({ x }) => x > 1100)).toBe(true);

  await page.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(page.locator(".viewer-top")).toContainText("2 / 5");
  await expect(page.getByTestId("praise-rain")).toBeVisible();
  await page.clock.fastForward(6000);
  await expect(page.getByTestId("praise-rain")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("p");
  await expect(page.locator(".praise-still")).toBeVisible();
  await expect(page.locator(".praise-drop")).toHaveCount(12);
  expect(
    await page
      .locator(".praise-drop")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.clock.fastForward(8500);
  await expect(page.getByTestId("praise-rain")).toHaveCount(0);
  await page.keyboard.press("p");
  await expect(page.getByTestId("praise-rain")).toBeVisible();
  await page.keyboard.press("s");
  await expect(page.getByTestId("praise-rain")).toHaveCount(0);
});
