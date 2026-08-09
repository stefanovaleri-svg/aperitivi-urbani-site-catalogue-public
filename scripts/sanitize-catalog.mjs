import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const PRIVATE_CATALOG_MARKER = "export const catalogSeed: CatalogSeed = ";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parsePrivateCatalog(source) {
  const markerIndex = source.indexOf(PRIVATE_CATALOG_MARKER);
  assert(markerIndex !== -1, "Private catalogue marker not found");
  assert(markerIndex === 0 || source[markerIndex - 1] === "\n", "Private catalogue marker must begin a line");
  assert(
    source.indexOf(PRIVATE_CATALOG_MARKER, markerIndex + PRIVATE_CATALOG_MARKER.length) === -1,
    "Private catalogue marker is ambiguous",
  );
  const payload = source.slice(markerIndex + PRIVATE_CATALOG_MARKER.length).trim();
  assert(payload.endsWith(";"), "Private catalogue export must end with a semicolon");
  return JSON.parse(payload.slice(0, -1));
}

function validateSourceReceipt(receipt, sourceBytes, privateCatalog) {
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  const receiptDigests = [
    receipt?.baseline_catalog_sha256,
    receipt?.accepted_catalog_sha256,
    receipt?.output_catalog_sha256,
  ];
  assert(receipt?.schema_version === "aperitivi-publication-catalog-overlay-v1", "Overlay receipt schema changed");
  assert(receiptDigests.every((value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)), "Overlay receipt digests are invalid");
  assert(receipt.output_catalog_sha256 === sourceDigest, "Overlay receipt does not bind the private catalogue bytes");
  assert(receipt.accepted_release_id === privateCatalog.release?.releaseId, "Overlay receipt release binding changed");

  const checks = [
    [receipt.preserved_posts, 573, "preserved posts"],
    [receipt.preserved_venues, 327, "preserved venues"],
    [receipt.preserved_mapped_venues, 232, "preserved mapped venues"],
    [receipt.added_posts, 15, "added posts"],
    [receipt.added_venue_groups, 7, "added venue groups"],
    [receipt.complete_posts, 588, "complete posts"],
    [receipt.excluded_records, 27, "excluded records"],
    [receipt.venues, 334, "venues"],
    [receipt.mapped_venues, 232, "mapped venues"],
    [receipt.media_routes, 2366, "media routes"],
    [receipt.raw_media_bytes, 2_164_402_273, "raw media bytes"],
  ];
  for (const [actual, expected, label] of checks) {
    assert(actual === expected, `Overlay receipt ${label}: expected ${expected}, got ${actual}`);
  }

  const evidence = receipt.evidence_checks;
  assert(evidence?.self_contained_typescript_module === true, "Self-contained catalogue module is unproven");
  assert(evidence?.common_canonical_urls_equal === true, "Canonical URL preservation is unproven");
  assert(evidence?.common_published_times_equal === true, "Published-time preservation is unproven");
  assert(evidence?.common_captions_equal === true, "Caption preservation is unproven");
  assert(evidence?.common_comment_trees_equal === true, "Comment-tree preservation is unproven");
  assert(evidence?.common_media_digests_and_sizes_equal === true, "Media preservation is unproven");
  assert(evidence?.added_records_from_accepted_release_only === true, "Added-record provenance is unproven");
  assert(evidence?.coordinates_applied_to_new_venue_identities === false, "New venue groups must remain unmapped");
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
  throw new Error("Usage: --source <private catalog.ts> [--receipt <paired receipt.json>] --output <public catalog.json>");
}

const resolvedSourcePath = resolve(sourcePath);
const resolvedReceiptPath = resolve(
  argument("--receipt") || resolve(dirname(resolvedSourcePath), "publication-catalog-overlay-receipt.json"),
);
const resolvedOutputPath = resolve(outputPath);
assert(resolvedOutputPath !== resolvedSourcePath && resolvedOutputPath !== resolvedReceiptPath, "Public output must not overwrite a private input");
const [sourceStat, receiptStat] = await Promise.all([
  lstat(resolvedSourcePath),
  lstat(resolvedReceiptPath),
]);
assert(sourceStat.isFile() && !sourceStat.isSymbolicLink(), "Private catalogue source must be a direct regular file");
assert(receiptStat.isFile() && !receiptStat.isSymbolicLink(), "Paired overlay receipt must be a direct regular file");
const [sourceBytes, receiptSource] = await Promise.all([
  readFile(resolvedSourcePath),
  readFile(resolvedReceiptPath, "utf8"),
]);
const privateCatalog = parsePrivateCatalog(sourceBytes.toString("utf8"));
const sourceReceipt = JSON.parse(receiptSource);
validateSourceReceipt(sourceReceipt, sourceBytes, privateCatalog);
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
  [publicCatalog.venues.length, 334, "venues"],
  [publicCatalog.venues.filter((venue) => venue.coordinateStatus === "valid").length, 232, "valid-coordinate venues"],
  [publicCatalog.venues.filter((venue) => venue.resolutionStatus === "resolved").length, 259, "resolved venues"],
  [publicCatalog.venues.filter((venue) => venue.resolutionStatus === "candidate").length, 31, "candidate venues"],
  [publicCatalog.venues.filter((venue) => venue.resolutionStatus === "unresolved").length, 44, "unresolved venues"],
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

await writeFile(resolvedOutputPath, `${JSON.stringify(publicCatalog)}\n`, "utf8");
console.log(`Wrote ${publicCatalog.venues.length} venues, ${publicCatalog.posts.length} posts, and ${mediaCount} media routes.`);
