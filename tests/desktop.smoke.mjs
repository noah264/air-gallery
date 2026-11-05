import { _electron as electron, expect } from "@playwright/test";
import { mkdir, copyFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const profile = await mkdtemp(path.join(os.tmpdir(), "airgallery-smoke-"));
const fixture = path.join(profile, "Pictures");
await mkdir(path.join(fixture, "Trip"), { recursive: true });
await copyFile("public/demo/photo-2.jpg", path.join(fixture, "Trip", "2.jpg"));
await copyFile("public/demo/photo-3.jpg", path.join(fixture, "Trip", "10.jpg"));
const launch = () =>
  electron.launch({
    args: ["."],
    env: {
      ...process.env,
      AIRGALLERY_TEST_USER_DATA: path.join(profile, "profile"),
      AIRGALLERY_DEV_URL: "",
    },
  });
let app;
try {
  app = await launch();
  const page = await app.firstWindow();
  await page.bringToFront();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/native-glass/);
  await app.evaluate(({ dialog }, directory) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [directory],
    });
  }, fixture);
  await page.keyboard.press("s");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/desktop-settings.png" });
  await page.getByRole("button", { name: "图片目录", exact: true }).click();
  await page.getByRole("button", { name: "选择图片目录", exact: true }).click();
  await expect(page.locator(".directory-card")).toContainText("2 张照片");
  await page.getByRole("button", { name: "关闭设置" }).click();
  await page.keyboard.press("Enter");
  await expect(page.locator(".viewer-top")).toContainText("2.jpg");
  await expect
    .poll(() =>
      page.locator(".viewer-photo").evaluate((image) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  const response = await page.evaluate(async () => {
    const source = document.querySelector(".viewer-photo").src;
    const response = await fetch(source);
    return { ok: response.ok, size: (await response.blob()).size };
  });
  expect(response.ok).toBe(true);
  expect(response.size).toBeGreaterThan(1000);
  await copyFile(
    "public/demo/photo-4.jpg",
    path.join(fixture, "Trip", "3.jpg"),
  );
  await expect(page.locator(".viewer-top")).toContainText("1 / 3", {
    timeout: 12000,
  });
  await page.screenshot({ path: "test-results/desktop-viewer.png" });
  await app.close();
  app = await launch();
  const restored = await app.firstWindow();
  await expect(restored.locator(".app-shell")).toHaveAttribute(
    "data-source",
    "desktop",
  );
  await expect(restored.locator(".album-name")).toContainText("Trip");
  console.log(
    "PASS: production protocol, native glass, local directory, original image, directory watcher, saved directory restore",
  );
} catch (error) {
  const page = (await app?.windows())?.[0];
  await page?.screenshot({ path: "test-results/desktop-failure.png" });
  console.error(await page?.locator("body").innerText());
  throw error;
} finally {
  await app?.close();
}
