import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = JSON.parse(await readFile(new URL("../src/data/catalog.json", import.meta.url), "utf8"));
const serialized = JSON.stringify(data);

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      keys.push(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

test("publishes the exact complete-record projection", () => {
  assert.equal(data.schemaVersion, "aperitivi-public-catalog-v1");
  assert.equal(data.coverage.expectedPosts, 615);
  assert.equal(data.coverage.attemptedPosts, 615);
  assert.equal(data.coverage.completePosts, 573);
  assert.equal(data.coverage.excludedIncompleteRecords, 42);
  assert.equal(data.venues.length, 327);
  assert.equal(data.posts.length, 573);
  assert.equal(data.listings.length, 573);
  assert.equal(data.posts.reduce((sum, post) => sum + post.media.length, 0), 2307);
  assert.equal(data.venues.filter((venue) => venue.coordinateStatus === "valid").length, 232);
  const postIds = new Set(data.posts.map((post) => post.id));
  const venueIds = new Set(data.venues.map((venue) => venue.id));
  assert.equal(data.listings.every((listing) => postIds.has(listing.postId)), true);
  assert.equal(data.listings.every((listing) => venueIds.has(listing.venueId)), true);
  assert.equal(data.listings.every((listing) => /^https:\/\/www\.instagram\.com\/(?:p|reel)\//.test(listing.sourceUrl)), true);
});

test("contains every approved route but no private evidence fields", () => {
  const routes = new Set();
  const postDirectories = new Set();
  let jpegCount = 0;
  let mp4Count = 0;
  for (const post of data.posts) {
    const shortcodeMatch = post.sourceUrl.match(/^https:\/\/www\.instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)\/$/u);
    assert.ok(shortcodeMatch);
    const postDirectory = shortcodeMatch[1];
    assert.equal(postDirectories.has(postDirectory), false);
    postDirectories.add(postDirectory);
    assert.ok(post.media.length > 0);
    for (const media of post.media) {
      assert.match(media.publicPath, /^\/media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/);
      assert.doesNotMatch(media.publicPath, /\.\.|\\/u);
      assert.equal(media.publicPath.split("/")[2], postDirectory);
      assert.equal(routes.has(media.publicPath), false);
      routes.add(media.publicPath);
      if (media.mediaType === "IMAGE") {
        assert.equal(media.contentType, "image/jpeg");
        assert.match(media.publicPath, /\.jpe?g$/iu);
        jpegCount += 1;
      } else {
        assert.equal(media.mediaType, "VIDEO");
        assert.equal(media.contentType, "video/mp4");
        assert.match(media.publicPath, /\.mp4$/iu);
        mp4Count += 1;
      }
    }
  }
  assert.equal(postDirectories.size, 573);
  assert.equal(routes.size, 2307);
  assert.equal(jpegCount, 2069);
  assert.equal(mp4Count, 238);
  const keys = collectKeys(data).join("\n");
  for (const forbiddenKey of [
    /comment/i,
    /author_ref/i,
    /parent_comment/i,
    /archive/i,
    /sha256/i,
    /localpath/i,
    /rootmanifest/i,
    /campaignmanifest/i,
  ]) {
    assert.doesNotMatch(keys, forbiddenKey);
  }
  for (const forbiddenValue of [
    /onedrive/i,
    /[A-Z]:\\/,
  ]) {
    assert.doesNotMatch(serialized, forbiddenValue);
  }
});

test("records publication scope without licensing the source code", async () => {
  const authorization = JSON.parse(await readFile(new URL("../publication-authorization.json", import.meta.url), "utf8"));
  assert.equal(authorization.status, "authorized");
  assert.equal(authorization.complete_posts, 573);
  assert.equal(authorization.media_count, 2307);
  assert.equal(authorization.excluded_incomplete_records, 42);
});
