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
});

test("contains every approved route but no private evidence fields", () => {
  for (const post of data.posts) {
    for (const media of post.media) {
      assert.match(media.publicPath, /^\/media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/);
    }
  }
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
