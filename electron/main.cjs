const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  session,
  nativeTheme,
  Menu,
} = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { scanLibrary } = require("./library.cjs");

// Test profiles are isolated from the user's saved picture directory.
if (!app.isPackaged && process.env.AIRGALLERY_TEST_USER_DATA) {
  app.setPath("userData", path.resolve(process.env.AIRGALLERY_TEST_USER_DATA));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "airgallery",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
  {
    scheme: "airgallery-image",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
let window,
  root = null,
  sources = new Map(),
  watcher = null,
  watchTimer = null,
  scanPromise = null;
const development = !app.isPackaged && process.env.AIRGALLERY_DEV_URL;
const nativeGlass =
  process.platform === "darwin" ||
  (process.platform === "win32" && Number(os.release().split(".")[2]) >= 22621);
function trusted(url) {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === "airgallery:" && parsed.hostname === "app") ||
      (development && parsed.origin === new URL(development).origin)
    );
  } catch {
    return false;
  }
}
function requireSender(event) {
  if (!trusted(event.senderFrame?.url || ""))
    throw new Error("Untrusted application origin");
}
function configuration() {
  return path.join(app.getPath("userData"), "directory.json");
}
async function refresh() {
  if (!root) return null;
  if (scanPromise) return scanPromise;
  scanPromise = scanLibrary(root)
    .then((result) => {
      sources = result.sources;
      return result.library;
    })
    .finally(() => {
      scanPromise = null;
    });
  return scanPromise;
}
function watchDirectory() {
  watcher?.close();
  clearTimeout(watchTimer);
  if (!root) return;
  try {
    watcher = fs.watch(root, { recursive: true }, () => {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(async () => {
        try {
          const data = await refresh();
          if (data && !window?.isDestroyed())
            window?.webContents.send("library:changed", data);
        } catch {
          if (!window?.isDestroyed())
            window?.webContents.send("library:changed", {
              error: "目录暂不可用，请重新选择图片目录。",
            });
        }
      }, 700);
    });
    watcher.on("error", () => {
      if (!window?.isDestroyed())
        window?.webContents.send("library:changed", {
          error: "目录监听已暂停，可在设置中手动刷新。",
        });
    });
  } catch {
    /* Refresh remains available for unsupported/network volumes. */
  }
}
async function selectDirectory() {
  const result = await dialog.showOpenDialog(window, {
    title: "选择图片目录",
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  if (scanPromise) await scanPromise.catch(() => {});
  const scanned = await scanLibrary(result.filePaths[0]);
  root = scanned.root;
  sources = scanned.sources;
  await fsp.mkdir(app.getPath("userData"), { recursive: true });
  await fsp.writeFile(configuration(), JSON.stringify({ version: 1, root }), {
    mode: 0o600,
  });
  watchDirectory();
  return scanned.library;
}

app.whenReady().then(() => {
  protocol.handle("airgallery", (request) => {
    const url = new URL(request.url);
    const folder = path.resolve(__dirname, "../dist");
    const target = path.resolve(
      folder,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (url.hostname !== "app" || !target.startsWith(folder + path.sep))
      return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(target).href);
  });
  protocol.handle("airgallery-image", async (request) => {
    const url = new URL(request.url);
    const id = url.pathname.slice(1);
    const file =
      url.hostname === "photo" && /^[a-f0-9]{64}$/.test(id)
        ? sources.get(id)
        : null;
    if (!file || !root) return new Response("Not found", { status: 404 });
    try {
      const real = await fsp.realpath(file);
      if (!real.startsWith(root + path.sep))
        return new Response("Forbidden", { status: 403 });
      const response = await net.fetch(pathToFileURL(real).href);
      const headers = new Headers(response.headers);
      headers.set(
        "Access-Control-Allow-Origin",
        development ? new URL(development).origin : "airgallery://app",
      );
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback) =>
      callback(permission === "media" && trusted(contents.getURL())),
  );
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission) =>
      permission === "media" && !!contents && trusted(contents.getURL()),
  );
  ipcMain.handle("library:choose", async (event) => {
    requireSender(event);
    return selectDirectory();
  });
  ipcMain.handle("library:restore", async (event) => {
    requireSender(event);
    let config;
    try {
      config = JSON.parse(await fsp.readFile(configuration(), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (typeof config.root !== "string") return null;
    root = await fsp.realpath(config.root);
    const data = await refresh();
    watchDirectory();
    return data;
  });
  ipcMain.handle("library:refresh", async (event) => {
    requireSender(event);
    return refresh();
  });
  ipcMain.handle("appearance:set", async (event, dark) => {
    requireSender(event);
    nativeTheme.themeSource = dark === true ? "dark" : "light";
  });
  function createWindow() {
    window = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 800,
      minHeight: 600,
      title: "AirGallery",
      backgroundColor: "#00000000",
      ...(process.platform === "darwin"
        ? {
            vibrancy: "under-window",
            visualEffectState: "active",
            titleBarStyle: "hiddenInset",
          }
        : {}),
      ...(process.platform === "win32" && nativeGlass
        ? { backgroundMaterial: "acrylic" }
        : {}),
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: [
          nativeGlass ? "--airgallery-native-glass" : "--airgallery-css-glass",
        ],
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event, url) => {
      if (!trusted(url)) event.preventDefault();
    });
    if (development) void window.loadURL(development);
    else void window.loadURL("airgallery://app/index.html");
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === "darwin"
        ? [
            {
              label: "AirGallery",
              submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "hide" },
                { role: "quit" },
              ],
            },
          ]
        : []),
      {
        label: "编辑",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize" },
          { role: "togglefullscreen" },
          ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
        ],
      },
    ]),
  );
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  watcher?.close();
  clearTimeout(watchTimer);
});
