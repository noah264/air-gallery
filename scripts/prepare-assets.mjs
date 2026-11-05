import { mkdir, readdir, copyFile, access, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.resolve("public/mediapipe");
await mkdir(path.join(target, "wasm"), { recursive: true });
await copyFile(
  path.resolve("node_modules/@mediapipe/tasks-vision/vision_bundle.js"),
  path.join(target, "vision_bundle.js"),
);
const wasm = path.resolve("node_modules/@mediapipe/tasks-vision/wasm");
for (const file of await readdir(wasm))
  if (/\.(wasm|js)$/.test(file))
    await copyFile(path.join(wasm, file), path.join(target, "wasm", file));
const model = path.join(target, "hand_landmarker.task");
try {
  await access(model);
} catch {
  const response = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  );
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await writeFile(model, Buffer.from(await response.arrayBuffer()));
}
console.log("Local MediaPipe WASM and hand model ready.");
