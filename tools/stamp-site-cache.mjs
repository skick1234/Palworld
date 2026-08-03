import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
const assetLink = /((?:href|src)=["'][^"']+\.(?:css|js))(?:\?[^"']*)?(["'])/gi;
const externalLink = /["'](?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

export function stampAssetLinks(html, version = Date.now()) {
  return html.replace(assetLink, (match, link, quote) => externalLink.test(link) ? match : `${link}?v=${version}${quote}`);
}

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : entry.name.endsWith(".html") ? [path] : [];
  }));
  return files.flat();
}

export async function stampSite(version = Date.now()) {
  const changed = [];
  for (const path of await htmlFiles(siteRoot)) {
    const source = await readFile(path, "utf8");
    const stamped = stampAssetLinks(source, version);
    if (stamped === source) continue;
    await writeFile(path, stamped, "utf8");
    changed.push(path);
  }
  return changed;
}

if (import.meta.main) {
  const version = Date.now();
  const changed = await stampSite(version);
  console.log(`Stamped ${changed.length} HTML page${changed.length === 1 ? "" : "s"} with cache version ${version}.`);
}
