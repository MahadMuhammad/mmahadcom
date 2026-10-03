import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const advisory = "https://github.com/advisories/GHSA-ch52-4w7c-c8xp";
export const expires = Date.parse("2026-10-11T00:00:00Z");
export const reviewedVersions = Object.freeze([
  "1.0.0",
  "2.0.0",
  "3.0.0",
  "3.1.0",
  "3.2.0",
  "3.3.0",
  "3.3.1",
  "3.3.2",
  "3.3.3",
  "3.4.0",
  "3.5.0",
  "3.5.1",
  "3.6.0",
  "3.6.1",
  "3.7.0",
  "3.7.1",
  "3.7.3",
  "3.8.0",
  "3.8.1",
  "4.0.0",
  "4.0.1",
  "4.0.2",
  "4.0.3",
  "4.0.4",
  "4.1.0",
  "4.1.1",
  "4.2.0-beta.1",
  "4.2.0-beta.2",
  "4.2.0",
]);
export const ignoredRootEntries = Object.freeze([".git", "node_modules", ".astro", "dist", "test-results"]);
const sourceDirectories = [".github", "design", "previews", "public", "scripts", "src"];
const severities = ["info", "low", "moderate", "high", "critical"];
const packages = {
  "@astrojs/mdx": { version: "8.0.0", direct: true, via: "astro", effects: [] },
  astro: { version: "7.3.1", direct: true, via: "http-cache-semantics", effects: ["@astrojs/mdx"] },
  "http-cache-semantics": { version: "4.2.0", direct: false, effects: ["astro"] },
};
const guardFiles = new Set(["scripts/audit-dependencies.mjs", "scripts/check-static-output.mjs", "scripts/security-checks.test.mjs"]);
const expectedInputs = "a63582da9587046b6d9728302708857a42b9b06d9647aa8603161df745a59485";
const expectedRemoteModule = "f373fa76e3112446db327c79b34e2bbb1ef1dcad41affb60788adf30edc9588e";

export function evaluateAudit(report, exitCode, { now = Date.now(), latest, versions } = {}) {
  assert.equal(report?.auditReportVersion, 2, "Unsupported or malformed npm audit report.");
  assert.ok(!report.error && report.vulnerabilities && report.metadata?.vulnerabilities, "The dependency audit failed.");
  assert.ok(typeof report.vulnerabilities === "object" && !Array.isArray(report.vulnerabilities), "Malformed audit findings map.");
  const entries = Object.entries(report.vulnerabilities);
  const counts = report.metadata.vulnerabilities;
  assert.equal(counts.total, entries.length, "Audit findings and totals disagree.");
  for (const severity of severities) {
    assert.equal(counts[severity], entries.filter(([, entry]) => entry.severity === severity).length, "Audit severity totals disagree.");
  }
  assert.equal(
    severities.reduce((total, severity) => total + counts[severity], 0),
    counts.total,
    "Unknown audit severity."
  );
  if (entries.length === 0) {
    assert.equal(exitCode, 0, "Audit command failed despite an empty report.");
    return "clean";
  }
  assert.equal(exitCode, 1, "Unexpected audit command exit status.");
  assert.deepEqual(Object.keys(report.vulnerabilities).sort(), Object.keys(packages).sort(), "Unexpected vulnerable package; no exception applies.");
  for (const [name, expected] of Object.entries(packages)) {
    const entry = report.vulnerabilities[name];
    assert.equal(entry.name, name);
    assert.equal(entry.severity, "high");
    assert.equal(entry.isDirect, expected.direct);
    assert.deepEqual(entry.nodes, [`node_modules/${name}`], "Dependency path changed; re-review required.");
    assert.deepEqual(entry.effects, expected.effects, "Affected dependency graph changed.");
    if (expected.via) assert.deepEqual(entry.via, [expected.via], "Another advisory affects this package.");
    else {
      assert.equal(entry.via.length, 1, "Another advisory affects the cache dependency.");
      assert.equal(entry.via[0].url, advisory, "This advisory has no exception.");
      assert.equal(entry.via[0].name, name);
      assert.equal(entry.via[0].dependency, name);
      assert.equal(entry.via[0].severity, "high");
      assert.equal(entry.via[0].range, "<=4.2.0", "The advisory scope changed.");
    }
  }
  assert.ok(Number.isFinite(now) && now < expires, "The temporary advisory exception has expired.");
  assert.equal(latest, "4.2.0", "A new cache release is available or registry lookup failed; review and update dependencies.");
  assert.deepEqual(versions, reviewedVersions, "The upstream release inventory changed or could not be checked; review available fixes.");
  return "exception";
}

export async function assertReviewedInputs(root) {
  assert.ok(!(await readdir(root)).some((name) => /^\.env(?:\.|$)/.test(name)), "Environment files are outside the reviewed build scope.");
  const inputs = {};
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "Build input symlinks are outside the reviewed scope.");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        if (!guardFiles.has(relative))
          inputs[relative] = createHash("sha256")
            .update(await readFile(absolute))
            .digest("hex");
      }
    }
  }
  for (const directory of sourceDirectories) await visit(path.join(root, directory));
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (ignoredRootEntries.includes(entry.name) || sourceDirectories.includes(entry.name)) continue;
    assert.ok(entry.isFile() && !entry.isSymbolicLink(), "Build inputs changed: unexpected root code or configuration directory.");
    inputs[entry.name] = createHash("sha256")
      .update(await readFile(path.join(root, entry.name)))
      .digest("hex");
  }
  const ordered = Object.fromEntries(
    Object.keys(inputs)
      .sort()
      .map((name) => [name, inputs[name]])
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(ordered)).digest("hex"),
    expectedInputs,
    "Build inputs changed; the temporary exception requires a new review."
  );
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
  for (const [name, expected] of Object.entries(packages)) {
    const installed = JSON.parse(await readFile(path.join(root, "node_modules", name, "package.json"), "utf8"));
    assert.equal(lock.packages[`node_modules/${name}`].version, expected.version);
    assert.equal(installed.version, expected.version, "Installed dependency differs from the reviewed version.");
  }
  const remote = await readFile(path.join(root, "node_modules/astro/dist/assets/build/remote.js"));
  assert.equal(createHash("sha256").update(remote).digest("hex"), expectedRemoteModule, "Astro's cache consumer changed.");
}

function npm(args, root) {
  const result = spawnSync("npm", args, { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  assert.ok(!result.error && !result.signal && Number.isInteger(result.status), "npm audit or registry lookup could not complete.");
  return result;
}

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = npm(
    [
      "audit",
      "--json",
      "--ignore-scripts",
      "--include=dev",
      "--include=optional",
      "--include=peer",
      "--registry=https://registry.npmjs.org",
      "--offline=false",
    ],
    root
  );
  // Retain the complete findings, including the exception, in the CI log.
  console.log(result.stdout);
  const report = JSON.parse(result.stdout);
  let latest;
  let versions;
  if (Object.keys(report.vulnerabilities ?? {}).length > 0) {
    const registry = npm(
      [
        "view",
        "http-cache-semantics",
        "dist-tags.latest",
        "versions",
        "--json",
        "--ignore-scripts",
        "--registry=https://registry.npmjs.org",
        "--prefer-online",
        "--offline=false",
      ],
      root
    );
    assert.equal(registry.status, 0, "Unable to check whether an upstream release is available.");
    const inventory = JSON.parse(registry.stdout);
    latest = inventory["dist-tags.latest"];
    versions = inventory.versions;
  }
  const status = evaluateAudit(report, result.status, { latest, versions });
  if (status === "exception") {
    await assertReviewedInputs(root);
    console.warn(
      `::warning title=Temporary dependency exception::${advisory} remains unresolved. Accepted only for the reviewed static build until 2026-10-11 00:00 UTC. All other findings fail.`
    );
  } else console.log("Dependency audit passed without an exception.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
