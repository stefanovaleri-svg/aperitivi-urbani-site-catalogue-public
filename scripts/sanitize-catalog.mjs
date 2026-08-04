import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
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

const publicCatalog = {
  schemaVersion: "aperitivi-public-catalog-v1",
  creator: {
    handle: privateCatalog.creator.handle,
    displayName: privateCatalog.creator.displayName,
    profileUrl: privateCatalog.creator.profileUrl,
  },
  coverage: {
    expectedPosts: privateCatalog.release.operatorSnapshot.expectedPosts,
    attemptedPosts: privateCatalog.release.operatorSnapshot.attemptedPosts,
    completePosts: privateCatalog.release.operatorSnapshot.completePosts,
    excludedIncompleteRecords: privateCatalog.release.operatorSnapshot.exceptionPosts,
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
      publicPath: media.publicPath,
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
  [publicCatalog.posts.length, 573, "complete posts"],
  [publicCatalog.listings.length, 573, "listings"],
  [publicCatalog.venues.length, 327, "venues"],
  [mediaCount, 2307, "media"],
];
for (const [actual, expected, label] of checks) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
if (!privateCatalog.listings.every((listing) => listing.mediaRightsStatus === "verified")) {
  throw new Error("Not every complete-record listing has verified media rights");
}
if (publicCatalog.posts.some((post) => post.media.some((media) => !media.publicPath))) {
  throw new Error("A complete-record media item lacks a public route");
}

await writeFile(resolve(outputPath), `${JSON.stringify(publicCatalog)}\n`, "utf8");
console.log(`Wrote ${publicCatalog.venues.length} venues, ${publicCatalog.posts.length} posts, and ${mediaCount} media routes.`);
