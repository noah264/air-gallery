const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const order = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
const image = /\.(jpe?g|png|webp)$/i;

async function scanLibrary(root) {
  const realRoot = await fs.realpath(root);
  const albums = [],
    sources = new Map();
  async function walk(folder) {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const photos = [];
    for (const entry of entries.sort((a, b) => order.compare(a.name, b.name))) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (!entry.isFile() || !image.test(entry.name)) continue;
      try {
        const stat = await fs.stat(absolute);
        const relative = path.relative(realRoot, absolute);
        const id = crypto
          .createHash("sha256")
          .update(realRoot + "\0" + relative)
          .digest("hex");
        sources.set(id, absolute);
        photos.push({
          id,
          name: entry.name,
          revision: stat.mtimeMs + stat.size,
          url: `airgallery-image://photo/${id}?revision=${stat.mtimeMs}`,
        });
      } catch {
        /* A file may disappear while scanning. */
      }
    }
    if (photos.length) {
      const relative = path.relative(realRoot, folder);
      albums.push({
        id: relative || "@root",
        name: path.basename(folder),
        path: relative,
        photos,
      });
    }
  }
  await walk(realRoot);
  albums.sort((a, b) => order.compare(a.path, b.path));
  return {
    library: { name: path.basename(realRoot), albums },
    sources,
    root: realRoot,
  };
}
module.exports = { scanLibrary };
