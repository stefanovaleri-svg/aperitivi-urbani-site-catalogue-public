import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sanitizerPath = join(repoRoot, "scripts", "sanitize-catalog.mjs");
const releaseId = "accepted-release-fixture";

function receiptFor(source, overrides = {}) {
  return {
    schema_version: "aperitivi-publication-catalog-overlay-v1",
    accepted_release_id: releaseId,
    baseline_catalog_sha256: "a".repeat(64),
    accepted_catalog_sha256: "b".repeat(64),
    output_catalog_sha256: createHash("sha256").update(source).digest("hex"),
    preserved_posts: 573,
    preserved_venues: 327,
    preserved_mapped_venues: 232,
    added_posts: 15,
    added_venue_groups: 7,
    complete_posts: 588,
    excluded_records: 27,
    venues: 334,
    mapped_venues: 232,
    media_routes: 2366,
    raw_media_bytes: 2_164_402_273,
    evidence_checks: {
      self_contained_typescript_module: true,
      common_canonical_urls_equal: true,
      common_published_times_equal: true,
      common_captions_equal: true,
      common_comment_trees_equal: true,
      common_media_digests_and_sizes_equal: true,
      added_records_from_accepted_release_only: true,
      coordinates_applied_to_new_venue_identities: false,
    },
    ...overrides,
  };
}

test("fails closed when private catalogue provenance is not exact", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "aperitivi-catalogue-gate-"));
  try {
    const validSource = `export const catalogSeed: CatalogSeed = {"release":{"releaseId":"${releaseId}"}};\n`;
    const malformedSource = `+${validSource}`;
    const scenarios = [
      {
        name: "source hash mismatch",
        source: validSource,
        receipt: receiptFor(validSource, { output_catalog_sha256: "0".repeat(64) }),
        error: /does not bind the private catalogue bytes/u,
      },
      {
        name: "release mismatch",
        source: validSource,
        receipt: receiptFor(validSource, { accepted_release_id: "different-release" }),
        error: /release binding changed/u,
      },
      {
        name: "missing self-contained evidence",
        source: validSource,
        receipt: receiptFor(validSource, {
          evidence_checks: {
            ...receiptFor(validSource).evidence_checks,
            self_contained_typescript_module: false,
          },
        }),
        error: /Self-contained catalogue module is unproven/u,
      },
      {
        name: "failed preservation evidence",
        source: validSource,
        receipt: receiptFor(validSource, {
          evidence_checks: {
            ...receiptFor(validSource).evidence_checks,
            common_media_digests_and_sizes_equal: false,
          },
        }),
        error: /Media preservation is unproven/u,
      },
      {
        name: "malformed plus export",
        source: malformedSource,
        receipt: receiptFor(malformedSource),
        error: /marker must begin a line/u,
      },
    ];

    for (const [index, scenario] of scenarios.entries()) {
      const sourcePath = join(tempDirectory, `source-${index}.ts`);
      const receiptPath = join(tempDirectory, `receipt-${index}.json`);
      const outputPath = join(tempDirectory, `output-${index}.json`);
      await Promise.all([
        writeFile(sourcePath, scenario.source, "utf8"),
        writeFile(receiptPath, `${JSON.stringify(scenario.receipt)}\n`, "utf8"),
      ]);

      const result = spawnSync(
        process.execPath,
        [sanitizerPath, "--source", sourcePath, "--receipt", receiptPath, "--output", outputPath],
        { cwd: repoRoot, encoding: "utf8" },
      );
      assert.notEqual(result.status, 0, `${scenario.name} was accepted`);
      assert.match(`${result.stdout}\n${result.stderr}`, scenario.error, scenario.name);
      await assert.rejects(lstat(outputPath), (error) => error?.code === "ENOENT", `${scenario.name} wrote output`);
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
