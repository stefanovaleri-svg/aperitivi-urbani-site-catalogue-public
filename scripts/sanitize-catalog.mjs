import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function publicMediaPath(post, media) {
  const filename = basename(String(media.archive?.localPath || ""));
  if (!/^[A-Za-z0-9._-]+$/u.test(filename)) {
    throw new Error("A complete-record media item has an unsafe archive filename");
  }
  if (
    !["preserved", "reused"].includes(media.archive?.status) ||
    media.archive?.error !== null ||
    !Number.isInteger(media.archive?.bytes) ||
    media.archive.bytes <= 0 ||
    media.archive.contentType !== media.contentType
  ) {
    throw new Error("A complete-record media item is not fully preserved");
  }
  const derivedPath = `/media/${post.sourcePostId}/${filename}`;
  if (media.publicPath && media.publicPath !== derivedPath) {
    throw new Error("A committed media route conflicts with its accepted archive identity");
  }
  return derivedPath;
}

const sourcePath = argument("--source");
const outputPath = argument("--output");
if (!sourcePath || !outputPath) {
  throw new Error("Usage: --source <private catalog.ts> --output <public catalog.json>");
}

const source = await readFile(resolve(sourcePath), "utf8");
const marker = "export const catalogSeed: CatalogSeed = ";
const markerIndex = source.indexOf(marker);
if (markerIndex === -1) throw new Error("Private catalogue marker not found");
const privateCatalog = JSON.parse(source.slice(markerIndex + marker.length, -2));
const acceptance = privateCatalog.release.acceptance;
const campaign = privateCatalog.release.manifest?.campaign;
const operatorSnapshot = privateCatalog.release.operatorSnapshot || {
  expectedPosts: acceptance?.expected_posts,
  attemptedPosts: campaign?.attempted_records,
  completePosts: acceptance?.released_posts,
  exceptionPosts: acceptance?.exception_posts,
};

if (
  privateCatalog.release.status !== "completed" ||
  privateCatalog.release.deliveryMode !== "standard-95-percent-release" ||
  privateCatalog.release.recordCount !== 588 ||
  privateCatalog.release.captureCount !== 588 ||
  privateCatalog.release.mediaCount !== 2366 ||
  acceptance?.threshold_met !== true ||
  acceptance?.accepted_with_exceptions !== true ||
  acceptance?.expected_posts !== 615 ||
  acceptance?.released_posts !== 588 ||
  acceptance?.fully_successful_posts !== 588 ||
  acceptance?.exception_posts !== 27 ||
  acceptance?.capture_exception_posts !== 27 ||
  acceptance?.pipeline_exception_posts !== 0 ||
  acceptance?.completion_basis_points !== 9560 ||
  campaign?.inventory_verified !== true ||
  campaign?.ready_for_release !== true ||
  campaign?.expected_posts !== 615 ||
  campaign?.attempted_records !== 615 ||
  campaign?.complete_records !== 588 ||
  campaign?.pending_records !== 27 ||
  campaign?.unattempted_records !== 0 ||
  privateCatalog.release.manifest?.complete_history_complete !== true
) {
  throw new Error("Private catalogue is not an accepted, inventory-verified release");
}

const publicCatalog = {
  schemaVersion: "aperitivi-public-catalog-v1",
  creator: {
    handle: privateCatalog.creator.handle,
    displayName: privateCatalog.creator.displayName,
    profileUrl: privateCatalog.creator.profileUrl,
  },
  coverage: {
    expectedPosts: operatorSnapshot.expectedPosts,
    attemptedPosts: operatorSnapshot.attemptedPosts,
    completePosts: operatorSnapshot.completePosts,
    excludedIncompleteRecords: operatorSnapshot.exceptionPosts,
    venueCount: privateCatalog.venues.length,
    mediaCount: privateCatalog.release.mediaCount,
  },
  venues: privateCatalog.venues.map((venue) => ({
    id: venue.id,
    slug: venue.slug,
    name: venue.canonicalName,
    aliases: venue.aliases,
    city: venue.city,
    neighbourhood: venue.neighbourhood,
    address: venue.formattedAddress,
    latitude: venue.coordinateStatus === "valid" ? venue.latitude : null,
    longitude: venue.coordinateStatus === "valid" ? venue.longitude : null,
    coordinateStatus: venue.coordinateStatus,
    resolutionStatus: venue.resolutionStatus,
  })),
  posts: privateCatalog.posts.map((post) => ({
    id: post.id,
    sourceUrl: post.canonicalUrl,
    publishedAt: post.publishedAt,
    summary: post.summary,
    tags: post.experienceTags,
    media: post.media.map((media) => ({
      publicPath: publicMediaPath(post, media),
      contentType: media.contentType,
      mediaType: media.mediaType,
      altText: media.altText,
    })),
  })),
  listings: privateCatalog.listings.map((listing) => ({
    id: listing.id,
    venueId: listing.venueId,
    postId: listing.sourcePostId,
    sourceUrl: listing.sourcePostUrl,
  })),
};

const mediaCount = publicCatalog.posts.reduce(
  (total, post) => total + post.media.length,
  0,
);
const checks = [
  [publicCatalog.coverage.expectedPosts, 615, "expected posts"],
  [publicCatalog.coverage.attemptedPosts, 615, "attempted posts"],
  [publicCatalog.coverage.completePosts, 588, "coverage complete posts"],
  [publicCatalog.coverage.excludedIncompleteRecords, 27, "excluded incomplete records"],
  [publicCatalog.coverage.mediaCount, 2366, "coverage media"],
  [publicCatalog.posts.length, 588, "complete posts"],
  [publicCatalog.listings.length, 588, "listings"],
  [publicCatalog.venues.length, 289, "venues"],
  [mediaCount, 2366, "media"],
];
for (const [actual, expected, label] of checks) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
if (
  privateCatalog.creator.licenceStatus !== "verified" ||
  !privateCatalog.listings.every((listing) => listing.mediaRightsStatus === "verified")
) {
  throw new Error("Not every complete-record listing has verified media rights");
}
const mediaRoutes = publicCatalog.posts.flatMap((post) => post.media.map((media) => media.publicPath));
if (
  publicCatalog.posts.some((post) => post.media.length === 0) ||
  mediaRoutes.some((route) => !/^\/media\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/u.test(route)) ||
  new Set(mediaRoutes).size !== mediaCount
) {
  throw new Error("Complete-record public media routes are missing, unsafe, or duplicated");
}

await writeFile(resolve(outputPath), `${JSON.stringify(publicCatalog)}\n`, "utf8");
console.log(`Wrote ${publicCatalog.venues.length} venues, ${publicCatalog.posts.length} posts, and ${mediaCount} media routes.`);
