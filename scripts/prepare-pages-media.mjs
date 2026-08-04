import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(repoRoot, "src", "data", "catalog.json");
const distRoot = path.join(repoRoot, "dist");
const distMediaRoot = path.join(distRoot, "media");
const MAX_PAGES_FILE_BYTES = 25 * 1024 * 1024;
const EXPECTED_POSTS = 573;
const EXPECTED_MEDIA = 2307;
const EXPECTED_JPEGS = 2069;
const EXPECTED_MP4S = 238;
const EXPECTED_MEDIA_BYTES = 2_085_040_796;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeChild(root, relativePath) {
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), `Unsafe child path: ${relativePath}`);
  return candidate;
}

function isSameOrDescendant(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function verifySignature(filePath, contentType) {
  const handle = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(handle, buffer, 0, buffer.length, 0);
    assert(bytesRead >= 12, `Media file is too short: ${path.basename(filePath)}`);
    if (contentType === "image/jpeg") {
      assert(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff, `Invalid JPEG signature: ${path.basename(filePath)}`);
      return;
    }
    if (contentType === "video/mp4") {
      assert(buffer.subarray(4, 8).toString("ascii") === "ftyp", `Invalid MP4 signature: ${path.basename(filePath)}`);
      return;
    }
    throw new Error(`Unsupported content type: ${contentType}`);
  } finally {
    fs.closeSync(handle);
  }
}

const mediaRoot = argument("--media-root");
assert(mediaRoot, "Usage: --media-root <verified public/media directory>");
const sourceRoot = path.resolve(mediaRoot);

assert(fs.existsSync(path.join(distRoot, "index.html")), "Run npm run build before preparing Pages assets");
assert(fs.existsSync(sourceRoot) && fs.lstatSync(sourceRoot).isDirectory(), "Verified public media allowlist is unavailable");
assert(!isSameOrDescendant(sourceRoot, distMediaRoot), "Media destination overlaps the source allowlist");
assert(!isSameOrDescendant(distMediaRoot, sourceRoot), "Media source overlaps the deployment destination");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
assert(catalog?.coverage?.completePosts === EXPECTED_POSTS, "Public projection complete-post count changed");
assert(Array.isArray(catalog.posts) && catalog.posts.length === EXPECTED_POSTS, "Public projection does not contain exactly 573 complete posts");

const media = [];
const postDirectories = new Set();
for (const post of catalog.posts) {
  const shortcodeMatch = post.sourceUrl?.match(/^https:\/\/www\.instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)\/$/u);
  assert(shortcodeMatch, `Invalid public source URL: ${post.sourceUrl}`);
  const postDirectory = shortcodeMatch[1];
  assert(!postDirectories.has(postDirectory), `Duplicate public post directory: ${postDirectory}`);
  assert(Array.isArray(post.media) && post.media.length > 0, `Complete post has no public media: ${postDirectory}`);
  postDirectories.add(postDirectory);

  for (const item of post.media) {
    assert(/^\/media\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/u.test(item.publicPath), `Unsafe media route: ${item.publicPath}`);
    assert(!item.publicPath.includes("..") && !item.publicPath.includes("\\"), `Unsafe media route: ${item.publicPath}`);
    const relativeRoute = item.publicPath.slice("/media/".length);
    const [routeDirectory, fileName, unexpectedSegment] = relativeRoute.split("/");
    assert(!unexpectedSegment && routeDirectory === postDirectory, `Media route is not bound to its public post: ${item.publicPath}`);

    if (item.mediaType === "IMAGE") {
      assert(item.contentType === "image/jpeg" && /\.jpe?g$/iu.test(fileName), `Invalid JPEG media declaration: ${item.publicPath}`);
    } else if (item.mediaType === "VIDEO") {
      assert(item.contentType === "video/mp4" && /\.mp4$/iu.test(fileName), `Invalid MP4 media declaration: ${item.publicPath}`);
    } else {
      throw new Error(`Unsupported media type: ${item.mediaType}`);
    }

    media.push({ ...item, relativeRoute, postDirectory, fileName });
  }
}

assert(postDirectories.size === EXPECTED_POSTS, "Expected one public media directory per complete post");
assert(media.length === EXPECTED_MEDIA, "Public projection does not contain exactly 2,307 media routes");
assert(new Set(media.map((item) => item.publicPath)).size === EXPECTED_MEDIA, "Public media routes are not unique");
assert(media.filter((item) => item.contentType === "image/jpeg").length === EXPECTED_JPEGS, "Public JPEG count changed");
assert(media.filter((item) => item.contentType === "video/mp4").length === EXPECTED_MP4S, "Public MP4 count changed");

const verifiedJunctions = new Map();
for (const postDirectory of postDirectories) {
  const junctionPath = safeChild(sourceRoot, postDirectory);
  const junctionStat = fs.lstatSync(junctionPath);
  assert(junctionStat.isSymbolicLink(), `Media source is not a verified per-post junction: ${postDirectory}`);
  verifiedJunctions.set(postDirectory, fs.realpathSync(junctionPath));
}

if (fs.existsSync(distMediaRoot)) {
  assert(path.relative(repoRoot, distMediaRoot) === path.join("dist", "media"), "Refusing to clear an unexpected media destination");
  fs.rmSync(distMediaRoot, { recursive: true, force: true });
}
fs.mkdirSync(distMediaRoot, { recursive: true });

let linkedBytes = 0;
let maxFileBytes = 0;
for (const item of media) {
  const sourcePath = safeChild(sourceRoot, item.relativeRoute);
  const sourceLinkStat = fs.lstatSync(sourcePath);
  assert(!sourceLinkStat.isSymbolicLink(), `Media file must not be a nested link: ${item.publicPath}`);
  const sourceRealPath = fs.realpathSync(sourcePath);
  const junctionRealPath = verifiedJunctions.get(item.postDirectory);
  assert(isSameOrDescendant(junctionRealPath, sourceRealPath) && sourceRealPath !== junctionRealPath, `Media escapes its verified post junction: ${item.publicPath}`);

  const sourceStat = fs.statSync(sourcePath, { bigint: true });
  assert(sourceStat.isFile() && sourceStat.size > 0n, `Media source is not a non-empty file: ${item.publicPath}`);
  assert(sourceStat.size <= BigInt(MAX_PAGES_FILE_BYTES), `Media exceeds Cloudflare Pages 25 MiB limit: ${item.publicPath}`);
  verifySignature(sourcePath, item.contentType);

  const destinationPath = safeChild(distMediaRoot, item.relativeRoute);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.linkSync(sourcePath, destinationPath);
  const destinationStat = fs.statSync(destinationPath, { bigint: true });
  assert(destinationStat.isFile(), `Hardlink destination is not a file: ${item.publicPath}`);
  assert(destinationStat.dev === sourceStat.dev && destinationStat.ino === sourceStat.ino, `Destination is not the exact source hardlink: ${item.publicPath}`);
  assert(destinationStat.size === sourceStat.size, `Hardlink size mismatch: ${item.publicPath}`);

  const fileBytes = Number(sourceStat.size);
  linkedBytes += fileBytes;
  maxFileBytes = Math.max(maxFileBytes, fileBytes);
}

assert(linkedBytes === EXPECTED_MEDIA_BYTES, `Expected ${EXPECTED_MEDIA_BYTES} media bytes, got ${linkedBytes}`);
assert(verifiedJunctions.size === EXPECTED_POSTS, "Expected 573 verified per-post media junctions");
console.log(
  `Prepared ${media.length} exact hardlinks from ${verifiedJunctions.size} verified junctions (${linkedBytes} bytes); largest ${maxFileBytes} bytes.`,
);
