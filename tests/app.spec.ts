import { test, expect } from "@playwright/test";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

test("space, theme preview/cancel/persistence and independent image view", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "阿尔卑斯之旅", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "test-results/space-light.png" });
  await page.mouse.move(850, 450);
  await page.mouse.wheel(0, -500);
  await expect(page.locator(".spatial-stage")).not.toHaveAttribute(
    "data-log-zoom",
    "0.0000",
  );
  const zoom = await page
    .locator(".spatial-stage")
    .getAttribute("data-log-zoom");
  await page.keyboard.press("s");
  await page
    .getByRole("group", { name: "背景主题" })
    .getByRole("button", { name: /深空石墨/ })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dawn");
  await expect(page.locator(".spatial-stage")).toHaveAttribute(
    "data-log-zoom",
    zoom!,
  );
  await page.keyboard.press("s");
  await page.getByRole("button", { name: /森林薄雾/ }).click();
  await page.getByRole("button", { name: "应用设置" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: /阿尔卑斯之旅/ }),
  ).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".viewer-top")).toContainText("2 / 5");
  await page.keyboard.press("Escape");
  await expect(page.locator(".image-viewer")).toHaveCount(0);
  await page.keyboard.press("0");
  await expect(page.locator(".spatial-stage")).toHaveAttribute(
    "data-log-zoom",
    "0.0000",
  );
  expect(errors).toEqual([]);
});

test("folder fallback groups local photos without uploading them", async ({
  page,
}) => {
  const fixture = path.resolve("test-results/local-photos");
  await mkdir(path.join(fixture, "Trip"), { recursive: true });
  await copyFile(
    "public/demo/photo-1.jpg",
    path.join(fixture, "Trip", "10.jpg"),
  );
  await copyFile(
    "public/demo/photo-2.jpg",
    path.join(fixture, "Trip", "2.jpg"),
  );
  await copyFile("public/demo/photo-3.jpg", path.join(fixture, "root.jpg"));
  await page.addInitScript(() =>
    Object.defineProperty(window, "showDirectoryPicker", { value: undefined }),
  );
  const remote: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1") &&
      !request.url().startsWith("blob:") &&
      !request.url().startsWith("data:")
    )
      remote.push(request.url());
  });
  await page.goto("/");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "图片目录", exact: true }).click();
  await page.locator("input[type=file]").setInputFiles(fixture);
  await expect(page.locator(".directory-card")).toContainText("2 本画册");
  await expect(page.locator(".directory-card")).toContainText("3 张照片");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.keyboard.press("ArrowRight");
  const label = await page.locator(".album-name").textContent();
  if (label !== "Trip") await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-top")).toContainText("2.jpg");
  await expect(page.locator(".viewer-photo")).toBeVisible();
  expect(remote).toEqual([]);
});

test("local camera worker initializes and camera can be stopped", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("s");
  await page.getByRole("button", { name: "手势与操作", exact: true }).click();
  await page.getByRole("button", { name: /摄像头手势控制/ }).click();
  await expect(page.locator(".system-theme")).toContainText(
    /等待手势|正在追踪/,
    { timeout: 35000 },
  );
  await page.getByRole("button", { name: /摄像头手势控制/ }).click();
  await expect(page.locator(".system-theme")).toContainText("摄像头已关闭");
});
