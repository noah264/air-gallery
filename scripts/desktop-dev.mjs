import { spawn } from "node:child_process";
import electron from "electron";

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const server = spawn(command, ["run", "dev"], {
  stdio: "inherit",
  shell: false,
});
let desktop;
const stop = () => {
  desktop?.kill();
  server.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);
server.on("exit", () => {
  desktop?.kill();
});
const address = "http://127.0.0.1:5173";
let ready = false;
for (let attempt = 0; attempt < 80; attempt++) {
  try {
    if ((await fetch(address)).ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 250));
}
if (!ready) {
  stop();
  throw new Error("Vite did not become ready.");
}
desktop = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, AIRGALLERY_DEV_URL: address },
});
desktop.on("exit", (code) => {
  server.kill();
  process.exitCode = code || 0;
});
