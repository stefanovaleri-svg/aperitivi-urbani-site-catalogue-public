import { link, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

const mediaRoot = argument("--media-root");
if (!mediaRoot) throw new Error("Usage: --media-root <verified public/media directory>");

const sourceRoot = resolve(mediaRoot);
const outputRoot = resolve("dist", "media");
let files = 0;
let bytes = 0;
let largest = 0;

async function hardlinkFile(source, target, size) {
  await mkdir(dirname(target), { recursive: true });
  await rm(target, { force: true });
  await link(source, target);
  files += 1;
  bytes += size;
  largest = Math.max(largest, size);
}

async function hardlinkTree(source, target) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === ".aperitivi-media-cache.json") continue;
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);
    const metadata = await stat(sourcePath);
    if (metadata.isDirectory()) await hardlinkTree(sourcePath, targetPath);
    else if (metadata.isFile()) await hardlinkFile(sourcePath, targetPath, metadata.size);
  }
}

await stat(resolve("dist", "index.html"));
await stat(sourceRoot);
await rm(outputRoot, { recursive: true, force: true });
await hardlinkTree(sourceRoot, outputRoot);

if (files !== 2307) throw new Error(`Expected 2307 media files, got ${files}`);
if (largest > 25 * 1024 * 1024) throw new Error(`Largest media exceeds 25 MiB: ${largest}`);
console.log(`Prepared ${files} hard-linked media files (${bytes} bytes); largest ${largest} bytes.`);
